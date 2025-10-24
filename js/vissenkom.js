const cv=document.getElementById('c');const ctx=cv.getContext('2d');
const rand=(a,b)=>Math.random()*(b-a)+a;const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let lamps=[];let W=0,H=0;
let viewportConfig={offsetTop:0,offsetBottom:0,offsetLeft:0,offsetRight:0};

// === ADAPTIVE PERFORMANCE SYSTEM ===
let performanceProfile={quality:'high',particleCount:1,detailLevel:1,skipFrames:0};
let fpsHistory=[];let frameCount=0;let lastFPSCheck=Date.now();
function measureFPS(){
  frameCount++;
  const now=Date.now();
  if(now-lastFPSCheck>=1000){
    const fps=frameCount;
    fpsHistory.push(fps);
    if(fpsHistory.length>5)fpsHistory.shift();
    frameCount=0;
    lastFPSCheck=now;
    updatePerformanceProfile();
  }
}
function updatePerformanceProfile(){
  if(fpsHistory.length<3)return;
  const avgFPS=fpsHistory.reduce((a,b)=>a+b,0)/fpsHistory.length;
  if(avgFPS>=50){
    performanceProfile={quality:'high',particleCount:1,detailLevel:1,skipFrames:0};
  }else if(avgFPS>=30){
    performanceProfile={quality:'medium',particleCount:0.6,detailLevel:0.8,skipFrames:0};
  }else{
    performanceProfile={quality:'low',particleCount:0.3,detailLevel:0.6,skipFrames:1};
  }
}

// === OBJECT POOLING ===
const bubblePool=[];const particlePool=[];
function getBubble(){
  return bubblePool.length>0?bubblePool.pop():{x:0,y:0,r:0,vx:0,vy:0,ttl:0};
}
function releaseBubble(b){
  bubblePool.push(b);
}
function getParticle(){
  return particlePool.length>0?particlePool.pop():{x:0,y:0,size:0,speedX:0,speedY:0,alpha:0};
}
function releaseParticle(p){
  particlePool.push(p);
}

function resize(){
  const fullW=cv.clientWidth;
  const fullH=cv.clientHeight;
  cv.width=fullW;
  cv.height=fullH;
  W=fullW-(viewportConfig.offsetLeft+viewportConfig.offsetRight);
  H=fullH-(viewportConfig.offsetTop+viewportConfig.offsetBottom);
  updateUIPositions();
  setupLamps();setupPlants();setupDecorations();setupStars();setupParticles();drawQR();
}
function updateUIPositions(){
  const side=document.querySelector('.side');
  const statusbar=document.querySelector('.statusbar');
  if(side){
    side.style.left=(viewportConfig.offsetLeft+8)+'px';
    side.style.top=(viewportConfig.offsetTop+8)+'px';
  }
  if(statusbar){
    statusbar.style.bottom=(viewportConfig.offsetBottom+8)+'px';
  }
}
window.addEventListener('resize',resize);
const DAY_MIN=2*24*60;const DAY=DAY_MIN*60*1000;const FEED_CD=60*60*1000;
const BG='#083042';const BG_NIGHT='#04121a';
const fishes=[];const foods=[];const deadLog=[];const bubbles=[];const poops=[];
const plants=[];const decorations=[];const stars=[];const particles=[];const algenParticles=[];
let recentActivity=[];
let lastFed=0;let fishCounter=1;let lastT=Date.now();let TOP_N=3;
let lightsOn=true;let discoOn=false;let pumpOn=false;const pumpPos={x:0,y:0};let pumpJustOnUntil=0;
let waterGreenness=0;let waterGreennessTarget=0;

function setupLamps(){const n=4;const baseWidth=180;const spread=0.12;const hue=48;const margin=W*0.08;const step=(W-2*margin)/Math.max(1,n-1);lamps=[];for(let i=0;i<n;i++){const x=margin+i*step+rand(-step*spread,step*spread);const intensity=rand(0.55,0.8);const width=baseWidth*rand(0.9,1.1);const phase=rand(0,Math.PI*2);const stripePhase=rand(0,Math.PI*2);lamps.push({x,width,intensity,hueBase:hue,phase,stripePhase})}}

function setupStars(){
  stars.length=0;
  const baseStars=Math.floor(rand(35,55));
  const numStars=Math.floor(baseStars*performanceProfile.detailLevel);
  for(let i=0;i<numStars;i++){
    // Verschillende ster types met kleuren
    const starType=Math.random();
    let color;
    if(starType<0.6){
      color='white'; // 60% wit
    } else if(starType<0.85){
      color='yellow'; // 25% geel/warm
    } else {
      color='blue'; // 15% blauw/koel
    }

    stars.push({
      x:rand(0,W),
      y:rand(0,H*0.3),
      size:rand(0.8,2.5),
      brightness:rand(0.4,1),
      twinklePhase:rand(0,Math.PI*2),
      twinkleSpeed:rand(0.02,0.05),
      color:color
    });
  }
}

function setupParticles(){
  // Release old particles back to pool
  while(particles.length>0){
    releaseParticle(particles.pop());
  }
  const baseParticles=Math.floor(rand(15,25));
  const numParticles=Math.floor(baseParticles*performanceProfile.particleCount);
  for(let i=0;i<numParticles;i++){
    const p=getParticle();
    p.x=rand(0,W);
    p.y=rand(0,H);
    p.size=rand(1,3);
    p.speedX=rand(-0.15,0.15);
    p.speedY=rand(-0.2,0.2);
    p.alpha=rand(0.1,0.3);
    particles.push(p);
  }
}

function updateAlgenParticles(){
  const targetCount=Math.floor(waterGreenness/3.3); // ~30 deeltjes bij 100% greenness
  while(algenParticles.length<targetCount){
    algenParticles.push({x:rand(0,W),y:rand(0,H),size:rand(2,6),speedX:rand(-0.1,0.1),speedY:rand(-0.15,0.15),hue:rand(90,120)}); // Bruiniger groen (hue 90-120)
  }
  while(algenParticles.length>targetCount){
    algenParticles.pop();
  }
  for(const a of algenParticles){
    a.x+=a.speedX;a.y+=a.speedY;
    if(a.x<0)a.x=W;
    if(a.x>W)a.x=0;
    if(a.y<0)a.y=H;
    if(a.y>H)a.y=0;
  }
}

function setupPlants(){
  plants.length=0;
  const sandHeight=70;
  const numPlants=Math.floor(rand(4,7));
  for(let i=0;i<numPlants;i++){
    const plantTypes=['seaweed','kelp','fern','grass','anubias','vallisneria'];
    const type=plantTypes[Math.floor(Math.random()*plantTypes.length)];
    const x=rand(50,W-50);

    let height,width,segments,zIndex;
    if(type==='seaweed'){
      height=rand(200,500); // Bigger seaweed
      width=rand(20,45);
      segments=Math.floor(rand(12,25));
      zIndex=Math.random()<0.7?'back':'front';
    } else if(type==='kelp'){
      height=rand(300,600); // Very large kelp forests
      width=rand(30,60);
      segments=Math.floor(rand(15,30));
      zIndex='back';
    } else if(type==='fern'){
      height=rand(150,300);
      width=rand(40,80);
      segments=Math.floor(rand(10,18));
      zIndex=Math.random()<0.6?'back':'front';
    } else if(type==='grass'){
      height=rand(120,220);
      width=rand(8,18);
      segments=Math.floor(rand(25,40));
      zIndex=Math.random()<0.8?'back':'front';
    } else if(type==='anubias'){
      height=rand(80,160);
      width=rand(50,100);
      segments=Math.floor(rand(5,10));
      zIndex='front';
    } else if(type==='vallisneria'){
      height=rand(250,450);
      width=rand(10,20);
      segments=Math.floor(rand(20,35));
      zIndex='back';
    }

    const hue=type==='anubias'?rand(100,140):rand(80,160);
    const swayPhase=rand(0,Math.PI*2);
    const movePhase=rand(0,Math.PI*2);
    const branchiness=rand(0.5,0.9);

    // Variatie in hoogte: planten mogen op verschillende dieptes groeien
    // Van helemaal onderaan (H) tot aan de top van het zand (H-sandHeight)
    const minY=H-5; // Net boven de bodem
    const maxY=H-sandHeight+15; // Tot wat boven het zand
    const plantY=rand(minY,maxY);

    plants.push({type,x,y:plantY,height,width,segments,hue,swayPhase,movePhase,branchiness,zIndex});
  }
}

