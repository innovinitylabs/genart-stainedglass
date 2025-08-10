/*
  Stained Glass 3D (three.js)
  - Orthographic camera rendering a panel of extruded glass cells and lead came
  - MeshPhysicalMaterial for realistic glass (transmission)
  - Deterministic via seed (?seed=..., ?cells=..., ?w=..., ?h=...)
*/

import * as THREE from 'https://unpkg.com/three@0.161.0?module';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js?module';
import { RoomEnvironment } from 'https://unpkg.com/three@0.161.0/examples/jsm/environments/RoomEnvironment.js?module';
import { RectAreaLightUniformsLib } from 'https://unpkg.com/three@0.161.0/examples/jsm/lights/RectAreaLightUniformsLib.js?module';

let seed = 1;
let renderer, scene, camera, controls;
let panelGroup;

function params() {
  const q = new URLSearchParams(location.search);
  const w = parseInt(q.get('w') || 1200, 10);
  const h = parseInt(q.get('h') || 1600, 10);
  seed = parseInt(q.get('seed') || (Date.now() % 1e9), 10);
  const cells = parseInt(q.get('cells') || 140, 10);
  return { w, h, cells };
}

// Minimal deterministic RNG
function reseed(s) { seed = s; }
function rand() { // mulberry32
  let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function rrange(a, b) { return a + (b - a) * rand(); }

function init() {
  const { w, h } = params();
  const app = document.getElementById('app');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.physicallyCorrectLights = true;
  renderer.setClearColor(0xece9e3, 1);
  app.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new RoomEnvironment();
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;

  const aspect = h / w;
  const orthoSize = 1.0;
  camera = new THREE.OrthographicCamera(-orthoSize, orthoSize, orthoSize * aspect, -orthoSize * aspect, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.enableZoom = false;

  RectAreaLightUniformsLib.init();
  generatePanel();

  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'n' || e.key === 'N') { reseed(Math.floor(rrange(0, 1e9))); regenerate(); }
    if (e.key === 's' || e.key === 'S') { save(); }
  });
  document.getElementById('seedLabel').textContent = String(seed);
  animate();
}

function onResize() { /* static canvas size based on URL; omit dynamic */ }

function save() { renderer.domElement.toBlob((b)=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`stained-glass-3d-${seed}.png`; a.click(); }); }

function regenerate() {
  if (panelGroup) scene.remove(panelGroup);
  generatePanel();
  renderer.render(scene, camera);
}

