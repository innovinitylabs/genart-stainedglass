// 2D stained-glass with triangular lead network over soft polygonal cells
let seed = 1;
let paperG;
let palette;

function params(){
  const q = new URLSearchParams(location.search);
  const w = int(q.get('w') || 1200);
  const h = int(q.get('h') || 1600);
  seed = int(q.get('seed') || (Date.now() % 1e9));
  const pts = int(q.get('pts') || 220);
  return { w, h, pts };
}

function reseed(s){ seed = s; randomSeed(seed); noiseSeed(seed); document.getElementById('seedLabel').textContent = String(seed); }

function setup(){
  const { w, h } = params();
  const cnv = createCanvas(w, h);
  cnv.parent(document.querySelector('.wrap'));
  pixelDensity(2);
  palette = pickPalette(seed);
  reseed(seed);
  paperG = createGraphics(w, h);
  drawPaperTexture(paperG, palette.background || '#efece6');
  noLoop();
}

function keyTyped(){ if (key==='n'||key==='N'){ reseed(int(random(1e9))); redraw(); } if (key==='s'||key==='S'){ saveCanvas('tri-'+seed,'png'); } }

function draw(){
  background(palette.background || '#efece6');
  image(paperG, 0, 0);
  const margin = min(width, height) * 0.06;
  const frame = { x0: margin, y0: margin, x1: width - margin, y1: height - margin };
  drawCells(frame);
  drawTriNetwork(frame);
}

function drawCells(frame){
  const { pts } = params();
  const seeds = jitteredGridPoints(frame, pts);
  const delaunay = d3.Delaunay.from(seeds);
  const vor = delaunay.voronoi([frame.x0, frame.y0, frame.x1, frame.y1]);
  const colors = [ '#e87c8b', '#c2e5d7', '#f4efe7', '#79b7b0' ];
  for (let i = 0; i < seeds.length; i++){
    const poly = vor.cellPolygon(i);
    if (!poly || poly.length < 3) continue;
    const c = color(colors[i % colors.length]);
    fillGlassPolygon(poly, c);
  }
}

function drawTriNetwork(frame){
  // Build a triangulation on top of the same seeds, then draw thick beveled lead strokes
  const { pts } = params();
  const seeds = jitteredGridPoints(frame, pts, true);
  const tri = d3.Delaunay.from(seeds).triangles;
  // collect unique edges
  const edges = new Set();
  for (let i = 0; i < tri.length; i += 3){
    const a = tri[i], b = tri[i+1], c = tri[i+2];
    addEdge(edges, seeds, a, b); addEdge(edges, seeds, b, c); addEdge(edges, seeds, c, a);
  }
  // lead shadow
  stroke(30, 70);
  strokeWeight(10);
  for (const e of edges){ const [p,q] = e; line(p[0]+4, p[1]+4, q[0]+4, q[1]+4); }
  // core lead
  stroke(20);
  strokeWeight(7);
  for (const e of edges){ const [p,q] = e; line(p[0], p[1], q[0], q[1]); }
  // central highlight
  stroke(255, 220);
  strokeWeight(3);
  for (const e of edges){ const [p,q] = e; line(p[0]-1, p[1]-1, q[0]-1, q[1]-1); }
}

function addEdge(set, pts, i, j){
  const a = pts[i], b = pts[j];
  const key = a[0] < b[0] || (a[0]===b[0] && a[1]<=b[1]) ? `${a[0]}_${a[1]}_${b[0]}_${b[1]}` : `${b[0]}_${b[1]}_${a[0]}_${a[1]}`;
  if (!set.has(key)) set.add(key);
}

function jitteredGridPoints(frame, count, sameSeed=false){
  const aspect = (frame.y1 - frame.y0) / (frame.x1 - frame.x0);
  const cols = max(6, round(sqrt(count / aspect)));
  const rows = max(6, round(cols * aspect));
  const gw = (frame.x1 - frame.x0) / cols; const gh = (frame.y1 - frame.y0) / rows;
  const pts = [];
  for (let j=0;j<rows;j++){
    for (let i=0;i<cols;i++){
      const x = frame.x0 + (i+0.5)*gw + random(-gw*0.28, gw*0.28);
      const y = frame.y0 + (j+0.5)*gh + random(-gh*0.28, gh*0.28);
      pts.push([x,y]);
    }
  }
  return pts;
}

// rendering helpers reused from earlier sketch
function drawPaperTexture(g, bg){
  g.noiseSeed(seed); g.background(bg); g.noStroke(); const nScale=0.003;
  for (let y=0;y<g.height;y+=2){ for(let x=0;x<g.width;x+=2){ const n=g.noise(x*nScale,y*nScale); const v=245+10*(n-0.5); g.fill(v, v, v, 25); g.rect(x,y,2,2); }}
  g.noFill(); for (let i=0;i<28;i++){ g.stroke(0, 12 - i*0.3); g.rect(2+i,2+i,g.width-4-2*i,g.height-4-2*i); }
}

function fillGlassPolygon(poly, baseC){
  const ctx = drawingContext; ctx.save();
  ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]); for(let k=1;k<poly.length;k++) ctx.lineTo(poly[k][0], poly[k][1]); ctx.closePath();
  ctx.clip();
  const bb = bounds(poly); const cx=(bb.minX+bb.maxX)/2, cy=(bb.minY+bb.maxY)/2; const r=max(bb.maxX-bb.minX, bb.maxY-bb.minY);
  const base = color(baseC); const edge = color(red(base)*0.75, green(base)*0.75, blue(base)*0.75, 230); const mid = color(min(red(base)+30,255),min(green(base)+30,255),min(blue(base)+30,255),230);
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
  grad.addColorStop(0, rgba(mid, 0.95)); grad.addColorStop(0.7, rgba(base, 0.9)); grad.addColorStop(1, rgba(edge, 0.95));
  ctx.fillStyle = grad; ctx.fillRect(bb.minX, bb.minY, bb.maxX-bb.minX, bb.maxY-bb.minY);
  ctx.restore();
}

function bounds(poly){ let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9; for(const [x,y] of poly){ if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y;} return {minX,minY,maxX,maxY}; }
function rgba(c,a){ return `rgba(${red(c)},${green(c)},${blue(c)},${a})`; }


