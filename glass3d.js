/*
  Stained Glass 3D (three.js)
  - Orthographic camera rendering a panel of extruded glass cells and lead came
  - MeshPhysicalMaterial for realistic glass (transmission)
  - Deterministic via seed (?seed=..., ?cells=..., ?w=..., ?h=...)
*/

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Delaunay } from 'd3-delaunay';

let seed = 1;
let renderer, scene, camera, controls;
let panelGroup;
let cellsParam = 140;

function params() {
  const q = new URLSearchParams(location.search);
  const w = parseInt(q.get('w') || 1200, 10);
  const h = parseInt(q.get('h') || 1600, 10);
  seed = parseInt(q.get('seed') || (Date.now() % 1e9), 10);
  cellsParam = parseInt(q.get('cells') || 140, 10);
  return { w, h };
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
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
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
    if (e.key === 'n' || e.key === 'N') { newSeed(); }
    if (e.key === 's' || e.key === 'S') { save(); }
  });
  document.getElementById('newBtn')?.addEventListener('click', newSeed);
  document.getElementById('saveBtn')?.addEventListener('click', save);
  document.getElementById('seedLabel').textContent = String(seed);
  animate();
}

function newSeed(){ reseed(Math.floor(rrange(0, 1e9))); regenerate(); document.getElementById('seedLabel').textContent = String(seed); }

function onResize() { /* static canvas size based on URL; omit dynamic */ }

function save() { renderer.domElement.toBlob((b)=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`stained-glass-3d-${seed}.png`; a.click(); }); }

function regenerate() {
  if (panelGroup) scene.remove(panelGroup);
  generatePanel();
  renderer.render(scene, camera);
}

function generatePanel() {
  const cells = cellsParam;
  panelGroup = new THREE.Group();
  scene.add(panelGroup);

  // Panel dimensions in world units
  const W = 1.6, H = 2.2, Z = 0.05;

  // Generate jittered seeds and compute Voronoi for authentic tessellation
  const aspect = H / W;
  const cols = Math.max(3, Math.round(Math.sqrt(cells / aspect)));
  const rows = Math.max(3, Math.round(cols * aspect));
  const gw = W / cols, gh = H / rows;
  const seeds = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = -W/2 + (i + 0.5) * gw + rrange(-gw*0.35, gw*0.35);
      const y = -H/2 + (j + 0.5) * gh + rrange(-gh*0.35, gh*0.35);
      seeds.push([x, y]);
    }
  }
  const del = Delaunay.from(seeds);
  const vor = del.voronoi([-W/2, -H/2, W/2, H/2]);
  const cellsPolys = [];
  for (let i = 0; i < seeds.length; i++) {
    const poly = vor.cellPolygon(i);
    if (poly && poly.length >= 3) cellsPolys.push(poly);
  }

  // Materials
  const leadMatBase = new THREE.MeshStandardMaterial({ color: 0x2a3438, roughness: 0.7, metalness: 0.05, envMapIntensity: 0.6 });
  const leadMatTop = new THREE.MeshStandardMaterial({ color: 0x161c1f, roughness: 0.5, metalness: 0.1, envMapIntensity: 0.9 });

  // Backboard to catch transmitted light
  const backMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ec, roughness: 0.9, metalness: 0.0 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.2, H + 0.2), backMat);
  back.position.z = -0.2;
  panelGroup.add(back);

  // Build lead network first (extruded thin strips)
  const leadEdges = edgesFromPolys(cellsPolys);
  for (const e of leadEdges) {
    const strip = makeLeadStrip(e.a, e.b, 0.026, Z + 0.01);
    const mesh = new THREE.Mesh(strip, leadMatBase);
    mesh.position.z += 0.02;
    panelGroup.add(mesh);
    // thin highlight cap
    const cap = makeLeadStrip(e.a, e.b, 0.010, Z + 0.014);
    const capMesh = new THREE.Mesh(cap, leadMatTop);
    capMesh.position.z += 0.028;
    panelGroup.add(capMesh);
  }

  // Glass materials palette
  const pal = (window.PALETTES?.[0]?.inks) || [ '#5aa3c7', '#6bb0dd', '#2b7aa7', '#e9c675', '#e36a6a', '#8dc5b0' ];

  // Build shapes and glass slabs inset from the lead for visible borders
  const insetFactor = 0.94;
  for (const poly of cellsPolys) {
    const shrunk = shrinkPolygon(poly, insetFactor);
    const shape = new THREE.Shape();
    shape.moveTo(shrunk[0][0], shrunk[0][1]);
    for (let i = 1; i < shrunk.length; i++) shape.lineTo(shrunk[i][0], shrunk[i][1]);
    shape.closePath();

    const extrude = new THREE.ExtrudeGeometry(shape, { depth: Z, bevelEnabled: true, bevelSize: 0.0025, bevelThickness: 0.004, bevelSegments: 2 });

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
      attenuationDistance: rrange(0.4, 1.0),
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(extrude, glass);
    mesh.position.z -= Z/2 - 0.01;
    panelGroup.add(mesh);
  }

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.6);
  scene.add(hemi);
  const area1 = new THREE.RectAreaLight(0xffffff, 3.0, 2.5, 2.5);
  area1.position.set(0.8, 0.9, 1.0);
  panelGroup.add(area1);
  const area2 = new THREE.RectAreaLight(0xfff3d0, 2.2, 3.0, 3.0);
  area2.position.set(-1.0, -0.8, 0.8);
  panelGroup.add(area2);
  const backLight = new THREE.RectAreaLight(0xffffff, 4.0, 3.0, 3.0);
  backLight.position.set(0, 0, -0.5);
  backLight.lookAt(0, 0, 0);
  panelGroup.add(backLight);

  // Debug: always add a visible test cube so we confirm rendering
  // remove debug cube now that we render
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

function shrinkPolygon(poly, factor){
  let cx = 0, cy = 0; for(const [x,y] of poly){ cx+=x; cy+=y; } cx/=poly.length; cy/=poly.length;
  const out = []; for(const [x,y] of poly){ out.push([ cx + (x-cx)*factor, cy + (y-cy)*factor ]); }
  return out;
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