function generatePanel() {
  const { cells } = params();
  panelGroup = new THREE.Group();
  scene.add(panelGroup);

  // Panel dimensions in world units
  const W = 1.6, H = 2.2, Z = 0.05;

  // Generate jittered seeds
  const cols = Math.max(3, Math.round(Math.sqrt(cells / (H / W))));
  const rows = Math.max(3, Math.round(cols * (H / W)));
  const gw = W / cols, gh = H / rows;
  const seeds = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = -W/2 + (i + 0.5) * gw + rrange(-gw*0.35, gw*0.35);
      const y = -H/2 + (j + 0.5) * gh + rrange(-gh*0.35, gh*0.35);
      seeds.push([x, y]);
    }
  }
  // Build polygons via simple Lloyd-like relaxation (few steps) for nicer shapes
  // Minimal: use Delaunay/Voronoi ersatz by splitting grid — we’ll approximate cells as quads/triangles around seeds
  // For realism without heavy deps, create random convex polygons per seed
  const cellsPolys = makeSimplePolys(seeds, gw, gh);

  // Materials
  const leadMatBase = new THREE.MeshStandardMaterial({ color: 0x222a2e, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.8 });
  const leadMatTop = new THREE.MeshStandardMaterial({ color: 0x12181b, roughness: 0.5, metalness: 0.15, envMapIntensity: 1.0 });

  // Backboard to catch transmitted light
  const backMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ec, roughness: 0.9, metalness: 0.0 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.2, H + 0.2), backMat);
  back.position.z = -0.2;
  panelGroup.add(back);

  // Build lead network first (extruded thin strips)
  for (const e of edgesFromPolys(cellsPolys)) {
    const strip = makeLeadStrip(e.a, e.b, 0.018, Z);
    const mesh = new THREE.Mesh(strip, leadMatBase);
    panelGroup.add(mesh);
    // thin highlight cap
    const cap = makeLeadStrip(e.a, e.b, 0.008, Z + 0.004);
    const capMesh = new THREE.Mesh(cap, leadMatTop);
    capMesh.position.z += 0.002;
    panelGroup.add(capMesh);
  }

  // Glass materials palette
  const pal = (window.PALETTES?.[0]?.inks) || [ '#68a7d8', '#2b7aa7', '#e9c675', '#e36a6a', '#8dc5b0' ];

  // Build shapes and glass slabs
  for (const poly of cellsPolys) {
    const shape = new THREE.Shape();
    shape.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i][0], poly[i][1]);
    shape.closePath();

    const extrude = new THREE.ExtrudeGeometry(shape, { depth: Z, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 });

    // Glass material per cell
    const hex = pal[Math.floor(rrange(0, pal.length))];
    const col = new THREE.Color(hex);
    const glass = new THREE.MeshPhysicalMaterial({
      color: col,
      roughness: rrange(0.15, 0.45),
      metalness: 0.0,
      transmission: 1.0,
      ior: rrange(1.48, 1.55),
      thickness: rrange(0.01, 0.06),
      reflectivity: 0.5,
      envMapIntensity: 1.0,
      clearcoat: 0.3,
      clearcoatRoughness: 0.25,
      attenuationColor: col,
      attenuationDistance: rrange(0.3, 1.2)
    });

    const mesh = new THREE.Mesh(extrude, glass);
    mesh.position.z -= Z/2; // center around 0
    panelGroup.add(mesh);
  }

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.5);
  scene.add(hemi);
  const area1 = new THREE.RectAreaLight(0xffffff, 3.0, 2.5, 2.5);
  area1.position.set(0.8, 0.9, 1.0);
  panelGroup.add(area1);
  const area2 = new THREE.RectAreaLight(0xfff3d0, 2.2, 3.0, 3.0);
  area2.position.set(-1.0, -0.8, 0.8);
  panelGroup.add(area2);

  // Debug: always add a visible test cube so we confirm rendering
  const test = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.4 }));
  test.position.set(0, 0, 0.05);
  panelGroup.add(test);
}

function makeSimplePolys(seeds, gw, gh) {
  // Create a small convex polygon around each seed using a few radial points
  const polys = [];
  for (const [x, y] of seeds) {
    const n = 4 + Math.floor(rrange(0, 4));
    const pts = [];
    const rBase = Math.min(gw, gh) * rrange(0.45, 0.70);
    const rot = rrange(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const ang = rot + (i / n) * Math.PI * 2 + rrange(-0.15, 0.15);
      const r = rBase * rrange(0.8, 1.2);
      pts.push([ x + Math.cos(ang) * r, y + Math.sin(ang) * r ]);
    }
    polys.push(pts);
  }
  return polys;
}

function edgesFromPolys(polys) {
  // Collect unique edges from polygons
  const key = (a,b)=> `${a[0].toFixed(3)},${a[1].toFixed(3)}_${b[0].toFixed(3)},${b[1].toFixed(3)}`;
  const seen = new Set();
  const edges = [];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i+1)%poly.length];
      const k1 = key(a,b), k2 = key(b,a);
      if (!seen.has(k1) && !seen.has(k2)) { seen.add(k1); edges.push({ a, b }); }
    }
  }
  return edges;
}

function makeLeadStrip(a, b, width, height) {
  const dir = new THREE.Vector2(b[0]-a[0], b[1]-a[1]);
  const len = dir.length();
  const geom = new THREE.BoxGeometry(len, width, height);
  const meshGeom = new THREE.BufferGeometry().copy(geom);
  // position + rotate into place using a temp mesh
  const m = new THREE.Matrix4();
  const angle = Math.atan2(dir.y, dir.x);
  m.makeRotationZ(angle);
  m.setPosition((a[0]+b[0])/2, (a[1]+b[1])/2, 0);
  meshGeom.applyMatrix4(m);
  return meshGeom;
}

function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// bootstrap
(function main(){ const { seed: s } = { seed }; reseed(s); init(); })();