function setupDecorations(){
  decorations.length=0;
  const sandHeight=70;

  // Af en toe een kasteeltje
  if(Math.random()<0.3){
    const x=rand(80,W-80);
    const size=rand(80,140);
    const bobPhase=rand(0,Math.PI*2);
    const zIndex=Math.random()<0.7?'back':'front';
    // Variatie in hoogte: van onderkant zand tot wat hoger
    // y is het middenpunt van het kasteel, dus voor een kasteel dat op de bodem staat:
    // minimaal: H - size/2 (onderkant zit op H)
    // maximaal: H - sandHeight (onderkant zit op zandhoogte)
    const minY=H-size/2; // Helemaal onderaan
    const maxY=H-sandHeight+10; // Bijna bovenop zand
    const y=rand(minY,maxY);
    decorations.push({type:'castle',x,y,size,hue:rand(200,220),bobPhase,zIndex});
  }
}
function lampHueFor(L,time){if(!discoOn)return L.hueBase;const speed=2.5;const range=340;const wave=(Math.sin(time*speed+L.phase)+1)/2;return (L.hueBase+wave*range)%360}
function strobeAlpha(time){if(!discoOn)return 1;const hz=1.5;const duty=0.8;const cycle=(time*hz)%1;return cycle<duty?1:0.75}
let discoCache={};let lastDiscoTime=0;
function discoEffects(time){
  if(!discoOn)return;

  // Reduce frame rate for disco effects to improve performance
  if(time-lastDiscoTime<0.15)return;
  lastDiscoTime=time;

  const pulse=Math.sin(time*2)*0.5+0.5;
  ctx.globalCompositeOperation='lighter';
  const spots=4; // Reduced from 6 to 4 for better performance
  for(let i=0;i<spots;i++){
    const spotTime=time*0.7+i*0.8;
    const x=(W/spots)*i+W/(spots*2)+Math.sin(spotTime*1.2)*40; // Reduced movement range
    const y=H*0.3+Math.sin(spotTime*0.8+i)*H*0.3; // Reduced movement range
    const hue=(time*20+i*45)%360; // Slower color change
    const spotOn=Math.sin(spotTime*0.5+i)>0.4; // Less frequent flashing
    if(spotOn){
      const alpha=0.08*(0.7+pulse*0.3); // Reduced intensity
      const size=30+Math.sin(spotTime*1.5+i)*10; // Smaller size variation
      const grad=ctx.createRadialGradient(x,y,0,x,y,size);
      grad.addColorStop(0,`hsla(${hue},100%,75%,${alpha})`);
      grad.addColorStop(0.6,`hsla(${(hue+60)%360},90%,65%,${alpha*0.5})`);
      grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grad;
      ctx.beginPath();
      ctx.arc(x,y,size,0,Math.PI*2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation='source-over';
}

function makeFish(x=rand(50,W-50),y=rand(50,H-50),name){const base=rand(18,30);let hue=Math.floor(rand(0,360));if(isNaN(hue))hue=0;const initialVx=rand(-2.5,2.5);const initialVy=rand(-.3,.3);const f={x,y,vx:initialVx,vy:initialVy,speed:rand(1.5,2.5),baseSize:base,hue,dir:Math.random()*Math.PI*2,turnTimer:Math.floor(rand(600,1800)),blink:0,name:name||`Vis ${fishCounter++}`,lastEat:Date.now(),bornAt:Date.now(),eats:0,sickTop:Math.random()<0.5,hungerWindow:DAY*rand(0.9,1.1),behaviorState:'normal',behaviorTimer:0,wallFollowTarget:null,lastPoop:Date.now(),targetVx:initialVx,targetVy:initialVy};fishes.push(f)}
for(let i=0;i<8;i++)makeFish();

function makeFood(){const n=Math.max(8,fishes.length);for(let i=0;i<n;i++){foods.push({x:rand(40,W-40),y:50+rand(0,30),vy:rand(0.7,1.5),r:7,ttl:6000})}}
function makeBubble(){
  const b=getBubble();
  b.x=pumpPos.x+rand(-6,6);
  b.y=H-30;
  b.r=rand(2,6);
  b.vy=rand(0.8,1.8);
  b.vx=rand(-0.2,0.2);
  b.ttl=rand(200,380);
  bubbles.push(b);
}
function makeFishBubble(fx,fy){
  const b=getBubble();
  b.x=fx+rand(-8,8);
  b.y=fy+rand(-5,5);
  b.r=rand(1.5,3.5);
  b.vy=rand(0.6,1.2);
  b.vx=rand(-0.3,0.3);
  b.ttl=rand(150,300);
  bubbles.push(b);
}

function healthPct(f,now){return clamp(100*(1-((now-f.lastEat)/f.hungerWindow)),0,100)}
function fishSize(f,now){const ageDays=(now-f.bornAt)/DAY;const growth=1+Math.log(1+ageDays*0.15)*0.35+Math.log(1+f.eats*0.5)*0.25;return f.baseSize*growth}
function steerTowards(f,tx,ty,str){
  // Validate inputs to prevent jumping
  if(isNaN(tx) || isNaN(ty) || isNaN(str)) return;
  if(isNaN(f.x) || isNaN(f.y)) return;

  const dx=tx-f.x;
  const dy=ty-f.y;
  const d=Math.hypot(dx,dy);

  // Prevent division by zero and limit maximum steering force
  if(d < 0.1 || d > 1000) return;

  const maxSteer = f.speed * 0.1; // Limit steering force
  const steerX = Math.max(-maxSteer, Math.min(maxSteer, dx/d*str));
  const steerY = Math.max(-maxSteer, Math.min(maxSteer, dy/d*str));

  f.vx += steerX;
  f.vy += steerY;
}
function limitSpeed(f){
  // Validate fish speed property
  if(isNaN(f.speed) || f.speed <= 0) f.speed = 1.0;

  // Validate velocities
  if(isNaN(f.vx)) f.vx = 0.1;
  if(isNaN(f.vy)) f.vy = 0.05;

  const sp=Math.hypot(f.vx,f.vy);
  const max=f.speed*1.8;
  const min=0.6;

  if(sp > max && sp > 0){
    f.vx = f.vx/sp*max;
    f.vy = f.vy/sp*max;
  }
  if(sp < min){
    const a = Math.atan2(f.vy, f.vx);
    if(!isNaN(a)) {
      f.vx = Math.cos(a) * min;
      f.vy = Math.sin(a) * min;
    } else {
      f.vx = min;
      f.vy = 0;
    }
  }
}
function bounceOffWalls(f){
  const margin = 20;

  // Bounce off left wall
  if(f.x < margin) {
    f.x = margin + 1;
    f.vx = Math.abs(f.vx) + 0.1;
    // Update target velocity to match bounce
    f.targetVx = Math.abs(f.targetVx || f.vx);
    // Reset turn timer so fish picks new direction soon
    f.turnTimer = Math.floor(rand(60, 180));
    if(f.behaviorState !== 'normal') {
      f.behaviorState = 'normal';
      f.behaviorTimer = 0;
      f.wallFollowTarget = null;
    }
  }
  // Bounce off right wall
  if(f.x > W - margin) {
    f.x = W - margin - 1;
    f.vx = -Math.abs(f.vx) - 0.1;
    // Update target velocity to match bounce
    f.targetVx = -Math.abs(f.targetVx || f.vx);
    // Reset turn timer so fish picks new direction soon
    f.turnTimer = Math.floor(rand(60, 180));
    if(f.behaviorState !== 'normal') {
      f.behaviorState = 'normal';
      f.behaviorTimer = 0;
      f.wallFollowTarget = null;
    }
  }
  // Bounce off top wall
  if(f.y < margin) {
    f.y = margin + 1;
    f.vy = Math.abs(f.vy) + 0.1;
    // Update target velocity to match bounce
    f.targetVy = Math.abs(f.targetVy || f.vy);
    // Reset turn timer so fish picks new direction soon
    f.turnTimer = Math.floor(rand(60, 180));
    if(f.behaviorState !== 'normal') {
      f.behaviorState = 'normal';
      f.behaviorTimer = 0;
      f.wallFollowTarget = null;
    }
  }
  // Bounce off bottom wall
  if(f.y > H - margin) {
    f.y = H - margin - 1;
    f.vy = -Math.abs(f.vy) - 0.1;
    // Update target velocity to match bounce
    f.targetVy = -Math.abs(f.targetVy || f.vy);
    // Reset turn timer so fish picks new direction soon
    f.turnTimer = Math.floor(rand(60, 180));
    if(f.behaviorState !== 'normal') {
      f.behaviorState = 'normal';
      f.behaviorTimer = 0;
      f.wallFollowTarget = null;
    }
  }

  // Gentle recovery for fish that get stuck - no sudden jumps
  if(f.x < 15 || f.x > W - 15 || f.y < 15 || f.y > H - 15) {
    // Gently push fish towards center instead of teleporting
    const centerX = W / 2;
    const centerY = H / 2;
    const pushStrength = 0.02;

    steerTowards(f, centerX, centerY, pushStrength);

    // Only reset behavior state, don't change position/velocity
    if(f.behaviorState !== 'normal') {
      f.behaviorState = 'normal';
      f.behaviorTimer = Math.floor(rand(60, 180));
      f.wallFollowTarget = null;
    }
  }
}

function drawLamps(time){
  if(!lightsOn)return;

  const stro=strobeAlpha(time);
  const discoMultiplier=discoOn?1.5:1; // Reduced from 1.8 to 1.5
  for(const L of lamps){
    const hue=lampHueFor(L,time);
    const intensity=L.intensity*(discoOn?1.2:1); // Reduced from 1.4 to 1.2
    const topGlow=ctx.createRadialGradient(L.x,0,2,L.x,0,Math.max(40,L.width*0.6*discoMultiplier));
    topGlow.addColorStop(0,`hsla(${hue},95%,90%,${0.4*intensity*stro})`); // Reduced intensity
    topGlow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalCompositeOperation='lighter';
    ctx.fillStyle=topGlow;ctx.beginPath();ctx.arc(L.x,0,Math.max(40,L.width*0.6*discoMultiplier),0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='source-over';
    const hue2=(hue+140)%360;const hue3=(hue+220)%360;
    const beamGrad=ctx.createLinearGradient(L.x,0,L.x,H*0.9);
    beamGrad.addColorStop(0,`hsla(${hue},95%,78%,${0.2*intensity*stro})`); // Reduced intensity
    beamGrad.addColorStop(0.35,`hsla(${hue2},95%,72%,${0.14*intensity*stro})`); // Reduced intensity
    if(discoOn)beamGrad.addColorStop(0.7,`hsla(${hue3},95%,65%,${0.1*intensity*stro})`); // Reduced intensity
    beamGrad.addColorStop(1,'rgba(0,0,0,0)');
    const wTop=L.width*0.55*discoMultiplier;const wBottom=L.width*1.1*discoMultiplier;const yBottom=H*0.9;
    ctx.fillStyle=beamGrad;ctx.beginPath();ctx.moveTo(L.x-wTop,0);ctx.lineTo(L.x+wTop,0);ctx.lineTo(L.x+wBottom,yBottom);ctx.lineTo(L.x-wBottom,yBottom);ctx.closePath();ctx.fill();
    const stripes=discoOn?4:3; // Reduced from 6 to 4
    for(let i=0;i<stripes;i++){
      const p=i/stripes;const localPhase=L.stripePhase+i*0.9;const stripeX=L.x+(p-0.5)*L.width*0.8*discoMultiplier;
      const stripeW=L.width*(0.04+0.02*Math.sin(time*(discoOn?2:1.2)+localPhase))*discoMultiplier; // Reduced stripe width
      const stripeGrad=ctx.createLinearGradient(stripeX,0,stripeX,H*0.7);
      const sh=(hue+(Math.sin(time*(discoOn?2.5:1.5)+localPhase)*(discoOn?200:160)+160))%360; // Slower color change
      stripeGrad.addColorStop(0,`hsla(${sh},95%,86%,${0.15*intensity*stro})`); // Reduced intensity
      stripeGrad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=stripeGrad;ctx.fillRect(stripeX-stripeW*0.5,0,stripeW,H*0.7);
    }
    if(discoOn){
      const extraGlow=ctx.createRadialGradient(L.x,H*0.2,0,L.x,H*0.2,100); // Reduced size
      extraGlow.addColorStop(0,`hsla(${(hue+180)%360},100%,75%,${0.12*stro})`); // Reduced intensity
      extraGlow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=extraGlow;ctx.beginPath();ctx.arc(L.x,H*0.2,100,0,Math.PI*2);ctx.fill();
      ctx.globalCompositeOperation='source-over';
    }
  }
}

function drawStars(time){
  if(lightsOn)return;
  for(const star of stars){
    const twinkle=Math.sin(time*star.twinkleSpeed+star.twinklePhase)*0.3+0.7;
    const alpha=star.brightness*twinkle*0.9;

    // Kleur per ster type
    let starColor;
    if(star.color==='yellow'){
      starColor=`rgba(255,240,200,${alpha})`; // Warm geel
    } else if(star.color==='blue'){
      starColor=`rgba(200,230,255,${alpha})`; // Koel blauw
    } else {
      starColor=`rgba(255,255,255,${alpha})`; // Wit
    }

    ctx.fillStyle=starColor;
    ctx.beginPath();
    ctx.arc(star.x,star.y,star.size,0,Math.PI*2);
    ctx.fill();

    // Extra glow voor grotere sterren
    if(star.size>1.5){
      ctx.fillStyle=starColor.replace(/[\d.]+\)$/,`${alpha*0.3})`);
      ctx.beginPath();
      ctx.arc(star.x,star.y,star.size*1.8,0,Math.PI*2);
      ctx.fill();
    }
  }
}

function drawSandBottom(time){
  const sandHeight=70;
  const sandTop=H-sandHeight;

  // Zand gradient (lichter boven, donkerder onder)
  const sandGrad=ctx.createLinearGradient(0,sandTop,0,H);
  if(lightsOn){
    sandGrad.addColorStop(0,'#E5C89A'); // Licht zand boven
    sandGrad.addColorStop(0.5,'#D4AF7A'); // Midden zand
    sandGrad.addColorStop(1,'#B89968'); // Donkerder zand onder
  } else {
    sandGrad.addColorStop(0,'#8A7556'); // Donker zand boven (nacht)
    sandGrad.addColorStop(0.5,'#6D5D45'); // Midden
    sandGrad.addColorStop(1,'#544736'); // Donkerst (nacht)
  }

  // Teken basis zandlaag met golvende bovenkant
  ctx.fillStyle=sandGrad;
  ctx.beginPath();
  ctx.moveTo(0,H);
  ctx.lineTo(0,sandTop);

  // Golvende duinen aan de top
  for(let x=0;x<=W;x+=5){
    const wave1=Math.sin(x*0.015+time*0.003)*8;
    const wave2=Math.sin(x*0.008+time*0.002)*5;
    const wave3=Math.sin(x*0.025)*3;
    const y=sandTop+wave1+wave2+wave3;
    ctx.lineTo(x,y);
  }

  ctx.lineTo(W,H);
  ctx.closePath();
  ctx.fill();

  // Subtiele schaduw op de duinen voor diepte
  ctx.strokeStyle=lightsOn?'rgba(0,0,0,0.08)':'rgba(0,0,0,0.15)';
  ctx.lineWidth=1.5;
  ctx.beginPath();
  for(let x=0;x<=W;x+=5){
    const wave1=Math.sin(x*0.015+time*0.003)*8;
    const wave2=Math.sin(x*0.008+time*0.002)*5;
    const wave3=Math.sin(x*0.025)*3;
    const y=sandTop+wave1+wave2+wave3;
    if(x===0)ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  }
  ctx.stroke();

  // Zand textuur (kleine stipjes)
  if(lightsOn){
    ctx.fillStyle='rgba(0,0,0,0.04)';
    for(let i=0;i<80;i++){
      const x=rand(0,W);
      const y=rand(sandTop,H);
      ctx.beginPath();
      ctx.arc(x,y,rand(0.5,1.5),0,Math.PI*2);
      ctx.fill();
    }
    // Lichtere stipjes
    ctx.fillStyle='rgba(255,255,255,0.1)';
    for(let i=0;i<40;i++){
      const x=rand(0,W);
      const y=rand(sandTop,H);
      ctx.beginPath();
      ctx.arc(x,y,rand(0.5,1),0,Math.PI*2);
      ctx.fill();
    }
  }
}

function drawAmbientGlow(time){
  // Subtiele gloeiende vlekken in de achtergrond voor meer variatie
  if(lightsOn){
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<4;i++){
      const x=W*(0.15+i*0.25);
      const y=H*0.4+Math.sin(time*0.008+i)*H*0.15;
      const pulse=Math.sin(time*0.012+i*1.5)*0.3+0.7;
      const grad=ctx.createRadialGradient(x,y,0,x,y,150);
      grad.addColorStop(0,`rgba(80,227,194,${0.04*pulse})`);
      grad.addColorStop(0.5,`rgba(80,227,194,${0.02*pulse})`);
      grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grad;
      ctx.beginPath();
      ctx.arc(x,y,150,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
  }
}

function drawParticles(){
  for(const p of particles){
    ctx.fillStyle=`rgba(255,255,255,${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
    ctx.fill();

    // Update particle position
    p.x+=p.speedX;
    p.y+=p.speedY;

    // Wrap around edges
    if(p.x<0)p.x=W;
    if(p.x>W)p.x=0;
    if(p.y<0)p.y=H;
    if(p.y>H)p.y=0;
  }
}

function drawAlgenParticles(){
  for(const a of algenParticles){
    const alpha=(waterGreenness/100)*0.8;
    ctx.fillStyle=`hsla(${a.hue},40%,30%,${alpha})`; // Donkerder, minder verzadigd voor natuurlijker effect
    ctx.beginPath();
    ctx.arc(a.x,a.y,a.size,0,Math.PI*2);
    ctx.fill();
  }
}

function drawWaterGreenness(){
  if(waterGreenness<=0)return;
  const alpha=(waterGreenness/100)*0.9; // 90% opacity bij 100% greenness
  ctx.fillStyle=`rgba(45,85,45,${alpha})`; // Donker modderig groen (natuurlijk vervuild water)
  ctx.fillRect(0,0,W,H);
}

function clearFrame(time){
  const fullW=cv.width;
  const fullH=cv.height;
  // Fill entire canvas with black first
  ctx.fillStyle='#000';
  ctx.fillRect(0,0,fullW,fullH);
  // Save context and translate to viewport area
  ctx.save();
  ctx.translate(viewportConfig.offsetLeft,viewportConfig.offsetTop);
  // Clip to viewport area to prevent rendering outside bounds
  ctx.beginPath();
  ctx.rect(0,0,W,H);
  ctx.clip();

  // Fill viewport area with gradient background for depth - meer variatie
  const bgGrad=ctx.createLinearGradient(0,0,0,H);
  if(lightsOn){
    bgGrad.addColorStop(0,'#0d5168'); // Lichter blauw bovenaan
    bgGrad.addColorStop(0.3,'#094050'); // Midden
    bgGrad.addColorStop(0.7,'#073342'); // Dieper
    bgGrad.addColorStop(1,'#052530'); // Donkerst onderaan
  } else {
    bgGrad.addColorStop(0,'#082030'); // Nacht boven (met hint van blauw)
    bgGrad.addColorStop(0.4,'#051520'); // Midden
    bgGrad.addColorStop(0.8,'#030f18'); // Dieper
    bgGrad.addColorStop(1,'#020a10'); // Bijna zwart onderaan
  }
  ctx.fillStyle=bgGrad;
  ctx.fillRect(0,0,W,H);

  // Extra subtiele radiale gradient voor meer diepte (donkerder in hoeken)
  const vignetteGrad=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.8);
  vignetteGrad.addColorStop(0,'rgba(0,0,0,0)');
  vignetteGrad.addColorStop(1,'rgba(0,0,0,0.15)');
  ctx.fillStyle=vignetteGrad;
  ctx.fillRect(0,0,W,H);

  drawStars(time);
  drawAmbientGlow(time);
  drawLamps(time);
  discoEffects(time);
  drawParticles();
  ctx.restore();
}
function drawFood(){for(let i=foods.length-1;i>=0;i--){const p=foods[i];
  // Als voer de bodem bereikt, stop met vallen
  if(p.y >= H-16){
    p.y = H-16;  // Blijf op de bodem
    p.vy = 0;     // Stop met vallen
  } else {
    p.y+=p.vy;    // Blijf vallen als nog niet op bodem
  }
  p.ttl--;
  ctx.fillStyle='#ffb37a';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
  // Verwijder alleen als ttl verloopt (niet meer als het de bodem raakt)
  if(p.ttl<=0){foods.splice(i,1)}}}
function drawBubbles(){for(let i=bubbles.length-1;i>=0;i--){const b=bubbles[i];b.y-=b.vy;b.x+=b.vx;b.ttl--;ctx.globalAlpha=lightsOn?0.7:0.5;ctx.fillStyle='#bfeaf5';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;if(b.y<-10||b.ttl<=0){releaseBubble(b);bubbles.splice(i,1)}}}

function drawPoops(){
  for(const p of poops) {
    // Draw small brown poop on tank floor
    ctx.fillStyle = lightsOn ? '#8B4513' : '#654321';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    // Add a slightly darker center for detail
    ctx.fillStyle = lightsOn ? '#654321' : '#4A2C17';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlant(plant,time){
  const lightMul=lightsOn?1:0.6;
  // Heel subtiele sway voor meer leven
  const swayAmount=Math.sin(time*0.015+plant.swayPhase)*3;
  const moveAmount=Math.sin(time*0.008+plant.movePhase)*2;

  if(plant.type==='seaweed' || plant.type==='kelp'){
    const segmentHeight=plant.height/plant.segments;
    const swayMultiplier=plant.type==='kelp'?1.5:1;

    for(let i=0;i<plant.segments;i++){
      const y=plant.y-i*segmentHeight;
      const sway=(i/plant.segments)*swayAmount*swayMultiplier;
      const x=plant.x+sway;
      const width=plant.width*(1-i*0.02/plant.segments);
      const alpha=(lightsOn?0.9:0.6)*fadeAlpha;

      ctx.fillStyle=`hsla(${plant.hue},70%,${45*lightMul}%,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x,y,width/2,segmentHeight/2,0,0,Math.PI*2);
      ctx.fill();

      if(plant.type==='kelp' && i>plant.segments*0.6){
        // Add kelp fronds at the top - static for performance
        const frondX=x+(i%2===0?-width/2:width/2);
        const frondY=y;
        ctx.fillStyle=`hsla(${plant.hue+15},65%,${50*lightMul}%,${alpha*0.7})`;
        ctx.beginPath();
        ctx.ellipse(frondX,frondY,width/4,segmentHeight/3,0,0,Math.PI*2);
        ctx.fill();
      }
    }
  }
  else if(plant.type==='fern'){
    const segmentHeight=plant.height/plant.segments;

    for(let i=0;i<plant.segments;i++){
      const y=plant.y-i*segmentHeight;
      const x=plant.x;
      const width=plant.width*(1-i*0.04/plant.segments);
      const alpha=(lightsOn?0.8:0.5)*fadeAlpha;

      // Main stem - static
      ctx.strokeStyle=`hsla(${plant.hue-20},80%,${30*lightMul}%,${alpha})`;
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(plant.x,plant.y);
      ctx.lineTo(x,y);
      ctx.stroke();

      // Fern fronds on both sides - static
      const frondLength=width*plant.branchiness;
      for(let side of [-1,1]){
        const frondX=x+side*frondLength;
        const frondY=y;

        ctx.fillStyle=`hsla(${plant.hue},70%,${45*lightMul}%,${alpha})`;
        ctx.beginPath();
        ctx.ellipse(frondX,frondY,frondLength/3,segmentHeight/4,0,0,Math.PI*2);
        ctx.fill();
      }
    }
  }
  else if(plant.type==='grass'){
    const bladeSpacing=plant.width/plant.segments;

    for(let i=0;i<plant.segments;i++){
      const offsetX=(i-plant.segments/2)*bladeSpacing;
      const x=plant.x+offsetX;
      const bladeHeight=plant.height*(0.8+0.2*(i%3)/2);
      const topX=x+swayAmount*0.6; // Subtiele sway aan de top
      const alpha=(lightsOn?0.8:0.5)*fadeAlpha;

      ctx.strokeStyle=`hsla(${plant.hue},80%,${40*lightMul}%,${alpha})`;
      ctx.lineWidth=2;
      ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(x,plant.y);
      ctx.lineTo(topX,plant.y-bladeHeight);
      ctx.stroke();
    }
  }
  else if(plant.type==='anubias'){
    // Large broad leaves
    const leafSpacing=plant.height/plant.segments;
    for(let i=0;i<plant.segments;i++){
      const y=plant.y-i*leafSpacing;
      const x=plant.x;
      const leafWidth=plant.width*plant.branchiness*(1-i*0.1/plant.segments);
      const leafHeight=leafSpacing*0.8;
      const alpha=(lightsOn?0.9:0.6)*fadeAlpha;

      ctx.fillStyle=`hsla(${plant.hue},60%,${35*lightMul}%,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x,y,leafWidth/2,leafHeight/2,0,0,Math.PI*2);
      ctx.fill();

      // Leaf veins - static
      ctx.strokeStyle=`hsla(${plant.hue-10},50%,${25*lightMul}%,${alpha*0.7})`;
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(x,y+leafHeight/2);
      ctx.lineTo(x,y-leafHeight/2);
      ctx.stroke();
    }
  }
  else if(plant.type==='vallisneria'){
    // Long ribbon-like leaves
    const segmentHeight=plant.height/plant.segments;
    for(let i=0;i<plant.segments;i++){
      const y=plant.y-i*segmentHeight;
      const sway=(i/plant.segments)*swayAmount*0.8;
      const x=plant.x+sway;
      const width=plant.width*(1-i*0.01/plant.segments);
      const alpha=(lightsOn?0.8:0.5)*fadeAlpha;

      ctx.strokeStyle=`hsla(${plant.hue},70%,${40*lightMul}%,${alpha})`;
      ctx.lineWidth=width;
      ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(plant.x,plant.y);
      ctx.lineTo(x,y);
      ctx.stroke();
    }
  }
  else if(plant.type==='coral'){
    const baseY=plant.y;
    const branches=4;

    for(let i=0;i<branches;i++){
      const angle=(i/branches)*Math.PI; // Static angle
      const branchLength=plant.height*0.8;
      const endX=plant.x+Math.cos(angle)*branchLength*0.6;
      const endY=baseY-Math.abs(Math.sin(angle))*branchLength;

      ctx.strokeStyle=`hsla(${plant.hue},60%,${45*lightMul}%,${(lightsOn?0.8:0.5)*fadeAlpha})`;
      ctx.lineWidth=plant.width/6;
      ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(plant.x,baseY);
      ctx.lineTo(endX,endY); // Straight lines for performance
      ctx.stroke();

      ctx.fillStyle=`hsla(${plant.hue+20},70%,${55*lightMul}%,${(lightsOn?0.6:0.4)*fadeAlpha})`;
      ctx.beginPath();
      ctx.arc(endX,endY,plant.width/8,0,Math.PI*2);
      ctx.fill();
    }
  }
}

function drawPlants(time){
  for(const plant of plants){
    drawPlant(plant,time);
  }
}

function drawDecoration(deco,time){
  const lightMul=lightsOn?1:0.6;
  const bobAmount=0; // Static decorations for performance

  if(deco.type==='rock'){
    const x=deco.x;
    const y=deco.y+bobAmount;
    const grad=ctx.createRadialGradient(x-deco.size*0.2,y-deco.size*0.2,0,x,y,deco.size);
    grad.addColorStop(0,`hsla(${deco.hue},30%,${60*lightMul}%,1)`);
    grad.addColorStop(1,`hsla(${deco.hue},40%,${30*lightMul}%,1)`);
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.ellipse(x,y,deco.size*0.8,deco.size*0.6,0,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle=`hsla(${deco.hue},20%,${70*lightMul}%,0.6)`;
    ctx.beginPath();
    ctx.ellipse(x-deco.size*0.3,y-deco.size*0.2,deco.size*0.3,deco.size*0.2,0,0,Math.PI*2);
    ctx.fill();
  }
  else if(deco.type==='driftwood'){
    const x=deco.x;
    const y=deco.y+bobAmount;

    // Main log shape
    ctx.fillStyle=`hsla(${deco.hue},40%,${25*lightMul}%,0.9)`;
    ctx.beginPath();
    ctx.ellipse(x,y,deco.size*0.6,deco.size*0.2,0.3,0,Math.PI*2);
    ctx.fill();

    // Branch sticking up
    const branchX=x+deco.size*0.3;
    const branchY=y-deco.size*0.4;
    ctx.strokeStyle=`hsla(${deco.hue},35%,${30*lightMul}%,0.8)`;
    ctx.lineWidth=deco.size*0.08;
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(branchX,branchY);
    ctx.stroke();

    // Texture lines
    for(let i=0;i<3;i++){
      ctx.strokeStyle=`hsla(${deco.hue},30%,${20*lightMul}%,0.6)`;
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(x-deco.size*0.4,y-5+i*5);
      ctx.lineTo(x+deco.size*0.4,y-5+i*5);
      ctx.stroke();
    }
  }
  else if(deco.type==='rock_formation'){
    const x=deco.x;
    const y=deco.y+bobAmount;

    // Large main rock
    const grad1=ctx.createRadialGradient(x-deco.size*0.2,y-deco.size*0.3,0,x,y,deco.size*0.8);
    grad1.addColorStop(0,`hsla(${deco.hue},35%,${50*lightMul}%,1)`);
    grad1.addColorStop(1,`hsla(${deco.hue},45%,${25*lightMul}%,1)`);
    ctx.fillStyle=grad1;
    ctx.beginPath();
    ctx.ellipse(x,y,deco.size*0.7,deco.size*0.5,0,0,Math.PI*2);
    ctx.fill();

    // Secondary rocks
    const rock2X=x-deco.size*0.4;
    const rock2Y=y+deco.size*0.2;
    const grad2=ctx.createRadialGradient(rock2X,rock2Y-deco.size*0.1,0,rock2X,rock2Y,deco.size*0.3);
    grad2.addColorStop(0,`hsla(${deco.hue+10},30%,${55*lightMul}%,1)`);
    grad2.addColorStop(1,`hsla(${deco.hue+10},40%,${30*lightMul}%,1)`);
    ctx.fillStyle=grad2;
    ctx.beginPath();
    ctx.ellipse(rock2X,rock2Y,deco.size*0.3,deco.size*0.2,0,0,Math.PI*2);
    ctx.fill();

    const rock3X=x+deco.size*0.3;
    const rock3Y=y+deco.size*0.1;
    ctx.fillStyle=`hsla(${deco.hue-5},35%,${45*lightMul}%,1)`;
    ctx.beginPath();
    ctx.ellipse(rock3X,rock3Y,deco.size*0.25,deco.size*0.15,0,0,Math.PI*2);
    ctx.fill();
  }
  else if(deco.type==='cave'){
    const x=deco.x;
    const y=deco.y+bobAmount;

    // Cave entrance/archway
    const archGrad=ctx.createRadialGradient(x,y-deco.size*0.2,0,x,y,deco.size*0.8);
    archGrad.addColorStop(0,`hsla(${deco.hue},40%,${40*lightMul}%,1)`);
    archGrad.addColorStop(1,`hsla(${deco.hue},50%,${20*lightMul}%,1)`);
    ctx.fillStyle=archGrad;
    ctx.beginPath();
    ctx.ellipse(x,y,deco.size*0.6,deco.size*0.4,0,0,Math.PI*2);
    ctx.fill();

    // Dark cave opening
    ctx.fillStyle=`hsla(${deco.hue},20%,${5*lightMul}%,0.9)`;
    ctx.beginPath();
    ctx.ellipse(x,y-deco.size*0.1,deco.size*0.25,deco.size*0.15,0,0,Math.PI*2);
    ctx.fill();
  }
  else if(deco.type==='castle'){
    const x=deco.x;
    const y=deco.y+bobAmount;
    const baseWidth=deco.size*0.8;
    const baseHeight=deco.size*0.6;
    const towerWidth=deco.size*0.3;
    const towerHeight=deco.size*0.4;

    ctx.fillStyle=`hsla(${deco.hue},40%,${45*lightMul}%,${fadeAlpha})`;
    ctx.fillRect(x-baseWidth/2,y-baseHeight/2,baseWidth,baseHeight);

    ctx.fillStyle=`hsla(${deco.hue},35%,${55*lightMul}%,${fadeAlpha})`;
    ctx.fillRect(x-towerWidth/2,y-baseHeight/2-towerHeight,towerWidth,towerHeight);

    ctx.fillStyle=`hsla(${deco.hue+20},50%,${35*lightMul}%,${fadeAlpha})`;
    const flagHeight=deco.size*0.15;
    ctx.fillRect(x-2,y-baseHeight/2-towerHeight-flagHeight,4,flagHeight);

    const flagWave=0; // Static flag for performance
    ctx.fillStyle=`hsla(${(deco.hue+180)%360},70%,${60*lightMul}%,${fadeAlpha})`;
    ctx.beginPath();
    ctx.moveTo(x+2,y-baseHeight/2-towerHeight-flagHeight);
    ctx.lineTo(x+flagHeight+flagWave,y-baseHeight/2-towerHeight-flagHeight*0.7);
    ctx.lineTo(x+2,y-baseHeight/2-towerHeight-flagHeight*0.4);
    ctx.fill();
  }
  else if(deco.type==='chest'){
    const x=deco.x;
    const y=deco.y+bobAmount;
    const width=deco.size*0.8;
    const height=deco.size*0.4;

    ctx.fillStyle=`hsla(${deco.hue},60%,${40*lightMul}%,1)`;
    ctx.fillRect(x-width/2,y-height,width,height);

    ctx.fillStyle=`hsla(${deco.hue},70%,${50*lightMul}%,1)`;
    ctx.fillRect(x-width/2,y-height,width,height*0.3);

    ctx.fillStyle=`hsla(${deco.hue+40},80%,${70*lightMul}%,1)`;
    ctx.beginPath();
    ctx.arc(x,y-height*0.7,width*0.08,0,Math.PI*2);
    ctx.fill();

    if(Math.sin(time*0.003+deco.bobPhase)>0.7){
      ctx.fillStyle=`hsla(${(deco.hue+180)%360},90%,${80*lightMul}%,0.8)`;
      for(let i=0;i<3;i++){
        const sparkleX=x+Math.sin(time*0.01+i)*width*0.2;
        const sparkleY=y-height*0.5+Math.cos(time*0.008+i)*height*0.1;
        ctx.beginPath();
        ctx.arc(sparkleX,sparkleY,2,0,Math.PI*2);
        ctx.fill();
      }
    }
  }
}

function drawDecorations(time){
  for(const deco of decorations){
    drawDecoration(deco,time);
  }
}

function ageLabelMS(ms){const s=Math.floor(ms/1000);if(s<60)return s+'s';const m=Math.floor(ms/60000);if(m<60)return m+'m';const h=Math.floor(ms/3600000);if(h<24)return h+'u';const d=Math.floor(h/24);if(d<7)return d+'d';if(d<30)return Math.floor(d/7)+'w';const mo=Math.floor(d/30);if(mo<12)return mo+'mnd';return Math.floor(d/365)+'jr'}
function ageLabel(f,now){return ageLabelMS(now-f.bornAt)}

function drawFish(f,t,now){
  const s=fishSize(f,now);const a=Math.atan2(f.vy,f.vx);

  // Subtiele schaduw onder de vis voor diepte-effect
  if(lightsOn){
    ctx.save();
    ctx.globalAlpha=0.15;
    ctx.fillStyle='#000';
    ctx.beginPath();
    ctx.ellipse(f.x+2,f.y+s*1.3,s*0.7,s*0.3,a,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();ctx.translate(f.x,f.y);ctx.rotate(a);
  const dimBase=1-(1-healthPct(f,now)/100)*0.4;const lightMul=lightsOn?1:0.6;let dim=dimBase*lightMul;

  // Sick fish appear duller and more transparent
  if(f.sick && !f.medicated) {
    const sickHealth = f.health || healthPct(f,now);
    if(sickHealth <= 30) {
      ctx.globalAlpha = 0.6; // Critical: very dull
      dim *= 0.6;
    } else if(sickHealth <= 60) {
      ctx.globalAlpha = 0.75; // Sick: moderately dull
      dim *= 0.75;
    } else {
      ctx.globalAlpha = 0.85; // Early stage: slightly dull
      dim *= 0.9;
    }
  }

  // Ensure f.hue is a valid number, fallback to 0 if NaN
  let fishHue = isNaN(f.hue) ? 0 : f.hue;

  if(discoOn){
    // Ensure all inputs are valid numbers before calculating
    const timeInput = isNaN(t) ? 0 : t;
    const xInput = isNaN(f.x) ? 0 : f.x;
    const colorShift = Math.sin(timeInput * 0.08 + xInput * 0.01) * 60;
    fishHue = (fishHue + colorShift) % 360;

    // Ensure fishHue is still a valid number after calculation
    if(isNaN(fishHue)) fishHue = 0;

    dim*=1.2;
    const glow=ctx.createRadialGradient(0,0,0,0,0,s*1.5);
    glow.addColorStop(0,`hsla(${Math.round(fishHue)},100%,70%,0.3)`);
    glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,s*1.5,0,Math.PI*2);ctx.fill();
  }
  const bodyGrad=ctx.createLinearGradient(-s*0.6,0,s*0.6,0);
  bodyGrad.addColorStop(0,`hsla(${Math.round(fishHue)},90%,${60*dim}%,1)`);bodyGrad.addColorStop(1,`hsla(${Math.round((fishHue+50)%360)},80%,${50*dim}%,1)`);
  ctx.fillStyle=bodyGrad;ctx.beginPath();ctx.ellipse(0,0,s*0.9,s*0.55,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=`hsla(${Math.round((fishHue+20)%360)},80%,${55*dim}%,1)`;ctx.beginPath();ctx.moveTo(-s*0.9,0);ctx.lineTo(-s*1.4,-s*0.35);ctx.lineTo(-s*1.2,0);ctx.lineTo(-s*1.4,s*0.35);ctx.closePath();ctx.fill();
  const finW=s*0.45;const finH=s*0.25;const finWave=Math.sin(t*(discoOn?0.04:0.02)+f.x*0.03)*0.5+0.5;
  ctx.save();ctx.translate(-s*0.35,0);ctx.rotate((finWave-0.5)*(discoOn?1.2:0.6));ctx.fillStyle=`hsla(${Math.round((fishHue+70)%360)},85%,${65*dim}%,1)`;ctx.beginPath();ctx.ellipse(0,0,finW,finH,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.fillStyle=lightsOn?'#fff':'#d8e1e8';ctx.beginPath();ctx.arc(s*0.35,-s*0.08,s*0.11,0,Math.PI*2);ctx.fill();ctx.fillStyle=lightsOn?'#000':'#24323c';ctx.beginPath();ctx.arc(s*0.37,-s*0.08,s*0.05,0,Math.PI*2);ctx.fill();

  // Af en toe een glinsterend sterretje op de vis (alleen als gezond en licht aan)
  if(lightsOn && healthPct(f,now)>50 && Math.sin(t*0.1+f.x*0.05)>0.85){
    ctx.fillStyle='rgba(255,255,255,0.9)';
    const sparkX=s*0.2;
    const sparkY=-s*0.15;
    ctx.beginPath();
    ctx.arc(sparkX,sparkY,s*0.06,0,Math.PI*2);
    ctx.fill();
    // Extra klein glinstertje
    ctx.beginPath();
    ctx.arc(sparkX+s*0.12,sparkY+s*0.08,s*0.03,0,Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
  const hp=healthPct(f,now);
  const behaviorEmoji=appConfig.showBehaviorEmoji ? getBehaviorEmoji(f.behaviorState || 'normal', f) + ' ' : '';
  const label1=behaviorEmoji + f.name;
  const label2=ageLabel(f,now);
  const labelAlpha=lightsOn?0.92:0.7;
  const pad=6;
  const nameFont='600 14px system-ui,Segoe UI,Roboto,Arial';
  const ageFont='500 11px system-ui,Segoe UI,Roboto,Arial';
  ctx.font=nameFont;const tw1=ctx.measureText(label1).width;
  ctx.font=ageFont;const tw2=ctx.measureText(label2).width;
  const lw=Math.max(90,Math.max(tw1,tw2)+pad*2);
  const lh=50;
  const lx=Math.round(clamp(f.x-lw/2,6,W-lw-6));const ly=Math.round(f.y-Math.max(s*2.0,65));
  ctx.fillStyle=`rgba(255,255,255,${labelAlpha})`;roundRect(lx,ly,lw,lh,12);ctx.fill();
  ctx.fillStyle=lightsOn?'#2d5f5f':'#4a7c7c';ctx.textBaseline='top';
  ctx.font=nameFont;ctx.fillText(label1,Math.round(lx+pad),Math.round(ly+6));
  const barW=lw-pad*2;const barH=6;const bx=Math.round(lx+pad);const by=Math.round(ly+24);
  ctx.fillStyle='rgba(50,50,50,0.6)';ctx.fillRect(bx,by,barW,barH);
  ctx.fillStyle=hp>50?'#3ecf5c':hp>25?'#f2c94c':'#eb5757';
  ctx.fillRect(bx,by,Math.round((hp/100)*barW),barH);
  ctx.font=ageFont;ctx.fillStyle=lightsOn?'#4a7c7c':'#6a9c9c';ctx.fillText(label2,Math.round(lx+pad),Math.round(ly+34));
}

function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}

// Behavior emoji mapping
function getBehaviorEmoji(behaviorState, fish) {
  // Check if fish is sick - override behavior emoji
  if (fish && fish.sick) {
    const health = fish.health || 100;
    if (health <= 30) return '💀'; // Critical
    if (health <= 60) return '🤢'; // Sick
    return '😕'; // Early stage
  }

  switch(behaviorState) {
    case 'bottom_dwelling': return '⬇️';
    case 'wall_following': return '🧱';
    case 'resting': return '💤';
    case 'surface_swimming': return '⬆️';
    case 'schooling': return '👥';
    case 'playful': return '🎉';
    case 'energetic': return '⚡';
    case 'jumping': return '🦘';
    case 'lazy': return '😴';
    case 'curious': return '🔍';
    case 'dancing': return '💃';
    case 'hiding': return '🫣';
    case 'territorial': return '💢';
    case 'floating': return '🎈';
    case 'hunting': return '🎯';
    case 'scared': return '😱';
    case 'normal':
    default: return '🐟';
  }
}

function handleBottomDwelling(f) {
  // Steer towards bottom area
  const targetY = H - 60 + rand(-20, 20);
  const targetX = f.x + rand(-30, 30);
  steerTowards(f, targetX, targetY, 0.03);

  // Slower movement when bottom dwelling
  f.vx *= 0.8;
  f.vy *= 0.8;
}

function handleWallFollowing(f) {
  const margin = 30;

  // If no wall target set, find closest wall
  if (!f.wallFollowTarget) {
    const distToLeft = f.x;
    const distToRight = W - f.x;
    const distToTop = f.y;
    const distToBottom = H - f.y;

    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
    if (minDist === distToLeft) f.wallFollowTarget = 'left';
    else if (minDist === distToRight) f.wallFollowTarget = 'right';
    else if (minDist === distToTop) f.wallFollowTarget = 'top';
    else f.wallFollowTarget = 'bottom';
  }

  // Follow the wall
  switch(f.wallFollowTarget) {
    case 'left':
      steerTowards(f, margin, f.y + rand(-40, 40), 0.04);
      break;
    case 'right':
      steerTowards(f, W - margin, f.y + rand(-40, 40), 0.04);
      break;
    case 'top':
      steerTowards(f, f.x + rand(-40, 40), margin, 0.04);
      break;
    case 'bottom':
      steerTowards(f, f.x + rand(-40, 40), H - margin, 0.04);
      break;
  }
}

function handleResting(f) {
  // Very slow movement, mostly stay in place
  f.vx *= 0.3;
  f.vy *= 0.3;

  // Small gentle floating motion
  const time = Date.now() * 0.001;
  f.vx += Math.sin(time + f.x * 0.01) * 0.02;
  f.vy += Math.cos(time * 0.7 + f.y * 0.01) * 0.015;
}

function handleSurfaceSwimming(f) {
  // Steer towards surface area
  const targetY = 40 + rand(-10, 20);
  const targetX = f.x + rand(-40, 40);
  steerTowards(f, targetX, targetY, 0.03);
}

function handleSchooling(f) {
  const schoolRadius = 80;
  const separationRadius = 25;
  let nearby = [];

  // Find nearby fish
  for(const other of fishes) {
    if(other === f) continue;
    const dist = Math.hypot(other.x - f.x, other.y - f.y);
    if(dist < schoolRadius) {
      nearby.push({fish: other, distance: dist});
    }
  }

  if(nearby.length > 0) {
    // Separation: avoid getting too close
    let sepX = 0, sepY = 0;
    let tooClose = 0;
    for(const n of nearby) {
      if(n.distance < separationRadius) {
        sepX += (f.x - n.fish.x) / n.distance;
        sepY += (f.y - n.fish.y) / n.distance;
        tooClose++;
      }
    }
    if(tooClose > 0) {
      sepX /= tooClose;
      sepY /= tooClose;
      f.vx += sepX * 0.1;
      f.vy += sepY * 0.1;
    }

    // Cohesion: move towards center of group
    let centerX = 0, centerY = 0;
    for(const n of nearby) {
      centerX += n.fish.x;
      centerY += n.fish.y;
    }
    centerX /= nearby.length;
    centerY /= nearby.length;
    steerTowards(f, centerX, centerY, 0.02);

    // Alignment: match velocity of nearby fish
    let avgVx = 0, avgVy = 0;
    for(const n of nearby) {
      avgVx += n.fish.vx;
      avgVy += n.fish.vy;
    }
    avgVx /= nearby.length;
    avgVy /= nearby.length;
    f.vx += (avgVx - f.vx) * 0.05;
    f.vy += (avgVy - f.vy) * 0.05;
  }
}

function handlePlayful(f) {
  // Fast swimming with sudden direction changes
  // Quick random turns every 30-90 frames (0.5-1.5 seconds)
  if(!f.playfulTurnTimer) f.playfulTurnTimer = 0;
  f.playfulTurnTimer--;

  if(f.playfulTurnTimer <= 0) {
    f.playfulTurnTimer = Math.floor(rand(30, 90));
    // Sharp random direction change
    const angle = rand(0, Math.PI * 2);
    f.targetVx = Math.cos(angle) * f.speed * 1.3; // 30% faster
    f.targetVy = Math.sin(angle) * f.speed * 0.5;
  }

  // Quick steering for playful darting
  if(f.targetVx !== undefined && f.targetVy !== undefined) {
    f.vx += (f.targetVx - f.vx) * 0.2; // Fast steering
    f.vy += (f.targetVy - f.vy) * 0.2;
  }
}

function handleEnergetic(f) {
  // Super fast zigzag sprint pattern
  if(!f.energeticTimer) f.energeticTimer = 0;
  f.energeticTimer++;

  // Zigzag every 20 frames
  if(f.energeticTimer % 20 === 0) {
    const baseAngle = Math.atan2(f.vy, f.vx);
    const zigzag = (Math.floor(f.energeticTimer / 20) % 2 === 0) ? Math.PI / 6 : -Math.PI / 6;
    const newAngle = baseAngle + zigzag;

    f.targetVx = Math.cos(newAngle) * f.speed * 1.8; // 80% faster!
    f.targetVy = Math.sin(newAngle) * f.speed * 0.6;
  }

  // Very fast steering
  if(f.targetVx !== undefined && f.targetVy !== undefined) {
    f.vx += (f.targetVx - f.vx) * 0.25;
    f.vy += (f.targetVy - f.vy) * 0.25;
  }
}

function handleJumping(f) {
  // Jumping behavior: swim up fast, then drop down
  if(!f.jumpPhase) f.jumpPhase = 'up';
  if(!f.jumpTimer) f.jumpTimer = 0;

  if(f.jumpPhase === 'up') {
    // Swim up towards surface
    const targetY = 30;
    steerTowards(f, f.x + rand(-20, 20), targetY, 0.08);

    // When near surface, switch to down
    if(f.y < 50) {
      f.jumpPhase = 'down';
      f.jumpTimer = Math.floor(rand(60, 120));
    }
  } else {
    // Drop down
    f.vy += 0.15; // Gravity effect
    f.vx *= 0.98; // Slow horizontal movement

    f.jumpTimer--;
    if(f.jumpTimer <= 0) {
      f.jumpPhase = 'up';
    }
  }
}

function handleLazy(f) {
  // Very slow drifting, mostly sinking
  f.vx *= 0.85; // Heavy damping
  f.vy *= 0.85;

  // Slow sinking
  f.vy += 0.02;

  // Tiny random drift
  const time = Date.now() * 0.0005;
  f.vx += Math.sin(time + f.x * 0.02) * 0.01;
  f.vy += Math.cos(time * 0.3 + f.y * 0.02) * 0.008;
}

function handleCurious(f) {
  // Find something to investigate: decorations, plants, other fish, or the pump
  if(!f.curiousTarget || Math.random() < 0.02) {
    const options = [];

    // If pump is on, add it as a high-priority target (add multiple times to increase chance)
    if(pumpOn) {
      for(let i = 0; i < 3; i++) {
        options.push({x: pumpPos.x, y: H - 30});
      }
    }

    // Add decorations as targets
    decorations.forEach(d => options.push({x: d.x, y: d.y}));

    // Add plants as targets
    plants.forEach(p => options.push({x: p.x, y: p.y}));

    // Add other fish as targets
    fishes.forEach(other => {
      if(other !== f) options.push({x: other.x, y: other.y});
    });

    // Pick random target
    if(options.length > 0) {
      f.curiousTarget = options[Math.floor(rand(0, options.length))];
    }
  }

  // Swim towards target
  if(f.curiousTarget) {
    steerTowards(f, f.curiousTarget.x, f.curiousTarget.y, 0.04);

    // When close, pick new target
    const dist = Math.hypot(f.curiousTarget.x - f.x, f.curiousTarget.y - f.y);
    if(dist < 30) {
      f.curiousTarget = null;
    }
  }
}

function handleDancing(f) {
  // Oscillating up and down movement (dancing)
  if(!f.danceTimer) f.danceTimer = 0;
  f.danceTimer++;

  // Sine wave for up/down motion
  const danceSpeed = 0.1;
  const amplitude = 2.0;
  const verticalForce = Math.sin(f.danceTimer * danceSpeed) * amplitude;

  f.vy += verticalForce * 0.1;

  // Slight horizontal sway
  f.vx += Math.cos(f.danceTimer * danceSpeed * 0.7) * 0.05;

  // Keep moving forward slowly
  const baseAngle = Math.atan2(f.vy, f.vx);
  f.vx += Math.cos(baseAngle) * 0.02;
}

function handleHiding(f) {
  // Find hiding spot: closest plant or decoration
  if(!f.hideTarget || Math.random() < 0.01) {
    let closest = null;
    let minDist = Infinity;

    // Check plants
    plants.forEach(p => {
      const dist = Math.hypot(p.x - f.x, p.y - f.y);
      if(dist < minDist) {
        minDist = dist;
        closest = {x: p.x, y: p.y + rand(-15, 15)};
      }
    });

    // Check decorations
    decorations.forEach(d => {
      const dist = Math.hypot(d.x - f.x, d.y - f.y);
      if(dist < minDist) {
        minDist = dist;
        closest = {x: d.x + rand(-20, 20), y: d.y};
      }
    });

    f.hideTarget = closest;
  }

  // Swim towards hiding spot
  if(f.hideTarget) {
    steerTowards(f, f.hideTarget.x, f.hideTarget.y, 0.04);

    // When close, stay still
    const dist = Math.hypot(f.hideTarget.x - f.x, f.hideTarget.y - f.y);
    if(dist < 40) {
      f.vx *= 0.9; // Heavy damping
      f.vy *= 0.9;
    }
  } else {
    // No hiding spots, just slow down
    f.vx *= 0.95;
    f.vy *= 0.95;
  }
}

function handleTerritorial(f) {
  // Define territory center if not set
  if(!f.territoryCenter) {
    f.territoryCenter = {x: f.x, y: f.y};
    f.territoryRadius = rand(80, 150);
  }

  // Check for intruders in territory
  let intruder = null;
  let closestDist = Infinity;

  fishes.forEach(other => {
    if(other === f) return;
    const dist = Math.hypot(other.x - f.territoryCenter.x, other.y - f.territoryCenter.y);
    if(dist < f.territoryRadius && dist < closestDist) {
      closestDist = dist;
      intruder = other;
    }
  });

  if(intruder) {
    // Chase intruder aggressively
    steerTowards(f, intruder.x, intruder.y, 0.08);

    // Speed boost when chasing
    const angle = Math.atan2(intruder.y - f.y, intruder.x - f.x);
    f.vx += Math.cos(angle) * 0.15;
    f.vy += Math.sin(angle) * 0.15;

    // Make intruder flee if close enough
    const chaseRadius = 60;
    const distToIntruder = Math.hypot(intruder.x - f.x, intruder.y - f.y);
    if(distToIntruder < chaseRadius) {
      // Intruder flees away from territorial fish
      const fleeAngle = Math.atan2(intruder.y - f.y, intruder.x - f.x);
      intruder.vx += Math.cos(fleeAngle) * 0.25;
      intruder.vy += Math.sin(fleeAngle) * 0.25;

      // Reset intruder's behavior if they were doing something else
      if(intruder.behaviorState !== 'normal' && intruder.behaviorState !== 'territorial') {
        intruder.behaviorState = 'normal';
        intruder.behaviorTimer = Math.floor(rand(60, 180));
      }
    }
  } else {
    // No intruder, patrol around territory center
    const distToCenter = Math.hypot(f.x - f.territoryCenter.x, f.y - f.territoryCenter.y);

    if(distToCenter > f.territoryRadius * 0.8) {
      // Return to center
      steerTowards(f, f.territoryCenter.x, f.territoryCenter.y, 0.04);
    } else {
      // Patrol in circles around center
      if(!f.patrolAngle) f.patrolAngle = 0;
      f.patrolAngle += 0.02;

      const patrolRadius = f.territoryRadius * 0.5;
      const targetX = f.territoryCenter.x + Math.cos(f.patrolAngle) * patrolRadius;
      const targetY = f.territoryCenter.y + Math.sin(f.patrolAngle) * patrolRadius * 0.5;

      steerTowards(f, targetX, targetY, 0.03);
    }
  }
}

function handleFloating(f) {
  // Almost no movement, just gentle drifting
  f.vx *= 0.92; // Strong damping
  f.vy *= 0.92;

  // Very subtle wave motion to simulate water currents
  const time = Date.now() * 0.0003;
  f.vx += Math.sin(time + f.x * 0.01) * 0.005;
  f.vy += Math.cos(time * 0.8 + f.y * 0.01) * 0.003;

  // Very slow vertical drift
  f.vy += Math.sin(time * 0.5) * 0.01;
}

function handleHunting(f) {
  // Initialize hunting state
  if(!f.huntPhase) f.huntPhase = 'stalking';
  if(!f.huntTarget) f.huntTimer = 0;

  if(f.huntPhase === 'stalking') {
    // Pick a target to hunt (other fish or random point)
    if(!f.huntTarget || Math.random() < 0.02) {
      // Sometimes hunt other fish
      if(fishes.length > 1 && Math.random() < 0.4) {
        const others = fishes.filter(other => other !== f);
        f.huntTarget = others[Math.floor(rand(0, others.length))];
      } else {
        // Hunt random point
        f.huntTarget = {
          x: rand(50, W - 50),
          y: rand(50, H - 50)
        };
      }
      f.huntTimer = Math.floor(rand(120, 300)); // Time until lunge
    }

    // Slow, stealthy approach
    const targetX = f.huntTarget.x || f.huntTarget.x;
    const targetY = f.huntTarget.y || f.huntTarget.y;
    steerTowards(f, targetX, targetY, 0.02); // Slow steering

    // Move slowly while stalking
    f.vx *= 0.93;
    f.vy *= 0.93;

    f.huntTimer--;

    // Check distance to target
    const dist = Math.hypot(targetX - f.x, targetY - f.y);

    // Lunge if timer expired or very close
    if(f.huntTimer <= 0 || dist < 80) {
      f.huntPhase = 'lunging';
      f.huntTimer = Math.floor(rand(30, 60)); // Lunge duration
    }

  } else if(f.huntPhase === 'lunging') {
    // Rapid burst towards target
    const targetX = f.huntTarget.x || f.huntTarget.x;
    const targetY = f.huntTarget.y || f.huntTarget.y;

    const lungeAngle = Math.atan2(targetY - f.y, targetX - f.x);
    f.vx += Math.cos(lungeAngle) * 0.3;
    f.vy += Math.sin(lungeAngle) * 0.3;

    f.huntTimer--;

    if(f.huntTimer <= 0) {
      // Reset to stalking
      f.huntPhase = 'stalking';
      f.huntTarget = null;
      f.huntTimer = 0;
    }
  }
}

function handleScared(f) {
  // Fish swims away rapidly in a panicked manner
  // Burst away from center of tank
  if(!f.scaredInitialized) {
    // Pick a random direction away from center
    const centerX = W / 2;
    const centerY = H / 2;
    const awayAngle = Math.atan2(f.y - centerY, f.x - centerX);
    const randomOffset = rand(-0.5, 0.5);

    f.targetVx = Math.cos(awayAngle + randomOffset) * f.speed * 2.5;
    f.targetVy = Math.sin(awayAngle + randomOffset) * f.speed * 2.5;
    f.scaredInitialized = true;
  }

  // Quick steering with high speed
  if(f.targetVx !== undefined && f.targetVy !== undefined) {
    f.vx += (f.targetVx - f.vx) * 0.15;
    f.vy += (f.targetVy - f.vy) * 0.15;
  }
}

function updateFish(f,dt,now){
  let target=null;let best=1e9;for(const p of foods){const d=(p.x-f.x)**2+(p.y-f.y)**2;if(d<best){best=d;target=p}}
  const hp=healthPct(f,now);

  // Af en toe een bubbeltje bij de vis (2% kans per frame als gezond)
  if(hp>30 && Math.random()<0.02){makeFishBubble(f.x,f.y)}

  // Heel af en toe een snelle "burst" beweging (0.3% kans)
  if(Math.random()<0.003){
    const burstAngle=rand(0,Math.PI*2);
    f.vx+=Math.cos(burstAngle)*0.8;
    f.vy+=Math.sin(burstAngle)*0.4;
  }

  // Update behavior timer
  f.behaviorTimer--;

  // High priority: food seeking (existing behavior)
  if(target){
    steerTowards(f,target.x,target.y,0.05);
    // Reset to normal behavior when food is found
    if(f.behaviorState !== 'normal') {
      f.behaviorState = 'normal';
      f.behaviorTimer = 0;
      f.wallFollowTarget = null;
    }
  }
  // Medium priority: pump attraction (existing behavior)
  else if(pumpOn || now<pumpJustOnUntil){
    if(pumpOn){steerTowards(f,pumpPos.x,H-30,0.006)}
    if(now<pumpJustOnUntil){steerTowards(f,pumpPos.x,H-30,0.045)}
    // Reset to normal behavior when near pump
    if(f.behaviorState !== 'normal') {
      f.behaviorState = 'normal';
      f.behaviorTimer = 0;
      f.wallFollowTarget = null;
    }
  }
  // Low priority: special behaviors or normal wandering
  else {
    // Check if behavior timer expired, switch to new behavior
    if(f.behaviorTimer <= 0) {
      const randVal = Math.random();

      // Adjust probabilities based on pump and disco state
      let curiousThreshold = 0.65; // Base: 9% curious (56-65%)
      let dancingThreshold = 0.71; // Base: 6% dancing (65-71%)

      // When pump is on, increase curious behavior chance
      if(pumpOn) {
        curiousThreshold = 0.75; // Increase curious range to 19% (56-75%)
      }

      // When disco is on, increase dancing behavior chance
      if(discoOn) {
        dancingThreshold = curiousThreshold + 0.15; // Increase dancing range to ~15%
      } else {
        dancingThreshold = curiousThreshold + 0.06; // Normal 6% dancing
      }

      if(randVal < 0.03) { // 3% bottom dwelling (0-3%)
        f.behaviorState = 'bottom_dwelling';
        f.behaviorTimer = Math.floor(rand(300, 900)); // 5-15 seconds at 60fps
        f.wallFollowTarget = null;
      } else if(randVal < 0.13) { // 10% wall following (3-13%)
        f.behaviorState = 'wall_following';
        f.behaviorTimer = Math.floor(rand(480, 1200)); // 8-20 seconds
        f.wallFollowTarget = null;
      } else if(randVal < 0.19) { // 6% resting (13-19%)
        f.behaviorState = 'resting';
        f.behaviorTimer = Math.floor(rand(180, 600)); // 3-10 seconds
        f.wallFollowTarget = null;
      } else if(randVal < 0.20) { // 1% surface swimming (19-20%)
        f.behaviorState = 'surface_swimming';
        f.behaviorTimer = Math.floor(rand(240, 720)); // 4-12 seconds
        f.wallFollowTarget = null;
      } else if(randVal < 0.32) { // 12% schooling (20-32%)
        f.behaviorState = 'schooling';
        f.behaviorTimer = Math.floor(rand(360, 1080)); // 6-18 seconds
        f.wallFollowTarget = null;
      } else if(randVal < 0.40) { // 8% playful (32-40%)
        f.behaviorState = 'playful';
        f.behaviorTimer = Math.floor(rand(180, 480)); // 3-8 seconds
        f.wallFollowTarget = null;
      } else if(randVal < 0.47) { // 7% energetic (40-47%)
        f.behaviorState = 'energetic';
        f.behaviorTimer = Math.floor(rand(120, 360)); // 2-6 seconds
        f.wallFollowTarget = null;
      } else if(randVal < 0.51) { // 4% jumping (47-51%)
        f.behaviorState = 'jumping';
        f.behaviorTimer = Math.floor(rand(240, 600)); // 4-10 seconds
        f.wallFollowTarget = null;
      } else if(randVal < 0.56) { // 5% lazy (51-56%)
        f.behaviorState = 'lazy';
        f.behaviorTimer = Math.floor(rand(300, 900)); // 5-15 seconds
        f.wallFollowTarget = null;
      } else if(randVal < 0.59) { // 3% hiding (56-59%)
        f.behaviorState = 'hiding';
        f.behaviorTimer = Math.floor(rand(240, 720)); // 4-12 seconds
        f.wallFollowTarget = null;
        f.hideTarget = null;
      } else if(randVal < 0.62) { // 3% territorial (59-62%)
        f.behaviorState = 'territorial';
        f.behaviorTimer = Math.floor(rand(600, 1200)); // 10-20 seconds
        f.wallFollowTarget = null;
        f.territoryCenter = null;
      } else if(randVal < 0.64) { // 2% floating (62-64%)
        f.behaviorState = 'floating';
        f.behaviorTimer = Math.floor(rand(180, 540)); // 3-9 seconds
        f.wallFollowTarget = null;
      } else if(randVal < 0.67) { // 3% hunting (64-67%)
        f.behaviorState = 'hunting';
        f.behaviorTimer = Math.floor(rand(360, 900)); // 6-15 seconds
        f.wallFollowTarget = null;
        f.huntPhase = null;
        f.huntTarget = null;
      } else if(randVal < curiousThreshold) { // Dynamic curious threshold (influenced by pump)
        f.behaviorState = 'curious';
        f.behaviorTimer = Math.floor(rand(360, 900)); // 6-15 seconds
        f.wallFollowTarget = null;
      } else if(randVal < dancingThreshold) { // Dynamic dancing threshold (influenced by disco)
        f.behaviorState = 'dancing';
        f.behaviorTimer = Math.floor(rand(240, 720)); // 4-12 seconds
        f.wallFollowTarget = null;
      } else { // Remaining % normal behavior
        f.behaviorState = 'normal';
        f.behaviorTimer = Math.floor(rand(120, 480)); // 2-8 seconds
        f.wallFollowTarget = null;
      }
    }

    // Execute current behavior
    switch(f.behaviorState) {
      case 'bottom_dwelling':
        handleBottomDwelling(f);
        break;
      case 'wall_following':
        handleWallFollowing(f);
        break;
      case 'resting':
        handleResting(f);
        break;
      case 'surface_swimming':
        handleSurfaceSwimming(f);
        break;
      case 'schooling':
        handleSchooling(f);
        break;
      case 'playful':
        handlePlayful(f);
        break;
      case 'energetic':
        handleEnergetic(f);
        break;
      case 'jumping':
        handleJumping(f);
        break;
      case 'lazy':
        handleLazy(f);
        break;
      case 'curious':
        handleCurious(f);
        break;
      case 'dancing':
        handleDancing(f);
        break;
      case 'hiding':
        handleHiding(f);
        break;
      case 'territorial':
        handleTerritorial(f);
        break;
      case 'floating':
        handleFloating(f);
        break;
      case 'hunting':
        handleHunting(f);
        break;
      case 'scared':
        handleScared(f);
        break;
      case 'normal':
      default:
        // Natural swimming behavior - gradual direction changes
        f.turnTimer--;if(f.turnTimer<=0){
          f.turnTimer=Math.floor(rand(600,1800)); // 10-30 seconds between turns

          // Calculate current direction from velocity
          const currentAngle = Math.atan2(f.vy, f.vx);

          // Small angle change (max 45 degrees = π/4 radians) for smooth turns
          const angleChange = rand(-Math.PI/4, Math.PI/4); // Random change between -45° and +45°
          let newAngle = currentAngle + angleChange;

          // Normalize angle to -PI to PI range
          while (newAngle > Math.PI) newAngle -= Math.PI * 2;
          while (newAngle < -Math.PI) newAngle += Math.PI * 2;

          // Set target velocities - use full speed for target
          f.targetVx = Math.cos(newAngle) * f.speed;
          f.targetVy = Math.sin(newAngle) * f.speed * 0.25; // Reduced vertical component
        }

        // Gradually steer towards target direction - ONLY when we have a target
        if(f.targetVx !== undefined && f.targetVy !== undefined) {
          const steerStrength = 0.12; // Medium steering for smooth but visible turns
          f.vx += (f.targetVx - f.vx) * steerStrength;
          f.vy += (f.targetVy - f.vy) * steerStrength;
        }
        // Removed random course corrections to reduce jittering
        if(hp<35){const ty=f.sickTop?40:H-40;steerTowards(f,f.x+rand(-60,60),ty,0.02)}
        break;
    }
  }

  if(discoOn&&Math.random()<0.001){ // Reduced frequency from 0.003 to 0.001
    // Disco mode still prefers horizontal movement but allows more vertical
    const angle=Math.random()*Math.PI*2;
    const force=0.15; // Reduced force from 0.3 to 0.15
    const horizontalBias=Math.abs(Math.cos(angle))*0.8+0.2; // Favor horizontal angles
    // Update target velocities instead of direct velocity change
    f.targetVx += Math.cos(angle)*force*horizontalBias;
    f.targetVy += Math.sin(angle)*force*(1-horizontalBias*0.6); // Reduce vertical component

    // Ensure fish doesn't get stuck by limiting extreme velocities
    f.targetVx = clamp(f.targetVx, -f.speed * 1.5, f.speed * 1.5);
    f.targetVy = clamp(f.targetVy, -f.speed * 0.8, f.speed * 0.8);
  }
  // Better speed curve: minimal slowdown until critical health
  let slow;
  if(hp > 50) {
    slow = 0.95; // 100-50% health: almost no slowdown
  } else if(hp > 25) {
    slow = 0.80; // 50-25% health: moderate slowdown
  } else {
    slow = 0.55; // 25-0% health: significant slowdown
  }
  if(discoOn) slow *= 1.2; // Disco mode speed boost

  // Sick fish are slower
  if(f.sick && !f.medicated) {
    const sickHealth = f.health || hp;
    if(sickHealth <= 30) {
      slow *= 0.4; // Critical: very slow
    } else if(sickHealth <= 60) {
      slow *= 0.6; // Sick: moderately slow
    } else {
      slow *= 0.8; // Early stage: slightly slow
    }
  }

  // Water greenness affects fish speed (dirty water = slower fish)
  const waterMultiplier = 1 - (waterGreenness * 0.003); // At 100% greenness = 0.7x speed
  slow *= waterMultiplier;

  // Apply friction and speed adjustments
  f.vx*=0.99;f.vy*=0.99;f.vx*=slow;f.vy*=slow;

  // Validate velocities before applying
  if(isNaN(f.vx)) f.vx = 0.1;
  if(isNaN(f.vy)) f.vy = 0.05;

  limitSpeed(f);

  // Validate position before updating
  if(isNaN(f.x)) f.x = W / 2;
  if(isNaN(f.y)) f.y = H / 2;

  // Update position
  f.x += f.vx;
  f.y += f.vy;

  // Hard clamp position to viewport bounds (safety net)
  f.x = clamp(f.x, 0, W);
  f.y = clamp(f.y, 0, H);

  // Validate position after updating
  if(isNaN(f.x)) f.x = W / 2;
  if(isNaN(f.y)) f.y = H / 2;

  bounceOffWalls(f);
  for(let i=foods.length-1;i>=0;i--){const p=foods[i];if(Math.hypot(p.x-f.x,p.y-f.y)<fishSize(f,now)*0.7+p.r){foods.splice(i,1);f.blink=8;f.lastEat=Date.now();f.eats++;if(ws && ws.readyState === WebSocket.OPEN){ws.send(JSON.stringify({command:'updateFishStats',fishName:f.name,stats:{eats:f.eats,lastEat:f.lastEat}}))}}}

  // Pooping logic - fish poop 15-60 minutes after eating
  const timeSinceEat = now - f.lastEat;
  const timeSincePoop = now - f.lastPoop;
  const minPoopInterval = 15 * 60 * 1000; // 15 minutes
  const maxPoopInterval = 60 * 60 * 1000; // 60 minutes

  if(timeSinceEat > minPoopInterval && timeSincePoop > minPoopInterval && Math.random() < 0.00001) {
    // Create poop at fish location
    poops.push({
      x: f.x + rand(-5, 5),
      y: f.y + rand(5, 15), // Slightly below fish
      createdAt: now,
      size: rand(3, 6)
    });
    f.lastPoop = now;

    // Report poop count to server for controller updates
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ command: 'reportPoop', poopCount: poops.length }));
    }
  }

  if(Date.now()-f.lastEat>=f.hungerWindow) f.dead=true;
}

function updateListItems(listEl,items){
  const existingItems=listEl.children;
  items.forEach((item,i)=>{
    if(i<existingItems.length){
      const el=existingItems[i];
      const labelSpan=el.querySelector('.label');
      const textNode=el.childNodes[1];
      if(labelSpan&&labelSpan.textContent!==item.idx){
        labelSpan.textContent=item.idx;
      }
      if(textNode&&textNode.textContent!==' '+item.label){
        textNode.textContent=' '+item.label;
      }
    }else{
      const d=document.createElement('div');
      d.className='item';
      const b=document.createElement('span');
      b.className='label';
      b.textContent=item.idx;
      d.appendChild(b);
      d.appendChild(document.createTextNode(' '+item.label));
      listEl.appendChild(d);
    }
  });
  while(listEl.children.length>items.length){
    listEl.removeChild(listEl.lastChild);
  }
}

function drawLists(){
  const now=Date.now();
  const deadListEl=document.getElementById('deadList');
  const deadPanelEl=document.getElementById('deadPanel');
  const oldestListEl=document.getElementById('oldestList');
  const livingListEl=document.getElementById('livingList');
  const newestListEl=document.getElementById('newestList');

  // Dead list
  const recent=deadLog.slice(-TOP_N).reverse();
  if(deadLog.length>0){
    deadPanelEl.style.display='block';
    const items=recent.map((it,i)=>{
      const ago=now-it.diedAt;
      const age=it.diedAt-it.bornAt;
      return{idx:i+1,label:`${it.name} · ${ageLabelMS(age)} oud · ${ageLabelMS(ago)} geleden`};
    });
    updateListItems(deadListEl,items);
  }else{
    deadPanelEl.style.display='none';
  }

  // Oldest list (combined live + dead)
  const combined=[];
  for(const f of fishes){combined.push({name:f.name,age:now-f.bornAt,type:'live'})}
  for(const d of deadLog){combined.push({name:d.name,age:(d.diedAt-d.bornAt),type:'dead'})}
  combined.sort((a,b)=>b.age-a.age);
  const oldestItems=combined.slice(0,TOP_N).map((x,i)=>({
    idx:i+1,
    label:`${x.name} · ${ageLabelMS(x.age)} ${x.type==='live'?'levend':'†'}`
  }));
  updateListItems(oldestListEl,oldestItems);

  // Living list
  const livingAges=[...fishes].map(f=>({name:f.name,age:now-f.bornAt})).sort((a,b)=>b.age-a.age).slice(0,TOP_N);
  const livingItems=livingAges.map((x,i)=>({idx:i+1,label:`${x.name} · ${ageLabelMS(x.age)}`}));
  updateListItems(livingListEl,livingItems);

  // Newest list
  const newest=[...fishes].sort((a,b)=>b.bornAt-a.bornAt).slice(0,TOP_N);
  const newestItems=newest.map((f,i)=>({idx:i+1,label:`${f.name} · ${ageLabelMS(now-f.bornAt)} geleden geboren`}));
  updateListItems(newestListEl,newestItems);
}

function drawActivityList(){
  const now=Date.now();
  const activityListEl=document.getElementById('activityList');
  const activityPanelEl=document.getElementById('activityPanel');
  if(!activityListEl||!activityPanelEl)return;

  if(recentActivity.length===0){
    activityPanelEl.style.display='none';
    return;
  }

  activityPanelEl.style.display='block';

  // Process events in reverse order (newest first)
  const eventsToShow=recentActivity.slice().reverse();

  // Get existing items
  const existingItems=activityListEl.children;

  // Update existing items and add new ones if needed
  eventsToShow.forEach((event,i)=>{
    const ago=now-event.timestamp;
    const timeStr=ageLabelMS(ago)+' geleden';
    let emoji='';
    let label='';

    switch(event.type){
      case 'feed':
        emoji='🍤';
        label=`Gevoerd · ${timeStr}`;
        break;
      case 'fish_added':
        emoji='🐟';
        label=`${event.data.name} toegevoegd · ${timeStr}`;
        break;
      case 'fish_died':
        emoji='💀';
        label=`${event.data.name} overleden · ${timeStr}`;
        break;
      case 'glass_tapped':
        emoji='👆';
        label=`Op kom getikt · ${timeStr}`;
        break;
      case 'tank_cleaned':
        emoji='💩';
        label=`Kom schoongemaakt · ${timeStr}`;
        break;
      case 'water_refreshed':
        emoji='💧';
        label=`Water ververst · ${timeStr}`;
        break;
      case 'medicine_added':
        emoji='💊';
        label=`Medicijn gegeven · ${timeStr}`;
        break;
      case 'light_toggle':
        emoji='💡';
        const lightState=event.data.state||'aan';
        label=`Licht ${lightState} · ${timeStr}`;
        break;
      case 'disco_toggle':
        emoji='🎉';
        const discoState=event.data.state||'aan';
        label=`Disco ${discoState} · ${timeStr}`;
        break;
      case 'pump_toggle':
        emoji='💨';
        const pumpState=event.data.state||'aan';
        label=`Pomp ${pumpState} · ${timeStr}`;
        break;
      default:
        emoji='📝';
        label=`${event.type} · ${timeStr}`;
    }

    // Update existing item or create new one
    if(i<existingItems.length){
      const item=existingItems[i];
      const labelSpan=item.querySelector('.label');
      const textNode=item.childNodes[1];
      if(labelSpan&&labelSpan.textContent!==emoji){
        labelSpan.textContent=emoji;
      }
      if(textNode&&textNode.textContent!==' '+label){
        textNode.textContent=' '+label;
      }
    }else{
      const d=document.createElement('div');
      d.className='item';
      const b=document.createElement('span');
      b.className='label';
      b.textContent=emoji;
      d.appendChild(b);
      d.appendChild(document.createTextNode(' '+label));
      activityListEl.appendChild(d);
    }
  });

  // Remove extra items if list got shorter
  while(activityListEl.children.length>eventsToShow.length){
    activityListEl.removeChild(activityListEl.lastChild);
  }
}

function drawQR(){
  const el=document.getElementById('qr');

  // Request current access code from server
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ command: 'getAccessCode' }));
  }
}

function updateQRWithCode(accessCode) {
  const el = document.getElementById('qr');
  const controllerUrl = `${window.location.protocol}//${window.location.host}/controller?code=${accessCode}`;

  console.log('📱 Generating local QR code for URL:', controllerUrl);

  // Show canvas and hide any existing img
  el.style.display = 'block';
  const existingImg = el.parentNode.querySelector('.qr-img');
  if (existingImg) {
    existingImg.style.display = 'none';
  }

  // Configure QR code options
  const qrOptions = {
    width: 200,
    height: 200,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    margin: 2
  };

  // Add visual feedback during generation
  el.style.opacity = '0.7';
  el.style.filter = 'blur(1px)';

  // Check if QRious library is available
  if (typeof QRious === 'undefined' || !window.qriousLoaded) {
    console.warn('⚠️ QRious library not loaded yet, retrying in 100ms...');

    // Retry after a short delay for library to load
    setTimeout(() => {
      console.log('🔄 Retrying QR generation...');
      updateQRWithCode(accessCode);
    }, 100);
    return;
  }

  try {
    // Generate QR code locally using QRious library
    const qr = new QRious({
      element: el,
      value: controllerUrl,
      size: 200, // Back to 200px
      level: 'M'
    });

    console.log('✅ Local QR code generated successfully with QRious');

    // Restore visual clarity with smooth transition
    el.style.transition = 'opacity 0.3s ease, filter 0.3s ease';
    el.style.opacity = '1';
    el.style.filter = 'none';

    // Style the canvas - override CSS to match external QR size
    el.style.borderRadius = '6px';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,.25)';
    el.style.background = '#fff';
    el.style.width = '200px';  // Fixed width to match external QR
    el.style.height = '200px'; // Fixed height to match external QR

  } catch (error) {
    console.error('❌ Local QR generation failed:', error);
    // Fallback to old method if local generation fails
    fallbackToExternalQR(el, controllerUrl, accessCode);
  }
}

// Fallback function for external QR generation (backup)
function fallbackToExternalQR(canvas, controllerUrl, accessCode) {
  console.log('🔄 Falling back to external QR service...');

  canvas.style.display = 'none';
  let img = canvas.parentNode.querySelector('.qr-img');
  if (!img) {
    img = document.createElement('img');
    img.className = 'qr-img';
    img.style.cssText = 'display: block; width: 200px; height: 200px; margin: 0 auto; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,.25); background: #fff';
    canvas.parentNode.insertBefore(img, canvas);
  }

  img.style.display = 'block';
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(controllerUrl)}&t=${Date.now()}`;
  img.alt = 'QR Code naar Controller';
}

// WebSocket connection for receiving commands
let ws = null;
let currentVersion = null; // Store current version to detect changes
let appConfig = { showBehaviorEmoji: false }; // Store config from server

function initWebSocket() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const port = window.location.port ? `:${window.location.port}` : '';
        ws = new WebSocket(`${protocol}//${window.location.hostname}${port}`);

        ws.onopen = function() {
            console.log('WebSocket verbonden met server');
            // Request current game state from server
            ws.send(JSON.stringify({ command: 'getGameState' }));
            // Request access code for QR
            ws.send(JSON.stringify({ command: 'getAccessCode' }));
            // Request version info
            ws.send(JSON.stringify({ command: 'getVersion' }));
            // Request config for viewport settings
            ws.send(JSON.stringify({ command: 'getConfig' }));
            // Request recent activity for activity list
            ws.send(JSON.stringify({ command: 'getRecentActivity' }));
        };

        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);

                // Handle vissenkom already active error
                if (data.error === 'vissenkom_already_active') {
                    console.log('🚫 Vissenkom al actief elders:', data.message);
                    showVisssenkomAlreadyActiveError(data.message);
                    return;
                }

                handleRemoteCommand(data);
            } catch (error) {
                console.error('Fout bij verwerken WebSocket bericht:', error);
            }
        };

        ws.onclose = function() {
            console.log('WebSocket verbinding gesloten, probeer opnieuw...');
            setTimeout(initWebSocket, 3000);
        };

        ws.onerror = function(error) {
            console.error('WebSocket fout:', error);
        };
    } catch (error) {
        console.error('Kan geen WebSocket verbinding maken:', error);
        setTimeout(initWebSocket, 3000);
    }
}

