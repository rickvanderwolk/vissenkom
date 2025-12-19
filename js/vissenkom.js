const cv=document.getElementById('c');const ctx=cv.getContext('2d');
const rand=(a,b)=>Math.random()*(b-a)+a;const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let lamps=[];let W=0,H=0;
let viewportConfig={offsetTop:0,offsetBottom:0,offsetLeft:0,offsetRight:0};

// === ADAPTIVE PERFORMANCE SYSTEM ===
let performanceProfile={quality:'high',particleCount:1,detailLevel:1,skipFrames:0,fishUpdateRate:1};
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
  if(avgFPS>=55){
    performanceProfile={quality:'high',particleCount:1,detailLevel:1,skipFrames:0,fishUpdateRate:1};
  }else if(avgFPS>=40){
    performanceProfile={quality:'medium',particleCount:0.7,detailLevel:0.85,skipFrames:0,fishUpdateRate:1};
  }else if(avgFPS>=25){
    performanceProfile={quality:'low',particleCount:0.4,detailLevel:0.7,skipFrames:0,fishUpdateRate:2};
  }else{
    performanceProfile={quality:'verylow',particleCount:0.2,detailLevel:0.5,skipFrames:1,fishUpdateRate:3};
  }
}

// === DEBUG FUNCTIONS ===
let debugOverlayVisible=false;
let debugOverlayInterval=null;
function showStats(){
  if(debugOverlayVisible){hideStats();return}
  debugOverlayVisible=true;
  let overlay=document.getElementById('debug-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='debug-overlay';
    overlay.style.cssText='position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:12px;padding:10px 15px;border-radius:5px;z-index:9999;min-width:220px;line-height:1.4;';
    document.body.appendChild(overlay);
  }
  overlay.style.display='block';
  function update(){
    const avgFPS=fpsHistory.length>0?Math.round(fpsHistory.reduce((a,b)=>a+b,0)/fpsHistory.length):0;
    const currentFPS=fpsHistory.length>0?fpsHistory[fpsHistory.length-1]:0;
    const fpsColor=currentFPS>=50?'#0f0':currentFPS>=30?'#ff0':'#f00';
    const on='<span style="color:#0f0">ON</span>';
    const off='<span style="color:#f00">OFF</span>';
    overlay.innerHTML=`
      <div style="border-bottom:1px solid #0f0;margin-bottom:6px;padding-bottom:4px;font-weight:bold">🐟 Stats</div>
      <div style="color:#888;font-size:10px;margin-bottom:4px">PERFORMANCE</div>
      <div>FPS: <span style="color:${fpsColor}">${currentFPS}</span> (avg: ${avgFPS})</div>
      <div>Quality: <span style="color:#0ff">${performanceProfile.quality}</span></div>
      <div>Particles: ${Math.round(performanceProfile.particleCount*100)}% | Detail: ${Math.round(performanceProfile.detailLevel*100)}%</div>
      <div style="color:#888;font-size:10px;margin-top:6px;margin-bottom:4px">VISSENKOM</div>
      <div>Theme: <span style="color:#ff0">${currentTheme}</span></div>
      <div>Temp: ${currentTemperature}°C | Algae: ${Math.round(waterGreenness)}%</div>
      <div>Lights: ${lightsOn?on:off} | Disco: ${discoOn?on:off}</div>
      <div>Pump: ${pumpOn?on:off} | Heating: ${heatingOn?on:off}</div>
      <div style="color:#888;font-size:10px;margin-top:6px;margin-bottom:4px">OBJECTS</div>
      <div>Fish: ${fishes.length} | Food: ${foods.length} | Poop: ${poops.length}</div>
      <div>Bubbles: ${bubbles.length} | Plants: ${plants.length}</div>
      <div>Decorations: ${decorations.length} | Stars: ${stars.length}</div>
      <div>Particles: ${particles.length} | Algae: ${algenParticles.length}</div>
    `;
  }
  update();
  debugOverlayInterval=setInterval(update,500);
  console.log('Stats visible. Run showStats() again to hide.');
}
function hideStats(){
  debugOverlayVisible=false;
  if(debugOverlayInterval){clearInterval(debugOverlayInterval);debugOverlayInterval=null}
  const overlay=document.getElementById('debug-overlay');
  if(overlay)overlay.style.display='none';
}
window.showStats=showStats;

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
  pumpPos.x=W-70; // Altijd initialiseren voor champagnefles
  updateUIPositions();
  setupLamps();setupDiscoBall();setupFishingRod();setupPlants();setupDecorations();setupStars();setupParticles();setupSpiderWebs();
  updateLayerCache();
  drawQR();
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
const BG='#083042';const BG_NIGHT='#04121a';const BG_HALLOWEEN='#020d12'; // Veel donkerder, griezeliger voor Halloween
const fishes=[];const foods=[];const deadLog=[];const bubbles=[];const poops=[];
const plants=[];const decorations=[];const stars=[];const particles=[];const algenParticles=[];
const playBalls=[]; // Speelballen voor vissen
const spiderWebs=[]; // Halloween spinnenwebben (statisch)
const fireworks=[]; // Nieuwjaar vuurwerk
let recentActivity=[];
let playedAudioEvents=new Set(); // Track welke events al audio hebben afgespeeld
let plingAudio=null; // Herbruikbaar audio object voor pling geluid
let lastFed=0;let lastMedicine=0;let feedCooldown=60*60*1000;let medicineCooldown=24*60*60*1000;let fishCounter=1;let lastT=Date.now();let TOP_N=3;let lastSeenSeq=0;
let lightsOn=true;let discoOn=false;let pumpOn=false;let heatingOn=true;const pumpPos={x:0,y:0};let pumpJustOnUntil=0;
let discoBall={x:0,y:0,targetY:0,rotation:0,deployed:false,deployStart:0,deployDuration:2500,undeploying:false,undeployStart:0};
let fishingRod={x:0,y:0,targetY:0,deployed:false,deployStart:0,deployDuration:2000,state:'idle',caughtFish:null,reelingStart:0,showCatchStart:0,baitSwing:0,retractStart:0};
let race={active:false,fish1:null,fish2:null,startTime:0,duration:15000,startX:0,finishX:0,fish1Speed:0,fish2Speed:0,fish1X:0,fish2X:0,winner:null,spectatorPositions:[],showingWinner:false,winnerFish:null,loserFish:null,winnerShowStart:0};
let waterGreenness=0;let waterGreennessTarget=0;
let currentTemperature=24;
let currentTheme='normal'; // Current theme (loaded from server)

// Helper functions for theme
function getThemeConfig(){return THEMES[currentTheme]||THEMES.normal}
function isHalloween(){return currentTheme==='halloween'}
function isChristmas(){return currentTheme==='christmas'}
function isNewYear(){return currentTheme==='newyear'}
function isWinter(){return currentTheme==='winter'}
function isSummer(){return currentTheme==='summer'}
function hasDecoration(type){return getThemeConfig().decorations.includes(type)}

// Theme configurations
const THEMES={
  normal:{
    name:'Normaal',
    emoji:'🐟',
    bgLight:['#0d5168','#094050','#073342','#052530'],
    bgDark:['#082030','#051520','#030f18','#020a10'],
    vignette:0.15,
    foodColors:['#ffb37a'],
    bubbleColor:'#bfeaf5',
    decorations:[]
  },
  spring:{
    name:'Lente',
    emoji:'🌸',
    bgLight:['#1a7a6e','#156b5f','#105c50','#0b4d42'],
    bgDark:['#0a4038','#083630','#062c28','#042220'],
    vignette:0.12,
    foodColors:['#ffb37a','#ffd700','#98fb98'],
    bubbleColor:'#d4f1f4',
    decorations:['flower','butterfly']
  },
  summer:{
    name:'Zomer',
    emoji:'☀️',
    bgLight:['#1e88e5','#1976d2','#1565c0','#0d47a1'],
    bgDark:['#0d3d70','#0a3060','#082450','#051840'],
    vignette:0.10,
    foodColors:['#ffb37a','#ff9800','#ffeb3b'],
    bubbleColor:'#81d4fa',
    decorations:['parasol']
  },
  autumn:{
    name:'Herfst',
    emoji:'🍂',
    bgLight:['#0d5168','#094050','#073342','#052530'],
    bgDark:['#082030','#051520','#030f18','#020a10'],
    vignette:0.15,
    foodColors:['#ff8c42','#ffa07a','#ff6347'],
    bubbleColor:'#bfeaf5',
    decorations:['leaf'],
    plantHueRange:[15,45]
  },
  winter:{
    name:'Winter',
    emoji:'❄️',
    bgLight:['#1a4d6d','#16415c','#12354a','#0e2938'],
    bgDark:['#0a1f2e','#081924','#06131a','#040d10'],
    vignette:0.20,
    foodColors:['#e0f7fa','#b2ebf2','#80deea'],
    bubbleColor:'#e6f7ff',
    decorations:['snowflake']
  },
  tropical:{
    name:'Tropisch',
    emoji:'🌴',
    bgLight:['#00838f','#00796b','#00695c','#004d40'],
    bgDark:['#003d3d','#003333','#002929','#001f1f'],
    vignette:0.14,
    foodColors:['#ff6b9d','#4ecdc4','#ffd93d'],
    bubbleColor:'#4dd0e1',
    decorations:['coral']
  },
  arctic:{
    name:'Arctisch',
    emoji:'🧊',
    bgLight:['#1e3a5f','#1a324f','#162a40','#122230'],
    bgDark:['#0f1b2e','#0c1624','#09111a','#060c10'],
    vignette:0.22,
    foodColors:['#b3e5fc','#81d4fa','#4fc3f7'],
    bubbleColor:'#b2ebf2',
    decorations:['aurora','ice']
  },
  halloween:{
    name:'Halloween',
    emoji:'🎃',
    bgLight:['#0a1418','#050c10','#020608','#000000'],
    bgDark:['#0a1418','#050c10','#020608','#000000'],
    vignette:0.40,
    foodColors:['#ff1744','#ff6f00','#9c27b0','#ff4081','#00e676'],
    bubbleColor:'#9d4edd',
    decorations:['pumpkin','skull','spiderweb']
  },
  christmas:{
    name:'Kerst',
    emoji:'🎄',
    bgLight:['#0f1a38','#1a2540','#0d1f35','#162038'], // Donkerblauw met meer variatie
    bgDark:['#070d1f','#0a1028','#060b1a','#081020'], // Diep donkerblauw
    vignette:0.25,
    foodColors:['#ff2d55','#00e676','#ffd700','#ffb3ba','#8b6f47'],
    bubbleColor:'#e6f7ff',
    decorations:['christmastree','snowman','christmaslights','snowflake']
  },
  newyear:{
    name:'Nieuwjaar',
    emoji:'🎆',
    bgLight:['#0a0a1a','#101028','#0d0d20','#080818'], // Donkere nachtlucht
    bgDark:['#050510','#080818','#040410','#020208'], // Diep donkerblauw/zwart
    vignette:0.30,
    foodColors:['#ffd700','#ffdf00','#f0e68c','#daa520'], // Gouden champagne kleuren
    bubbleColor:'#fffacd', // Champagne bubbels
    decorations:['oliebollen']
  }
};

function setupLamps(){const n=4;const baseWidth=180;const spread=0.12;const hue=48;const margin=W*0.08;const step=(W-2*margin)/Math.max(1,n-1);lamps=[];for(let i=0;i<n;i++){const x=margin+i*step+rand(-step*spread,step*spread);const intensity=rand(0.55,0.8);const width=baseWidth*rand(0.9,1.1);const phase=rand(0,Math.PI*2);const stripePhase=rand(0,Math.PI*2);lamps.push({x,width,intensity,hueBase:hue,phase,stripePhase})}}

function setupDiscoBall(){
  discoBall.x=W/2;
  discoBall.y=-150; // Start boven scherm
  discoBall.targetY=H*0.30; // Zweeft hoger in de kom (30% van hoogte)
  discoBall.rotation=0;
  discoBall.deployed=false;
  discoBall.deployStart=0;
}

function setupFishingRod(){
  fishingRod.x=W/2;
  fishingRod.y=viewportConfig.offsetTop; // Start vanaf bovenkant scherm
  fishingRod.targetY=H*0.65; // Aas hangt op 65% van hoogte
  fishingRod.deployed=false;
  fishingRod.deployStart=0;
  fishingRod.state='idle'; // States: idle, deploying, waiting, reeling, showing, releasing, retracting
  fishingRod.caughtFish=null;
  fishingRod.reelingStart=0;
  fishingRod.showCatchStart=0;
  fishingRod.baitSwing=Math.random()*Math.PI*2; // Random start phase voor swing
  fishingRod.retractStart=0;
}

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
  const numPlants=isChristmas()?Math.floor(rand(2,4)):Math.floor(rand(4,7)); // Minder bomen bij kerst
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

    const theme=getThemeConfig();
    const hueRange=theme.plantHueRange||[80,160];
    const hue=type==='anubias'?rand(100,140):rand(hueRange[0],hueRange[1]);
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

  // Theme-based decoration or normal castle
  // In Halloween mode: altijd minimaal 1 pompoen
  // In Christmas mode: altijd huisje OF sneeuwpop
  // In NewYear mode: oliebollen
  // Anders: 30% kans op kasteel
  const shouldAddDecoration=isHalloween()||isChristmas()||isNewYear()||Math.random()<0.3;

  if(shouldAddDecoration){
    const x=rand(80,W-80);
    // Pompoen kan groter zijn dan kasteel: 80-280 (soms 2x zo groot)
    const size=isHalloween()?rand(80,280):isNewYear()?rand(120,240):rand(80,140);
    const bobPhase=rand(0,Math.PI*2);
    const zIndex=Math.random()<0.7?'back':'front';
    const minY=H-size/2;
    const maxY=H-sandHeight+10;
    const y=rand(minY,maxY);

    if(isHalloween()){
      decorations.push({type:'pumpkin',x,y,size,hue:rand(25,35),bobPhase,zIndex});
    }else if(isChristmas()){
      // 50% kans op huisje, 50% kans op sneeuwpop
      const decoType = Math.random() < 0.5 ? 'cottage' : 'snowman';
      decorations.push({type:decoType,x,y,size,bobPhase,zIndex});
    }else if(isNewYear()){
      decorations.push({type:'oliebollen',x,y,size,bobPhase,zIndex});
    }else{
      decorations.push({type:'castle',x,y,size,hue:rand(200,220),bobPhase,zIndex});
    }
  }

  // Halloween: extra schedel decoratie (50% kans)
  if(isHalloween()&&Math.random()<0.5){
    const x=rand(80,W-80);
    const size=rand(70,250); // Vergelijkbaar met pompoen maar iets kleiner
    const bobPhase=rand(0,Math.PI*2);
    const zIndex=Math.random()<0.7?'back':'front';
    const minY=H-size/2;
    const maxY=H-sandHeight+10;
    const y=rand(minY,maxY);
    decorations.push({type:'skull',x,y,size,bobPhase,zIndex});
  }

  // Kerst: kerstbal decoraties (altijd 1, 50% kans op 2e, 20% kans op 3e)
  if(isChristmas()){
    let numOrnaments=1;
    if(Math.random()<0.5)numOrnaments++;
    if(Math.random()<0.2)numOrnaments++;
    for(let i=0;i<numOrnaments;i++){
      const x=rand(80,W-80);
      const size=rand(60,180);
      const bobPhase=rand(0,Math.PI*2);
      const zIndex=Math.random()<0.7?'back':'front';
      const minY=H-size/2;
      const maxY=H-sandHeight+10;
      const y=rand(minY,maxY);
      const ornamentColor={light:'#ff6b8a',mid:'#ff2d55',dark:'#c41e3a'}; // Rood
      decorations.push({type:'ornament',x,y,size,bobPhase,zIndex,ornamentColor});
    }
  }

  // Nieuwjaar: grote champagnefles erbij
  if(isNewYear()){
    const x=rand(100,W-100);
    const size=rand(160,220); // Veel groter!
    const bobPhase=rand(0,Math.PI*2);
    const zIndex='back'; // Altijd achter de vissen
    const minY=H-size*0.4;
    const maxY=H-sandHeight+20;
    const y=rand(minY,maxY);
    decorations.push({type:'champagne',x,y,size,bobPhase,zIndex});
  }

  // Zomer: parasol
  if(isSummer()){
    const x=rand(100,W-100);
    const size=rand(80,120);
    const bobPhase=rand(0,Math.PI*2);
    const zIndex='back';
    const y=H-sandHeight+15;
    decorations.push({type:'parasol',x,y,size,bobPhase,zIndex});
  }
}
function lampHueFor(L,time){
  if(isChristmas()){
    // Kerst: wissel tussen rood, groen en blauw
    const christmasColors=[0,120,240]; // Rood, Groen, Blauw
    const cycleSpeed=1.5;
    const colorIndex=Math.floor((time*cycleSpeed+L.phase)%3);
    return christmasColors[colorIndex];
  }
  // Blijf disco kleuren tonen als disco aan is OF ball aan het undeployen is
  if(!discoOn&&!discoBall.undeploying)return L.hueBase;
  const speed=7.5;const range=340;const wave=(Math.sin(time*speed+L.phase)+1)/2; // 3x sneller!
  // Synchronisatie momenten: alle lampen soms dezelfde kleur
  const syncPulse=Math.sin(time*0.5);
  if(syncPulse>0.9){
    return (time*100)%360; // Alle lampen sync'd
  }
  return (L.hueBase+wave*range)%360;
}
function strobeAlpha(time){if(!discoOn&&!discoBall.undeploying)return 1;const hz=1.5;const duty=0.8;const cycle=(time*hz)%1;return cycle<duty?1:0.75}
function flickerEffect(L,time){if(!isHalloween())return 1;const baseFlicker=Math.sin(time*8+L.phase)*0.5+0.5;const stutter=Math.random()<0.05?Math.random()*0.3:0;const shortFlash=Math.random()<0.02?0:1;return Math.max(0.3,baseFlicker-stutter)*shortFlash}
let discoCache={};let lastDiscoTime=0;

