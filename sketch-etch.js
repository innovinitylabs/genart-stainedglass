// Etched/printed cross composition inspired by reference
let seed = 1; let paperG; let palette;

function params(){ const q=new URLSearchParams(location.search); const w=int(q.get('w')||1100); const h=int(q.get('h')||1500); seed=int(q.get('seed')||(Date.now()%1e9)); return {w,h}; }
function reseed(s){ seed=s; randomSeed(s); noiseSeed(s); document.getElementById('seedLabel').textContent=String(s); }

function setup(){ const {w,h}=params(); const cnv=createCanvas(w,h); cnv.parent(document.querySelector('.wrap')); pixelDensity(2); palette=pickPalette(seed); reseed(seed); paperG=createGraphics(w,h); drawPaperTexture(paperG,palette.background||'#efece6'); noLoop(); }
function keyTyped(){ if(key==='n'||key==='N'){ reseed(int(random(1e9))); redraw(); } if(key==='s'||key==='S'){ saveCanvas('etch-'+seed,'png'); } }

function draw(){
  background(palette.background||'#efece6'); image(paperG,0,0);
  const m = width*0.06; const inner={x:m,y:m,w:width-2*m,h:height-2*m};
  push(); clipRect(inner);
  drawGround(inner);
  drawHorizon(inner);
  drawCross(inner);
  drawGarden(inner);
  drawMembranes(inner);
  drawFlowPools(inner);
  pop();
  vignette(0.09);
}

function drawGround(inner){ // horizontal watercolor washes
  const bands=10; noStroke();
  for(let i=0;i<bands;i++){ const y0=inner.y+(inner.h*i)/bands; const y1=inner.y+(inner.h*(i+1))/bands; const c=(i<4)?color(210,230,220,26):(i<6?color(255,190,160,24):color(230,238,230,20)); for(let p=0;p<5+i;p++){ const j=16; const a=y0+random(-j,j), b=y1+random(-j,j); fill(red(c),green(c),blue(c),alpha(c)); rect(inner.x,a,inner.w,b-a); }}
}

function drawCross(inner){
  const cx=inner.x+inner.w*0.505, cy=inner.y+inner.h*0.52; const vW=inner.w*0.08, vH=inner.h*0.56; const hH=inner.h*0.14;
  // center glow
  radialGlow(cx,cy,inner.w*0.13,color(255,220,140,140));
  const inks=[color('#d86578'), color('#6fa392'), color('#223332')]; const offs=[[1.2,-1.0],[-0.7,0.7],[0,0]];
  for(let k=0;k<3;k++){ const col=inks[k]; fill(red(col),green(col),blue(col),k===2?150:90); stroke(red(col),green(col),blue(col),k===2?170:80); strokeWeight(1.2); rect(cx-vW/2+offs[k][0],cy-vH/2+offs[k][1],vW,vH,4); rect(cx-inner.w*0.40+offs[k][0],cy-hH/2+offs[k][1],inner.w*0.80,hH,4); }
  // hatch density lines
  stroke(30,40); for(let y=-vH/2;y<=vH/2;y+=5){ line(cx-vW/2+2,cy+y,cx+vW/2-2,cy+y+random(-1,1)); }
  for(let x=-inner.w*0.40;x<=inner.w*0.40;x+=6){ line(cx+x,cy-hH/2+2,cx+x+random(-1,1),cy+hH/2-2); }
}

function drawGarden(inner){ // split top: left berries+stems, right fine web
  const topH = inner.h*0.40;
  const left={x:inner.x,y:inner.y,w:inner.w*0.5,h:topH};
  const right={x:inner.x+inner.w*0.5,y:inner.y,w:inner.w*0.5,h:topH};
  // left grid + stems + berries
  drawElasticGrid(left,9,6,22,true);
  // stems
  stroke(40,120); for(let i=0;i<55;i++){ const x=random(left.x,left.x+left.w), y=random(left.y,left.y+left.h); const len=random(18,48); const ang=random(-1.2,-0.2); line(x,y,x+len*cos(ang),y+len*sin(ang)); }
  clusteredBubbles(left,28,10,24,0.95);
  // right web of small membranes
  drawMembraneWeb(right,12,8,14);
}