function handleRemoteCommand(data) {
    switch (data.type) {
        case 'gameState':
            loadGameState(data.data);
            break;
        case 'status':
            // Update water greenness target from server (smooth transition)
            if(data.data && data.data.waterGreenness !== undefined) {
                waterGreennessTarget = data.data.waterGreenness;
                console.log('💧 Water greenness target updated from server:', waterGreennessTarget.toFixed(2) + '%');
            }
            break;
        case 'accessCode':
            console.log('🔄 Received new access code from server:', data.code);
            updateQRWithCode(data.code);
            break;
        case 'config':
            console.log('🔄 Received config from server:', data.config);
            if(data.config) {
                // Store full config
                appConfig = { ...appConfig, ...data.config };
                // Handle viewport config
                if(data.config.viewport) {
                    viewportConfig = data.config.viewport;
                    resize(); // Recalculate viewport dimensions
                }
            }
            break;
        case 'version':
            // Check if version has changed (and currentVersion is not empty)
            if (currentVersion && currentVersion !== data.version) {
                console.log('🔄 Nieuwe versie gedetecteerd:', data.version, '(was:', currentVersion, ')');
                console.log('🔄 Pagina wordt opnieuw geladen...');
                location.reload();
            } else {
                // First time receiving version or same version
                currentVersion = data.version;
                document.getElementById('versionNumber').textContent = data.version;
                console.log('✅ Huidige versie:', currentVersion);
            }
            break;
        case 'recentActivity':
            console.log('🕐 Received recent activity:', data.events.length, 'events');
            recentActivity = data.events || [];
            drawActivityList();
            break;
        default:
            // Handle regular commands
            switch (data.command) {
                case 'feed':
                    feed();
                    break;
                case 'addFish':
                    addFish(data.fishData || data.name, data.fishCounter);
                    break;
                case 'toggleLight':
                    toggleLight();
                    break;
                case 'toggleDisco':
                    toggleDisco();
                    break;
                case 'togglePump':
                    togglePump();
                    break;
                case 'cleanTank':
                    cleanTank();
                    break;
                case 'refreshWater':
                    refreshWater();
                    break;
                case 'tapGlass':
                    tapGlass();
                    break;
                case 'addMedicine':
                    console.log('💊 Medicine added - fish will recover');
                    // No visual action needed, server handles the logic
                    break;
                case 'diseaseUpdate':
                    console.log('🦠 Disease status updated');
                    // No visual action needed, server handles the logic
                    break;
                default:
                    console.log('Onbekend commando:', data.command);
            }
    }
}