function discoEffects(time){
  // Blijf effecten tonen zolang disco aan is OF ball aan het undeployen is
  if(!discoOn&&!discoBall.undeploying)return;

  // Deploy disco ball on first frame
  if(!discoBall.deployed){
    discoBall.deployed=true;
    discoBall.deployStart=Date.now();
  }

  // Reduce frame rate for disco effects to improve performance
  if(time-lastDiscoTime<0.15)return;
  lastDiscoTime=time;

  const pulse=Math.sin(time*2)*0.5+0.5;
  ctx.globalCompositeOperation='lighter';

  // Performance-based effect scaling
  const qualityMult=performanceProfile.quality==='high'?1:
                     performanceProfile.quality==='medium'?0.7:
                     performanceProfile.quality==='low'?0.5:0.3;

  // === MOVING SPOTLIGHTS (12-15 spots) ===
  const maxSpots=Math.floor(15*qualityMult);
  const spots=Math.max(4,maxSpots);
  for(let i=0;i<spots;i++){
    const spotTime=time*0.9+i*0.6;
    const x=(W/spots)*i+W/(spots*2)+Math.sin(spotTime*1.3)*60;
    const y=H*0.3+Math.sin(spotTime*0.9+i)*H*0.35;
    const hue=(time*40+i*30)%360;
    const spotOn=Math.sin(spotTime*0.7+i)>0.3;
    if(spotOn){
      const alpha=0.12*(0.7+pulse*0.3);
      const size=35+Math.sin(spotTime*1.8+i)*15;
      const grad=ctx.createRadialGradient(x,y,0,x,y,size);
      grad.addColorStop(0,`hsla(${hue},100%,80%,${alpha})`);
      grad.addColorStop(0.5,`hsla(${(hue+40)%360},95%,70%,${alpha*0.6})`);
      grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grad;
      ctx.beginPath();
      ctx.arc(x,y,size,0,Math.PI*2);
      ctx.fill();
    }
  }

  // === SIDE-LIGHTS (vanaf zijkanten) ===
  const sideSpots=Math.floor(4*qualityMult);
  for(let i=0;i<sideSpots;i++){
    const spotTime=time*1.1+i*1.2;
    const fromLeft=i%2===0;
    const xStart=fromLeft?0:W;
    const xEnd=fromLeft?W*0.6:W*0.4;
    const x=xStart+Math.sin(spotTime*0.8)*(xEnd-xStart);
    const y=H*0.4+Math.sin(spotTime*0.5+i)*H*0.4;
    const hue=(time*50+i*90)%360;
    const spotOn=Math.sin(spotTime*0.6+i)>0.2;
    if(spotOn){
      const alpha=0.1*(0.6+pulse*0.4);
      const size=45+Math.sin(spotTime*1.4)*12;
      const grad=ctx.createRadialGradient(x,y,0,x,y,size*1.5);
      grad.addColorStop(0,`hsla(${hue},100%,75%,${alpha})`);
      grad.addColorStop(0.7,`hsla(${(hue+30)%360},90%,65%,${alpha*0.4})`);
      grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grad;
      ctx.beginPath();
      ctx.ellipse(x,y,size*1.5,size*0.8,fromLeft?0.3:-0.3,0,Math.PI*2);
      ctx.fill();
    }
  }

  // === LASER BEAMS (performance-aware) ===
  if(qualityMult>=0.5){ // Alleen op medium+ performance
    const maxLasers=Math.floor(8*qualityMult);
    const lasers=Math.max(3,maxLasers);
    ctx.lineWidth=2;
    ctx.lineCap='round';
    for(let i=0;i<lasers;i++){
      const laserTime=time*2.5+i*1.5;
      const angle=laserTime*0.8+i*Math.PI*0.4;
      const x1=W*0.5+Math.cos(angle)*W*0.3;
      const y1=H*0.2+Math.sin(angle+0.5)*H*0.2;
      const x2=W*0.5+Math.cos(angle+Math.PI)*W*0.5;
      const y2=H*0.5+Math.sin(angle+Math.PI+0.3)*H*0.4;
      const hue=(time*80+i*45)%360;
      const laserOn=Math.sin(laserTime*1.2+i)>0.1;
      if(laserOn){
        const alpha=0.25+Math.sin(laserTime*3)*0.15;
        ctx.strokeStyle=`hsla(${hue},100%,70%,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.lineTo(x2,y2);
        ctx.stroke();
        // Extra glow
        ctx.strokeStyle=`hsla(${hue},100%,85%,${alpha*0.4})`;
        ctx.lineWidth=4;
        ctx.stroke();
        ctx.lineWidth=2;
      }
    }
  }

  ctx.globalCompositeOperation='source-over';
}

function drawDiscoFog(time){
  // Blijf fog tonen zolang disco aan is OF ball aan het undeployen is
  if(!discoOn&&!discoBall.undeploying)return;

  // Skip fog op low/verylow performance
  if(performanceProfile.quality==='low'||performanceProfile.quality==='verylow')return;

  // Subtiele rook/nevel onderaan voor club sfeer
  ctx.globalCompositeOperation='lighter';

  const baseFogClouds=8;
  const numFogClouds=performanceProfile.quality==='medium'?6:baseFogClouds;
  const fogHeight=H*0.3; // Onderste 30%

  for(let i=0;i<numFogClouds;i++){
    const fogTime=time*0.2+i*1.5;
    const x=(i/numFogClouds)*W+Math.sin(fogTime*0.6)*W*0.15;
    const y=H-fogHeight*0.5+Math.sin(fogTime*0.4+i)*fogHeight*0.3;
    const size=W*0.25+Math.sin(fogTime*0.5)*W*0.1;

    // Kleur van de nevel (beetje gekleurd door disco lights)
    const hue=(time*30+i*45)%360;
    const alpha=0.08+Math.sin(fogTime*0.8)*0.04;

    const fogGrad=ctx.createRadialGradient(x,y,0,x,y,size);
    fogGrad.addColorStop(0,`hsla(${hue},60%,70%,${alpha})`);
    fogGrad.addColorStop(0.4,`hsla(${(hue+40)%360},50%,65%,${alpha*0.6})`);
    fogGrad.addColorStop(0.7,`hsla(${(hue+80)%360},40%,60%,${alpha*0.3})`);
    fogGrad.addColorStop(1,'rgba(0,0,0,0)');

    ctx.fillStyle=fogGrad;
    ctx.beginPath();
    ctx.arc(x,y,size,0,Math.PI*2);
    ctx.fill();
  }

  ctx.globalCompositeOperation='source-over';
}

function drawDiscoBall(time){
  // Render als disco aan is, of als ball undeploying is
  if(!discoOn&&!discoBall.undeploying)return;
  if(!discoBall.deployed&&!discoBall.undeploying)return;

  const now=Date.now();

  let currentY;

  // Check if undeploying
  if(discoBall.undeploying){
    const undeployProgress=Math.min(1,(now-discoBall.undeployStart)/discoBall.deployDuration);
    const easeProgress=1-Math.pow(1-undeployProgress,3); // Ease-out cubic
    // Start from targetY, go to -150
    currentY=discoBall.targetY+((-150)-discoBall.targetY)*easeProgress;

    if(undeployProgress>=1){
      // Undeploy klaar - reset state
      discoBall.undeploying=false;
      discoBall.deployed=false;
      discoBall.y=-150;
      return; // Stop rendering
    }
  }else{
    // Normal deploy animation
    const deployProgress=Math.min(1,(now-discoBall.deployStart)/discoBall.deployDuration);
    const easeProgress=1-Math.pow(1-deployProgress,3); // Ease-out cubic
    currentY=discoBall.y+(discoBall.targetY-discoBall.y)*easeProgress;
  }

  // Zweven (kleine op/neer beweging) - alleen als niet undeploying
  const hoverOffset=discoBall.undeploying?0:Math.sin(time*0.8)*10;
  const finalY=currentY+hoverOffset;

  // Rotatie
  discoBall.rotation=(discoBall.rotation+0.5)%360;
  const rot=discoBall.rotation*Math.PI/180;

  const ballSize=95; // Nog groter!
  const cx=discoBall.x;
  const cy=finalY;

  // Teken ketting/kabel van boven naar discobal
  ctx.strokeStyle='#606060';
  ctx.lineWidth=3;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(cx,viewportConfig.offsetTop);
  // Lichte curve/sag in de ketting
  const controlY=viewportConfig.offsetTop+(cy-viewportConfig.offsetTop)*0.5;
  const sag=Math.sin(time*0.8)*3; // Lichte beweging
  ctx.quadraticCurveTo(cx+sag,controlY,cx,cy-ballSize);
  ctx.stroke();

  // Metalen glans op ketting
  ctx.strokeStyle='#808080';
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(cx-1,viewportConfig.offsetTop);
  ctx.quadraticCurveTo(cx+sag-1,controlY,cx-1,cy-ballSize);
  ctx.stroke();

  // Bevestigingspunt bovenaan (plafondbevestiging)
  ctx.fillStyle='#505050';
  ctx.beginPath();
  ctx.arc(cx,viewportConfig.offsetTop,6,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle='#707070';
  ctx.beginPath();
  ctx.arc(cx-1,viewportConfig.offsetTop-1,3,0,Math.PI*2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx,cy);

  // HELE spiegelbol bedekt met vakjes - 3D rotatie om verticale as
  const tileSize=6.5; // Kleine vierkante spiegeltegeltjes
  const numLatitudes=Math.floor(ballSize*2/tileSize); // Rijen (van boven naar beneden)
  const numLongitudes=Math.floor(ballSize*2/tileSize)*1.5; // Kolommen (rond de bol)

  // Eerst achterste helft, dan voorste helft (voor correcte z-ordering)
  for(let pass=0;pass<2;pass++){
    for(let lat=0;lat<numLatitudes;lat++){
      // Y positie (van top naar bottom)
      const ty=(lat-numLatitudes/2)*tileSize;
      if(Math.abs(ty)>ballSize)continue;

      // Bereken radius op deze latitude
      const radiusAtLat=Math.sqrt(ballSize*ballSize-ty*ty);
      const tilesAtLat=Math.floor(radiusAtLat*2*Math.PI/tileSize);

      for(let lon=0;lon<tilesAtLat;lon++){
        // Hoek rond de bol (0 to 2π)
        const theta=lon*Math.PI*2/tilesAtLat+rot; // Rotatie rond verticale as!

        // 3D positie op sphere
        const x3d=Math.cos(theta)*radiusAtLat;
        const z3d=Math.sin(theta)*radiusAtLat; // Diepte
        const y3d=ty;

        // Alleen tekenen als aan juiste kant (front/back pass)
        const isFront=z3d>0;
        if((pass===0&&isFront)||(pass===1&&!isFront))continue;

        // Project naar 2D (simple orthographic projection)
        const tx=x3d;
        const ty2d=y3d;

        const tileId=lat*numLongitudes+lon;

        // Helderheid op basis van facing en diepte
        const normalZ=z3d/ballSize; // -1 tot 1
        const facingFactor=Math.max(0,normalZ); // Alleen voorkant krijgt extra licht
        const depthFactor=Math.abs(normalZ); // Voor algemene helderheid

        const baseBrightness=40+depthFactor*30;
        const frontBoost=facingFactor*25;
        const flicker=Math.sin(time*3+tileId*0.3)*5;
        const brightness=Math.max(15,baseBrightness+frontBoost+flicker);

        ctx.fillStyle=`hsl(0,0%,${brightness}%)`;
        ctx.fillRect(tx-tileSize/2,ty2d-tileSize/2,tileSize-0.5,tileSize-0.5);

        // Witte highlights alleen op voorkant vakjes
        if(facingFactor>0.5&&Math.sin(time*4+tileId*0.7)>0.6){
          const highlightAlpha=facingFactor*0.7;
          ctx.fillStyle=`rgba(255,255,255,${highlightAlpha})`;
          const highlightSize=tileSize*0.3;
          ctx.fillRect(tx-tileSize/2+1,ty2d-tileSize/2+1,highlightSize,highlightSize);
        }

        // Subtiele randen voor diepte
        if(facingFactor>0.1){
          ctx.strokeStyle=`rgba(0,0,0,${0.25})`;
          ctx.lineWidth=0.5;
          ctx.strokeRect(tx-tileSize/2,ty2d-tileSize/2,tileSize-0.5,tileSize-0.5);
        }

        // Extra glinsteren - sommige vakjes flikkeren fel op
        const glitterChance=Math.sin(time*8+tileId*0.3)*0.5+0.5;
        if(facingFactor>0.4&&glitterChance>0.92){ // ~8% van vakjes glinster
          const glitterAlpha=Math.sin(time*12+tileId)*0.5+0.5;
          const glitterSize=tileSize*0.6;
          const glitterGrad=ctx.createRadialGradient(tx,ty2d,0,tx,ty2d,glitterSize);
          glitterGrad.addColorStop(0,`rgba(255,255,255,${glitterAlpha*0.9})`);
          glitterGrad.addColorStop(0.5,`rgba(255,255,255,${glitterAlpha*0.5})`);
          glitterGrad.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle=glitterGrad;
          ctx.beginPath();
          ctx.arc(tx,ty2d,glitterSize,0,Math.PI*2);
          ctx.fill();
        }
      }
    }
  }

  ctx.restore();

  // Lichtstralen vanuit discobal - stralen vanaf baloppervlak
  ctx.globalCompositeOperation='lighter';

  const numRays=12;
  const rayEndPoints=[]; // Sla eindpunten op voor lichtspots

  for(let i=0;i<numRays;i++){
    // Positie op de bal (spherical) - draait mee met bal
    const rayTime=time*0.4+i*1.8;
    const theta=rot+i*(Math.PI*2/numRays); // Rond de bal (horizontaal)
    const phi=Math.sin(rayTime)*0.7; // Verticale hoek (-0.7 tot 0.7 rad)

    // 3D punt OP de bal waar straal begint
    const rx=Math.cos(phi)*Math.cos(theta)*ballSize;
    const ry=Math.sin(phi)*ballSize;
    const rz=Math.cos(phi)*Math.sin(theta)*ballSize;

    // Skip stralen aan achterkant
    if(rz<-ballSize*0.5)continue;

    // Startpunt: OP de bal
    const sx=cx+rx;
    const sy=cy+ry;

    // Richting van de straal (radiaal naar buiten + variatie)
    const outDirX=rx/ballSize;
    const outDirY=ry/ballSize+Math.sin(rayTime*1.2)*0.3; // Beetje buigen
    const outDirZ=rz/ballSize;

    // Normaliseer richting
    const dirLen=Math.sqrt(outDirX*outDirX+outDirY*outDirY);
    const normDirX=outDirX/dirLen;
    const normDirY=outDirY/dirLen;

    // Eindpunt van straal
    const rayLength=W*0.55+Math.sin(rayTime*0.9)*W*0.1;
    const ex=sx+normDirX*rayLength;
    const ey=sy+normDirY*rayLength;

    // Helderheid (voorkant helderder)
    const facingFactor=Math.max(0,rz/ballSize);
    const alpha=0.16+facingFactor*0.08+Math.sin(time*2.8+i)*0.06;

    // Kleur
    const hue=(time*50+i*30+rx*0.5)%360;

    // Gradient: helder bij bal, vervaagt
    const grad=ctx.createLinearGradient(sx,sy,ex,ey);
    grad.addColorStop(0,`hsla(${hue},100%,80%,${alpha*1.3})`);
    grad.addColorStop(0.2,`hsla(${(hue+50)%360},100%,75%,${alpha})`);
    grad.addColorStop(0.5,`hsla(${(hue+100)%360},95%,70%,${alpha*0.6})`);
    grad.addColorStop(1,'rgba(0,0,0,0)');

    ctx.strokeStyle=grad;
    ctx.lineWidth=28+facingFactor*12+Math.sin(time*3.5+i)*8;
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(sx,sy);
    ctx.lineTo(ex,ey);
    ctx.stroke();

    // Bewaar eindpunt voor lichtspot op bodem
    rayEndPoints.push({x:ex,y:ey,hue,alpha});
  }

  // Lichtspots op bodem/objecten waar stralen landen
  for(const point of rayEndPoints){
    // Alleen teken spot als straal naar beneden gaat
    if(point.y>cy){
      const spotSize=40+Math.sin(time*3)*15;
      const spotGrad=ctx.createRadialGradient(point.x,point.y,0,point.x,point.y,spotSize);
      spotGrad.addColorStop(0,`hsla(${point.hue},100%,70%,${point.alpha*0.4})`);
      spotGrad.addColorStop(0.5,`hsla(${(point.hue+30)%360},90%,65%,${point.alpha*0.2})`);
      spotGrad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=spotGrad;
      ctx.beginPath();
      ctx.arc(point.x,point.y,spotSize,0,Math.PI*2);
      ctx.fill();
    }
  }

  ctx.globalCompositeOperation='source-over';
}

function drawFishingRod(time){
  if(fishingRod.state==='idle')return; // Geen hengel als niet actief
  if(fishingRod.state==='showing')return; // Verberg hengel/aas tijdens popup

  const now=Date.now();
  let baitY=fishingRod.y;

  // Bereken huidige positie obv state
  if(fishingRod.state==='deploying'){
    const deployProgress=Math.min(1,(now-fishingRod.deployStart)/fishingRod.deployDuration);
    const easeProgress=1-Math.pow(1-deployProgress,3); // Ease-out cubic
    baitY=fishingRod.y+(fishingRod.targetY-fishingRod.y)*easeProgress;
  }else if(fishingRod.state==='waiting'){
    // Hangt op target positie met lichte swing
    fishingRod.baitSwing+=0.02;
    const swing=Math.sin(fishingRod.baitSwing)*8;
    baitY=fishingRod.targetY+Math.sin(time*0.5)*3; // Lichte op/neer
    fishingRod.x=W/2+swing; // Zijwaartse swing
  }else if(fishingRod.state==='reeling'){
    // Vis wordt opgehaald naar boven - gaat helemaal uit beeld
    const reelingProgress=Math.min(1,(now-fishingRod.reelingStart)/1500); // 1.5 sec
    const easeProgress=1-Math.pow(1-reelingProgress,3);
    const targetYOffScreen=viewportConfig.offsetTop-300; // Ver buiten beeld (extra ver voor grote vissen)
    baitY=fishingRod.targetY+(targetYOffScreen-fishingRod.targetY)*easeProgress;

    // Als vis gevangen is, beweeg vis mee EN zet verticaal
    if(fishingRod.caughtFish){
      fishingRod.caughtFish.x=fishingRod.x;
      fishingRod.caughtFish.y=baitY;
      fishingRod.caughtFish.caughtVertical=true; // Markeer als verticaal gevangen
      // Vis blijft zichtbaar tijdens reeling, wordt pas verborgen bij 'showing' state
    }
  }else if(fishingRod.state==='releasing'){
    // Vis komt terug van boven
    const releaseProgress=Math.min(1,(now-fishingRod.reelingStart)/2000); // 2 sec
    const easeProgress=1-Math.pow(1-releaseProgress,3);
    if(fishingRod.caughtFish){
      fishingRod.caughtFish.x=fishingRod.x+(fishingRod.caughtFish.releaseTargetX-fishingRod.x)*easeProgress;
      fishingRod.caughtFish.y=viewportConfig.offsetTop-50+(fishingRod.caughtFish.releaseTargetY-(viewportConfig.offsetTop-50))*easeProgress;
    }
    return; // Geen lijn tijdens release
  }else if(fishingRod.state==='retracting'){
    // Hengel gaat terug omhoog
    const retractProgress=Math.min(1,(now-fishingRod.retractStart)/1000); // 1 sec
    const easeProgress=1-Math.pow(1-retractProgress,3); // Ease-out cubic
    baitY=fishingRod.targetY+(fishingRod.y-fishingRod.targetY)*easeProgress; // Van targetY naar y (boven)
  }

  // Teken lijn vanaf bovenkant naar aas
  ctx.strokeStyle='#8b6f47'; // Bruin touw
  ctx.lineWidth=2;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(fishingRod.x,viewportConfig.offsetTop);

  // Lichte curve in lijn (sag)
  const controlY=viewportConfig.offsetTop+(baitY-viewportConfig.offsetTop)*0.5;
  const sag=Math.sin(time*0.8)*2;
  ctx.quadraticCurveTo(fishingRod.x+sag,controlY,fishingRod.x,baitY-8);
  ctx.stroke();

  // Teken haakje
  ctx.strokeStyle='#c0c0c0'; // Zilver
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.arc(fishingRod.x,baitY-12,8,Math.PI*0.3,Math.PI*1.7);
  ctx.stroke();

  // Teken aas/voer aan haakje
  const theme=getThemeConfig();
  const foodColor=theme.foodColors[0]||'#ffb37a';
  ctx.fillStyle=foodColor;
  ctx.beginPath();
  ctx.arc(fishingRod.x,baitY,15,0,Math.PI*2);
  ctx.fill();

  // Subtiele gloed om aas (trekt vissen aan)
  if(fishingRod.state==='waiting'){
    const glowSize=20+Math.sin(time*2)*5;
    const grad=ctx.createRadialGradient(fishingRod.x,baitY,0,fishingRod.x,baitY,glowSize);
    grad.addColorStop(0,'rgba(255,200,100,0.3)');
    grad.addColorStop(1,'rgba(255,200,100,0)');
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.arc(fishingRod.x,baitY,glowSize,0,Math.PI*2);
    ctx.fill();
  }
}

function drawCatchPopup(time){
  if(fishingRod.state!=='showing')return;
  if(!fishingRod.caughtFish)return;

  const fish=fishingRod.caughtFish;
  const now=Date.now();
  const elapsed=now-fishingRod.showCatchStart;

  // Fade in/out animatie
  let alpha=1;
  if(elapsed<300){ // Fade in eerste 300ms
    alpha=elapsed/300;
  }else if(elapsed>9700){ // Fade out laatste 300ms
    alpha=(10000-elapsed)/300;
  }

  ctx.save();
  ctx.globalAlpha=alpha;

  // Bereken vis-grootte vooraf om banner dynamisch te maken
  const visGrootte=fishSize(fish,now);
  const visBannerGrootte=Math.min(visGrootte*2.5,160); // Cap op 160px max, 2.5x schaling

  // Popup box (centered) - dynamische hoogte op basis van vis-grootte
  const boxW=Math.min(480,W*0.7);
  const minBoxH=240; // Minimum hoogte voor kleine vissen
  const maxBoxH=400; // Maximum hoogte voor zeer grote vissen

  // Bereken benodigde hoogte: pad + titel(~30) + vis + ruimte + gewicht(~30) + pad
  const neededH=18+30+visBannerGrootte+20+30+18;
  const boxH=Math.max(minBoxH,Math.min(maxBoxH,neededH));

  const boxX=(cv.width-boxW)/2;
  const boxY=(cv.height-boxH)/2;
  const pad=18; // Padding boven/onder voor balans

  // Subtiele schaduw zoals panelen
  ctx.fillStyle='rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(boxX+4,boxY+4,boxW,boxH,10);
  ctx.fill();

  // Main box - achtergrond zoals panelen (licht/donker afhankelijk van lightsOn)
  ctx.fillStyle=lightsOn?'rgba(255,255,255,0.7)':'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.roundRect(boxX,boxY,boxW,boxH,10);
  ctx.fill();

  // Titel bovenaan gecentreerd - tekstkleur ook afhankelijk van lightsOn
  ctx.fillStyle=lightsOn?'#0b1e2d':'#e9f1f7';
  ctx.font='700 20px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign='center';
  ctx.textBaseline='top';
  ctx.fillText(`🏆 ${fish.name} Gevangen!`,boxX+boxW/2,boxY+pad);

  // Teken de ECHTE vis gecentreerd in de banner
  ctx.save();
  const visX=boxX+boxW/2; // Gecentreerd horizontaal
  const visY=boxY+boxH/2; // Gecentreerd verticaal in dynamische banner

  // Tijdelijk vis eigenschappen aanpassen voor tekenen in banner
  const originalX=fish.x;
  const originalY=fish.y;
  const originalVx=fish.vx;
  const originalVy=fish.vy;
  const originalBaseSize=fish.baseSize;

  fish.x=visX;
  fish.y=visY;
  fish.vx=-1; // Hoofd naar links
  fish.vy=0;
  // Gebruik gecapte grootte: max 160px na 2.5x schaling
  const scaleFactor=Math.min(2.5,160/visGrootte);
  fish.baseSize=fish.baseSize*scaleFactor;
  fish.hideLabel=true; // Verberg label
  fish.hideShadow=true; // Verberg schaduw in banner

  // Gebruik de echte drawFish functie - zo is het gegarandeerd dezelfde vis!
  drawFish(fish,elapsed,now);

  // Restore originele waardes
  fish.x=originalX;
  fish.y=originalY;
  fish.vx=originalVx;
  fish.vy=originalVy;
  fish.baseSize=originalBaseSize;
  fish.hideLabel=false;
  fish.hideShadow=false;

  ctx.restore();

  // Vis info gecentreerd onder vis - simpel en clean
  ctx.textAlign='center';
  ctx.textBaseline='top';
  const centerX=boxX+boxW/2;

  // Gewicht
  const eatsCount=fish.eats||0;
  const baseWeight=fish.baseSize||20;
  const growthFromEating=eatsCount*2;
  const ageDays=Math.floor((now-fish.bornAt)/(1000*60*60*24));
  const growthFromAge=ageDays*0.5;
  const totalWeight=Math.round(baseWeight+growthFromEating+growthFromAge);

  ctx.globalAlpha=alpha*0.85;
  ctx.fillStyle=lightsOn?'#0b1e2d':'#e9f1f7';
  ctx.font='500 14px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillText(`${totalWeight} gram`,centerX,boxY+boxH-pad-16); // Dynamisch onderaan banner

  ctx.globalAlpha=alpha; // Reset

  ctx.restore();
}

function drawErrorPopup(){
  // Bepaal welke error we tonen
  const isDisconnected=wsConnectedOnce&&!wsConnected;
  const isAlreadyActive=alreadyActiveError;

  if(!isDisconnected&&!isAlreadyActive)return;

  ctx.save();

  // Donkere overlay over hele canvas
  ctx.fillStyle='rgba(0,0,0,0.5)';
  ctx.fillRect(0,0,cv.width,cv.height);

  // Popup box (centered) - zelfde stijl als catch popup
  const boxW=Math.min(400,W*0.6);
  const boxH=160;
  const boxX=(cv.width-boxW)/2;
  const boxY=(cv.height-boxH)/2;
  const pad=20;

  // Subtiele schaduw
  ctx.fillStyle='rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(boxX+4,boxY+4,boxW,boxH,10);
  ctx.fill();

  // Main box
  ctx.fillStyle=lightsOn?'rgba(255,255,255,0.85)':'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(boxX,boxY,boxW,boxH,10);
  ctx.fill();

  ctx.fillStyle=lightsOn?'#0b1e2d':'#e9f1f7';
  ctx.font='700 20px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign='center';
  ctx.textBaseline='top';

  if(isAlreadyActive){
    // Already active error
    ctx.fillText('Vissenkom al actief',boxX+boxW/2,boxY+pad);

    ctx.globalAlpha=0.7;
    ctx.font='400 16px system-ui,Segoe UI,Roboto,Arial';
    ctx.fillText('Er is al een ander scherm actief',boxX+boxW/2,boxY+pad+32);

    ctx.font='400 14px system-ui,Segoe UI,Roboto,Arial';
    ctx.fillText('Sluit dat scherm of herlaad deze pagina',boxX+boxW/2,boxY+pad+58);
  }else{
    // Disconnected error
    ctx.fillText('Geen verbinding',boxX+boxW/2,boxY+pad);

    // Status: verbinden of wachten?
    const now=Date.now();
    const isConnecting=wsNextRetryAt===0;
    const secondsUntilRetry=isConnecting?0:Math.max(0,Math.ceil((wsNextRetryAt-now)/1000));

    ctx.globalAlpha=0.7;
    ctx.font='400 16px system-ui,Segoe UI,Roboto,Arial';

    if(isConnecting){
      ctx.fillText('Verbinden...',boxX+boxW/2,boxY+pad+32);
    }else{
      ctx.fillText(`Volgende poging over ${secondsUntilRetry}s`,boxX+boxW/2,boxY+pad+32);
    }

    // Poging teller
    ctx.font='400 14px system-ui,Segoe UI,Roboto,Arial';
    ctx.fillText(`poging ${wsReconnectAttempts}`,boxX+boxW/2,boxY+pad+58);

    // Animated spinner dots (alleen bij verbinden)
    if(isConnecting){
      const dotY=boxY+boxH-pad-10;
      const dotSpacing=12;
      const numDots=3;
      const startX=boxX+boxW/2-(numDots-1)*dotSpacing/2;

      for(let i=0;i<numDots;i++){
        const phase=(now/300+i)%3;
        const alpha=phase<1?0.3+0.7*phase:phase<2?1:1-0.7*(phase-2);
        ctx.globalAlpha=alpha;
        ctx.beginPath();
        ctx.arc(startX+i*dotSpacing,dotY,3,0,Math.PI*2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

function updateFishingRod(time){
  if(fishingRod.state==='idle')return;

  const now=Date.now();

  // State: deploying → waiting
  if(fishingRod.state==='deploying'){
    const deployProgress=(now-fishingRod.deployStart)/fishingRod.deployDuration;
    if(deployProgress>=1){
      fishingRod.state='waiting';
      fishingRod.deployStart=now; // Start waiting timer
    }
  }

  // State: waiting → check for bite or timeout
  else if(fishingRod.state==='waiting'){
    checkFishBite();

    // Timeout na 15 seconden als geen vis bijt - trek hengel terug
    if(now-fishingRod.deployStart>15000){
      fishingRod.state='retracting';
      fishingRod.retractStart=now;
    }
  }

  // State: reeling → showing
  else if(fishingRod.state==='reeling'){
    const reelingProgress=(now-fishingRod.reelingStart)/1500;
    if(reelingProgress>=1){
      // Vis is boven scherm, toon popup
      fishingRod.state='showing';
      fishingRod.showCatchStart=now;

      // Log vis gevangen event naar server
      if(fishingRod.caughtFish&&ws&&ws.readyState===WebSocket.OPEN){
        ws.send(JSON.stringify({
          command:'fishCaught',
          fishName:fishingRod.caughtFish.name,
          fishEats:fishingRod.caughtFish.eats||0
        }));
      }
      // Vis wordt pas verborgen na popup fade-in (zie 'showing' state)
    }
  }

  // State: showing → releasing
  else if(fishingRod.state==='showing'){
    const elapsed=now-fishingRod.showCatchStart;

    // Verberg vis na fade-in (300ms)
    if(elapsed>300&&fishingRod.caughtFish&&fishingRod.caughtFish.x!==-1000){
      fishingRod.caughtFish.x=-1000;
      fishingRod.caughtFish.y=-1000;
      fishingRod.caughtFish.caughtVertical=false;
    }

    // Laat vis weer zien voor fade-out (bij 9700ms)
    if(elapsed>9700&&fishingRod.caughtFish&&fishingRod.caughtFish.x===-1000){
      fishingRod.caughtFish.x=fishingRod.x;
      fishingRod.caughtFish.y=viewportConfig.offsetTop-50;
    }

    // Transition naar releasing na 10 seconden
    if(elapsed>10000){ // 10 seconden popup
      // Start release animatie
      fishingRod.state='releasing';
      fishingRod.reelingStart=now; // Hergebruik timer voor release

      // Bepaal waar vis terug komt
      if(fishingRod.caughtFish){
        fishingRod.caughtFish.releaseTargetX=rand(W*0.2,W*0.8);
        fishingRod.caughtFish.releaseTargetY=rand(H*0.3,H*0.6);
        fishingRod.caughtFish.x=fishingRod.x;
        fishingRod.caughtFish.y=viewportConfig.offsetTop-50;
      }
    }
  }

  // State: releasing → idle (hengel is al opgehaald tijdens vangen)
  else if(fishingRod.state==='releasing'){
    const releaseProgress=(now-fishingRod.reelingStart)/2000;
    if(releaseProgress>=1){
      // Vis is terug, klaar!
      if(fishingRod.caughtFish){
        fishingRod.caughtFish.x=fishingRod.caughtFish.releaseTargetX;
        fishingRod.caughtFish.y=fishingRod.caughtFish.releaseTargetY;
        fishingRod.caughtFish.caughtVertical=false; // Reset verticale oriëntatie
        fishingRod.caughtFish=null;
      }
      fishingRod.state='idle';
      fishingRod.deployed=false;
    }
  }

  // State: retracting → idle
  else if(fishingRod.state==='retracting'){
    const retractProgress=(now-fishingRod.retractStart)/1000;
    if(retractProgress>=1){
      // Hengel is ingetrokken, klaar
      fishingRod.state='idle';
      fishingRod.deployed=false;
    }
  }
}

function checkFishBite(){
  if(fishingRod.state!=='waiting')return;
  if(!fishingRod.deployed)return;

  const BITE_DISTANCE=20; // pixels - vis moet dichterbij komen
  let closestFish=null;
  let closestDist=BITE_DISTANCE;

  // Bereken huidige aas positie
  const baitX=fishingRod.x;
  const baitY=fishingRod.targetY;

  // Zoek dichtstbijzijnde vis
  for(const fish of fishes){
    const dist=Math.hypot(fish.x-baitX,fish.y-baitY);
    if(dist<closestDist){
      closestDist=dist;
      closestFish=fish;
    }
  }

  // Als vis dichtbij is, kleine kans om te bijten (2% per frame - moeilijker)
  if(closestFish&&Math.random()<0.02){
    // Vis bijt!
    fishingRod.state='reeling';
    fishingRod.reelingStart=Date.now();
    fishingRod.caughtFish=closestFish;
  }
}

function makeFish(x=rand(50,W-50),y=rand(50,H-50),name){const base=rand(18,30);let hue=Math.floor(rand(0,360));if(isNaN(hue))hue=0;const initialVx=rand(-2.5,2.5);const initialVy=rand(-.3,.3);const f={x,y,vx:initialVx,vy:initialVy,speed:rand(1.5,3.0),baseSize:base,hue,dir:Math.random()*Math.PI*2,turnTimer:Math.floor(rand(600,1800)),blink:0,name:name||`Vis ${fishCounter++}`,lastEat:Date.now(),bornAt:Date.now(),eats:0,sickTop:Math.random()<0.5,hungerWindow:DAY*rand(0.9,1.1),behaviorState:'normal',behaviorTimer:0,wallFollowTarget:null,lastPoop:Date.now(),targetVx:initialVx,targetVy:initialVy,ballApproachSide:Math.random()<0.5?-1:1};fishes.push(f)}
// Dummy vissen verwijderd - vissen komen nu alleen van server na gameState

function makeFood(){const n=Math.max(8,fishes.length);const theme=getThemeConfig();const foodColors=theme.foodColors;for(let i=0;i<n;i++){const color=foodColors[Math.floor(Math.random()*foodColors.length)];foods.push({x:rand(40,W-40),y:50+rand(0,30),vy:rand(0.7,1.5),r:7,ttl:6000,color})}}
function makeBubble(){
  const b=getBubble();
  // Bij nieuwjaar: bubbels uit champagnefles opening
  if(isNewYear()){
    // Fles opening positie (na rotatie van -1.1 rad vanaf pumpPos.x, H-60)
    b.x=pumpPos.x-55+rand(-4,4);
    b.y=H-88+rand(-4,4);
  }else{
    b.x=pumpPos.x+rand(-6,6);
    b.y=H-30;
  }
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

// Unified health system - always use fish.health from server (managed by hunger, disease, temp)
function healthPct(f,now){
  // Always use unified health from server
  if(f.health !== undefined) return clamp(f.health, 0, 100);
  // Fallback for very old fish data (shouldn't happen)
  return 0;
}
function fishSize(f,now){const ageDays=(now-f.bornAt)/DAY;const growth=1+Math.log(1+ageDays*0.15)*0.35+Math.log(1+f.eats*0.5)*0.25;return f.baseSize*growth}
function steerTowards(f,tx,ty,str){
  // Validate inputs to prevent jumping
  if(isNaN(tx) || isNaN(ty) || isNaN(str)) return;
  if(isNaN(f.x) || isNaN(f.y)) return;

  const dx=tx-f.x;
  const dy=ty-f.y;
  const dSq=dx*dx+dy*dy; // Use squared distance to avoid sqrt

  // Prevent division by zero and limit maximum steering force
  if(dSq < 0.01 || dSq > 1000000) return;

  const d=Math.sqrt(dSq); // Only calculate sqrt once when needed
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

  // Kerst: hangende kerstlichtjes snoeren ipv normale lampen
  if(isChristmas()){
    for(const L of lamps){
      const x=L.x;
      const lightCount=12; // Meer lampjes per snoer! (was 8)
      const spacing=H*0.85/lightCount; // Verticale afstand
      const lightColors=['#ffbb44','#ffd166','#ffe699','#ffcc55','#ffd580','#fff0aa']; // Meer variatie in warme gele tinten

      // Donkergroen draad/snoer van boven naar beneden
      ctx.strokeStyle='hsla(140,30%,15%,0.6)';
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(x,0);
      // Zigzag patroon voor natuurlijke val
      for(let i=0;i<=lightCount;i++){
        const ly=i*spacing;
        const lx=x+Math.sin(i*0.8+L.phase)*8; // Kleine zigzag
        ctx.lineTo(lx,ly);
      }
      ctx.stroke();

      // Kerstlichtjes langs het snoer
      for(let i=0;i<lightCount;i++){
        const ly=i*spacing+spacing*0.5;
        const lx=x+Math.sin(i*0.8+L.phase)*8;

        // Sterk fonkel effect - lampjes gaan af en toe aan en uit met variatie
        // Elke lamp heeft zijn eigen ritme
        const twinkleSpeed1 = 0.0025;
        const twinkleSpeed2 = 0.0018;
        const twinkleSpeed3 = 0.0032;

        const wave1 = Math.sin(time * twinkleSpeed1 + i * 1.8 + L.phase);
        const wave2 = Math.sin(time * twinkleSpeed2 + i * 2.3 + L.phase * 1.5);
        const wave3 = Math.cos(time * twinkleSpeed3 + i * 0.9 + L.phase * 2.1);

        // Combineer golven voor meer dramatisch fonkelen
        const twinkle = Math.max(0.15, Math.min(1.0, (wave1 * 0.35 + wave2 * 0.35 + wave3 * 0.3 + 0.5)));

        const color=lightColors[i%lightColors.length];

        // Kort draadje naar lampje
        ctx.strokeStyle='hsla(140,30%,15%,0.5)';
        ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(lx,ly);
        ctx.lineTo(lx,ly+15);
        ctx.stroke();

        // Lampje (peervormig)
        ctx.fillStyle=color;
        ctx.globalAlpha=twinkle;
        ctx.beginPath();
        ctx.ellipse(lx,ly+20,5,7,0,0,Math.PI*2);
        ctx.fill();

        // Warm glow effect
        const glowGrad=ctx.createRadialGradient(lx,ly+20,0,lx,ly+20,25);
        glowGrad.addColorStop(0,color);
        glowGrad.addColorStop(0.4,`${color}99`);
        glowGrad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=glowGrad;
        ctx.beginPath();
        ctx.arc(lx,ly+20,25,0,Math.PI*2);
        ctx.fill();

        ctx.globalAlpha=1;
      }
    }
    return; // Skip normale lampen voor kerst
  }

  // Normale lampen voor andere thema's
  const stro=strobeAlpha(time);
  // Disco effecten blijven actief zolang disco aan is OF ball aan het undeployen is
  const discoActive=discoOn||discoBall.undeploying;
  const discoMultiplier=discoActive?2.0:1; // 2x groter in disco mode!
  for(const L of lamps){
    const flicker=flickerEffect(L,time);
    const hue=lampHueFor(L,time);
    const intensity=L.intensity*(discoActive?1.6:1)*flicker; // 1.6x helderder!
    const topGlow=ctx.createRadialGradient(L.x,0,2,L.x,0,Math.max(40,L.width*0.6*discoMultiplier));
    topGlow.addColorStop(0,`hsla(${hue},95%,90%,${0.4*intensity*stro})`);
    topGlow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalCompositeOperation='lighter';
    ctx.fillStyle=topGlow;ctx.beginPath();ctx.arc(L.x,0,Math.max(40,L.width*0.6*discoMultiplier),0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='source-over';
    const hue2=(hue+140)%360;const hue3=(hue+220)%360;
    const beamGrad=ctx.createLinearGradient(L.x,0,L.x,H*0.9);
    const alphaBoost=discoActive?1.4:1; // Meer alpha in disco mode
    beamGrad.addColorStop(0,`hsla(${hue},95%,78%,${0.2*intensity*stro*alphaBoost})`);
    beamGrad.addColorStop(0.35,`hsla(${hue2},95%,72%,${0.14*intensity*stro*alphaBoost})`);
    if(discoActive)beamGrad.addColorStop(0.7,`hsla(${hue3},95%,65%,${0.1*intensity*stro*alphaBoost})`);
    beamGrad.addColorStop(1,'rgba(0,0,0,0)');
    const wTop=L.width*0.55*discoMultiplier;const wBottom=L.width*1.1*discoMultiplier;const yBottom=H*0.9;
    ctx.fillStyle=beamGrad;ctx.beginPath();ctx.moveTo(L.x-wTop,0);ctx.lineTo(L.x+wTop,0);ctx.lineTo(L.x+wBottom,yBottom);ctx.lineTo(L.x-wBottom,yBottom);ctx.closePath();ctx.fill();
    const stripes=discoActive?6:3; // Meer stripes in disco mode!
    for(let i=0;i<stripes;i++){
      const p=i/stripes;const localPhase=L.stripePhase+i*0.9;const stripeX=L.x+(p-0.5)*L.width*0.8*discoMultiplier;
      const stripeW=L.width*(0.04+0.02*Math.sin(time*(discoActive?2:1.2)+localPhase))*discoMultiplier;
      const stripeGrad=ctx.createLinearGradient(stripeX,0,stripeX,H*0.7);
      const sh=(hue+(Math.sin(time*(discoActive?2.5:1.5)+localPhase)*(discoActive?200:160)+160))%360;
      stripeGrad.addColorStop(0,`hsla(${sh},95%,86%,${0.15*intensity*stro})`);
      stripeGrad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=stripeGrad;ctx.fillRect(stripeX-stripeW*0.5,0,stripeW,H*0.7);
    }
    if(discoActive){
      const extraGlow=ctx.createRadialGradient(L.x,H*0.2,0,L.x,H*0.2,100);
      extraGlow.addColorStop(0,`hsla(${(hue+180)%360},100%,75%,${0.12*stro})`);
      extraGlow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=extraGlow;ctx.beginPath();ctx.arc(L.x,H*0.2,100,0,Math.PI*2);ctx.fill();
      ctx.globalCompositeOperation='source-over';
    }
  }
}

function drawStars(time){
  // Bij kerst: altijd sterren tonen (ook met licht aan, maar zachter)
  // Bij andere thema's: alleen met licht uit
  if(lightsOn && !isChristmas())return;

  const christmasMode = isChristmas();
  const baseDimming = (lightsOn && christmasMode) ? 0.4 : 1.0; // Dimmer met licht aan bij kerst

  for(const star of stars){
    const twinkle=Math.sin(time*star.twinkleSpeed+star.twinklePhase)*0.3+0.7;
    const alpha=star.brightness*twinkle*0.9*baseDimming;

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

  // Extra kerst sparkles (gouden glitters die langzaam bewegen)
  if(christmasMode){
    const sparkleCount = 8;
    for(let i=0;i<sparkleCount;i++){
      const sparklePhase = i * 3.7 + time * 0.0003;
      const x = (Math.sin(sparklePhase) * 0.4 + 0.5) * W;
      const y = (Math.cos(sparklePhase * 0.7) * 0.3 + 0.3) * H;
      const sparkle = Math.sin(time * 0.005 + i * 2.1) * 0.5 + 0.5;
      const sparkleAlpha = sparkle * 0.6 * baseDimming;

      // Gouden glitter
      const sparkleGrad = ctx.createRadialGradient(x,y,0,x,y,4);
      sparkleGrad.addColorStop(0,`rgba(255,215,100,${sparkleAlpha})`);
      sparkleGrad.addColorStop(1,`rgba(255,215,100,0)`);
      ctx.fillStyle = sparkleGrad;
      ctx.beginPath();
      ctx.arc(x,y,4,0,Math.PI*2);
      ctx.fill();
    }
  }
}

function drawHalloweenMoon(){
  if(!isHalloween()||lightsOn)return;

  // Grote volle maan rechtsboven
  const moonX=W*0.85;
  const moonY=H*0.15;
  const moonRadius=60;

  // Maan glow (zachte gloed rondom)
  const moonGlow=ctx.createRadialGradient(moonX,moonY,moonRadius*0.5,moonX,moonY,moonRadius*2);
  moonGlow.addColorStop(0,'rgba(255,255,200,0.3)');
  moonGlow.addColorStop(0.5,'rgba(255,255,200,0.1)');
  moonGlow.addColorStop(1,'rgba(255,255,200,0)');
  ctx.fillStyle=moonGlow;
  ctx.beginPath();
  ctx.arc(moonX,moonY,moonRadius*2,0,Math.PI*2);
  ctx.fill();

  // Maan zelf (gradient voor 3D effect)
  const moonGrad=ctx.createRadialGradient(moonX-moonRadius*0.3,moonY-moonRadius*0.3,0,moonX,moonY,moonRadius);
  moonGrad.addColorStop(0,'#fffef0'); // Licht geel-wit
  moonGrad.addColorStop(0.7,'#f0e68c'); // Khaki geel
  moonGrad.addColorStop(1,'#d4c589'); // Donkerder aan de rand
  ctx.fillStyle=moonGrad;
  ctx.beginPath();
  ctx.arc(moonX,moonY,moonRadius,0,Math.PI*2);
  ctx.fill();

  // Kraters (donkere vlekken)
  ctx.fillStyle='rgba(180,170,140,0.3)';
  ctx.beginPath();
  ctx.arc(moonX+moonRadius*0.2,moonY-moonRadius*0.3,moonRadius*0.15,0,Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(moonX-moonRadius*0.3,moonY+moonRadius*0.1,moonRadius*0.2,0,Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(moonX+moonRadius*0.1,moonY+moonRadius*0.35,moonRadius*0.12,0,Math.PI*2);
  ctx.fill();
}

function setupSpiderWebs(){
  spiderWebs.length=0;
  if(!isHalloween())return;

  // Alleen 2 webben: linksboven en rechtsboven (altijd in de hoeken)
  const corners=[
    {x:0,y:0,anchor:'left'},        // Linksboven
    {x:W,y:0,anchor:'right'}        // Rechtsboven
  ];

  for(const corner of corners){
    const webSize=rand(300,500); // Veel groter: 300-500 (huidige 300 is nu het kleinste)
    const strands=5;
    const radialLines=[];
    const concentricLines=[];

    // Genereer radiaal strands vanuit de hoek (statisch)
    for(let i=0;i<strands;i++){
      const angle=corner.anchor==='left'?i*(Math.PI/2)/(strands-1):Math.PI/2+i*(Math.PI/2)/(strands-1);
      const endX=corner.x+Math.cos(angle)*webSize;
      const endY=corner.y+Math.sin(angle)*webSize;
      radialLines.push({startX:corner.x,startY:corner.y,endX,endY});
    }

    // Genereer spiraal/concentrische lijnen (statisch)
    for(let r=1;r<=3;r++){
      const radius=webSize*(r/3)*0.7;
      const points=[];

      for(let i=0;i<strands;i++){
        const angle=corner.anchor==='left'?i*(Math.PI/2)/(strands-1):Math.PI/2+i*(Math.PI/2)/(strands-1);
        const x=corner.x+Math.cos(angle)*radius;
        const y=corner.y+Math.sin(angle)*radius;
        points.push({x,y});
      }
      concentricLines.push(points);
    }

    spiderWebs.push({radialLines,concentricLines});
  }
}

function drawSpiderWebs(){
  if(!isHalloween()||spiderWebs.length===0)return;

  // In Halloween mode: spinnenwebben altijd zichtbaar (ook bij licht uit)
  ctx.strokeStyle='rgba(200,200,200,0.15)';
  ctx.lineWidth=1;

  for(const web of spiderWebs){
    // Teken radiaal strands
    for(const line of web.radialLines){
      ctx.beginPath();
      ctx.moveTo(line.startX,line.startY);
      ctx.lineTo(line.endX,line.endY);
      ctx.stroke();
    }

    // Teken concentrische lijnen
    for(const points of web.concentricLines){
      ctx.beginPath();
      for(let i=0;i<points.length;i++){
        if(i===0)ctx.moveTo(points[i].x,points[i].y);
        else ctx.lineTo(points[i].x,points[i].y);
      }
      ctx.stroke();
    }
  }
}

function drawSandBottom(time){
  const sandHeight=70;
  const sandTop=H-sandHeight;

  // Winter/Kerst: witte sneeuw ipv zand
  if(isWinter()||isChristmas()){
    const snowGrad=ctx.createLinearGradient(0,sandTop,0,H);
    if(lightsOn){
      snowGrad.addColorStop(0,'#FFFFFF'); // Wit sneeuw boven
      snowGrad.addColorStop(0.5,'#F0F8FF'); // Licht blauwige sneeuw
      snowGrad.addColorStop(1,'#E6F2FF'); // Iets donkerder sneeuw onder
    } else {
      snowGrad.addColorStop(0,'#C8D8E8'); // Blauwgrijze sneeuw (nacht)
      snowGrad.addColorStop(0.5,'#B0C4D8'); // Midden
      snowGrad.addColorStop(1,'#98B0C8'); // Donkerder (nacht)
    }
    ctx.fillStyle=snowGrad;
  } else {
    // Normaal: zand gradient (lichter boven, donkerder onder)
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
    ctx.fillStyle=sandGrad;
  }

  // Teken basis zand/sneeuw laag met golvende bovenkant
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
    // Kerst: teken sneeuwvlokken
    if(isChristmas()){
      ctx.fillStyle=`rgba(255,255,255,${p.alpha*0.9})`;
      ctx.strokeStyle=`rgba(255,255,255,${p.alpha*0.7})`;
      ctx.lineWidth=1;

      // Simpele sneeuwvlok (6 armen)
      const armLength=p.size*1.5;
      ctx.beginPath();
      for(let i=0;i<6;i++){
        const angle=(i*Math.PI/3);
        const x1=p.x+Math.cos(angle)*p.size*0.3;
        const y1=p.y+Math.sin(angle)*p.size*0.3;
        const x2=p.x+Math.cos(angle)*armLength;
        const y2=p.y+Math.sin(angle)*armLength;
        ctx.moveTo(x1,y1);
        ctx.lineTo(x2,y2);
      }
      ctx.stroke();

      // Centrum bolletje
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size*0.4,0,Math.PI*2);
      ctx.fill();
    } else {
      // Normaal: gewone particle
      ctx.fillStyle=`rgba(255,255,255,${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fill();
    }

    // Update particle position
    if(isChristmas()){
      // Sneeuw valt langzamer en zwiept
      p.x+=Math.sin(p.y*0.01)*0.3+p.speedX*0.3;
      p.y+=Math.abs(p.speedY)*0.5; // Alleen naar beneden, langzamer
    } else {
      p.x+=p.speedX;
      p.y+=p.speedY;
    }

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

// === NIEUWJAAR VUURWERK ===
const FIREWORK_COLORS=['#ffd700','#ff6b6b','#4ecdc4','#ff69b4','#7b68ee','#00ff7f','#ff4500','#ffffff','#ff0000','#00ffff'];
let lastFireworkTime=0;

// Performance-based settings
function getFireworkSettings(){
  const q=performanceProfile.quality;
  if(q==='high')return{interval:800,maxActive:8,sparks:[35,55],trailLen:15};
  if(q==='medium')return{interval:1200,maxActive:5,sparks:[25,40],trailLen:10};
  if(q==='low')return{interval:1800,maxActive:3,sparks:[15,25],trailLen:6};
  return{interval:2500,maxActive:2,sparks:[10,18],trailLen:4}; // verylow
}

function spawnFirework(){
  const settings=getFireworkSettings();
  const color=FIREWORK_COLORS[Math.floor(Math.random()*FIREWORK_COLORS.length)];
  const x=rand(W*0.1,W*0.9);
  const targetY=rand(H*0.05,H*0.28); // Explodeert in bovenste deel
  fireworks.push({
    x:x,
    y:H*0.4, // Start onder water niveau
    targetY:targetY,
    vy:-rand(4,7), // Snelheid omhoog
    color:color,
    phase:'rising', // 'rising' of 'exploding'
    sparks:[],
    trail:[],
    birthTime:Date.now(),
    sparkRange:settings.sparks,
    trailLen:settings.trailLen
  });
}

function updateFireworks(){
  if(!isNewYear())return;

  const settings=getFireworkSettings();
  const now=Date.now();

  // Spawn nieuwe vuurwerk periodiek - meer tegelijk!
  if(now-lastFireworkTime>settings.interval&&fireworks.length<settings.maxActive){
    spawnFirework();
    // 40% kans op dubbel vuurwerk bij high/medium quality
    if((performanceProfile.quality==='high'||performanceProfile.quality==='medium')&&Math.random()<0.4&&fireworks.length<settings.maxActive-1){
      spawnFirework();
    }
    lastFireworkTime=now;
  }

  for(let i=fireworks.length-1;i>=0;i--){
    const fw=fireworks[i];

    if(fw.phase==='rising'){
      // Voeg trail toe
      fw.trail.push({x:fw.x,y:fw.y,alpha:1});
      if(fw.trail.length>fw.trailLen)fw.trail.shift();

      // Beweeg omhoog
      fw.y+=fw.vy;
      fw.x+=rand(-0.5,0.5); // Lichte wiggle

      // Check of we doelhoogte bereikt hebben
      if(fw.y<=fw.targetY){
        fw.phase='exploding';
        // Creëer explosie sparks - aantal gebaseerd op performance
        const numSparks=Math.floor(rand(fw.sparkRange[0],fw.sparkRange[1]));
        for(let j=0;j<numSparks;j++){
          const angle=rand(0,Math.PI*2);
          const speed=rand(3,9); // Grotere explosie radius
          fw.sparks.push({
            x:fw.x,
            y:fw.y,
            vx:Math.cos(angle)*speed,
            vy:Math.sin(angle)*speed,
            alpha:1,
            size:rand(2.5,5), // Grotere sparks
            decay:rand(0.010,0.018) // Iets langzamer uitdoven
          });
        }
        fw.trail=[];
      }
    }
    else if(fw.phase==='exploding'){
      // Update sparks
      let allDead=true;
      for(const spark of fw.sparks){
        spark.x+=spark.vx;
        spark.y+=spark.vy;
        spark.vy+=0.08; // Gravity
        spark.vx*=0.98; // Drag
        spark.alpha-=spark.decay;
        if(spark.alpha>0)allDead=false;
      }

      // Verwijder vuurwerk als alle sparks gedoofd zijn
      if(allDead){
        fireworks.splice(i,1);
      }
    }
  }
}

function drawFireworks(){
  if(!isNewYear())return;

  for(const fw of fireworks){
    if(fw.phase==='rising'){
      // Teken trail
      for(let i=0;i<fw.trail.length;i++){
        const t=fw.trail[i];
        const alpha=(i/fw.trail.length)*0.6;
        ctx.fillStyle=fw.color.replace(')',`,${alpha})`).replace('rgb','rgba').replace('#',`rgba(${parseInt(fw.color.slice(1,3),16)},${parseInt(fw.color.slice(3,5),16)},${parseInt(fw.color.slice(5,7),16)},`).split('rgba').pop();
        ctx.globalAlpha=alpha;
        ctx.beginPath();
        ctx.arc(t.x,t.y,2,0,Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha=1;

      // Teken raket punt
      ctx.fillStyle=fw.color;
      ctx.beginPath();
      ctx.arc(fw.x,fw.y,3,0,Math.PI*2);
      ctx.fill();

      // Glow effect
      ctx.shadowColor=fw.color;
      ctx.shadowBlur=10;
      ctx.beginPath();
      ctx.arc(fw.x,fw.y,2,0,Math.PI*2);
      ctx.fill();
      ctx.shadowBlur=0;
    }
    else if(fw.phase==='exploding'){
      // Teken sparks
      for(const spark of fw.sparks){
        if(spark.alpha<=0)continue;
        ctx.globalAlpha=spark.alpha;
        ctx.fillStyle=fw.color;
        ctx.shadowColor=fw.color;
        ctx.shadowBlur=spark.alpha*8;
        ctx.beginPath();
        ctx.arc(spark.x,spark.y,spark.size*spark.alpha,0,Math.PI*2);
        ctx.fill();
      }
      ctx.shadowBlur=0;
      ctx.globalAlpha=1;
    }
  }
}

// === NIEUWJAAR JAARCIJFERS ===
function drawNewYearText(time){
  if(!isNewYear())return;

  const now=new Date();
  const month=now.getMonth();
  const day=now.getDate();

  const centerX=W/2;
  const centerY=H*0.45;
  const glowPulse=0.7+Math.sin(time*0.002)*0.3;

  ctx.save();
  ctx.textAlign='center';
  ctx.textBaseline='middle';

  if(!(month===0&&day<=6)){ // Countdown tonen behalve 1-6 januari
    // Bereken tijd tot middernacht 1 januari
    const newYear=new Date(now.getFullYear()+1,0,1,0,0,0);
    const diff=newYear-now;

    const days=Math.floor(diff/(1000*60*60*24));
    const hours=Math.floor((diff%(1000*60*60*24))/(1000*60*60));
    const minutes=Math.floor((diff%(1000*60*60))/(1000*60));
    const seconds=Math.floor((diff%(1000*60))/1000);

    // Countdown tekst
    let countdownText;
    if(days>=1){
      // 29-30 dec: "Nog X dagen"
      countdownText=days===1?'1 dag':`${days} dagen`;
    }else{
      // 31 dec: live countdown
      countdownText=`${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
    }

    // Countdown groot
    ctx.font=`bold ${Math.floor(W*0.10)}px Arial, sans-serif`;
    ctx.shadowColor='#ffd700';
    ctx.shadowBlur=25*glowPulse;
    ctx.fillStyle=`rgba(255,215,0,${0.85*glowPulse})`;
    ctx.fillText(countdownText,centerX,centerY);
    ctx.shadowBlur=0;
    ctx.fillStyle='#fff8dc';
    ctx.fillText(countdownText,centerX,centerY);


  }else{ // 1-6 januari: feestelijk
    // 2025 groot
    ctx.font=`bold ${Math.floor(W*0.12)}px Arial, sans-serif`;
    ctx.shadowColor='#ffd700';
    ctx.shadowBlur=25*glowPulse;
    ctx.fillStyle=`rgba(255,215,0,${0.85*glowPulse})`;
    ctx.fillText('2025',centerX,centerY);
    ctx.shadowBlur=0;
    ctx.fillStyle='#fff8dc';
    ctx.fillText('2025',centerX,centerY);

    // Gelukkig Nieuwjaar eronder
    ctx.font=`bold ${Math.floor(W*0.04)}px Arial, sans-serif`;
    ctx.shadowColor='#ffd700';
    ctx.shadowBlur=15*glowPulse;
    ctx.fillStyle=`rgba(255,215,0,${0.8*glowPulse})`;
    ctx.fillText('Gelukkig Nieuwjaar!',centerX,centerY+W*0.09);
    ctx.shadowBlur=0;
    ctx.fillStyle='#fffacd';
    ctx.fillText('Gelukkig Nieuwjaar!',centerX,centerY+W*0.09);
  }

  ctx.restore();
}

// Champagne fles bij de pump - bubbels lijken uit de fles te komen
function drawPumpChampagne(){
  if(!isNewYear())return;

  const lightMul=lightsOn?1:0.6;
  const fadeAlpha=1;

  // Positie: bij de pump, schuin liggend
  const x=pumpPos.x;
  const y=H-60;
  const bottleHeight=120;
  const bottleWidth=bottleHeight*0.28;
  const neckWidth=bottleWidth*0.35;

  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(-1.1); // ~63 graden schuin

  // Fles body (donkergroen glas)
  const bodyGrad=ctx.createLinearGradient(-bottleWidth/2,0,bottleWidth/2,0);
  bodyGrad.addColorStop(0,`hsla(140,45%,${15*lightMul}%,${fadeAlpha})`);
  bodyGrad.addColorStop(0.3,`hsla(140,40%,${25*lightMul}%,${fadeAlpha})`);
  bodyGrad.addColorStop(0.7,`hsla(140,40%,${22*lightMul}%,${fadeAlpha})`);
  bodyGrad.addColorStop(1,`hsla(140,45%,${12*lightMul}%,${fadeAlpha})`);
  ctx.fillStyle=bodyGrad;

  // Fles body shape
  ctx.beginPath();
  ctx.moveTo(-bottleWidth/2,bottleHeight*0.35);
  ctx.lineTo(-bottleWidth/2,-bottleHeight*0.1);
  ctx.quadraticCurveTo(-bottleWidth/2,-bottleHeight*0.2,-neckWidth/2,-bottleHeight*0.28);
  ctx.lineTo(-neckWidth/2,-bottleHeight*0.52);
  ctx.lineTo(neckWidth/2,-bottleHeight*0.52);
  ctx.lineTo(neckWidth/2,-bottleHeight*0.28);
  ctx.quadraticCurveTo(bottleWidth/2,-bottleHeight*0.2,bottleWidth/2,-bottleHeight*0.1);
  ctx.lineTo(bottleWidth/2,bottleHeight*0.35);
  ctx.closePath();
  ctx.fill();

  // Gouden folie rond de nek
  ctx.fillStyle=`hsla(45,80%,${55*lightMul}%,${fadeAlpha})`;
  ctx.beginPath();
  ctx.rect(-neckWidth/2-3,-bottleHeight*0.52,neckWidth+6,bottleHeight*0.12);
  ctx.fill();

  // Open fles - donkere opening bovenaan
  ctx.fillStyle=`hsla(140,30%,${8*lightMul}%,${fadeAlpha})`;
  ctx.beginPath();
  ctx.ellipse(0,-bottleHeight*0.52,neckWidth/2,neckWidth*0.2,0,0,Math.PI*2);
  ctx.fill();

  // Gouden rand rond opening
  ctx.strokeStyle=`hsla(45,70%,${50*lightMul}%,${fadeAlpha})`;
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.ellipse(0,-bottleHeight*0.52,neckWidth/2+1,neckWidth*0.25,0,0,Math.PI*2);
  ctx.stroke();

  // Label (crème kleur)
  ctx.fillStyle=`hsla(40,30%,${85*lightMul}%,${fadeAlpha})`;
  ctx.beginPath();
  ctx.rect(-bottleWidth*0.38,-bottleHeight*0.08,bottleWidth*0.76,bottleHeight*0.28);
  ctx.fill();

  // Label tekst/decoratie (gouden lijnen)
  ctx.fillStyle=`hsla(45,60%,${50*lightMul}%,${fadeAlpha})`;
  ctx.beginPath();
  ctx.rect(-bottleWidth*0.28,bottleHeight*0.0,bottleWidth*0.56,bottleHeight*0.025);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(-bottleWidth*0.28,bottleHeight*0.05,bottleWidth*0.56,bottleHeight*0.025);
  ctx.fill();

  // Glans op fles
  ctx.fillStyle=`hsla(0,0%,100%,${fadeAlpha*0.18})`;
  ctx.beginPath();
  ctx.ellipse(-bottleWidth*0.22,0,bottleWidth*0.06,bottleHeight*0.22,0,0,Math.PI*2);
  ctx.fill();

  ctx.restore();
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

  // Fill viewport area with gradient background for depth - theme based
  const theme=getThemeConfig();
  const bgColors=lightsOn?theme.bgLight:theme.bgDark;
  const bgGrad=ctx.createLinearGradient(0,0,0,H);
  bgGrad.addColorStop(0,bgColors[0]);
  bgGrad.addColorStop(0.3,bgColors[1]);
  bgGrad.addColorStop(0.7,bgColors[2]);
  bgGrad.addColorStop(1,bgColors[3]);
  ctx.fillStyle=bgGrad;
  ctx.fillRect(0,0,W,H);

  // Extra subtiele radiale gradient voor meer diepte (donkerder in hoeken)
  const vignetteGrad=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.8);
  vignetteGrad.addColorStop(0,'rgba(0,0,0,0)');
  vignetteGrad.addColorStop(1,`rgba(0,0,0,${theme.vignette})`);
  ctx.fillStyle=vignetteGrad;
  ctx.fillRect(0,0,W,H);

  drawStars(time);
  drawHalloweenMoon();
  // Vuurwerk alleen na nieuwjaar (1-6 januari)
  const nowDate=new Date();
  if(isNewYear()&&nowDate.getMonth()===0&&nowDate.getDate()<=6){
    updateFireworks();
    drawFireworks();
  }
  drawNewYearText(time);
  drawAmbientGlow(time);
  drawLamps(time);
  drawSpiderWebs();
  drawDiscoFog(time);
  discoEffects(time);
  drawDiscoBall(time);
  drawFishingRod(time);
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
  ctx.fillStyle=p.color||'#ffb37a';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
  // Verwijder alleen als ttl verloopt (niet meer als het de bodem raakt)
  if(p.ttl<=0){foods.splice(i,1)}}}
function drawBubbles(){const theme=getThemeConfig();for(let i=bubbles.length-1;i>=0;i--){const b=bubbles[i];b.y-=b.vy;b.x+=b.vx;b.ttl--;ctx.globalAlpha=lightsOn?0.7:0.5;ctx.fillStyle=theme.bubbleColor;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;if(b.y<-10||b.ttl<=0){releaseBubble(b);bubbles.splice(i,1)}}}

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

// Speelbal functies
function makePlayBall(){
  // Check of er al een bal is
  if(playBalls.length > 0) {
    console.log('🎾 Er is al een bal! Wacht tot deze verdwijnt.');
    return;
  }

  // Random kleur kiezen (kerst heeft alleen rood)
  const ballColors = isChristmas() ? [
    { light: '#ff4444', mid: '#cc0000', dark: '#990000' }, // Kerst Rood
  ] : [
    { light: '#ff6b9d', mid: '#ff1493', dark: '#c71585' }, // Magenta/Roze
    { light: '#4ecdc4', mid: '#2eb8b0', dark: '#1a8a85' }, // Turquoise
    { light: '#ffd93d', mid: '#ffb700', dark: '#e89e00' }, // Geel
    { light: '#6bcf7f', mid: '#3ecf5c', dark: '#2db84b' }, // Groen
    { light: '#ff9f6b', mid: '#ff7043', dark: '#e64a19' }, // Oranje
    { light: '#9d6bff', mid: '#7c4dff', dark: '#5e35b1' }, // Paars
    { light: '#6bb8ff', mid: '#4a90e2', dark: '#357abd' }  // Blauw
  ];
  const randomColor = ballColors[Math.floor(Math.random() * ballColors.length)];

  const ball = {
    x: rand(100, W-100),
    y: rand(50, H/2), // Start in bovenste helft
    vx: rand(-1, 1),
    vy: 0,
    radius: 100, // NOG VEEL GROTER! (was 50, nu 100 - 2x zo groot!)
    ttl: 7200, // 120 seconden = 2 minuten bij 60fps (was 3600 = 60 sec)
    bounceDamping: 0.7, // Energie verlies bij bounce
    gravity: 0.08, // Drijvende bal (lichte gravity)
    buoyancy: 0.12, // Opwaartse kracht (hoger dan gravity = drijven)
    color: randomColor // Random kleur voor deze bal
  };
  playBalls.push(ball);
  console.log('🎾 Speelbal toegevoegd! Vissen gaan ermee spelen!');

  // Zorg dat ALTIJD minimaal 2-3 vissen spelen (meer zekerheid)
  const numPlayingFish = Math.max(2, Math.floor(rand(2, 4))); // Minimaal 2, max 3 vissen
  const availableFish = [...fishes]; // Kopieer array

  for(let i = 0; i < numPlayingFish && availableFish.length > 0; i++) {
    // Kies random vis
    const randomIndex = Math.floor(Math.random() * availableFish.length);
    const fish = availableFish[randomIndex];

    // Zet vis in playing mode
    fish.behaviorState = 'playing';
    fish.behaviorTimer = Math.floor(rand(600, 1200)); // Speel 10-20 seconden

    // Verwijder uit beschikbare vissen
    availableFish.splice(randomIndex, 1);
  }
}

function updatePlayBalls(){
  for(let i = playBalls.length - 1; i >= 0; i--){
    const ball = playBalls[i];

    // Zorg ervoor dat er altijd minimaal 2 vissen met de bal spelen
    // Check elke 2 seconden (120 frames)
    if(!ball.lastPlayingCheck || Date.now() - ball.lastPlayingCheck > 2000) {
      ball.lastPlayingCheck = Date.now();

      const playingFish = fishes.filter(f => f.behaviorState === 'playing').length;

      if(playingFish < 2) {
        // Niet genoeg vissen spelen, voeg er 1-2 toe
        const needed = 2 - playingFish;
        const availableFish = fishes.filter(f => f.behaviorState !== 'playing');

        for(let j = 0; j < needed && j < availableFish.length; j++) {
          const randomIndex = Math.floor(Math.random() * availableFish.length);
          const fish = availableFish[randomIndex];
          fish.behaviorState = 'playing';
          fish.behaviorTimer = Math.floor(rand(600, 1200));
          availableFish.splice(randomIndex, 1);
        }
      }
    }

    // Physics: buoyancy (drijven) vs gravity
    ball.vy += ball.gravity - ball.buoyancy;

    // Update positie
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Friction in water
    ball.vx *= 0.98;
    ball.vy *= 0.98;

    // Bounce tegen wanden (links/rechts)
    if(ball.x - ball.radius < 0){
      ball.x = ball.radius;
      ball.vx = -ball.vx * ball.bounceDamping;
    }
    if(ball.x + ball.radius > W){
      ball.x = W - ball.radius;
      ball.vx = -ball.vx * ball.bounceDamping;
    }

    // Bounce tegen bovenkant
    if(ball.y - ball.radius < 0){
      ball.y = ball.radius;
      ball.vy = -ball.vy * ball.bounceDamping;
    }

    // Bounce tegen onderkant (bodem)
    if(ball.y + ball.radius > H - 20){
      ball.y = H - 20 - ball.radius;
      ball.vy = -ball.vy * ball.bounceDamping;
    }

    // TTL countdown
    ball.ttl--;
    if(ball.ttl <= 0){
      playBalls.splice(i, 1);
      console.log('🎾 Speelbal is verdwenen');

      // Notify server that ball is gone (so button can be enabled again)
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ command: 'ballGone' }));
      }
    }
  }
}

function drawPlayBalls(){
  for(const ball of playBalls){
    // Schaduw effect
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(ball.x + 5, ball.y + 5, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if(isHalloween()){
      // Halloween: pompoen stijl bal (zelfde stijl als decoratie)
      const lightMul = lightsOn ? 1 : 0.6;
      const hue = 30; // Oranje hue (zoals pompoen decoratie)

      // Pompoen lichaam (oranje met gradient - exact zoals decoratie)
      const pumpkinGrad = ctx.createRadialGradient(
        ball.x - ball.radius * 0.2,
        ball.y - ball.radius * 0.2,
        0,
        ball.x,
        ball.y,
        ball.radius * 0.6
      );
      pumpkinGrad.addColorStop(0, `hsla(${hue},85%,${58*lightMul}%,1)`);
      pumpkinGrad.addColorStop(1, `hsla(${hue},75%,${40*lightMul}%,1)`);
      ctx.fillStyle = pumpkinGrad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Pompoen segmenten (donkere lijnen - exact zoals decoratie)
      ctx.strokeStyle = `hsla(${hue},70%,${25*lightMul}%,0.6)`;
      ctx.lineWidth = 2;
      for(let i = -2; i <= 2; i++){
        const segX = ball.x + i * ball.radius * 0.3;
        // Gebruik ellipse formule voor ronde bal
        const xOffset = Math.abs(i * ball.radius * 0.3);
        const maxY = ball.radius * Math.sqrt(1 - Math.pow(xOffset / ball.radius, 2));
        const lineHeight = maxY * 0.96;

        ctx.beginPath();
        ctx.moveTo(segX, ball.y - lineHeight);
        ctx.quadraticCurveTo(segX + (i * 3), ball.y, segX, ball.y + lineHeight);
        ctx.stroke();
      }

      // Steeltje (groen - exact zoals decoratie)
      const stemWidth = ball.radius * 0.24;
      const stemHeight = ball.radius * 0.4;
      ctx.fillStyle = `hsla(120,45%,${30*lightMul}%,1)`;
      ctx.fillRect(ball.x - stemWidth/2, ball.y - ball.radius - stemHeight, stemWidth, stemHeight);

      // Jack-o'-lantern gezicht (exact zoals decoratie)
      const eyeGlow = `hsla(45,100%,${65*lightMul}%,1)`;

      // Linker oog (driehoek)
      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.moveTo(ball.x - ball.radius * 0.5, ball.y - ball.radius * 0.3);
      ctx.lineTo(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3);
      ctx.lineTo(ball.x - ball.radius * 0.4, ball.y - ball.radius * 0.1);
      ctx.fill();

      // Rechter oog (driehoek)
      ctx.beginPath();
      ctx.moveTo(ball.x + ball.radius * 0.3, ball.y - ball.radius * 0.3);
      ctx.lineTo(ball.x + ball.radius * 0.5, ball.y - ball.radius * 0.3);
      ctx.lineTo(ball.x + ball.radius * 0.4, ball.y - ball.radius * 0.1);
      ctx.fill();

      // Mond (grillig - exact zoals decoratie)
      ctx.beginPath();
      ctx.moveTo(ball.x - ball.radius * 0.5, ball.y + ball.radius * 0.2);
      ctx.quadraticCurveTo(ball.x - ball.radius * 0.3, ball.y + ball.radius * 0.4, ball.x - ball.radius * 0.1, ball.y + ball.radius * 0.2);
      ctx.quadraticCurveTo(ball.x, ball.y + ball.radius * 0.4, ball.x + ball.radius * 0.1, ball.y + ball.radius * 0.2);
      ctx.quadraticCurveTo(ball.x + ball.radius * 0.3, ball.y + ball.radius * 0.4, ball.x + ball.radius * 0.5, ball.y + ball.radius * 0.2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = eyeGlow;
      ctx.stroke();

    } else if(isNewYear()){
      // Nieuwjaar: oliebol stijl (zoals decoratie)
      const lightMul = lightsOn ? 1 : 0.6;

      // Oliebol basis (goudbruin)
      const bolGrad = ctx.createRadialGradient(
        ball.x - ball.radius * 0.2,
        ball.y - ball.radius * 0.2,
        0,
        ball.x,
        ball.y,
        ball.radius
      );
      bolGrad.addColorStop(0, `hsla(35,55%,${55*lightMul}%,1)`);
      bolGrad.addColorStop(0.7, `hsla(30,60%,${40*lightMul}%,1)`);
      bolGrad.addColorStop(1, `hsla(25,50%,${30*lightMul}%,1)`);
      ctx.fillStyle = bolGrad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Krokante textuur (statische donkere stipjes)
      ctx.fillStyle = `hsla(25,40%,${25*lightMul}%,0.5)`;
      for(let i = 0; i < 8; i++){
        const angle = i * Math.PI / 4;
        const dist = ball.radius * 0.55;
        const dotX = ball.x + Math.cos(angle) * dist;
        const dotY = ball.y + Math.sin(angle) * dist;
        ctx.beginPath();
        ctx.arc(dotX, dotY, ball.radius * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }

      // Poedersuiker (witte stipjes bovenop)
      ctx.fillStyle = `hsla(0,0%,${100*lightMul}%,0.95)`;
      const sugarAngles = [0.3, 0.9, 1.5, 2.1, 2.7, 3.3, 3.9, 4.5, 5.1, 5.7];
      const sugarDists = [0.3, 0.5, 0.2, 0.6, 0.4, 0.55, 0.35, 0.45, 0.25, 0.5];
      const sugarSizes = [2.5, 2, 3, 1.5, 2.5, 2, 3, 2, 1.5, 2.5];
      for(let i = 0; i < 10; i++){
        const angle = sugarAngles[i];
        const dist = sugarDists[i] * ball.radius * 0.8;
        const dotX = ball.x + Math.cos(angle) * dist;
        const dotY = ball.y - ball.radius * 0.2 + Math.sin(angle) * dist * 0.5;
        const dotSize = sugarSizes[i];
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Extra grote poedersuiker klodders bovenop
      ctx.fillStyle = `hsla(0,0%,${98*lightMul}%,0.85)`;
      ctx.beginPath();
      ctx.arc(ball.x - ball.radius * 0.2, ball.y - ball.radius * 0.5, ball.radius * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ball.x + ball.radius * 0.25, ball.y - ball.radius * 0.4, ball.radius * 0.14, 0, Math.PI * 2);
      ctx.fill();

    } else if(isSummer()){
      // Zomer: strandbal met rood-witte strepen
      const lightMul = lightsOn ? 1 : 0.7;

      // Witte basis
      ctx.fillStyle = `rgba(255,255,255,${lightMul})`;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Afwisselend rode en witte strepen (3 rood, 3 wit)
      const numStripes = 6;
      for(let i = 0; i < numStripes; i++){
        const startAngle = (i * 2 * Math.PI / numStripes);
        const endAngle = startAngle + (2 * Math.PI / numStripes);
        ctx.fillStyle = i % 2 === 0 ? `rgba(220,20,60,${lightMul})` : `rgba(255,255,255,${lightMul})`;
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.arc(ball.x, ball.y, ball.radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
      }

      // Witte glans (linksboven)
      ctx.fillStyle = `rgba(255,255,255,${0.5*lightMul})`;
      ctx.beginPath();
      ctx.arc(ball.x - ball.radius * 0.35, ball.y - ball.radius * 0.35, ball.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();

    } else if(isChristmas()){
      // Kerst: echte kerstbal met kroontje
      const lightMul = lightsOn ? 1 : 0.7;

      // Metalen kroontje bovenop de bal
      const capHeight = ball.radius * 0.25;
      const capWidth = ball.radius * 0.4;
      const capGrad = ctx.createLinearGradient(
        ball.x - capWidth/2, ball.y - ball.radius,
        ball.x + capWidth/2, ball.y - ball.radius
      );
      capGrad.addColorStop(0, `rgba(180,180,180,${lightMul})`);
      capGrad.addColorStop(0.5, `rgba(220,220,220,${lightMul})`);
      capGrad.addColorStop(1, `rgba(180,180,180,${lightMul})`);
      ctx.fillStyle = capGrad;
      ctx.fillRect(ball.x - capWidth/2, ball.y - ball.radius - capHeight, capWidth, capHeight);

      // Glanzende kerstbal met vaste kleur per bal
      const ornamentGrad = ctx.createRadialGradient(
        ball.x - ball.radius * 0.3,
        ball.y - ball.radius * 0.3,
        0,
        ball.x,
        ball.y,
        ball.radius
      );
      ornamentGrad.addColorStop(0, ball.color.light);
      ornamentGrad.addColorStop(0.6, ball.color.mid);
      ornamentGrad.addColorStop(1, ball.color.dark);
      ctx.fillStyle = ornamentGrad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Extra glanzend wit highlight spotje (kerstballen zijn extra glanzend)
      ctx.fillStyle = `rgba(255,255,255,${0.85*lightMul})`;
      ctx.beginPath();
      ctx.arc(ball.x - ball.radius * 0.35, ball.y - ball.radius * 0.35, ball.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Klein tweede highlight voor extra glans
      ctx.fillStyle = `rgba(255,255,255,${0.4*lightMul})`;
      ctx.beginPath();
      ctx.arc(ball.x + ball.radius * 0.25, ball.y + ball.radius * 0.25, ball.radius * 0.15, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // Normaal: gekleurde bal
      const gradient = ctx.createRadialGradient(
        ball.x - ball.radius/3,
        ball.y - ball.radius/3,
        ball.radius/4,
        ball.x,
        ball.y,
        ball.radius
      );
      gradient.addColorStop(0, ball.color.light); // Lichte kleur
      gradient.addColorStop(0.5, ball.color.mid); // Middel kleur
      gradient.addColorStop(1, ball.color.dark); // Donkere kleur

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Witte glans voor shiny effect
      ctx.globalAlpha = lightsOn ? 0.6 : 0.3;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ball.x - ball.radius/3, ball.y - ball.radius/3, ball.radius/3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Fade out effect in laatste seconden
    if(ball.ttl < 120){ // Laatste 2 seconden
      ctx.globalAlpha = ball.ttl / 120;
      ctx.strokeStyle = isHalloween() ? '#ff8c42' : isNewYear() ? '#d4a056' : ball.color.light;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }
}

function drawPlant(plant,time){
  const lightMul=lightsOn?1:0.6;
  // Heel subtiele sway voor meer leven
  const swayAmount=Math.sin(time*0.015+plant.swayPhase)*3;
  const moveAmount=Math.sin(time*0.008+plant.movePhase)*2;

  // Kerst: teken vrolijke kerstboom ipv normale plant
  if(isChristmas()){
    // Proportionele verhouding: hoogte bepaalt breedte voor betere boom-vorm
    const treeHeight = Math.max(180, plant.height * 1.2); // Minimale hoogte voor kleine bomen
    const baseWidth = treeHeight * 0.45; // Basis breedte: 45% van hoogte
    const widthVariation = (plant.width / 80) * (treeHeight * 0.15); // Max 15% variatie
    const treeWidth = Math.min(180, baseWidth + widthVariation); // Max 180 pixels breed
    const alpha = (lightsOn ? 1 : 0.7) * fadeAlpha;

    // Vrolijke bruine stam met texture
    const trunkWidth = treeWidth * 0.18;
    const trunkHeight = treeHeight * 0.2;
    const trunkGrad = ctx.createLinearGradient(plant.x - trunkWidth/2, plant.y, plant.x + trunkWidth/2, plant.y);
    trunkGrad.addColorStop(0, `hsla(25,50%,${35*lightMul}%,${alpha})`);
    trunkGrad.addColorStop(0.5, `hsla(25,55%,${45*lightMul}%,${alpha})`);
    trunkGrad.addColorStop(1, `hsla(25,50%,${35*lightMul}%,${alpha})`);
    ctx.fillStyle = trunkGrad;
    ctx.fillRect(plant.x - trunkWidth/2, plant.y - trunkHeight, trunkWidth, trunkHeight);

    // Donkergroene kerstboom (4 lagen voor voller effect)
    const greenHue = 140; // Iets meer naar blauwgroen voor donkerder effect

    // Onderste laag (grootste en donkerste)
    const bottomY = plant.y - trunkHeight;
    const bottomWidth = treeWidth;
    const layerHeight = treeHeight * 0.22;
    ctx.fillStyle = `hsla(${greenHue},65%,${28*lightMul}%,${alpha})`; // Veel donkerder
    ctx.beginPath();
    ctx.moveTo(plant.x - bottomWidth/2, bottomY);
    ctx.lineTo(plant.x + bottomWidth/2, bottomY);
    ctx.lineTo(plant.x, bottomY - layerHeight);
    ctx.fill();

    // Tweede laag (iets lichter)
    const layer2Y = bottomY - layerHeight * 0.65;
    const layer2Width = treeWidth * 0.8;
    ctx.fillStyle = `hsla(${greenHue},68%,${32*lightMul}%,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(plant.x - layer2Width/2, layer2Y);
    ctx.lineTo(plant.x + layer2Width/2, layer2Y);
    ctx.lineTo(plant.x, layer2Y - layerHeight);
    ctx.fill();

    // Derde laag
    const layer3Y = layer2Y - layerHeight * 0.65;
    const layer3Width = treeWidth * 0.6;
    ctx.fillStyle = `hsla(${greenHue},70%,${35*lightMul}%,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(plant.x - layer3Width/2, layer3Y);
    ctx.lineTo(plant.x + layer3Width/2, layer3Y);
    ctx.lineTo(plant.x, layer3Y - layerHeight);
    ctx.fill();

    // Bovenste laag (lichtste punt voor diepte)
    const topY = layer3Y - layerHeight * 0.65;
    const topWidth = treeWidth * 0.4;
    ctx.fillStyle = `hsla(${greenHue},72%,${38*lightMul}%,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(plant.x - topWidth/2, topY);
    ctx.lineTo(plant.x + topWidth/2, topY);
    ctx.lineTo(plant.x, topY - layerHeight);
    ctx.fill();

    // Klassieke 5-puntige gouden ster bovenop (punt wijst naar boven)
    const starY = topY - layerHeight + treeWidth * 0.05;
    const starSize = treeWidth * 0.15; // Iets kleiner voor betere proportie
    const starGrad = ctx.createRadialGradient(plant.x, starY, 0, plant.x, starY, starSize * 1.2);
    starGrad.addColorStop(0, `hsla(48,100%,${80*lightMul}%,${alpha})`);
    starGrad.addColorStop(0.6, `hsla(45,100%,${65*lightMul}%,${alpha})`);
    starGrad.addColorStop(1, `hsla(42,95%,${55*lightMul}%,${alpha})`);
    ctx.fillStyle = starGrad;
    ctx.beginPath();

    // Teken 5-puntige ster: afwisselend buitenpunten en binnenpunten
    for(let i = 0; i < 10; i++){
      // Start bij -90 graden (boven) en ga met de klok mee
      const angle = (i * Math.PI / 5) - Math.PI / 2;
      const radius = i % 2 === 0 ? starSize : starSize * 0.4; // Buitenpunten vs binnenpunten
      const x = plant.x + Math.cos(angle) * radius;
      const y = starY + Math.sin(angle) * radius;
      if(i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Tijdelijk geen kerstballen in de boom
    // const ballCount = 5 + Math.floor(plant.width / 12);
    // const ballColors = [
    //   {color: '#ff2d55', glow: '#ff6b9d'},  // Vrolijk rood
    //   {color: '#ffd700', glow: '#ffe066'},  // Goud
    //   {color: '#00e676', glow: '#69f0ae'},  // Vrolijk groen
    // ];
    // for(let i = 0; i < ballCount; i++){
    //   // Bereken hoogte van bal (0 = onderaan, 1 = bovenaan)
    //   const heightRatio = (i + 0.5) / ballCount;
    //   const ballY = plant.y - trunkHeight - heightRatio * treeHeight * 0.7;
    //
    //   // Bereken max breedte op deze hoogte (driehoek wordt smaller naar boven)
    //   // Bottom = treeWidth, top = 0, dus: maxWidth = treeWidth * (1 - heightRatio)
    //   const maxWidthAtHeight = treeWidth * (1 - heightRatio * 0.85);
    //
    //   // Plaats bal random binnen de beschikbare breedte op deze hoogte
    //   const angle = (i * 2.3) + plant.swayPhase;
    //   const horizontalOffset = Math.sin(angle) * maxWidthAtHeight * 0.3; // Binnen 30% van max breedte
    //   const ballX = plant.x + horizontalOffset;
    //
    //   const ballRadius = treeWidth * 0.09;
    //   const colorSet = ballColors[i % ballColors.length];
    //
    //   // Glanzende bal met gradient
    //   const ballGrad = ctx.createRadialGradient(
    //     ballX - ballRadius*0.3, ballY - ballRadius*0.3, 0,
    //     ballX, ballY, ballRadius
    //   );
    //   ballGrad.addColorStop(0, colorSet.glow);
    //   ballGrad.addColorStop(0.7, colorSet.color);
    //   ballGrad.addColorStop(1, colorSet.color);
    //
    //   ctx.fillStyle = ballGrad;
    //   ctx.globalAlpha = alpha;
    //   ctx.beginPath();
    //   ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    //   ctx.fill();
    //
    //   // Wit highlight spotje
    //   ctx.fillStyle = `rgba(255,255,255,${0.6*lightMul})`;
    //   ctx.beginPath();
    //   ctx.arc(ballX - ballRadius*0.35, ballY - ballRadius*0.35, ballRadius*0.3, 0, Math.PI * 2);
    //   ctx.fill();
    //   ctx.globalAlpha = 1;
    // }
  }
  else if(plant.type==='seaweed' || plant.type==='kelp'){
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
  else if(deco.type==='pumpkin'){
    const x=deco.x;
    const y=deco.y+bobAmount;
    const pumpkinWidth=deco.size*0.8;
    const pumpkinHeight=deco.size*0.7;

    // Pompoen lichaam (oranje met segmenten)
    const pumpkinGrad=ctx.createRadialGradient(x-pumpkinWidth*0.2,y-pumpkinHeight*0.2,0,x,y,pumpkinWidth*0.6);
    pumpkinGrad.addColorStop(0,`hsla(${deco.hue},85%,${58*lightMul}%,${fadeAlpha})`);
    pumpkinGrad.addColorStop(1,`hsla(${deco.hue},75%,${40*lightMul}%,${fadeAlpha})`);
    ctx.fillStyle=pumpkinGrad;
    ctx.beginPath();
    ctx.ellipse(x,y,pumpkinWidth*0.5,pumpkinHeight*0.45,0,0,Math.PI*2);
    ctx.fill();

    // Pompoen segmenten (donkere lijnen)
    ctx.strokeStyle=`hsla(${deco.hue},70%,${25*lightMul}%,${fadeAlpha*0.6})`;
    ctx.lineWidth=2;
    for(let i=-2;i<=2;i++){
      const segX=x+i*pumpkinWidth*0.15;
      // Bereken de hoogte van de lijn zodat deze binnen de ellips blijft
      // De ellips heeft straal pumpkinWidth*0.5 en pumpkinHeight*0.45
      const xOffset=Math.abs(i*pumpkinWidth*0.15); // Horizontale afstand van centrum
      const radiusX=pumpkinWidth*0.5;
      const radiusY=pumpkinHeight*0.45;
      // Ellips formule: (x/a)² + (y/b)² = 1, dus y = b * sqrt(1 - (x/a)²)
      const maxY=radiusY*Math.sqrt(1-Math.pow(xOffset/radiusX,2));
      const lineHeight=maxY*0.96; // 96% van max hoogte, bijna tot de rand

      ctx.beginPath();
      ctx.moveTo(segX,y-lineHeight);
      ctx.quadraticCurveTo(segX+(i*3),y,segX,y+lineHeight);
      ctx.stroke();
    }

    // Steeltje (groen)
    const stemWidth=deco.size*0.12;
    const stemHeight=deco.size*0.2;
    ctx.fillStyle=`hsla(120,45%,${30*lightMul}%,${fadeAlpha})`;
    ctx.fillRect(x-stemWidth/2,y-pumpkinHeight*0.45-stemHeight,stemWidth,stemHeight);

    // Jack-o'-lantern gezicht (statische gloeiende ogen en mond)
    const eyeGlow=`hsla(45,100%,${65*lightMul}%,${fadeAlpha})`;

    // Linker oog (driehoek)
    ctx.fillStyle=eyeGlow;
    ctx.beginPath();
    ctx.moveTo(x-pumpkinWidth*0.25,y-pumpkinHeight*0.15);
    ctx.lineTo(x-pumpkinWidth*0.15,y-pumpkinHeight*0.15);
    ctx.lineTo(x-pumpkinWidth*0.2,y-pumpkinHeight*0.05);
    ctx.fill();

    // Rechter oog (driehoek)
    ctx.beginPath();
    ctx.moveTo(x+pumpkinWidth*0.15,y-pumpkinHeight*0.15);
    ctx.lineTo(x+pumpkinWidth*0.25,y-pumpkinHeight*0.15);
    ctx.lineTo(x+pumpkinWidth*0.2,y-pumpkinHeight*0.05);
    ctx.fill();

    // Mond (grillig)
    ctx.beginPath();
    ctx.moveTo(x-pumpkinWidth*0.25,y+pumpkinHeight*0.1);
    ctx.quadraticCurveTo(x-pumpkinWidth*0.15,y+pumpkinHeight*0.2,x-pumpkinWidth*0.05,y+pumpkinHeight*0.1);
    ctx.quadraticCurveTo(x,y+pumpkinHeight*0.2,x+pumpkinWidth*0.05,y+pumpkinHeight*0.1);
    ctx.quadraticCurveTo(x+pumpkinWidth*0.15,y+pumpkinHeight*0.2,x+pumpkinWidth*0.25,y+pumpkinHeight*0.1);
    ctx.lineWidth=3;
    ctx.strokeStyle=eyeGlow;
    ctx.stroke();
  }
  else if(deco.type==='skull'){
    const x=deco.x;
    const y=deco.y+bobAmount;
    const skullWidth=deco.size*0.8;
    const skullHeight=deco.size*0.9;

    // Schedel (wit/beige met schaduw)
    const skullGrad=ctx.createRadialGradient(x-skullWidth*0.2,y-skullHeight*0.2,0,x,y,skullWidth*0.5);
    skullGrad.addColorStop(0,`hsla(40,20%,${85*lightMul}%,${fadeAlpha})`); // Licht beige
    skullGrad.addColorStop(1,`hsla(40,25%,${65*lightMul}%,${fadeAlpha})`); // Donkerder beige
    ctx.fillStyle=skullGrad;

    // Hoofd (ovaal)
    ctx.beginPath();
    ctx.ellipse(x,y-skullHeight*0.15,skullWidth*0.45,skullHeight*0.4,0,0,Math.PI*2);
    ctx.fill();

    // Kaak (smaller, onderaan)
    ctx.beginPath();
    ctx.ellipse(x,y+skullHeight*0.25,skullWidth*0.35,skullHeight*0.15,0,0,Math.PI*2);
    ctx.fill();

    // Donkere oogkassen (groot en griezelig)
    ctx.fillStyle=`hsla(0,0%,${10*lightMul}%,${fadeAlpha*0.9})`;

    // Linker oogkas
    ctx.beginPath();
    ctx.ellipse(x-skullWidth*0.2,y-skullHeight*0.2,skullWidth*0.12,skullHeight*0.15,0,0,Math.PI*2);
    ctx.fill();

    // Rechter oogkas
    ctx.beginPath();
    ctx.ellipse(x+skullWidth*0.2,y-skullHeight*0.2,skullWidth*0.12,skullHeight*0.15,0,0,Math.PI*2);
    ctx.fill();

    // Neus (driehoek)
    ctx.beginPath();
    ctx.moveTo(x,y-skullHeight*0.05);
    ctx.lineTo(x-skullWidth*0.08,y+skullHeight*0.08);
    ctx.lineTo(x+skullWidth*0.08,y+skullHeight*0.08);
    ctx.fill();

    // Tanden (kleine rechthoekjes)
    const teethCount=4;
    const teethWidth=skullWidth*0.5/teethCount;
    ctx.fillStyle=`hsla(0,0%,${10*lightMul}%,${fadeAlpha*0.6})`;
    for(let i=0;i<teethCount;i++){
      const teethX=x-skullWidth*0.25+(i*teethWidth);
      ctx.fillRect(teethX,y+skullHeight*0.2,teethWidth*0.8,skullHeight*0.12);
    }
  }
  else if(deco.type==='snowman'){
    const x=deco.x;
    const y=deco.y+bobAmount;
    const snowmanWidth=deco.size*0.7;
    const snowmanHeight=deco.size*1.1;

    // Sneeuwpop lichaam (3 sneeuwballen gestapeld)
    const snowGrad=ctx.createRadialGradient(x-snowmanWidth*0.2,y-snowmanHeight*0.2,0,x,y,snowmanWidth*0.5);
    snowGrad.addColorStop(0,`hsla(200,20%,${95*lightMul}%,${fadeAlpha})`); // Wit met blauwe tint
    snowGrad.addColorStop(1,`hsla(200,15%,${85*lightMul}%,${fadeAlpha})`); // Licht grijs

    // Onderste bal (grootste)
    ctx.fillStyle=snowGrad;
    ctx.beginPath();
    ctx.ellipse(x,y,snowmanWidth*0.5,snowmanWidth*0.45,0,0,Math.PI*2);
    ctx.fill();

    // Middelste bal
    const middleY=y-snowmanHeight*0.35;
    ctx.beginPath();
    ctx.ellipse(x,middleY,snowmanWidth*0.4,snowmanWidth*0.36,0,0,Math.PI*2);
    ctx.fill();

    // Bovenste bal (hoofd)
    const headY=y-snowmanHeight*0.65;
    ctx.beginPath();
    ctx.ellipse(x,headY,snowmanWidth*0.3,snowmanWidth*0.27,0,0,Math.PI*2);
    ctx.fill();

    // Wortel neus (oranje driehoek) - iets hoger
    ctx.fillStyle=`hsla(30,90%,${55*lightMul}%,${fadeAlpha})`;
    ctx.beginPath();
    const noseY = headY - snowmanWidth*0.03; // Iets hoger
    ctx.moveTo(x,noseY);
    ctx.lineTo(x+snowmanWidth*0.25,noseY);
    ctx.lineTo(x,noseY+snowmanWidth*0.08);
    ctx.fill();

    // Ogen (zwarte kolen)
    ctx.fillStyle=`hsla(0,0%,${10*lightMul}%,${fadeAlpha})`;
    ctx.beginPath();
    ctx.arc(x-snowmanWidth*0.12,headY-snowmanWidth*0.1,snowmanWidth*0.06,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x+snowmanWidth*0.12,headY-snowmanWidth*0.1,snowmanWidth*0.06,0,Math.PI*2);
    ctx.fill();

    // Glimlach (gebogen naar boven voor blije sneeuwpop, binnen het hoofd)
    for(let i=0;i<5;i++){
      const smileX=x+(i-2)*snowmanWidth*0.08;
      // Blije glimlach: middelste punten lager (min), buitenste punten hoger
      const smileY=headY+snowmanWidth*0.12-Math.abs(i-2)*snowmanWidth*0.025;
      ctx.beginPath();
      ctx.arc(smileX,smileY,snowmanWidth*0.04,0,Math.PI*2);
      ctx.fill();
    }

    // Kolen knoppen op lichaam
    const buttonY1=middleY-snowmanWidth*0.15;
    const buttonY2=middleY;
    const buttonY3=middleY+snowmanWidth*0.15;
    ctx.beginPath();
    ctx.arc(x,buttonY1,snowmanWidth*0.06,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x,buttonY2,snowmanWidth*0.06,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x,buttonY3,snowmanWidth*0.06,0,Math.PI*2);
    ctx.fill();

    // Rode sjaal (tussen hoofd en middelste bal)
    ctx.fillStyle=`hsla(0,80%,${50*lightMul}%,${fadeAlpha})`;
    const scarfY = middleY - snowmanWidth*0.3; // Iets hoger
    const scarfHeight = snowmanWidth*0.12; // Normale breedte
    ctx.fillRect(x-snowmanWidth*0.35,scarfY,snowmanWidth*0.7,scarfHeight);
    // Sjaal einde (hangt naar beneden)
    ctx.fillRect(x+snowmanWidth*0.25,scarfY+scarfHeight,snowmanWidth*0.15,snowmanWidth*0.35);

    // Zwarte hoge hoed (cilindervorm) - beetje hoger zodat ogen vrij zijn
    const hatY = headY - snowmanWidth*0.2; // Iets hoger dan voorheen (was 0.15)
    const hatWidth = snowmanWidth*0.35;
    const hatHeight = snowmanWidth*0.5;
    const brimWidth = snowmanWidth*0.52;
    const brimHeight = snowmanWidth*0.08;

    // Hoed rand (brim) - ligt nu op afstand van het hoofd
    ctx.fillStyle=`hsla(0,0%,${8*lightMul}%,${fadeAlpha})`;
    ctx.beginPath();
    ctx.ellipse(x,hatY,brimWidth,brimHeight,0,0,Math.PI*2);
    ctx.fill();

    // Hoed cilinder
    ctx.fillRect(x-hatWidth,hatY-hatHeight,hatWidth*2,hatHeight);

    // Hoed top (ovaal)
    ctx.beginPath();
    ctx.ellipse(x,hatY-hatHeight,hatWidth,brimHeight,0,0,Math.PI*2);
    ctx.fill();

    // Rode band om de hoed
    ctx.fillStyle=`hsla(0,80%,${50*lightMul}%,${fadeAlpha})`;
    ctx.fillRect(x-hatWidth*1.05,hatY-hatHeight*0.3,hatWidth*2.1,brimHeight*1.5);
  }
  else if(deco.type==='cottage'){
    // Cartoonachtig houten hutje met zichtbare boomstammen
    const x=deco.x;
    const y=deco.y+bobAmount;
    const cottageWidth=deco.size*0.9;
    const cottageHeight=deco.size*0.7;
    const roofHeight=deco.size*0.4;

    // Achtergrond (donkerbruine vulling tussen de stammen)
    ctx.fillStyle=`hsla(30,35%,${25*lightMul}%,${fadeAlpha})`;
    ctx.fillRect(x-cottageWidth/2,y-cottageHeight/2,cottageWidth,cottageHeight);

    // Horizontale boomstammen (dikke rondhout balken)
    const logCount=4;
    const logHeight=cottageHeight/logCount;
    for(let i=0;i<logCount;i++){
      const logY=y-cottageHeight/2+i*logHeight;

      // Basis boomstam kleur (variatie per stam)
      const logHue=25+Math.sin(i*2.3)*5;
      const logLight=38+Math.sin(i*1.7)*5;

      // Boomstam met gradient voor 3D effect
      const logGrad=ctx.createLinearGradient(x-cottageWidth/2,logY,x+cottageWidth/2,logY);
      logGrad.addColorStop(0,`hsla(${logHue},40%,${(logLight-5)*lightMul}%,${fadeAlpha})`);
      logGrad.addColorStop(0.3,`hsla(${logHue},50%,${logLight*lightMul}%,${fadeAlpha})`);
      logGrad.addColorStop(0.7,`hsla(${logHue},50%,${logLight*lightMul}%,${fadeAlpha})`);
      logGrad.addColorStop(1,`hsla(${logHue},40%,${(logLight-5)*lightMul}%,${fadeAlpha})`);

      ctx.fillStyle=logGrad;
      // Ronding boven en onder voor cartoon effect
      ctx.beginPath();
      ctx.moveTo(x-cottageWidth/2,logY+logHeight*0.15);
      ctx.lineTo(x-cottageWidth/2,logY+logHeight*0.85);
      ctx.quadraticCurveTo(x-cottageWidth/2,logY+logHeight,x-cottageWidth/2+5,logY+logHeight);
      ctx.lineTo(x+cottageWidth/2-5,logY+logHeight);
      ctx.quadraticCurveTo(x+cottageWidth/2,logY+logHeight,x+cottageWidth/2,logY+logHeight*0.85);
      ctx.lineTo(x+cottageWidth/2,logY+logHeight*0.15);
      ctx.quadraticCurveTo(x+cottageWidth/2,logY,x+cottageWidth/2-5,logY);
      ctx.lineTo(x-cottageWidth/2+5,logY);
      ctx.quadraticCurveTo(x-cottageWidth/2,logY,x-cottageWidth/2,logY+logHeight*0.15);
      ctx.fill();

      // Donkere lijn tussen stammen
      ctx.strokeStyle=`hsla(30,30%,${15*lightMul}%,${fadeAlpha*0.6})`;
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(x-cottageWidth/2,logY+logHeight);
      ctx.lineTo(x+cottageWidth/2,logY+logHeight);
      ctx.stroke();

      // Jaarringen op de uiteinden (cartoon stijl)
      // Links
      ctx.strokeStyle=`hsla(${logHue},35%,${(logLight-15)*lightMul}%,${fadeAlpha*0.5})`;
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.arc(x-cottageWidth/2+8,logY+logHeight/2,logHeight*0.2,0,Math.PI*2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x-cottageWidth/2+8,logY+logHeight/2,logHeight*0.35,0,Math.PI*2);
      ctx.stroke();
      // Rechts
      ctx.beginPath();
      ctx.arc(x+cottageWidth/2-8,logY+logHeight/2,logHeight*0.2,0,Math.PI*2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x+cottageWidth/2-8,logY+logHeight/2,logHeight*0.35,0,Math.PI*2);
      ctx.stroke();
    }

    // Donkerrood/bruin driehoekig dak
    ctx.fillStyle=`hsla(10,50%,${30*lightMul}%,${fadeAlpha})`;
    ctx.beginPath();
    ctx.moveTo(x-cottageWidth/2-10,y-cottageHeight/2);
    ctx.lineTo(x,y-cottageHeight/2-roofHeight);
    ctx.lineTo(x+cottageWidth/2+10,y-cottageHeight/2);
    ctx.closePath();
    ctx.fill();

    // Sneeuw op het dak (witte laag)
    ctx.fillStyle=`hsla(200,20%,${95*lightMul}%,${fadeAlpha})`;
    ctx.beginPath();
    ctx.moveTo(x-cottageWidth/2-10,y-cottageHeight/2);
    ctx.quadraticCurveTo(x-cottageWidth/4,y-cottageHeight/2-5,x,y-cottageHeight/2-8);
    ctx.quadraticCurveTo(x+cottageWidth/4,y-cottageHeight/2-5,x+cottageWidth/2+10,y-cottageHeight/2);
    ctx.lineTo(x+cottageWidth/2+10,y-cottageHeight/2+8);
    ctx.quadraticCurveTo(x+cottageWidth/4,y-cottageHeight/2+3,x,y-cottageHeight/2);
    ctx.quadraticCurveTo(x-cottageWidth/4,y-cottageHeight/2+3,x-cottageWidth/2-10,y-cottageHeight/2+8);
    ctx.closePath();
    ctx.fill();

    // Raampje (warm geel licht)
    const windowSize=cottageWidth*0.25;
    const windowX=x-cottageWidth*0.25;
    const windowY=y-cottageHeight*0.1;
    // Raamkozijn (donker hout)
    ctx.fillStyle=`hsla(25,35%,${20*lightMul}%,${fadeAlpha})`;
    ctx.fillRect(windowX-windowSize/2-2,windowY-windowSize/2-2,windowSize+4,windowSize+4);
    // Warm licht van binnen
    const windowGrad=ctx.createRadialGradient(windowX,windowY,0,windowX,windowY,windowSize/2);
    windowGrad.addColorStop(0,`hsla(45,100%,${75*lightMul}%,${fadeAlpha})`);
    windowGrad.addColorStop(1,`hsla(40,90%,${60*lightMul}%,${fadeAlpha})`);
    ctx.fillStyle=windowGrad;
    ctx.fillRect(windowX-windowSize/2,windowY-windowSize/2,windowSize,windowSize);
    // Kruis in het raam
    ctx.strokeStyle=`hsla(25,35%,${20*lightMul}%,${fadeAlpha})`;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(windowX,windowY-windowSize/2);
    ctx.lineTo(windowX,windowY+windowSize/2);
    ctx.moveTo(windowX-windowSize/2,windowY);
    ctx.lineTo(windowX+windowSize/2,windowY);
    ctx.stroke();

    // Deurtje (donker hout)
    const doorWidth=cottageWidth*0.2;
    const doorHeight=cottageHeight*0.45;
    const doorX=x+cottageWidth*0.2;
    const doorY=y+cottageHeight/2-doorHeight;
    ctx.fillStyle=`hsla(20,40%,${25*lightMul}%,${fadeAlpha})`;
    ctx.fillRect(doorX-doorWidth/2,doorY,doorWidth,doorHeight);
    // Deurknop (gouden)
    ctx.fillStyle=`hsla(45,70%,${55*lightMul}%,${fadeAlpha})`;
    ctx.beginPath();
    ctx.arc(doorX+doorWidth/3,doorY+doorHeight/2,doorWidth*0.08,0,Math.PI*2);
    ctx.fill();

    // Schoorsteen (uit het dak)
    const chimneyWidth=cottageWidth*0.15;
    const chimneyHeight=roofHeight*0.4;
    const chimneyX=x+cottageWidth*0.25;
    const chimneyY=y-cottageHeight/2-roofHeight*0.6;
    ctx.fillStyle=`hsla(0,15%,${35*lightMul}%,${fadeAlpha})`; // Grijze steen
    ctx.fillRect(chimneyX-chimneyWidth/2,chimneyY,chimneyWidth,chimneyHeight);
    // Sneeuw op schoorsteen
    ctx.fillStyle=`hsla(200,20%,${95*lightMul}%,${fadeAlpha})`;
    ctx.fillRect(chimneyX-chimneyWidth/2,chimneyY,chimneyWidth,chimneyHeight*0.2);

    // Rustige rookwolkjes (subtiel, langzaam bewegend)
    const smokeTime = time * 0.0008; // Heel langzame animatie
    const smoke1Y = chimneyY - 8 + Math.sin(smokeTime) * 3;
    const smoke2Y = chimneyY - 18 + Math.cos(smokeTime * 1.3) * 4;
    const smokeOpacity = (Math.sin(smokeTime * 0.5) * 0.15 + 0.25) * fadeAlpha;

    ctx.fillStyle=`hsla(0,0%,${75*lightMul}%,${smokeOpacity})`;
    ctx.beginPath();
    ctx.arc(chimneyX,smoke1Y,chimneyWidth*0.35,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(chimneyX+chimneyWidth*0.2,smoke2Y,chimneyWidth*0.3,0,Math.PI*2);
    ctx.fill();
  }
  else if(deco.type==='christmaslights'){
    // Gezellige kerstlichtjes snoer - horizontaal over het scherm
    const x=deco.x;
    const y=deco.y+bobAmount;
    const wireLength=deco.size*4; // Langer snoer
    const lightCount=15; // Meer lampjes!
    const spacing=wireLength/lightCount;

    // Donkergroen draad/snoer
    ctx.strokeStyle=`hsla(140,30%,${15*lightMul}%,${fadeAlpha})`;
    ctx.lineWidth=2.5;
    ctx.beginPath();
    ctx.moveTo(x-wireLength/2,y);
    // Maak golvende lijn voor het snoer
    for(let i=0;i<=lightCount;i++){
      const lx=x-wireLength/2+i*spacing;
      const ly=y+Math.sin(i*0.6)*12; // Meer golving voor gezellige hangende look
      ctx.lineTo(lx,ly);
    }
    ctx.stroke();

    // Vrolijke kerstlichtjes (alleen rood, groen, goud)
    const lightColors=['#ff2d55','#00e676','#ffd700'];
    for(let i=0;i<lightCount;i++){
      const lx=x-wireLength/2+i*spacing;
      const ly=y+Math.sin(i*0.6)*12;

      // Subtiele twinkle (niet te wild)
      const twinkle=Math.sin(time*0.003+i)*0.15+0.85; // 0.7-1
      const color=lightColors[i%lightColors.length];

      // Draad naar lampje
      ctx.strokeStyle=`hsla(140,30%,${15*lightMul}%,${fadeAlpha*0.7})`;
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(lx,ly);
      ctx.lineTo(lx,ly+18);
      ctx.stroke();

      // Lampje (peervormig)
      ctx.fillStyle=color;
      ctx.globalAlpha=fadeAlpha*twinkle;
      ctx.beginPath();
      ctx.ellipse(lx,ly+25,5,7,0,0,Math.PI*2); // Peervorm
      ctx.fill();

      // Warm glow effect rond lampje
      const glowGrad=ctx.createRadialGradient(lx,ly+25,0,lx,ly+25,16);
      glowGrad.addColorStop(0,color);
      glowGrad.addColorStop(0.5,`${color}99`); // 60% opacity
      glowGrad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=glowGrad;
      ctx.beginPath();
      ctx.arc(lx,ly+25,16,0,Math.PI*2);
      ctx.fill();

      ctx.globalAlpha=1;
    }
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
  else if(deco.type==='oliebollen'){
    const x=deco.x;
    const y=deco.y+bobAmount;
    const bolSize=deco.size*0.25;

    // Schaaltje/bordje
    const plateWidth=deco.size*0.9;
    const plateHeight=deco.size*0.12;
    const plateGrad=ctx.createLinearGradient(x-plateWidth/2,y+bolSize*0.8,x+plateWidth/2,y+bolSize*0.8+plateHeight);
    plateGrad.addColorStop(0,`hsla(0,0%,${90*lightMul}%,${fadeAlpha})`);
    plateGrad.addColorStop(0.5,`hsla(0,0%,${98*lightMul}%,${fadeAlpha})`);
    plateGrad.addColorStop(1,`hsla(0,0%,${85*lightMul}%,${fadeAlpha})`);
    ctx.fillStyle=plateGrad;
    ctx.beginPath();
    ctx.ellipse(x,y+bolSize*0.9,plateWidth/2,plateHeight,0,0,Math.PI*2);
    ctx.fill();

    // Oliebollen (4 bollen op een stapeltje) - statische posities
    const bollen=[
      {ox:-bolSize*0.7,oy:0},
      {ox:bolSize*0.7,oy:0},
      {ox:0,oy:-bolSize*0.3},
      {ox:0,oy:bolSize*0.5}
    ];

    // Statische poedersuiker posities per bol (seeded by deco.bobPhase)
    const sugarSeeds=[
      [0.2,0.8,1.4,2.1,2.7,3.3,3.9,4.5,5.0,5.6,0.5,1.1,1.7,2.4,3.0],
      [0.4,1.0,1.6,2.3,2.9,3.5,4.1,4.7,5.2,5.8,0.7,1.3,1.9,2.6,3.2],
      [0.6,1.2,1.8,2.5,3.1,3.7,4.3,4.9,5.4,0.1,0.9,1.5,2.0,2.8,3.4],
      [0.3,0.9,1.5,2.2,2.8,3.4,4.0,4.6,5.1,5.7,0.6,1.2,1.8,2.5,3.1]
    ];
    const sugarDists=[0.3,0.5,0.2,0.6,0.4,0.55,0.35,0.45,0.25,0.5,0.4,0.3,0.55,0.2,0.6];
    const sugarSizes=[2,1.5,2.5,1,2,1.5,2,2.5,1,1.5,2,1,2.5,1.5,2];

    for(let bi=0;bi<bollen.length;bi++){
      const bol=bollen[bi];
      const bx=x+bol.ox;
      const by=y+bol.oy;

      // Oliebol basis (goudbruin)
      const bolGrad=ctx.createRadialGradient(bx-bolSize*0.2,by-bolSize*0.2,0,bx,by,bolSize);
      bolGrad.addColorStop(0,`hsla(35,55%,${55*lightMul}%,${fadeAlpha})`);
      bolGrad.addColorStop(0.7,`hsla(30,60%,${40*lightMul}%,${fadeAlpha})`);
      bolGrad.addColorStop(1,`hsla(25,50%,${30*lightMul}%,${fadeAlpha})`);
      ctx.fillStyle=bolGrad;
      ctx.beginPath();
      ctx.arc(bx,by,bolSize,0,Math.PI*2);
      ctx.fill();

      // Krokante textuur (statische donkere stipjes)
      ctx.fillStyle=`hsla(25,40%,${25*lightMul}%,${fadeAlpha*0.5})`;
      for(let i=0;i<6;i++){
        const angle=i*Math.PI/3+deco.bobPhase;
        const dist=bolSize*0.5;
        const dotX=bx+Math.cos(angle)*dist;
        const dotY=by+Math.sin(angle)*dist;
        ctx.beginPath();
        ctx.arc(dotX,dotY,bolSize*0.08,0,Math.PI*2);
        ctx.fill();
      }

      // Poedersuiker (statische witte stipjes - veel meer!)
      ctx.fillStyle=`hsla(0,0%,${100*lightMul}%,${fadeAlpha*0.95})`;
      const seeds=sugarSeeds[bi];
      for(let i=0;i<15;i++){
        const angle=seeds[i];
        const dist=sugarDists[i]*bolSize*0.7;
        const dotX=bx+Math.cos(angle)*dist;
        const dotY=by-bolSize*0.25+Math.sin(angle)*dist*0.4;
        const dotSize=sugarSizes[i];
        ctx.beginPath();
        ctx.arc(dotX,dotY,dotSize,0,Math.PI*2);
        ctx.fill();
      }

      // Extra grote poedersuiker klodders bovenop
      ctx.fillStyle=`hsla(0,0%,${98*lightMul}%,${fadeAlpha*0.85})`;
      ctx.beginPath();
      ctx.arc(bx-bolSize*0.15,by-bolSize*0.4,bolSize*0.15,0,Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx+bolSize*0.2,by-bolSize*0.35,bolSize*0.12,0,Math.PI*2);
      ctx.fill();
    }
  }
  else if(deco.type==='ornament'){
    // Kerstbal decoratie (zoals de bal maar dan op de bodem, schuin gedraaid)
    const x=deco.x;
    const y=deco.y+bobAmount;
    const ballRadius=deco.size*0.35;
    const color=deco.ornamentColor||{light:'#ff6b8a',mid:'#ff2d55',dark:'#c41e3a'};

    // Schuin kantelen - richting gebaseerd op bobPhase
    ctx.save();
    ctx.translate(x,y);
    const tiltDirection=deco.bobPhase>Math.PI?1:-1;
    ctx.rotate(tiltDirection*0.25); // ~15 graden kantelen

    // Metalen kroontje bovenop de bal
    const capHeight=ballRadius*0.25;
    const capWidth=ballRadius*0.4;
    const capGrad=ctx.createLinearGradient(-capWidth/2,-ballRadius,capWidth/2,-ballRadius);
    capGrad.addColorStop(0,`rgba(180,180,180,${fadeAlpha*lightMul})`);
    capGrad.addColorStop(0.5,`rgba(220,220,220,${fadeAlpha*lightMul})`);
    capGrad.addColorStop(1,`rgba(180,180,180,${fadeAlpha*lightMul})`);
    ctx.fillStyle=capGrad;
    ctx.fillRect(-capWidth/2,-ballRadius-capHeight,capWidth,capHeight);

    // Haakje bovenop het kroontje
    ctx.strokeStyle=`rgba(200,200,200,${fadeAlpha*lightMul})`;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(0,-ballRadius-capHeight-4,5,Math.PI*0.2,Math.PI*0.8);
    ctx.stroke();

    // Glanzende kerstbal
    const ornamentGrad=ctx.createRadialGradient(-ballRadius*0.3,-ballRadius*0.3,0,0,0,ballRadius);
    ornamentGrad.addColorStop(0,color.light);
    ornamentGrad.addColorStop(0.6,color.mid);
    ornamentGrad.addColorStop(1,color.dark);
    ctx.globalAlpha=fadeAlpha;
    ctx.fillStyle=ornamentGrad;
    ctx.beginPath();
    ctx.arc(0,0,ballRadius,0,Math.PI*2);
    ctx.fill();

    // Extra glanzend wit highlight spotje
    ctx.fillStyle=`rgba(255,255,255,${0.85*lightMul})`;
    ctx.beginPath();
    ctx.arc(-ballRadius*0.35,-ballRadius*0.35,ballRadius*0.35,0,Math.PI*2);
    ctx.fill();

    // Klein tweede highlight voor extra glans
    ctx.fillStyle=`rgba(255,255,255,${0.4*lightMul})`;
    ctx.beginPath();
    ctx.arc(ballRadius*0.25,ballRadius*0.25,ballRadius*0.15,0,Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=1;
    ctx.restore();
  }
  else if(deco.type==='champagne'){
    const x=deco.x;
    const y=deco.y+bobAmount;
    const bottleHeight=deco.size*1.1;
    const bottleWidth=deco.size*0.28;
    const neckWidth=bottleWidth*0.35;

    // Schuin kantelen - roteer canvas (richting gebaseerd op bobPhase)
    ctx.save();
    ctx.translate(x,y);
    const tiltDirection=deco.bobPhase>Math.PI?1:-1; // Links of rechts kantelen
    ctx.rotate(tiltDirection*0.35); // ~20 graden kantelen

    // Fles body (donkergroen glas)
    const bodyGrad=ctx.createLinearGradient(-bottleWidth/2,0,bottleWidth/2,0);
    bodyGrad.addColorStop(0,`hsla(140,45%,${15*lightMul}%,${fadeAlpha})`);
    bodyGrad.addColorStop(0.3,`hsla(140,40%,${25*lightMul}%,${fadeAlpha})`);
    bodyGrad.addColorStop(0.7,`hsla(140,40%,${22*lightMul}%,${fadeAlpha})`);
    bodyGrad.addColorStop(1,`hsla(140,45%,${12*lightMul}%,${fadeAlpha})`);
    ctx.fillStyle=bodyGrad;

    // Fles body shape (relatief aan 0,0)
    ctx.beginPath();
    ctx.moveTo(-bottleWidth/2,bottleHeight*0.35); // Links onder
    ctx.lineTo(-bottleWidth/2,-bottleHeight*0.1); // Links boven body
    ctx.quadraticCurveTo(-bottleWidth/2,-bottleHeight*0.2,-neckWidth/2,-bottleHeight*0.28); // Shoulder
    ctx.lineTo(-neckWidth/2,-bottleHeight*0.52); // Nek links
    ctx.lineTo(neckWidth/2,-bottleHeight*0.52); // Nek rechts
    ctx.lineTo(neckWidth/2,-bottleHeight*0.28); // Nek onder rechts
    ctx.quadraticCurveTo(bottleWidth/2,-bottleHeight*0.2,bottleWidth/2,-bottleHeight*0.1); // Shoulder
    ctx.lineTo(bottleWidth/2,bottleHeight*0.35); // Rechts onder
    ctx.closePath();
    ctx.fill();

    // Gouden folie rond de nek
    ctx.fillStyle=`hsla(45,80%,${55*lightMul}%,${fadeAlpha})`;
    ctx.beginPath();
    ctx.rect(-neckWidth/2-3,-bottleHeight*0.52,neckWidth+6,bottleHeight*0.12);
    ctx.fill();

    // Open fles - donkere opening bovenaan (geen kurk)
    ctx.fillStyle=`hsla(140,30%,${8*lightMul}%,${fadeAlpha})`;
    ctx.beginPath();
    ctx.ellipse(0,-bottleHeight*0.52,neckWidth/2,neckWidth*0.2,0,0,Math.PI*2);
    ctx.fill();

    // Gouden rand rond opening
    ctx.strokeStyle=`hsla(45,70%,${50*lightMul}%,${fadeAlpha})`;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.ellipse(0,-bottleHeight*0.52,neckWidth/2+1,neckWidth*0.25,0,0,Math.PI*2);
    ctx.stroke();

    // Label (crème kleur)
    ctx.fillStyle=`hsla(40,30%,${85*lightMul}%,${fadeAlpha})`;
    ctx.beginPath();
    ctx.rect(-bottleWidth*0.38,-bottleHeight*0.08,bottleWidth*0.76,bottleHeight*0.28);
    ctx.fill();

    // Label tekst/decoratie (gouden lijnen)
    ctx.fillStyle=`hsla(45,60%,${50*lightMul}%,${fadeAlpha})`;
    ctx.beginPath();
    ctx.rect(-bottleWidth*0.28,bottleHeight*0.0,bottleWidth*0.56,bottleHeight*0.025);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-bottleWidth*0.28,bottleHeight*0.05,bottleWidth*0.56,bottleHeight*0.025);
    ctx.fill();

    // Glans op fles
    ctx.fillStyle=`hsla(0,0%,100%,${fadeAlpha*0.18})`;
    ctx.beginPath();
    ctx.ellipse(-bottleWidth*0.22,0,bottleWidth*0.06,bottleHeight*0.22,0,0,Math.PI*2);
    ctx.fill();

    ctx.restore();
  }
  else if(deco.type==='parasol'){
    const x=deco.x;
    const y=deco.y+bobAmount;

    // Stok (houten paal)
    const poleHeight=deco.size*1.2;
    const poleWidth=deco.size*0.06;
    ctx.fillStyle=`hsla(30,40%,${35*lightMul}%,1)`;
    ctx.fillRect(x-poleWidth/2,y-poleHeight,poleWidth,poleHeight);

    // Parasol scherm (driehoekige kegel met strepen)
    const umbrellaWidth=deco.size*1.2;
    const umbrellaHeight=deco.size*0.4;
    const topY=y-poleHeight-umbrellaHeight;
    const bottomY=y-poleHeight+umbrellaHeight*0.1;

    // Afwisselend rode en witte strepen (8 segmenten)
    const numStripes=8;
    for(let i=0;i<numStripes;i++){
      const leftX=x-umbrellaWidth/2+(i*umbrellaWidth/numStripes);
      const rightX=x-umbrellaWidth/2+((i+1)*umbrellaWidth/numStripes);
      ctx.fillStyle=i%2===0?`rgba(220,20,60,${lightMul})`:`rgba(255,255,255,${lightMul})`;
      ctx.beginPath();
      ctx.moveTo(x,topY);
      ctx.lineTo(leftX,bottomY);
      ctx.lineTo(rightX,bottomY);
      ctx.closePath();
      ctx.fill();
    }

    // Lichte schaduwlijn onderaan voor diepte
    ctx.strokeStyle=`rgba(150,20,40,${0.5*lightMul})`;
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(x-umbrellaWidth/2,bottomY);
    ctx.lineTo(x+umbrellaWidth/2,bottomY);
    ctx.stroke();

    // Topje van de parasol
    ctx.fillStyle=`rgba(220,20,60,${lightMul})`;
    ctx.beginPath();
    ctx.arc(x,topY,deco.size*0.06,0,Math.PI*2);
    ctx.fill();
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
  const s=fishSize(f,now);
  // Als vis gevangen is, verticale oriëntatie (hoofd naar boven)
  const a=f.caughtVertical?-Math.PI/2:Math.atan2(f.vy,f.vx);

  // Subtiele schaduw onder de vis voor diepte-effect (skip on low performance, niet bij gevangen vis of in banner)
  if(lightsOn&&performanceProfile.quality!=='verylow'&&!f.caughtVertical&&!f.hideShadow){
    ctx.globalAlpha=0.15;
    ctx.fillStyle='#000';
    ctx.beginPath();
    ctx.ellipse(f.x+2,f.y+s*1.3,s*0.7,s*0.3,a,0,Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=1;
  }

  ctx.save();ctx.translate(f.x,f.y);ctx.rotate(a);
  const hp=healthPct(f,now); // Unified health (includes hunger, disease, temp effects)
  const dimBase=1-(1-hp/100)*0.4;const lightMul=lightsOn?1:0.6;let dim=dimBase*lightMul;

  // Sick fish appear duller and more transparent based on their health
  if(f.sick && !f.medicated) {
    if(hp <= 30) {
      ctx.globalAlpha = 0.6; // Critical: very dull
      dim *= 0.6;
    } else if(hp <= 60) {
      ctx.globalAlpha = 0.75; // Sick: moderately dull
      dim *= 0.75;
    } else {
      ctx.globalAlpha = 0.85; // Early stage: slightly dull
      dim *= 0.9;
    }
  }

  // Ensure f.hue is a valid number, fallback to 0 if NaN
  let fishHue = isNaN(f.hue) ? 0 : f.hue;

  if(discoOn&&performanceProfile.quality!=='verylow'){
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

  // Af en toe een glinsterend sterretje op de vis (alleen als gezond en licht aan) - skip on low performance
  if(lightsOn && performanceProfile.quality!=='low' && performanceProfile.quality!=='verylow' && healthPct(f,now)>50 && Math.sin(t*0.1+f.x*0.05)>0.85){
    ctx.fillStyle='rgba(255,255,255,0.9)';
    const sparkX=s*0.2;
    const sparkY=-s*0.15;
    ctx.beginPath();
    ctx.arc(sparkX,sparkY,s*0.06,0,Math.PI*2);
    ctx.fill();
    // Extra klein glinstertje (only on high quality)
    if(performanceProfile.quality==='high'){
      ctx.beginPath();
      ctx.arc(sparkX+s*0.12,sparkY+s*0.08,s*0.03,0,Math.PI*2);
      ctx.fill();
    }
  }

  // Kerstmutsje voor de visjes - tijdelijk uitgeschakeld
  // if(isChristmas()){
  //   const hatX = s*0.5; // Bovenop het hoofd
  //   const hatY = -s*0.4;
  //   const hatWidth = s*0.4;
  //   const hatHeight = s*0.5;

  //   // Rode muts (driehoek)
  //   ctx.fillStyle = `hsla(0,85%,${50*lightMul}%,1)`;
  //   ctx.beginPath();
  //   ctx.moveTo(hatX - hatWidth*0.5, hatY); // Links onder
  //   ctx.lineTo(hatX + hatWidth*0.5, hatY); // Rechts onder
  //   ctx.lineTo(hatX + hatWidth*0.2, hatY - hatHeight); // Punt (iets naar rechts)
  //   ctx.closePath();
  //   ctx.fill();

  //   // Witte rand onderaan
  //   ctx.fillStyle = `hsla(0,0%,${95*lightMul}%,1)`;
  //   ctx.fillRect(hatX - hatWidth*0.5, hatY - s*0.08, hatWidth, s*0.08);

  //   // Wit bolletje op de punt
  //   ctx.beginPath();
  //   ctx.arc(hatX + hatWidth*0.2, hatY - hatHeight, s*0.12, 0, Math.PI*2);
  //   ctx.fill();
  // }

  ctx.restore();

  // Verberg label als hideLabel flag gezet is (voor banner display)
  if(f.hideLabel)return;

  // hp already calculated above - reuse it for label and health bar
  // Sick emoji is always shown, behavior emoji only if enabled
  const sickEmoji=getSickEmoji(f);
  const behaviorEmoji=appConfig.showBehaviorEmoji ? getBehaviorEmoji(f.behaviorState || 'normal', f) : '';
  const emojiPrefix = (sickEmoji ? sickEmoji + ' ' : '') + (behaviorEmoji ? behaviorEmoji + ' ' : '');
  const label1=emojiPrefix + f.name;
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

// Sick emoji mapping - shown separately from behavior
function getSickEmoji(fish) {
  if (!fish || !fish.sick) return '';

  const health = fish.health !== undefined ? fish.health : 100;
  if (health <= 30) return '💀'; // Critical
  if (health <= 60) return '🤢'; // Sick
  return '🦠'; // Early stage
}

// Behavior emoji mapping
function getBehaviorEmoji(behaviorState, fish) {
  // Food chasing takes highest priority
  if(fish && fish.chasingFood) {
    return '🍽️';
  }

  // Pump interest takes priority (if active)
  if(fish && fish.pumpInterest && pumpOn) {
    return '🫧';
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
    case 'playing': return '🎾';
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
  const schoolRadiusSq = schoolRadius * schoolRadius; // Use squared distance
  const separationRadius = 25;
  const separationRadiusSq = separationRadius * separationRadius;
  let nearby = [];

  // Find nearby fish using squared distance
  for(const other of fishes) {
    if(other === f) continue;
    const dx = other.x - f.x;
    const dy = other.y - f.y;
    const distSq = dx*dx + dy*dy;
    if(distSq < schoolRadiusSq) {
      nearby.push({fish: other, distanceSq: distSq, dx: dx, dy: dy});
    }
  }

  if(nearby.length > 0) {
    // Separation: avoid getting too close
    let sepX = 0, sepY = 0;
    let tooClose = 0;
    for(const n of nearby) {
      if(n.distanceSq < separationRadiusSq) {
        const dist = Math.sqrt(n.distanceSq); // Only calculate sqrt when needed
        sepX += (f.x - n.fish.x) / dist;
        sepY += (f.y - n.fish.y) / dist;
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
  // Find something to investigate: decorations, plants, other fish
  if(!f.curiousTarget || Math.random() < 0.02) {
    const options = [];

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

function handlePlaying(f) {
  // Vis speelt met de bal - zoekt dichtsbijzijnde bal
  let closestBall = null;
  let closestDist = Infinity;

  for(const ball of playBalls) {
    const dx = ball.x - f.x;
    const dy = ball.y - f.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if(dist < closestDist) {
      closestDist = dist;
      closestBall = ball;
    }
  }

  if(closestBall) {
    const dx = closestBall.x - f.x;
    const dy = closestBall.y - f.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const fishSizeNow = fishSize(f, Date.now());

    // Iets ruimere collision - vis raakt bal net voordat ze overlapten
    const collisionRadius = closestBall.radius + fishSizeNow * 0.8; // Beetje meer ruimte

    if(dist < collisionRadius) {
      // VIS RAAKT DE BAL!
      const pushStrength = rand(0.5, 0.9); // Variabele kracht
      const pushAngle = Math.atan2(dy, dx);

      // Voeg random afwijking toe aan de hoek (tot 30 graden in elke richting)
      const angleDeviation = rand(-Math.PI/6, Math.PI/6); // -30° tot +30°
      const actualPushAngle = pushAngle + angleDeviation;

      // Duw bal weg van vis met momentum van de vis
      closestBall.vx += Math.cos(actualPushAngle) * f.speed * pushStrength;
      closestBall.vy += Math.sin(actualPushAngle) * f.speed * pushStrength;

      // Bepaal of vis bal naar BENEDEN of BOVEN wil duwen (1 op 5 kans voor boven)
      if(!f.ballPushDirection || Math.random() < 0.05) {
        // Wissel af en toe van richting (5% kans per frame tijdens contact)
        f.ballPushDirection = Math.random() < 0.2 ? 'up' : 'down'; // 20% wil omhoog, 80% omlaag
      }

      if(f.ballPushDirection === 'up') {
        // Rebel vis! Probeert bal naar BOVEN te krijgen
        const upwardForce = rand(0.3, 0.6);
        closestBall.vy -= upwardForce; // Negatief = omhoog
      } else {
        // Normale vis: probeert bal naar beneden te krijgen
        const downwardForce = rand(0.4, 0.7);
        closestBall.vy += downwardForce;
      }

      // Vis zwemt energiek rond de bal (cirkel beweging met variatie)
      const circleAngle = pushAngle + rand(Math.PI/3, Math.PI*2/3); // Random tussen 60° en 120°
      f.vx += Math.cos(circleAngle) * rand(0.3, 0.7);
      f.vy += Math.sin(circleAngle) * rand(0.3, 0.7);

      // Voorkom dat vis te diep in bal komt
      const minDist = closestBall.radius + fishSizeNow * 0.6;
      if(dist < minDist) {
        const pushOut = minDist - dist;
        f.x -= Math.cos(pushAngle) * pushOut;
        f.y -= Math.sin(pushAngle) * pushOut;
      }
    } else {
      // Initialiseer ballPushDirection als die nog niet bestaat
      if(!f.ballPushDirection) {
        f.ballPushDirection = Math.random() < 0.2 ? 'up' : 'down';
      }

      // Bereken doelpositie op basis van voorkeur
      let targetX, targetY;

      if(f.ballPushDirection === 'up') {
        // Rebel vis positioneert zich ONDER de bal om naar boven te duwen
        targetX = closestBall.x + rand(-40, 40); // Wat variatie in x
        targetY = closestBall.y + closestBall.radius + rand(30, 70); // Onder de bal
      } else {
        // Normale vis - kies random aanpak: van boven (50%) of van de zijkant (50%)
        // Gebruik ballApproachSide als positief = van zijkant, negatief = van boven
        const approachFromSide = Math.abs(f.ballApproachSide) === 1 && Math.random() < 0.5;

        if(approachFromSide || closestBall.y > H - 150) {
          // Van de zijkant met vaste voorkeur per vis
          targetX = closestBall.x + f.ballApproachSide * rand(80, 120);
          targetY = closestBall.y + rand(-30, 30);
        } else {
          // Van boven
          const xOffset = rand(-60, 60);
          const yOffset = rand(-70, -30);
          targetX = closestBall.x + xOffset;
          targetY = closestBall.y + yOffset;
        }
      }

      // Zwem ENERGIEK naar de doelpositie - veel hogere steer strength + speed boost
      const steerStrength = rand(0.18, 0.25); // Veel sterker sturen (was 0.12)
      steerTowards(f, targetX, targetY, steerStrength);

      // Extra speed boost richting bal - vissen worden enthousiast!
      const distToBall = Math.sqrt((targetX - f.x) ** 2 + (targetY - f.y) ** 2);
      if(distToBall > 50) {
        // Ver weg? Zwem nog sneller!
        const boostAngle = Math.atan2(targetY - f.y, targetX - f.x);
        const boostAmount = rand(0.08, 0.15);
        f.vx += Math.cos(boostAngle) * boostAmount;
        f.vy += Math.sin(boostAngle) * boostAmount;
      }
    }
  } else {
    // Geen bal meer - terug naar normaal gedrag
    f.behaviorState = 'normal';
    f.behaviorTimer = 0;
    f.ballPushDirection = undefined; // Reset voorkeur
  }
}

function updateFish(f,dt,now){
  let target=null;let best=1e9;for(const p of foods){const d=(p.x-f.x)**2+(p.y-f.y)**2;if(d<best){best=d;target=p}}
  const hp=healthPct(f,now);

  // Track if fish is chasing food (for emoji display)
  f.chasingFood = target !== null;

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
  // High priority: fishing bait attraction (when rod is waiting)
  else if(fishingRod.state==='waiting'&&fishingRod.deployed){
    // Vis wordt aangetrokken tot aas (net als voer)
    const baitX=fishingRod.x;
    const baitY=fishingRod.targetY;
    const distToBait=Math.hypot(f.x-baitX,f.y-baitY);

    // Binnen 120px wordt vis aangetrokken (moeilijker - was 200px)
    if(distToBait<120){
      steerTowards(f,baitX,baitY,0.06); // Iets sterker dan voer
      // Reset to normal behavior
      if(f.behaviorState !== 'normal') {
        f.behaviorState = 'normal';
        f.behaviorTimer = 0;
        f.wallFollowTarget = null;
      }
    }
  }
  // Medium-High priority: play with ball (if available and fish is playing or interested)
  else if(playBalls.length > 0 && (f.behaviorState === 'playing' || Math.random() < 0.7)) {
    if(f.behaviorState === 'playing') {
      // Already playing - call handlePlaying to steer towards ball
      handlePlaying(f);
    } else {
      // New fish considering playing - check distance
      let closestBall = null;
      let closestDist = Infinity;
      for(const ball of playBalls) {
        const dx = ball.x - f.x;
        const dy = ball.y - f.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if(dist < closestDist) {
          closestDist = dist;
          closestBall = ball;
        }
      }

      // Start playing if ball is close enough
      if(closestBall && closestDist < 400) {
        f.behaviorState = 'playing';
        f.behaviorTimer = Math.floor(rand(1800, 3600)); // Speel 30-60 seconden
      }
    }
  }
  // Medium priority: pump attraction (interest-based)
  else if((pumpOn || now<pumpJustOnUntil) && f.pumpInterest){
    // Check if interest has expired
    if(now > f.pumpInterestUntil) {
      f.pumpInterest = false;
    } else {
      // Still interested - steer towards pump
      if(pumpOn){steerTowards(f,pumpPos.x,H-30,0.006)}
      if(now<pumpJustOnUntil){steerTowards(f,pumpPos.x,H-30,0.045)}
    }
  }
  // Low priority: special behaviors or normal wandering
  else {
    // Chance to regain pump interest (~35% per minute per fish)
    // Only if fish is near the pump (within 200px)
    if(pumpOn && !f.pumpInterest) {
      const distToPump = Math.hypot(f.x - pumpPos.x, f.y - (H - 30));
      if(distToPump < 200 && Math.random() < 0.0001) {
        f.pumpInterest = true;
        f.pumpInterestUntil = now + rand(20000, 40000); // 20-40 seconds interest
      }
    }

    // Check if behavior timer expired, switch to new behavior
    if(f.behaviorTimer <= 0) {
      const randVal = Math.random();

      // Adjust probabilities based on disco state
      let curiousThreshold = 0.65; // Base: 9% curious (56-65%)
      let dancingThreshold = 0.71; // Base: 6% dancing (65-71%)
      let restingThreshold = 0.19; // Base: 6% resting (13-19%)

      // When disco is on, increase dancing behavior chance
      if(discoOn) {
        dancingThreshold = curiousThreshold + 0.15; // Increase dancing range to ~15%
      } else {
        dancingThreshold = curiousThreshold + 0.06; // Normal 6% dancing
      }

      // Cold temperature: more resting/sleeping behavior
      if(currentTemperature < 22) {
        restingThreshold = 0.28; // Increase resting to 15% (13-28%) when cold
      }

      if(randVal < 0.03) { // 3% bottom dwelling (0-3%)
        f.behaviorState = 'bottom_dwelling';
        f.behaviorTimer = Math.floor(rand(300, 900)); // 5-15 seconds at 60fps
        f.wallFollowTarget = null;
      } else if(randVal < 0.13) { // 10% wall following (3-13%)
        f.behaviorState = 'wall_following';
        f.behaviorTimer = Math.floor(rand(480, 1200)); // 8-20 seconds
        f.wallFollowTarget = null;
      } else if(randVal < restingThreshold) { // Dynamic resting threshold (temperature-dependent)
        f.behaviorState = 'resting';
        f.behaviorTimer = Math.floor(rand(180, 600)); // 3-10 seconds
        f.wallFollowTarget = null;
      } else if(randVal < restingThreshold + 0.01) { // 1% surface swimming
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
      case 'playing':
        handlePlaying(f);
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

  // Sick fish are slower (based on unified health)
  if(f.sick && !f.medicated) {
    if(hp <= 30) {
      slow *= 0.4; // Critical: very slow
    } else if(hp <= 60) {
      slow *= 0.6; // Sick: moderately slow
    } else {
      slow *= 0.8; // Early stage: slightly slow
    }
  }

  // Water greenness affects fish speed (dirty water = slower fish)
  const waterMultiplier = 1 - (waterGreenness * 0.003); // At 100% greenness = 0.7x speed
  slow *= waterMultiplier;

  // Temperature affects fish speed (cold = very slow, warm = hyperactive)
  let tempSpeedMultiplier = 1.0;
  if(currentTemperature < 18) tempSpeedMultiplier = 0.4;
  else if(currentTemperature < 20) tempSpeedMultiplier = 0.6;
  else if(currentTemperature < 22) tempSpeedMultiplier = 0.8;
  else if(currentTemperature <= 26) tempSpeedMultiplier = 1.0; // Ideal temp
  else if(currentTemperature <= 28) tempSpeedMultiplier = 1.3;
  else if(currentTemperature <= 30) tempSpeedMultiplier = 1.6;
  else tempSpeedMultiplier = 2.0; // Panic speed when too hot

  slow *= tempSpeedMultiplier;

  // Validate slow multiplier to prevent NaN propagation
  if(isNaN(slow) || !isFinite(slow) || slow <= 0) slow = 0.95;

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
  for(let i=foods.length-1;i>=0;i--){const p=foods[i];if(Math.hypot(p.x-f.x,p.y-f.y)<fishSize(f,now)*0.7+p.r){foods.splice(i,1);f.blink=8;f.lastEat=Date.now();f.eats++;f.health=Math.min(100,f.health+15);sendToServer({command:'updateFishStats',fishName:f.name,stats:{eats:f.eats,lastEat:f.lastEat,health:f.health}})}}

  // Pooping logic - fish poop 15-60 minutes after eating (50% chance to reduce frequency)
  const timeSinceEat = now - f.lastEat;
  const timeSincePoop = now - f.lastPoop;
  const minPoopInterval = 15 * 60 * 1000; // 15 minutes
  const maxPoopInterval = 60 * 60 * 1000; // 60 minutes

  // Check if fish should poop (reduced frequency for better balance with many fish)
  if(timeSinceEat > minPoopInterval && timeSincePoop > minPoopInterval && Math.random() < 0.00001) {
    // 50% chance to actually poop (reduces poop accumulation rate)
    if(Math.random() < 0.5) {
      // Create poop at fish location
      poops.push({
        x: f.x + rand(-5, 5),
        y: f.y + rand(5, 15), // Slightly below fish
        createdAt: now,
        size: rand(3, 6)
      });
      f.lastPoop = now;

      // Report poop count to server for controller updates
      sendToServer({ command: 'reportPoop', poopCount: poops.length });
    }
  }
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
  const newestItems=newest.map((f,i)=>({idx:i+1,label:`${f.name} · ${ageLabelMS(now-f.bornAt)}`}));
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
      case 'play_ball_added':
        emoji='🎾';
        label=`Speelbal gegooid · ${timeStr}`;
        break;
      case 'fishing_rod_cast':
        emoji='🎣';
        label=`Hengel uitgegooid · ${timeStr}`;
        break;
      case 'fish_caught':
        emoji='🏆';
        const caughtFishName=event.data.name||'Vis';
        label=`${caughtFishName} gevangen · ${timeStr}`;
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
      case 'heating_toggle':
        emoji='🔥';
        const heatingState=event.data.state||'aan';
        label=`Verwarming ${heatingState} · ${timeStr}`;
        break;
      case 'controller_access':
        emoji='🎮';
        label=`Controller verbonden · ${timeStr}`;
        // Speel pling geluid af bij nieuwe controller connectie
        const eventId=event.timestamp+'_'+event.type;
        if(!playedAudioEvents.has(eventId)){
          playedAudioEvents.add(eventId);
          // Hergebruik audio object of maak nieuwe aan
          if(!plingAudio){
            plingAudio=new Audio('pling.mp3');
          }
          plingAudio.currentTime=0; // Reset naar begin voor hergebruik
          plingAudio.play().catch(err=>console.log('Audio afspelen mislukt:',err));
        }
        break;
      case 'access_code_generated':
        emoji='🔑';
        label=`Nieuwe QR-code · ${timeStr}`;
        break;
      case 'water_greenness_milestone':
        emoji='✨';
        const percentage=event.data.percentage||0;
        label=`Water ${percentage}% schoon · ${timeStr}`;
        break;
      case 'fish_critical_health':
        emoji='⚠️';
        const criticalFishName=event.data.name||'Vis';
        label=`${criticalFishName} kritieke gezondheid · ${timeStr}`;
        break;
      case 'fish_died_disease':
        emoji='☠️';
        const diedFishName=event.data.name||'Vis';
        const cause=event.data.cause==='temperature'?'temperatuur':'ziekte';
        label=`${diedFishName} overleden (${cause}) · ${timeStr}`;
        break;
      case 'fish_recovered':
        emoji='💚';
        const recoveredFishName=event.data.name||'Vis';
        label=`${recoveredFishName} hersteld · ${timeStr}`;
        break;
      case 'fish_infected_environment':
        emoji='🦠';
        const infectedFishName=event.data.name||'Vis';
        label=`${infectedFishName} geïnfecteerd (vuil water) · ${timeStr}`;
        break;
      case 'fish_infected_contact':
        emoji='🦠';
        const contactFishName=event.data.name||'Vis';
        label=`${contactFishName} geïnfecteerd (contact) · ${timeStr}`;
        break;
      case 'fish_infected_arrival':
        emoji='🦠';
        const arrivalFishName=event.data.name||'Vis';
        label=`${arrivalFishName} is ziek · ${timeStr}`;
        break;
      case 'race_started':
        emoji='🏁';
        const raceFish1=event.data.fish1||'Vis';
        const raceFish2=event.data.fish2||'Vis';
        label=`Race: ${raceFish1} vs ${raceFish2} · ${timeStr}`;
        break;
      case 'race_finished':
        emoji='🏆';
        const raceWinner=event.data.winner||'Vis';
        const raceLoser=event.data.loser||'Vis';
        label=`${raceWinner} wint van ${raceLoser}! · ${timeStr}`;
        break;
      case 'invalid_access_code':
        // Niet tonen in activity feed
        return;
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
  const qrLink = document.getElementById('qrLink');
  const controllerUrl = `${window.location.protocol}//${window.location.host}/controller?code=${accessCode}`;

  // Update link href
  if (qrLink) {
    qrLink.href = controllerUrl;
  }

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
let appConfig = { showBehaviorEmoji: true }; // Store config from server
let gameLoopStarted = false; // Track if game loop has been started
let wsReconnectAttempts = 0; // Track reconnection attempts
let wsConnectedOnce = false; // Track if we've successfully connected before
let wsReconnectTimer = null; // Track reconnection timer for cleanup
let wsConnected = false; // Track current connection status for UI
let wsNextRetryAt = 0; // Timestamp when next retry will happen (0 = connecting now)
let alreadyActiveError = false; // Track if vissenkom is already active elsewhere

// Safe WebSocket send with error handling
function sendToServer(data) {
    try {
        if (!ws) {
            console.warn('WebSocket not initialized, skipping message:', data);
            return false;
        }
        if (ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not open, skipping message:', data);
            return false;
        }
        ws.send(JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Failed to send WebSocket message:', error, data);
        return false;
    }
}

function initWebSocket() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const port = window.location.port ? `:${window.location.port}` : '';
        ws = new WebSocket(`${protocol}//${window.location.hostname}${port}`);

        ws.onopen = function() {
            console.log('WebSocket verbonden met server');
            wsConnected = true;
            document.body.classList.remove('error-state');

            // If this is a reconnection after being connected before, refresh the page
            // This ensures we get fresh data and QR codes after server restart
            if (wsConnectedOnce && wsReconnectAttempts > 0) {
                console.log('🔄 Server herstart gedetecteerd - pagina wordt ververst...');
                location.reload();
                return;
            }

            wsConnectedOnce = true;
            wsReconnectAttempts = 0; // Reset counter on successful connection

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

            // Don't sync ball state here - let server be authoritative
            // The gameState response will contain hasBall status which we'll respect

            // Start periodic sync verification (every 30 seconds)
            startPeriodicSyncCheck();
            console.log('🔍 Periodic sync check started (every 30s)');
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
            wsConnected = false;
            wsReconnectAttempts++;
            if(wsConnectedOnce) document.body.classList.add('error-state');

            // Clear any existing reconnect timer
            if (wsReconnectTimer) {
                clearTimeout(wsReconnectTimer);
                wsReconnectTimer = null;
            }

            // Exponential backoff: 3s, 6s, 12s, 24s, max 30s
            const delay = Math.min(3000 * Math.pow(2, wsReconnectAttempts - 1), 30000);
            console.log(`WebSocket verbinding gesloten, probeer opnieuw in ${delay/1000}s... (poging ${wsReconnectAttempts})`);

            wsNextRetryAt = Date.now() + delay;
            wsReconnectTimer = setTimeout(() => {
                wsReconnectTimer = null;
                wsNextRetryAt = 0;
                initWebSocket();
            }, delay);
        };

        ws.onerror = function(error) {
            console.error('WebSocket fout:', error);
            // Error will trigger onclose, which handles reconnection
        };
    } catch (error) {
        console.error('Kan geen WebSocket verbinding maken:', error);
        wsConnected = false;
        wsReconnectAttempts++;

        // Clear any existing reconnect timer
        if (wsReconnectTimer) {
            clearTimeout(wsReconnectTimer);
            wsReconnectTimer = null;
        }

        // Exponential backoff: 3s, 6s, 12s, 24s, max 30s
        const delay = Math.min(3000 * Math.pow(2, wsReconnectAttempts - 1), 30000);
        wsNextRetryAt = Date.now() + delay;
        wsReconnectTimer = setTimeout(() => {
            wsReconnectTimer = null;
            wsNextRetryAt = 0;
            initWebSocket();
        }, delay);
    }
}

function handleRemoteCommand(data) {
    // Check message sequence to detect out-of-order messages
    if (data.seq !== undefined) {
        if (data.seq <= lastSeenSeq && data.type !== 'gameState') {
            // Ignore old message (except gameState which is always fresh)
            console.warn(`[SYNC] ⚠️ Ignored out-of-order message | Type: ${data.type}, Seq: ${data.seq} (last: ${lastSeenSeq})`);
            return;
        }
        lastSeenSeq = data.seq;
    }

    switch (data.type) {
        case 'gameState':
            loadGameState(data.data);
            // Start game loop after successfully loading game state
            if (!gameLoopStarted) {
                console.log('🎮 Starting game loop after receiving game state');
                gameLoopStarted = true;
                hideLoadingIndicator();
                loop();
            }
            break;
        case 'status':
            // Update water greenness target from server (smooth transition)
            if(data.data && data.data.waterGreenness !== undefined) {
                waterGreennessTarget = data.data.waterGreenness;
                console.log('💧 Water greenness target updated from server:', waterGreennessTarget.toFixed(2) + '%');
            }
            // Update temperature from server
            if(data.data && data.data.temperature !== undefined) {
                currentTemperature = data.data.temperature;
            }
            // Update heating status from server
            if(data.data && data.data.heatingOn !== undefined) {
                heatingOn = data.data.heatingOn;
            }
            // Update lights status from server
            if(data.data && data.data.lightsOn !== undefined) {
                lightsOn = data.data.lightsOn;
            }
            // Update disco status from server
            if(data.data && data.data.discoOn !== undefined) {
                discoOn = data.data.discoOn;
            }
            // Update pump status from server
            if(data.data && data.data.pumpOn !== undefined) {
                pumpOn = data.data.pumpOn;
            }
            // Update theme from server
            if(data.data && data.data.theme !== undefined) {
                const newTheme = data.data.theme;
                if(newTheme !== currentTheme) {
                    console.log(`🎨 Theme changed from "${currentTheme}" to "${newTheme}"`);
                    currentTheme = newTheme;
                }
            }
            // Update fish health data for real-time health bar updates
            if(data.data && data.data.fishHealth && Array.isArray(data.data.fishHealth)) {
                let syncChanges = 0;
                data.data.fishHealth.forEach(healthData => {
                    const fish = fishes.find(f => f.name === healthData.name);
                    if(fish) {
                        // Track if sync corrected any mismatch
                        if(fish.health !== healthData.health ||
                           fish.sick !== healthData.sick ||
                           fish.medicated !== healthData.medicated) {
                            syncChanges++;
                        }
                        fish.health = healthData.health;
                        fish.sick = healthData.sick;
                        fish.medicated = healthData.medicated;
                    }
                });
                // Log if sync corrected any state (means immediate update was missed)
                if(syncChanges > 0) {
                    console.log(`🔄 Status sync corrected ${syncChanges} fish state(s)`);
                }
            }
            break;
        case 'reload':
            console.log('🔄 Reload request from server:', data.reason);
            location.reload();
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
        case 'stateHash':
            // Handle state hash verification response from server
            handleStateHashResponse(data.data);
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
                case 'castFishingRod':
                    castFishingRod();
                    break;
                case 'togglePump':
                    // Pump state comes from server via status update
                    // Just run the UI update, don't toggle locally
                    if (data.pumpOn !== undefined) {
                        pumpOn = data.pumpOn;
                    } else {
                        pumpOn = !pumpOn; // Fallback for backwards compatibility
                    }
                    updatePumpUI();
                    break;
                case 'cleanTank':
                    cleanTank();
                    break;
                case 'updatePoopCount':
                    // Pump filtering - sync poop count from server
                    if (typeof data.poopCount === 'number') {
                        const targetCount = data.poopCount;
                        // Remove excess poops to match server count
                        while (poops.length > targetCount) {
                            poops.pop();
                        }
                        console.log(`🔄 Poep gefilterd door pomp: ${poops.length} poep over`);
                    }
                    break;
                case 'refreshWater':
                    refreshWater();
                    break;
                case 'tapGlass':
                    tapGlass();
                    break;
                case 'addPlayBall':
                    makePlayBall();
                    break;
                case 'addMedicine':
                    console.log('💊 Medicine added - updating fish status');

                    // Immediate update if server sent medicated fish data
                    if (data.medicatedFish && Array.isArray(data.medicatedFish)) {
                        data.medicatedFish.forEach(medData => {
                            const fish = fishes.find(f => f.name === medData.name);
                            if (fish) {
                                fish.sick = medData.sick;
                                fish.medicated = medData.medicated;
                                fish.medicatedAt = medData.medicatedAt;
                                fish.health = medData.health;
                                console.log(`💊 ${fish.name} immediately medicated`);
                            }
                        });
                    }

                    // Still request full game state as fallback for complete sync
                    sendToServer({ command: 'getGameState' });
                    break;
                case 'diseaseUpdate':
                    console.log('🦠 Disease status updated - syncing with server');

                    // Immediate update if server sent affected fish data
                    if (data.affectedFish && Array.isArray(data.affectedFish)) {
                        data.affectedFish.forEach(diseaseData => {
                            const fish = fishes.find(f => f.name === diseaseData.name);
                            if (fish) {
                                fish.sick = diseaseData.sick;
                                fish.sickStartedAt = diseaseData.sickStartedAt;
                                fish.medicated = diseaseData.medicated;
                                fish.health = diseaseData.health;
                                console.log(`🦠 ${fish.name} immediately updated - sick: ${fish.sick}`);
                            }
                        });
                    }

                    // Still request full game state as fallback for complete sync
                    sendToServer({ command: 'getGameState' });
                    break;
                case 'healthUpdate':
                    // Update specific fish health immediately
                    if (data.fishName && data.health !== undefined) {
                        const fish = fishes.find(f => f.name === data.fishName);
                        if (fish) {
                            fish.health = data.health;
                            // Also update sick/medicated status if provided to keep emoji in sync
                            if (data.sick !== undefined) fish.sick = data.sick;
                            if (data.medicated !== undefined) fish.medicated = data.medicated;
                            console.log(`💚 Health updated for ${data.fishName}: ${data.health}% (sick: ${fish.sick}, medicated: ${fish.medicated})`);
                        }
                    }
                    break;
                case 'startRace':
                    startRace(data.fish1, data.fish2);
                    break;
                default:
                    console.log('Onbekend commando:', data.command);
            }
    }
}

/**
 * Calculate client-side state hash
 * Must match server calculateStateHash() logic exactly
 */
function calculateClientStateHash() {
    // Match server's core state structure
    const coreState = {
        fishCount: fishes.length,
        fishes: fishes.map(f => ({
            name: f.name,
            health: Math.round(f.health * 10) / 10, // Round to 1 decimal
            sick: f.sick || false,
            medicated: f.medicated || false
        })),
        lightsOn: lightsOn,
        discoOn: discoOn,
        pumpOn: pumpOn,
        hasBall: playBalls.length > 0
    };

    // Simple hash (not cryptographic, just for sync verification)
    const stateString = JSON.stringify(coreState);
    let hash = 0;
    for (let i = 0; i < stateString.length; i++) {
        const char = stateString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return hash.toString(16);
}

/**
 * Sync stats tracking
 */
const syncStats = {
    lastCheck: 0,
    lastServerHash: null,
    lastClientHash: null,
    hashMatches: 0,
    hashMismatches: 0,
    correctionsApplied: 0,
    lastMismatchTime: 0
};

/**
 * Handle state hash response from server
 */
function handleStateHashResponse(serverHashData) {
    const serverHash = serverHashData.hash;
    const clientHash = calculateClientStateHash();

    syncStats.lastCheck = Date.now();
    syncStats.lastServerHash = serverHash;
    syncStats.lastClientHash = clientHash;

    const timeSinceLastCheck = syncStats.lastCheck - (syncStats.lastCheck - 30000);

    if (serverHash === clientHash) {
        // Hashes match - state is in sync!
        syncStats.hashMatches++;
        console.log(
            `%c[SYNC] ✅ State in sync`,
            'color: #00ff00; font-weight: bold',
            `| Hash: ${serverHash}`,
            `| Fish: ${serverHashData.fishCount} total, ${serverHashData.sickCount} sick`,
            `| Matches: ${syncStats.hashMatches}, Mismatches: ${syncStats.hashMismatches}`
        );
    } else {
        // Hash mismatch - state is out of sync!
        syncStats.hashMismatches++;
        syncStats.lastMismatchTime = Date.now();
        syncStats.correctionsApplied++;

        console.error(
            `%c[SYNC] ❌ HASH MISMATCH DETECTED!`,
            'color: #ff0000; font-weight: bold; font-size: 14px'
        );
        console.error(`Server Hash: ${serverHash}`);
        console.error(`Client Hash: ${clientHash}`);
        console.error(`Server Fish Count: ${serverHashData.fishCount}, Sick: ${serverHashData.sickCount}`);
        console.error(`Client Fish Count: ${fishes.length}, Sick: ${fishes.filter(f => f.sick).length}`);
        console.log('%c[SYNC] 🔄 Requesting fresh gameState to restore sync...', 'color: #ffaa00; font-weight: bold');

        // Request fresh gameState to fix sync
        sendToServer({ command: 'getGameState' });
    }
}

/**
 * Periodic sync check - request hash from server every 30 seconds
 */
function startPeriodicSyncCheck() {
    // Initial check after 5 seconds (give time for initial state load)
    setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            sendToServer({ command: 'getStateHash' });
        }
    }, 5000);

    // Then check every 30 seconds
    setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            sendToServer({ command: 'getStateHash' });
        }
    }, 30000);
}

/**
 * Manual sync commands (available in console)
 */
window.checkSyncNow = function() {
    console.log('[SYNC] Manual sync check requested...');
    if (ws && ws.readyState === WebSocket.OPEN) {
        sendToServer({ command: 'getStateHash' });
    } else {
        console.error('[SYNC] WebSocket not connected');
    }
};

window.forceSyncNow = function() {
    console.log('[SYNC] Force re-sync requested...');
    if (ws && ws.readyState === WebSocket.OPEN) {
        sendToServer({ command: 'getGameState' });
        console.log('[SYNC] ✅ Fresh gameState requested');
    } else {
        console.error('[SYNC] WebSocket not connected');
    }
};

window.getSyncStats = function() {
    const stats = {
        lastCheck: syncStats.lastCheck ? new Date(syncStats.lastCheck).toLocaleTimeString() : 'Never',
        timeSinceLastCheck: syncStats.lastCheck ? `${Math.round((Date.now() - syncStats.lastCheck) / 1000)}s ago` : 'N/A',
        lastServerHash: syncStats.lastServerHash || 'N/A',
        lastClientHash: syncStats.lastClientHash || 'N/A',
        hashMatches: syncStats.hashMatches,
        hashMismatches: syncStats.hashMismatches,
        correctionsApplied: syncStats.correctionsApplied,
        lastMismatch: syncStats.lastMismatchTime ? new Date(syncStats.lastMismatchTime).toLocaleTimeString() : 'Never',
        currentState: {
            fishCount: fishes.length,
            sickCount: fishes.filter(f => f.sick).length,
            medicatedCount: fishes.filter(f => f.medicated).length,
            lightsOn: lightsOn,
            discoOn: discoOn,
            pumpOn: pumpOn
        }
    };

    console.log('%c=== SYNC STATISTICS ===', 'font-weight: bold; font-size: 16px');
    console.table(stats);
    console.log('%cCommands: checkSyncNow(), forceSyncNow(), getSyncStats()', 'color: #888');

    return stats;
};

/**
 * Validate received state from server
 * Ensures core state is consistent and complete
 */
function validateReceivedState(state) {
    const errors = [];

    // Check if state exists
    if (!state || typeof state !== 'object') {
        errors.push('State is null or not an object');
        return errors;
    }

    // Validate fishes array
    if (!Array.isArray(state.fishes)) {
        errors.push('Fishes is not an array');
    } else {
        // Validate each fish
        state.fishes.forEach((fish, index) => {
            if (!fish.name) {
                errors.push(`Fish ${index} has no name`);
            }

            // Health must be 0-100
            if (fish.health !== undefined && (fish.health < 0 || fish.health > 100)) {
                errors.push(`Fish ${fish.name} health out of range: ${fish.health}`);
            }

            // Sick status consistency
            if (fish.sick && !fish.sickStartedAt) {
                errors.push(`Fish ${fish.name} is sick but has no sickStartedAt`);
            }
            if (!fish.sick && fish.sickStartedAt) {
                errors.push(`Fish ${fish.name} is not sick but has sickStartedAt`);
            }

            // Medicated status consistency
            if (fish.medicated && !fish.sick) {
                errors.push(`Fish ${fish.name} is medicated but not sick`);
            }
            if (fish.medicated && !fish.medicatedAt) {
                errors.push(`Fish ${fish.name} is medicated but has no medicatedAt`);
            }
            if (!fish.medicated && fish.medicatedAt) {
                errors.push(`Fish ${fish.name} is not medicated but has medicatedAt`);
            }
        });
    }

    // Validate required properties
    if (state.lightsOn === undefined) errors.push('lightsOn is undefined');
    if (state.discoOn === undefined) errors.push('discoOn is undefined');
    if (state.pumpOn === undefined) errors.push('pumpOn is undefined');
    if (state.fishCounter === undefined) errors.push('fishCounter is undefined');
    if (state.lastFed === undefined) errors.push('lastFed is undefined');

    return errors;
}

function loadGameState(state) {
    console.log('Game state geladen van server:', state);

    // Validate received state
    const validationErrors = validateReceivedState(state);
    if (validationErrors.length > 0) {
        console.error('⚠️ State validation errors detected:', validationErrors);
        console.error('Received state:', state);
        console.error('❌ REFUSING to load invalid state - requesting fresh gameState from server');

        // Request fresh state from server
        setTimeout(() => {
            console.log('🔄 Requesting fresh gameState from server...');
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'getGameState' }));
            }
        }, 1000);

        return; // STOP! Don't load invalid state
    } else {
        console.log('✅ State validation passed');
    }

    // Update global variables
    lastFed = state.lastFed;
    lastMedicine = state.lastMedicine || 0;
    feedCooldown = state.feedCooldown || (60 * 60 * 1000);
    medicineCooldown = state.medicineCooldown || (24 * 60 * 60 * 1000);
    fishCounter = state.fishCounter;
    lightsOn = state.lightsOn;
    discoOn = state.discoOn;
    pumpOn = state.pumpOn;
    heatingOn = state.heatingOn !== undefined ? state.heatingOn : true;
    waterGreenness = state.waterGreenness || 0;
    waterGreennessTarget = state.waterGreenness || 0;

    // Update theme from game state
    if(state.theme !== undefined) {
        currentTheme = state.theme || 'normal';
        console.log('🎨 Theme from server:', state.theme, '(currentTheme:', currentTheme, ')');
    }

    // Update existing fishes or add new ones (don't clear to preserve animations)
    // First, update existing fishes with server data
    state.fishes.forEach(serverFish => {
        const existingFish = fishes.find(f => f.name === serverFish.name);
        if (existingFish) {
            // Update disease properties without destroying the fish object
            // Use explicit undefined checks to properly handle false values
            existingFish.sick = serverFish.sick !== undefined ? serverFish.sick : false;
            existingFish.sickStartedAt = serverFish.sickStartedAt !== undefined ? serverFish.sickStartedAt : null;
            existingFish.medicated = serverFish.medicated !== undefined ? serverFish.medicated : false;
            existingFish.medicatedAt = serverFish.medicatedAt !== undefined ? serverFish.medicatedAt : null;
            existingFish.health = serverFish.health !== undefined ? serverFish.health : 100;
            // Also update stats that may have changed
            existingFish.eats = serverFish.eats !== undefined ? serverFish.eats : existingFish.eats;
            existingFish.lastEat = serverFish.lastEat !== undefined ? serverFish.lastEat : existingFish.lastEat;
        } else {
            // New fish from server - add it
            const fish = makeFishFromData(serverFish);
            if (fish) fishes.push(fish);
        }
    });

    // Remove fishes that no longer exist on server
    const fishesToRemove = [];
    for (let i = fishes.length - 1; i >= 0; i--) {
        const fish = fishes[i];
        if (!state.fishes.find(sf => sf.name === fish.name)) {
            fishesToRemove.push(i);
        }
    }
    fishesToRemove.forEach(index => fishes.splice(index, 1));

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

    // Sync ball state from server (server is authoritative)
    if (state.hasBall && playBalls.length === 0) {
        // Server says there's a ball, but we don't have one - add it
        console.log('🎾 Syncing ball from server - adding ball');
        makePlayBall();
    } else if (!state.hasBall && playBalls.length > 0) {
        // Server says no ball, but we have one - remove it
        console.log('🎾 Syncing ball from server - removing ball');
        playBalls.length = 0;
    }

    // Update UI
    updateLightUI();
    updateDiscoUI();
    updatePumpUI();
    updateCooldown();
    drawLists();
    drawActivityList();

    console.log(`Geladen: ${fishes.length} vissen, ${deadLog.length} overleden vissen`);

    // Report current poop count to server
    sendToServer({ command: 'reportPoop', poopCount: poops.length });
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

    // Initialize velocities with validation
    let vx = rand(-1, 1);
    let vy = rand(-0.5, 0.5);
    if(isNaN(vx) || !isFinite(vx)) vx = 0.1;
    if(isNaN(vy) || !isFinite(vy)) vy = 0.05;

    // Initialize speed with validation
    let speed = serverFish.speed !== undefined ? serverFish.speed : rand(1.5, 3.0);
    if(isNaN(speed) || !isFinite(speed) || speed <= 0) speed = 2.0;

    // Initialize baseSize with validation
    let baseSize = serverFish.baseSize !== undefined ? serverFish.baseSize : rand(18, 30);
    if(isNaN(baseSize) || !isFinite(baseSize) || baseSize <= 0) baseSize = 24;

    const f = {
        x: startX,
        y: startY,
        vx: vx,
        vy: vy,
        // Use saved visual properties or fallback to random (for backwards compatibility)
        speed: speed,
        baseSize: baseSize,
        hue: hue,
        sickTop: serverFish.sickTop !== undefined ? serverFish.sickTop : (Math.random() < 0.5),
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
        wallFollowTarget: null,
        // Ball approach preference (random per fish)
        ballApproachSide: Math.random() < 0.5 ? -1 : 1,
        // Pump interest (timer-based attraction)
        pumpInterest: false,
        pumpInterestUntil: 0,
        // Food chasing (for emoji display)
        chasingFood: false
    };
    return f;
}

function updateLightUI() {
    // Get theme-based background color
    const theme = getThemeConfig();
    const bgColors = lightsOn ? theme.bgLight : theme.bgDark;
    // Use the darkest color from the gradient as solid background
    const bgColor = bgColors[3];
    document.getElementById('tank').style.background = bgColor;
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

        // When pump turns on: 60% of fish get initial interest (30-60 sec)
        const now = Date.now();
        fishes.forEach(f => {
            if (Math.random() < 0.6) {
                f.pumpInterest = true;
                f.pumpInterestUntil = now + rand(30000, 60000); // 30-60 seconds
            }
        });
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
function toggleDisco(){
  discoOn=!discoOn;
  if(!discoOn&&discoBall.deployed){
    // Start undeploy animatie (bal gaat omhoog)
    discoBall.undeploying=true;
    discoBall.undeployStart=Date.now();
  }
  updateDiscoUI();
}

function castFishingRod(){
  // Kan alleen vissen als er geen hengel actief is
  if(fishingRod.deployed||fishingRod.state!=='idle')return;

  // Kan alleen vissen als er vissen zijn
  if(fishes.length===0)return;

  // Start deploy animatie
  fishingRod.deployed=true;
  fishingRod.state='deploying';
  fishingRod.deployStart=Date.now();
  fishingRod.x=W/2;
  fishingRod.y=viewportConfig.offsetTop;

  console.log('🎣 Fishing rod cast!');
}

function togglePump(){pumpOn=!pumpOn;updatePumpUI()}
function cleanTank(){
  poops.length=0;
  console.log('Tank opgeruimd! Alle poep weggehaald.');

  // Report poop count to server for controller updates
  sendToServer({ command: 'reportPoop', poopCount: 0 });
}
function refreshWater(){
  waterGreenness=0;
  waterGreennessTarget=0;
  algenParticles.length=0;
  console.log('💧 Water ververst! Greenness gereset naar 0%.');

  // Report water greenness to server for controller updates
  sendToServer({ command: 'reportWaterGreenness', waterGreenness: 0 });
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

// === RACE SYSTEM ===
function startRace(fish1Name, fish2Name) {
  // Find the fish objects
  const fish1 = fishes.find(f => f.name === fish1Name);
  const fish2 = fishes.find(f => f.name === fish2Name);

  if (!fish1 || !fish2) {
    console.log('🏁 Race kan niet starten: vis niet gevonden');
    return;
  }

  console.log(`🏁 Race gestart: ${fish1Name} VS ${fish2Name}`);

  // Calculate race speeds based on fish properties + random factor
  const baseSpeed1 = (fish1.speed || 2) * ((fish1.health || 100) / 100);
  const baseSpeed2 = (fish2.speed || 2) * ((fish2.health || 100) / 100);
  const randomFactor1 = 0.7 + Math.random() * 0.6; // 0.7 - 1.3
  const randomFactor2 = 0.7 + Math.random() * 0.6;

  // Setup race
  race.active = true;
  race.fish1 = fish1;
  race.fish2 = fish2;
  race.startTime = Date.now();
  race.duration = 20500; // 5.5s setup + 15s race
  race.startX = W * 0.15; // Start at 15% from left
  race.finishX = W * 0.85; // Finish at 85% from left
  race.fish1Speed = baseSpeed1 * randomFactor1;
  race.fish2Speed = baseSpeed2 * randomFactor2;
  race.fish1X = race.startX;
  race.fish2X = race.startX;
  race.winner = null;

  // Calculate race Y positions (two lanes)
  const raceY1 = H * 0.4; // Upper lane
  const raceY2 = H * 0.6; // Lower lane
  race.fish1Y = raceY1;
  race.fish2Y = raceY2;

  // Store original positions and set race flag on fish
  fish1.preRaceX = fish1.x;
  fish1.preRaceY = fish1.y;
  fish1.racing = true;
  fish1.raceTargetX = race.startX;
  fish1.raceTargetY = raceY1;

  fish2.preRaceX = fish2.x;
  fish2.preRaceY = fish2.y;
  fish2.racing = true;
  fish2.raceTargetX = race.startX;
  fish2.raceTargetY = raceY2;

  // Setup spectator positions for other fish
  race.spectatorPositions = [];
  fishes.forEach(f => {
    if (f !== fish1 && f !== fish2) {
      f.spectating = true;
      // Spectators move to top or bottom of screen
      const goTop = Math.random() < 0.5;
      f.spectatorTargetX = rand(W * 0.2, W * 0.8);
      f.spectatorTargetY = goTop ? rand(H * 0.08, H * 0.18) : rand(H * 0.82, H * 0.92);
      f.preSpectateX = f.x;
      f.preSpectateY = f.y;
    }
  });
}

function updateRace(dt) {
  if (!race.active) return;

  const elapsed = Date.now() - race.startTime;
  const raceDistance = race.finishX - race.startX;
  const setupDuration = 5500; // 2s VS + 3.5s countdown

  // Phase 1: Move fish to starting positions (first 2 seconds)
  if (elapsed < 2000) {
    const progress = elapsed / 2000;
    const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

    // Move race fish to start with velocity for swim animation
    if (race.fish1) {
      const targetX = race.fish1.preRaceX + (race.startX - race.fish1.preRaceX) * easeProgress;
      const targetY = race.fish1.preRaceY + (race.fish1Y - race.fish1.preRaceY) * easeProgress;
      race.fish1.vx = (targetX - race.fish1.x) * 0.1;
      race.fish1.vy = (targetY - race.fish1.y) * 0.1;
      race.fish1.x = targetX;
      race.fish1.y = targetY;
      race.fish1.dir = 1; // Face right
    }
    if (race.fish2) {
      const targetX = race.fish2.preRaceX + (race.startX - race.fish2.preRaceX) * easeProgress;
      const targetY = race.fish2.preRaceY + (race.fish2Y - race.fish2.preRaceY) * easeProgress;
      race.fish2.vx = (targetX - race.fish2.x) * 0.1;
      race.fish2.vy = (targetY - race.fish2.y) * 0.1;
      race.fish2.x = targetX;
      race.fish2.y = targetY;
      race.fish2.dir = 1; // Face right
    }

    // Move spectators with velocity
    fishes.forEach(f => {
      if (f.spectating) {
        const targetX = f.preSpectateX + (f.spectatorTargetX - f.preSpectateX) * easeProgress;
        const targetY = f.preSpectateY + (f.spectatorTargetY - f.preSpectateY) * easeProgress;
        f.vx = (targetX - f.x) * 0.1;
        f.vy = (targetY - f.y) * 0.1;
        f.x = targetX;
        f.y = targetY;
      }
    });
    return;
  }

  // Phase 2: Countdown - fish wait at start line (2-5.5 seconds)
  if (elapsed < setupDuration) {
    // Fish bob gently at start line
    const countdownTime = elapsed - 2000;
    if (race.fish1) {
      race.fish1.x = race.startX;
      race.fish1.y = race.fish1Y + Math.sin(countdownTime * 0.005) * 8;
      race.fish1.vx = 0.5; // Small forward velocity for swim animation
      race.fish1.vy = Math.sin(countdownTime * 0.008) * 0.5;
      race.fish1.dir = 1;
    }
    if (race.fish2) {
      race.fish2.x = race.startX;
      race.fish2.y = race.fish2Y + Math.sin(countdownTime * 0.006 + 1) * 8;
      race.fish2.vx = 0.5;
      race.fish2.vy = Math.sin(countdownTime * 0.009 + 1) * 0.5;
      race.fish2.dir = 1;
    }

    // Spectators bob while watching
    fishes.forEach(f => {
      if (f.spectating) {
        f.vx = Math.sin(countdownTime * 0.002 + f.spectatorTargetX) * 0.3;
        f.vy = Math.sin(countdownTime * 0.003 + f.spectatorTargetY) * 0.5;
        f.x = f.spectatorTargetX + Math.sin(countdownTime * 0.002 + f.spectatorTargetX) * 5;
        f.y = f.spectatorTargetY + Math.sin(countdownTime * 0.003 + f.spectatorTargetY) * 8;
      }
    });
    return;
  }

  // Phase 3: Racing (after 5.5 seconds)
  const raceElapsed = elapsed - setupDuration; // Time since race actually started
  const raceDuration = race.duration - setupDuration;

  // Add some randomness to speed over time
  const wobble1 = Math.sin(raceElapsed * 0.003) * 0.15;
  const wobble2 = Math.sin(raceElapsed * 0.004 + 1) * 0.15;

  // Update fish positions
  const speed1 = race.fish1Speed * (1 + wobble1);
  const speed2 = race.fish2Speed * (1 + wobble2);

  // Normalize speeds so race takes roughly the full duration
  const avgSpeed = (speed1 + speed2) / 2;
  const normalizedSpeed1 = (speed1 / avgSpeed) * (raceDistance / raceDuration) * 1000;
  const normalizedSpeed2 = (speed2 / avgSpeed) * (raceDistance / raceDuration) * 1000;

  // Calculate new X positions
  const newX1 = Math.min(race.finishX, race.fish1X + normalizedSpeed1 * (dt / 1000));
  const newX2 = Math.min(race.finishX, race.fish2X + normalizedSpeed2 * (dt / 1000));

  // Update fish with velocity for proper swim animation
  if (race.fish1) {
    race.fish1.vx = (newX1 - race.fish1X) * 60; // Convert to velocity
    race.fish1.vy = Math.sin(raceElapsed * 0.008) * 1.5; // Gentle vertical swimming
    race.fish1.x = newX1;
    race.fish1.y = race.fish1Y + Math.sin(raceElapsed * 0.006) * 15; // Swimming wave
    race.fish1.dir = 1;
    race.fish1X = newX1;
  }
  if (race.fish2) {
    race.fish2.vx = (newX2 - race.fish2X) * 60;
    race.fish2.vy = Math.sin(raceElapsed * 0.009 + 1) * 1.5;
    race.fish2.x = newX2;
    race.fish2.y = race.fish2Y + Math.sin(raceElapsed * 0.007 + 2) * 15;
    race.fish2.dir = 1;
    race.fish2X = newX2;
  }

  // Spectators gently bob while watching
  fishes.forEach(f => {
    if (f.spectating) {
      f.vx = Math.sin(raceElapsed * 0.002 + f.spectatorTargetX) * 0.3;
      f.vy = Math.sin(raceElapsed * 0.003 + f.spectatorTargetY) * 0.5;
      f.x = f.spectatorTargetX + Math.sin(raceElapsed * 0.002 + f.spectatorTargetX) * 5;
      f.y = f.spectatorTargetY + Math.sin(raceElapsed * 0.003 + f.spectatorTargetY) * 8;
    }
  });

  // Check for winner
  if (!race.winner) {
    if (race.fish1X >= race.finishX) {
      race.winner = race.fish1.name;
      endRace(race.fish1.name, race.fish2.name);
    } else if (race.fish2X >= race.finishX) {
      race.winner = race.fish2.name;
      endRace(race.fish2.name, race.fish1.name);
    }
  }
}

function endRace(winnerName, loserName) {
  console.log(`🏁 Race afgelopen! Winnaar: ${winnerName}`);

  // Notify server
  sendToServer({ command: 'raceFinished', winner: winnerName, loser: loserName });

  // Store winner/loser fish for popup
  race.winnerFish = race.fish1.name === winnerName ? race.fish1 : race.fish2;
  race.loserFish = race.fish1.name === loserName ? race.fish1 : race.fish2;

  // Reset fish states immediately
  fishes.forEach(f => {
    f.racing = false;
    f.spectating = false;
    delete f.preRaceX;
    delete f.preRaceY;
    delete f.raceTargetX;
    delete f.raceTargetY;
    delete f.spectatorTargetX;
    delete f.spectatorTargetY;
    delete f.preSpectateX;
    delete f.preSpectateY;
  });

  // Reset race active state but start showing winner popup
  race.active = false;
  race.showingWinner = true;
  race.winnerShowStart = Date.now();

  // Hide popup after 5 seconds
  setTimeout(() => {
    race.showingWinner = false;
    race.winnerFish = null;
    race.loserFish = null;
    race.fish1 = null;
    race.fish2 = null;
    race.winner = null;
  }, 5000);
}

function drawRaceOverlay(ctx) {
  if (!race.active) return;

  const elapsed = Date.now() - race.startTime;

  // Draw start line (dashed vertical line)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(race.startX, H * 0.25);
  ctx.lineTo(race.startX, H * 0.75);
  ctx.stroke();

  // Draw finish line (same style as start line)
  ctx.beginPath();
  ctx.moveTo(race.finishX, H * 0.25);
  ctx.lineTo(race.finishX, H * 0.75);
  ctx.stroke();

  ctx.restore();

  // Timeline:
  // 0-2000ms: VS screen with names, fish moving to start
  // 2000-3000ms: "3"
  // 3000-4000ms: "2"
  // 4000-5000ms: "1"
  // 5000-5500ms: "GO!"
  // 5500ms+: racing

  // Draw "VS" text during setup phase (first 2 seconds)
  if (elapsed < 2000) {
    ctx.save();

    // Semi-transparent overlay for better readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(W * 0.2, H * 0.25, W * 0.6, H * 0.5);

    // VS text
    ctx.font = 'bold 64px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText('VS', W / 2, H / 2);

    // Fish names
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#fff';
    if (race.fish1) ctx.fillText(race.fish1.name, W / 2, H * 0.35);
    if (race.fish2) ctx.fillText(race.fish2.name, W / 2, H * 0.65);

    ctx.restore();
  }

  // Draw countdown: 3, 2, 1, GO!
  if (elapsed >= 2000 && elapsed < 5500) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;

    let countText = '';
    let textColor = '#fff';
    let fontSize = 120;

    if (elapsed < 3000) {
      countText = '3';
      textColor = '#ff6b6b';
    } else if (elapsed < 4000) {
      countText = '2';
      textColor = '#ffd93d';
    } else if (elapsed < 5000) {
      countText = '1';
      textColor = '#6bcb77';
    } else {
      countText = 'GO!';
      textColor = '#4ecdc4';
      fontSize = 100;
    }

    // Pulse animation
    const pulsePhase = (elapsed % 1000) / 1000;
    const scale = 1 + Math.sin(pulsePhase * Math.PI) * 0.1;

    ctx.font = `bold ${Math.round(fontSize * scale)}px Arial`;
    ctx.fillStyle = textColor;
    ctx.fillText(countText, W / 2, H / 2);

    ctx.restore();
  }
}

function drawRaceWinnerPopup(time) {
  if (!race.showingWinner) return;
  if (!race.winnerFish) return;

  const fish = race.winnerFish;
  const loser = race.loserFish;
  const now = Date.now();
  const elapsed = now - race.winnerShowStart;

  // Fade in/out animatie
  let alpha = 1;
  if (elapsed < 300) { // Fade in eerste 300ms
    alpha = elapsed / 300;
  } else if (elapsed > 4700) { // Fade out laatste 300ms
    alpha = (5000 - elapsed) / 300;
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  // Bereken vis-grootte vooraf om banner dynamisch te maken
  const visGrootte = fishSize(fish, now);
  const visBannerGrootte = Math.min(visGrootte * 2.5, 160);

  // Popup box (centered)
  const boxW = Math.min(480, cv.width * 0.7);
  const minBoxH = 260;
  const maxBoxH = 420;
  const neededH = 18 + 30 + visBannerGrootte + 20 + 50 + 18;
  const boxH = Math.max(minBoxH, Math.min(maxBoxH, neededH));

  const boxX = (cv.width - boxW) / 2;
  const boxY = (cv.height - boxH) / 2;
  const pad = 18;

  // Subtiele schaduw
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(boxX + 4, boxY + 4, boxW, boxH, 10);
  ctx.fill();

  // Main box
  ctx.fillStyle = lightsOn ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 10);
  ctx.fill();

  // Titel bovenaan
  ctx.fillStyle = lightsOn ? '#0b1e2d' : '#e9f1f7';
  ctx.font = '700 20px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`🏆 ${fish.name} Wint!`, boxX + boxW / 2, boxY + pad);

  // Teken de winnende vis gecentreerd
  ctx.save();
  const visX = boxX + boxW / 2;
  const visY = boxY + boxH / 2;

  const originalX = fish.x;
  const originalY = fish.y;
  const originalVx = fish.vx;
  const originalVy = fish.vy;
  const originalBaseSize = fish.baseSize;

  fish.x = visX;
  fish.y = visY;
  fish.vx = -1;
  fish.vy = 0;
  const scaleFactor = Math.min(2.5, 160 / visGrootte);
  fish.baseSize = fish.baseSize * scaleFactor;
  fish.hideLabel = true;
  fish.hideShadow = true;

  drawFish(fish, elapsed, now);

  fish.x = originalX;
  fish.y = originalY;
  fish.vx = originalVx;
  fish.vy = originalVy;
  fish.baseSize = originalBaseSize;
  fish.hideLabel = false;
  fish.hideShadow = false;

  ctx.restore();

  // Tekst onderaan: "wint van [verliezer]"
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const centerX = boxX + boxW / 2;

  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = lightsOn ? '#0b1e2d' : '#e9f1f7';
  ctx.font = '500 14px system-ui,Segoe UI,Roboto,Arial';
  if (loser) {
    ctx.fillText(`wint van ${loser.name}`, centerX, boxY + boxH - pad - 16);
  }

  ctx.globalAlpha = alpha;
  ctx.restore();
}

function updateCooldown(){
    const cd=document.getElementById('cooldown');
    const left=Math.max(0,FEED_CD-(Date.now()-lastFed));

    if(left<=0){
        cd.textContent='🍤 Voeren: beschikbaar';
        cd.classList.add('ready');
    } else {
        // Better time formatting like ageLabelMS
        const timeText = ageLabelMS(left);
        cd.textContent=`🍤 Voeren: over ${timeText}`;
        cd.classList.remove('ready');
    }
}

function updateStatusBar(){
    // Temperature
    const tempEl = document.getElementById('temperature');
    const temp = Math.round(currentTemperature);
    tempEl.textContent = `🌡️ ${temp}°C`;
    tempEl.classList.remove('status-warn', 'status-danger');
    if(temp >= 22 && temp <= 26) {
        // Normal - no class (wit)
    } else if(temp >= 20 && temp <= 28) {
        tempEl.classList.add('status-warn');
    } else {
        tempEl.classList.add('status-danger');
    }

    // Water quality
    const waterEl = document.getElementById('water');
    const greenness = Math.round(waterGreenness);
    waterEl.classList.remove('status-warn', 'status-danger');

    if(greenness < 10) {
        waterEl.textContent = '💧 Water: helder';
        // Normal - no class (wit)
    } else if(greenness < 25) {
        waterEl.textContent = `💧 Water: ${greenness}% groen`;
        // Normal - no class (wit)
    } else if(greenness < 50) {
        waterEl.textContent = `💧 Water: ${greenness}% groen`;
        waterEl.classList.add('status-warn');
    } else if(greenness < 75) {
        waterEl.textContent = `💧 Water: ${greenness}% groen`;
        waterEl.classList.add('status-warn');
    } else {
        waterEl.textContent = `💧 Water: ${greenness}% groen`;
        waterEl.classList.add('status-danger');
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
  updateLayerCache();
  console.log('Nieuwe decoratie gegenereerd!');
}

let t=0;let lastListUpdate=0;let lastCooldownUpdate=0;let lastDecorUpdate=0;let lastBallStateSync=0;
let fadeState='idle';let fadeAlpha=1;let fadeStartTime=0;
const LIST_UPDATE_INTERVAL=5000;const COOLDOWN_UPDATE_INTERVAL=1000;const DECOR_UPDATE_INTERVAL=3600000;const BALL_STATE_SYNC_INTERVAL=10000; // Sync ball state every 10 seconds
const FADE_DURATION=1500; // 1.5 seconds for each fade phase

// Cache for layer filtering - avoid recreating arrays every frame
let backPlants=[],frontPlants=[],backDecorations=[],frontDecorations=[];
function updateLayerCache(){
  backPlants=plants.filter(p=>p.zIndex==='back');
  frontPlants=plants.filter(p=>p.zIndex==='front');
  backDecorations=decorations.filter(d=>d.zIndex==='back');
  frontDecorations=decorations.filter(d=>d.zIndex==='front');
}

function showLoadingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'loading-indicator';
    indicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        color: #50e3c2;
        font-family: system-ui, sans-serif;
        font-size: 18px;
        z-index: 1000;
    `;
    indicator.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 15px;">🐟</div>
        <div>Vissenkom laden...</div>
    `;
    document.body.appendChild(indicator);
}

function hideLoadingIndicator() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function init(){document.getElementById('tank').style.background=BG;document.body.classList.add('dark');document.body.classList.remove('light');lightsOn=true;resize();updateCooldown();updateStatusBar();drawLists();drawActivityList();showLoadingIndicator();initWebSocket()}
init();

function loop(){
// Stop loop if game is not active (e.g., vissenkom already active elsewhere)
if(!gameLoopStarted){
  return;
}

const now=Date.now();const dt=Math.min(0.05,(now-lastT)/1000);lastT=now;t++;
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

// Apply viewport transform for all drawing
ctx.save();
ctx.translate(viewportConfig.offsetLeft,viewportConfig.offsetTop);
// Clip to viewport area to prevent rendering outside bounds
ctx.beginPath();
ctx.rect(0,0,W,H);
ctx.clip();

// Background layer
drawSandBottom(t/60);

// Als disconnected of already active: alleen achtergrond tonen, geen vissen/planten/etc
if((wsConnectedOnce&&!wsConnected)||alreadyActiveError){
  ctx.restore();
  drawErrorPopup();
  requestAnimationFrame(loop);
  return;
}

for(let i=0;i<backPlants.length;i++){drawPlant(backPlants[i],t)}
for(let i=0;i<backDecorations.length;i++){drawDecoration(backDecorations[i],t)}

if(pumpOn&&Math.random()<0.6*performanceProfile.particleCount){for(let i=0;i<2;i++)makeBubble()}
drawPumpChampagne(); // Champagne fles bij pump (nieuwjaar)
drawBubbles();drawFood();drawPoops();

// Update race system
updateRace(dt*1000);

// Fish layer - update and draw with adaptive rate
const updateRate=performanceProfile.fishUpdateRate;
for(let i=0;i<fishes.length;i++){
  const f=fishes[i];
  // Skip normal update for racing/spectating fish - they are controlled by race system
  if(f.racing||f.spectating){
    drawFish(f,t,now);
    continue;
  }
  // Update fish logic at reduced rate on low performance
  if(t%updateRate===i%updateRate){
    updateFish(f,dt*updateRate,now);
  }else{
    // Still move fish smoothly even when logic updates are skipped
    f.x+=f.vx;f.y+=f.vy;
    bounceOffWalls(f);
  }
  drawFish(f,t,now);
}

// Play balls - update and draw (above fish, below front plants)
updatePlayBalls();drawPlayBalls();

// Fishing rod - update state machine
updateFishingRod(t);

// Foreground layer
for(let i=0;i<frontPlants.length;i++){drawPlant(frontPlants[i],t)}
for(let i=0;i<frontDecorations.length;i++){drawDecoration(frontDecorations[i],t)}

// Water greenness overlay and algae particles
updateAlgenParticles();
drawAlgenParticles();
drawWaterGreenness();

ctx.restore();

// Draw race overlay (start/finish lines, VS text, winner announcement)
ctx.save();
ctx.translate(viewportConfig.offsetLeft,viewportConfig.offsetTop);
drawRaceOverlay(ctx);
ctx.restore();

// Draw catch popup overlay (boven alles, full screen)
drawCatchPopup(t);

// Draw race winner popup overlay
drawRaceWinnerPopup(t);

// Draw error popup overlay (disconnected of already active)
drawErrorPopup();

for(let i=fishes.length-1;i>=0;i--){if(fishes[i].dead){const deadFish={name:fishes[i].name,bornAt:fishes[i].bornAt,diedAt:Date.now()};deadLog.push(deadFish);fishes.splice(i,1);sendToServer({command:'fishDied',fish:deadFish})}}

if(now-lastListUpdate>LIST_UPDATE_INTERVAL){drawLists();drawActivityList();lastListUpdate=now}
if(now-lastCooldownUpdate>COOLDOWN_UPDATE_INTERVAL){updateCooldown();updateStatusBar();lastCooldownUpdate=now}

// Periodieke ball state sync met server (elke 10 seconden)
if(now-lastBallStateSync>BALL_STATE_SYNC_INTERVAL){
  // Ball state sync removed - server is authoritative for ball state
  lastBallStateSync=now;
}

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

requestAnimationFrame(loop)}
// loop() is now started after gameState is received (see handleRemoteCommand)

// Show error when vissenkom is already active elsewhere
function showVisssenkomAlreadyActiveError(message) {
    console.log('🛑 Vissenkom already active:', message);

    // Hide loading indicator if it's still showing
    hideLoadingIndicator();

    // Set flag for canvas-based error popup
    alreadyActiveError = true;
    document.body.classList.add('error-state');

    // Start game loop if not already running (needed to show the popup)
    if (!gameLoopStarted) {
        gameLoopStarted = true;
        requestAnimationFrame(loop);
    }

    console.log('🚫 Vissenkom already active error set');
}