function drawMembranes(inner){ // lower soap-film cells (right heavier)
  const r={x:inner.x,y:inner.y+inner.h*0.64,w:inner.w,h:inner.h*0.34};
  const cols=8, rows=6; stroke(40,120); noFill();
  const pts=[]; for(let j=0;j<=rows;j++){ for(let i=0;i<=cols;i++){ const u=i/cols, v=j/rows; let x=lerp(r.x,r.x+r.w,u), y=lerp(r.y,r.y+r.h,v); const nx=noise(u*2.2,v*1.3), ny=noise(u*1.6,v*2.4); const pull=34*(0.4+0.6*noise(u*1.1,v*1.1)); x+=(nx-0.5)*pull; y+=(ny-0.5)*pull; pts.push({x,y}); }}
  for(let i=0;i<=cols;i++){ beginShape(); for(let j=0;j<=rows;j++){ const p=pts[j*(cols+1)+i]; curveVertex(p.x,p.y);} endShape(); }
  for(let j=0;j<=rows;j++){ beginShape(); for(let i=0;i<=cols;i++){ const p=pts[j*(cols+1)+i]; curveVertex(p.x,p.y);} endShape(); }
}

function drawElasticGrid(r,cols,rows,pullBase,misregister=false){
  const pts=[]; for(let j=0;j<=rows;j++){ for(let i=0;i<=cols;i++){ const u=i/cols,v=j/rows; let x=lerp(r.x,r.x+r.w,u), y=lerp(r.y,r.y+r.h,v); const nx=noise(u*2.0,v*1.8), ny=noise(u*2.1,v*2.2); const pull=pullBase*(0.4+0.6*noise(u*1.3,v*1.2)); x+=(nx-0.5)*pull; y+=(ny-0.5)*pull; pts.push({x,y}); }}
  const layers = misregister ? [ {col:color('#d86578aa'),dx:1.2,dy:-0.8}, {col:color('#6fa392aa'),dx:-0.6,dy:0.6}, {col:color(40,120),dx:0,dy:0} ] : [ {col:color(40,120),dx:0,dy:0} ];
  for(const L of layers){ stroke(L.col); noFill(); for(let i=0;i<=cols;i++){ beginShape(); for(let j=0;j<=rows;j++){ const p=pts[j*(cols+1)+i]; curveVertex(p.x+L.dx,p.y+L.dy);} endShape(); } for(let j=0;j<=rows;j++){ beginShape(); for(let i=0;i<=cols;i++){ const p=pts[j*(cols+1)+i]; curveVertex(p.x+L.dx,p.y+L.dy);} endShape(); } }
}

function clusteredBubbles(rect,count,rMin,rMax,density=1){ const attempts=int(count*5); const placed=[]; for(let a=0;a<attempts && placed.length<count;a++){ const r=random(rMin,rMax)*(0.8+0.4*noise(a)); const x=random(rect.x+r,rect.x+rect.w-r); const y=random(rect.y+r,rect.y+rect.h-r); const ok=placed.every(p=>dist(p.x,p.y,x,y)>(p.r+r)*0.9); if(ok && random()<density) placed.push({x,y,r}); } const inkPink=color('#e46a7a'); const inkLight=color('#ffd1da'); const lineCol=color('#2c3a3a'); for(const b of placed){ radialGlow(b.x,b.y,b.r*1.4,inkLight,110); noFill(); stroke(red(inkPink),green(inkPink),blue(inkPink),170); strokeWeight(2.2); circle(b.x+0.8,b.y-0.6,b.r*2); stroke(red(lineCol),green(lineCol),blue(lineCol),160); strokeWeight(0.9); circle(b.x,b.y,b.r*2); }}