function loadGameState(state) {
    console.log('Game state geladen van server:', state);

    // Update global variables
    lastFed = state.lastFed;
    fishCounter = state.fishCounter;
    lightsOn = state.lightsOn;
    discoOn = state.discoOn;
    pumpOn = state.pumpOn;
    waterGreenness = state.waterGreenness || 0;
    waterGreennessTarget = state.waterGreenness || 0;

    // Clear current fishes and load from server
    fishes.length = 0;
    state.fishes.forEach(serverFish => {
        const fish = makeFishFromData(serverFish);
        if (fish) fishes.push(fish);
    });

    // Load dead log
    deadLog.length = 0;
    state.deadLog.forEach(deadFish => {
        deadLog.push(deadFish);
    });

    // Regenerate poop objects based on poopCount
    poops.length = 0;
    const poopCount = state.poopCount || 0;
    for (let i = 0; i < poopCount; i++) {
        poops.push({
            x: rand(40, W - 40),
            y: rand(H - 60, H - 20), // On the bottom
            createdAt: Date.now(),
            size: rand(3, 6)
        });
    }
    console.log(`Regenerated ${poopCount} poop objects`);

    // Update UI
    updateLightUI();
    updateDiscoUI();
    updatePumpUI();
    updateCooldown();
    drawLists();
    drawActivityList();

    console.log(`Geladen: ${fishes.length} vissen, ${deadLog.length} overleden vissen`);

    // Report current poop count to server
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ command: 'reportPoop', poopCount: poops.length }));
    }
}

function makeFishFromData(serverFish) {
    // Ensure hue is always a valid number
    let hue = serverFish.hue !== undefined ? serverFish.hue : Math.floor(rand(0, 360));
    if(isNaN(hue) || hue < 0 || hue > 360) hue = Math.floor(rand(0, 360));

    // Use saved position if available, otherwise spawn in safe area
    let startX = rand(W * 0.2, W * 0.8); // Spawn away from edges
    let startY = rand(H * 0.2, H * 0.8);

    // Validate starting position
    if(isNaN(startX) || startX < 50 || startX > W - 50) startX = W / 2;
    if(isNaN(startY) || startY < 50 || startY > H - 50) startY = H / 2;

    const f = {
        x: startX,
        y: startY,
        vx: rand(-1, 1),
        vy: rand(-0.5, 0.5),
        // Use saved visual properties or fallback to random (for backwards compatibility)
        speed: serverFish.speed !== undefined ? serverFish.speed : rand(1.5, 2.5),
        baseSize: serverFish.baseSize !== undefined ? serverFish.baseSize : rand(18, 30),
        hue: hue,
        sickTop: serverFish.sickTop !== undefined ? serverFish.sickTop : (Math.random() < 0.5),
        hungerWindow: serverFish.hungerWindow !== undefined ? serverFish.hungerWindow : (DAY * rand(0.9, 1.1)),
        // Movement properties (still random each time)
        dir: Math.random() * Math.PI * 2,
        turnTimer: Math.floor(rand(600, 1800)),
        blink: 0,
        // Persistent data
        name: serverFish.name,
        lastEat: serverFish.lastEat || Date.now(),
        bornAt: serverFish.addedAt || serverFish.bornAt || Date.now(),
        eats: serverFish.eats || 0,
        lastPoop: serverFish.lastPoop || Date.now(),
        // Disease properties
        sick: serverFish.sick || false,
        sickStartedAt: serverFish.sickStartedAt || null,
        medicated: serverFish.medicated || false,
        medicatedAt: serverFish.medicatedAt || null,
        health: serverFish.health !== undefined ? serverFish.health : 100,
        // Behavior state (new, defaults to normal)
        behaviorState: 'normal',
        behaviorTimer: 0,
        wallFollowTarget: null
    };
    return f;
}