function drawMembraneWeb(r,cols,rows,pull){ const pts=[]; for(let j=0;j<=rows;j++){ for(let i=0;i<=cols;i++){ const u=i/cols,v=j/rows; let x=lerp(r.x,r.x+r.w,u), y=lerp(r.y,r.y+r.h,v); const nx=noise(u*2.6,v*2.0), ny=noise(u*2.2,v*2.7); const pp=pull*(0.4+0.6*noise(u*1.4,v*1.3)); x+=(nx-0.5)*pp; y+=(ny-0.5)*pp; pts.push({x,y}); }} const layers=[{col:color('#d86578aa'),dx:1.2,dy:-0.8},{col:color('#6fa392aa'),dx:-0.6,dy:0.6},{col:color(40,120),dx:0,dy:0}]; for(const L of layers){ stroke(L.col); noFill(); for(let i=0;i<=cols;i++){ beginShape(); for(let j=0;j<=rows;j++){ const p=pts[j*(cols+1)+i]; curveVertex(p.x+L.dx,p.y+L.dy);} endShape(); } for(let j=0;j<=rows;j++){ beginShape(); for(let i=0;i<=cols;i++){ const p=pts[j*(cols+1)+i]; curveVertex(p.x+L.dx,p.y+L.dy);} endShape(); } }
}

function drawHorizon(inner){ // warm band around center
  const y = inner.y + inner.h*0.50; const h = inner.h*0.18;
  noStroke(); const grad = drawingContext.createLinearGradient(0,y-h/2,0,y+h/2);
  grad.addColorStop(0,'rgba(250,220,140,0.18)'); grad.addColorStop(0.5,'rgba(255,210,120,0.32)'); grad.addColorStop(1,'rgba(230,240,220,0.16)'); drawingContext.fillStyle=grad; rect(inner.x,y-h/2,inner.w,h);
  // fine horizontal lines
  stroke(30,50); for(let i=-h/2;i<=h/2;i+=4){ line(inner.x+10,y+i,inner.x+inner.w-10,y+i+random(-1,1)); }
  // small side orbs
  radialGlow(inner.x+inner.w*0.18,y-8,inner.w*0.06,color(255,180,120,130));
  radialGlow(inner.x+inner.w*0.82,y+6,inner.w*0.05,color(255,170,130,120));
}

function drawFlowPools(inner){ // reddish flowing pools bottom corners
  noStroke(); fill(220,80,80,80);
  beginShape(); vertex(inner.x+inner.w*0.03,inner.y+inner.h*0.78); bezierVertex(inner.x+inner.w*0.18,inner.y+inner.h*0.70, inner.x+inner.w*0.22,inner.y+inner.h*0.95, inner.x+inner.w*0.12,inner.y+inner.h*0.98); endShape();
  beginShape(); vertex(inner.x+inner.w*0.88,inner.y+inner.h*0.72); bezierVertex(inner.x+inner.w*0.98,inner.y+inner.h*0.66, inner.x+inner.w*0.96,inner.y+inner.h*0.92, inner.x+inner.w*0.90,inner.y+inner.h*0.98); endShape();
}

// helpers from earlier
function clipRect(r){ drawingContext.save(); drawingContext.beginPath(); drawingContext.rect(r.x,r.y,r.w,r.h); drawingContext.clip(); }
function radialGlow(x,y,rad,col,strength=120){ push(); drawingContext.save(); const g=drawingContext.createRadialGradient(x,y,1,x,y,rad); const c=color(col); const rgba=(cc,a)=>`rgba(${red(cc)},${green(cc)},${blue(cc)},${a})`; g.addColorStop(0,rgba(c,strength/255)); g.addColorStop(0.6,rgba(c,(strength*0.25)/255)); g.addColorStop(1,rgba(c,0)); drawingContext.fillStyle=g; noStroke(); ellipse(x,y,rad*2,rad*2); drawingContext.restore(); pop(); }
function vignette(strength){ noFill(); for(let i=0;i<38;i++){ const a=map(i,0,37,255*strength,0); stroke(0,a); rect(2+i,2+i,width-4-2*i,height-4-2*i); }}
function drawPaperTexture(g,bg){ g.noiseSeed(seed); g.background(bg); g.noStroke(); const n=0.003; for(let y=0;y<g.height;y+=2){ for(let x=0;x<g.width;x+=2){ const v=245+10*(g.noise(x*n,y*n)-0.5); g.fill(v,v,v,25); g.rect(x,y,2,2);} } g.noFill(); for(let i=0;i<30;i++){ g.stroke(0,12-i*0.3); g.rect(2+i,2+i,g.width-4-2*i,g.height-4-2*i);} }