function updateLightUI() {
    document.getElementById('tank').style.background = lightsOn ? BG : BG_NIGHT;
    document.body.classList.toggle('light', lightsOn);
    document.body.classList.toggle('dark', !lightsOn);
}

function updateDiscoUI() {
    // No statusbar update needed - status only visible on controller
}

function updatePumpUI() {
    if (pumpOn) {
        pumpPos.x = W - 70;
        pumpJustOnUntil = Date.now() + 3000;
    }
}

function feed(){const now=Date.now();if(now-lastFed<FEED_CD)return;lastFed=now;makeFood();updateCooldown()}
function addFish(nameOrData, newCounter){
    if(fishes.length>=36)return;
    if(newCounter)fishCounter=newCounter;

    if(typeof nameOrData === 'object') {
        // Received fish data object from server
        const fish = makeFishFromData(nameOrData);
        if(fish) fishes.push(fish);
    } else {
        // Received just name (legacy support)
        const fishName = nameOrData || `Vis ${fishCounter}`;
        makeFish(undefined,undefined,fishName);
    }
}
function toggleLight(){lightsOn=!lightsOn;updateLightUI()}
function toggleDisco(){discoOn=!discoOn;updateDiscoUI()}
function togglePump(){pumpOn=!pumpOn;updatePumpUI()}
function cleanTank(){
  poops.length=0;
  console.log('Tank opgeruimd! Alle poep weggehaald.');

  // Report poop count to server for controller updates
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ command: 'reportPoop', poopCount: 0 }));
  }
}
function refreshWater(){
  waterGreenness=0;
  waterGreennessTarget=0;
  algenParticles.length=0;
  console.log('💧 Water ververst! Greenness gereset naar 0%.');

  // Report water greenness to server for controller updates
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ command: 'reportWaterGreenness', waterGreenness: 0 }));
  }
}

function tapGlass(){
  console.log('👊 Op het glas getikt! Vissen schrikken!');

  // Make all fish scared for a short duration
  fishes.forEach(f => {
    f.behaviorState = 'scared';
    f.behaviorTimer = Math.floor(rand(120, 240)); // 2-4 seconds of being scared
    f.scaredInitialized = false; // Reset scared state
  });
}

function updateCooldown(){
    const cd=document.getElementById('cooldown');
    const left=Math.max(0,FEED_CD-(Date.now()-lastFed));

    if(left<=0){
        cd.textContent='✅ Beschikbaar';
        cd.classList.add('ready');
    } else {
        // Better time formatting like ageLabelMS
        const timeText = ageLabelMS(left);
        cd.textContent=`Voeren kan over ${timeText}`;
        cd.classList.remove('ready');
    }
}

function updateSickFishStatus(){
    const sickFishEl = document.getElementById('sickFishStatus');
    if (!sickFishEl) return;

    const sickCount = fishes.filter(f => f.sick && !f.medicated).length;

    if (sickCount === 0) {
        sickFishEl.textContent = '✅ Geen';
        sickFishEl.style.color = '#4ecdc4';
    } else if (sickCount === 1) {
        sickFishEl.textContent = '🦠 1 vis';
        sickFishEl.style.color = '#ff9800';
    } else {
        sickFishEl.textContent = `🦠 ${sickCount} vissen`;
        sickFishEl.style.color = '#f44336';
    }
}

// Event listeners zijn verwijderd - controls zijn nu in de controller pagina

function regenerateDecor(){
  setupPlants();
  setupDecorations();
  console.log('Nieuwe decoratie gegenereerd!');
}

function init(){document.getElementById('tank').style.background=BG;document.body.classList.add('dark');document.body.classList.remove('light');lightsOn=true;resize();updateCooldown();drawLists();drawActivityList();initWebSocket()}
init();

let t=0;let lastListUpdate=0;let lastCooldownUpdate=0;let lastDecorUpdate=0;
let fadeState='idle';let fadeAlpha=1;let fadeStartTime=0;
const LIST_UPDATE_INTERVAL=5000;const COOLDOWN_UPDATE_INTERVAL=1000;const DECOR_UPDATE_INTERVAL=3600000; // 1 hour
const FADE_DURATION=1500; // 1.5 seconds for each fade phase

function loop(){const now=Date.now();const dt=Math.min(0.05,(now-lastT)/1000);lastT=now;t++;
measureFPS(); // Measure FPS for adaptive performance

// Skip frame if performance is low
if(performanceProfile.skipFrames>0&&t%2===0){
  requestAnimationFrame(loop);
  return;
}

// Smooth interpolation for waterGreenness (fade effect)
const lerpSpeed=0.02; // Lower = slower fade, smoother transition
waterGreenness+=(waterGreennessTarget-waterGreenness)*lerpSpeed;

clearFrame(t/60);

// Draw background elements first (behind fish)
const backPlants=plants.filter(p=>p.zIndex==='back');
const frontPlants=plants.filter(p=>p.zIndex==='front');
const backDecorations=decorations.filter(d=>d.zIndex==='back');
const frontDecorations=decorations.filter(d=>d.zIndex==='front');

// Apply viewport transform for all drawing
ctx.save();
ctx.translate(viewportConfig.offsetLeft,viewportConfig.offsetTop);
// Clip to viewport area to prevent rendering outside bounds
ctx.beginPath();
ctx.rect(0,0,W,H);
ctx.clip();

// Background layer
drawSandBottom(t/60);
for(const plant of backPlants){drawPlant(plant,t)}
for(const deco of backDecorations){drawDecoration(deco,t)}

if(pumpOn&&Math.random()<0.6*performanceProfile.particleCount){for(let i=0;i<2;i++)makeBubble()}
drawBubbles();drawFood();drawPoops();

// Fish layer
for(const f of fishes){updateFish(f,dt,now);drawFish(f,t,now)}

// Foreground layer
for(const plant of frontPlants){drawPlant(plant,t)}
for(const deco of frontDecorations){drawDecoration(deco,t)}

// Water greenness overlay and algae particles
updateAlgenParticles();
drawAlgenParticles();
drawWaterGreenness();

ctx.restore();

for(let i=fishes.length-1;i>=0;i--){if(fishes[i].dead){const deadFish={name:fishes[i].name,bornAt:fishes[i].bornAt,diedAt:Date.now()};deadLog.push(deadFish);fishes.splice(i,1);if(ws && ws.readyState === WebSocket.OPEN){ws.send(JSON.stringify({command:'fishDied',fish:deadFish}))}}}

if(now-lastListUpdate>LIST_UPDATE_INTERVAL){drawLists();drawActivityList();lastListUpdate=now}
if(now-lastCooldownUpdate>COOLDOWN_UPDATE_INTERVAL){updateCooldown();lastCooldownUpdate=now}

// Handle decoratie fade system
if(fadeState==='idle'&&now-lastDecorUpdate>DECOR_UPDATE_INTERVAL){
  // Start fade out
  fadeState='fading_out';
  fadeStartTime=now;
} else if(fadeState==='fading_out'){
  const fadeProgress=(now-fadeStartTime)/FADE_DURATION;
  if(fadeProgress>=1){
    // Switch to fade in and generate new decor
    fadeState='fading_in';
    fadeStartTime=now;
    fadeAlpha=0;
    regenerateDecor();
    lastDecorUpdate=now;
  } else {
    fadeAlpha=1-fadeProgress;
  }
} else if(fadeState==='fading_in'){
  const fadeProgress=(now-fadeStartTime)/FADE_DURATION;
  if(fadeProgress>=1){
    fadeState='idle';
    fadeAlpha=1;
  } else {
    fadeAlpha=fadeProgress;
  }
}

requestAnimationFrame(loop)}loop();

// Show error when vissenkom is already active elsewhere
function showVisssenkomAlreadyActiveError(message) {
    // Create error overlay
    const overlay = document.createElement('div');
    overlay.id = 'vissenkom-error-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: 'Segoe UI', Arial, sans-serif;
    `;

    // Create error content
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 12px;
        text-align: center;
        max-width: 400px;
        margin: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;

    content.innerHTML = `
        <div style="font-size: 48px; color: #ff6b6b; margin-bottom: 20px;">⚠️</div>
        <h2 style="color: #333; margin: 0 0 15px 0; font-size: 24px;">Vissenkom Al Actief</h2>
        <p style="color: #666; margin: 0 0 25px 0; line-height: 1.5;">${message}</p>
        <button onclick="location.reload()" style="
            background: #50e3c2;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.2s;
        " onmouseover="this.style.background='#45d4b3'" onmouseout="this.style.background='#50e3c2'">
            Probeer Opnieuw
        </button>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Disable canvas and other interactions
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.style.pointerEvents = 'none';
        canvas.style.filter = 'blur(3px)';
    }

    console.log('🚫 Vissenkom error overlay shown');
}
