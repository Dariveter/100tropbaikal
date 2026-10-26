(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const smooth = t => t*t*(3-2*t);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let noMotion = reduced.matches;
try { const saved=localStorage.getItem('baikal-motion'); if(saved!==null) noMotion=saved==='off'; } catch {}
const hero=$('.hero'), discovery=$('.discovery');
const stage=$('.discovery-stage');
let framePending=false, sizePending=true, heroProgress=0, discoveryProgress=0;
let heroCtx, iceCtx, heroSize={w:0,h:0}, iceSize={w:0,h:0};
let frozen, marks, heroBranches=[], frostReady=false, heroIntroStart=performance.now();
let icePointer=false, lastPointer=null;
const seedRand = seed => () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };

function setMotion(value, save=true) {
 noMotion=value; document.body.classList.toggle('no-motion',value);
 $('#motion-toggle').setAttribute('aria-pressed',String(value));
 $('#motion-label').textContent=value?'Анимация выключена':'Анимация включена';
 if(save) try{localStorage.setItem('baikal-motion',value?'off':'on')}catch{}
 sizePending=true; requestTick();
}
$('#motion-toggle').addEventListener('click',()=>setMotion(!noMotion));
reduced.addEventListener('change',e=>setMotion(e.matches,false));
setMotion(noMotion,false);

const revealObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');revealObserver.unobserve(e.target)}}),{threshold:.1});
$$('.reveal').forEach(el=>revealObserver.observe(el));
document.documentElement.classList.add('js');

function createBranches(width,height,seed,count,depthScale=1){
 const rnd=seedRand(seed), lines=[];
 function branch(x,y,angle,len,level,birth){
  if(level<0||len<4)return;
  const bend=(rnd()-.5)*.26;
  const ex=x+Math.cos(angle+bend)*len, ey=y+Math.sin(angle+bend)*len;
  lines.push({x,y,ex,ey,width:level*.24+.35,birth,opacity:.22+rnd()*.4});
  branch(ex,ey,angle+bend,len*(.64+rnd()*.13),level-1,birth+.08);
  if(level>1){
   const side=level%2?1:-1;
   branch(x+(ex-x)*.62,y+(ey-y)*.62,angle+side*(.65+rnd()*.25),len*.58,level-1,birth+.06);
   if(rnd()>.3)branch(x+(ex-x)*.36,y+(ey-y)*.36,angle-side*.8,len*.4,level-2,birth+.1);
  }
 }
 for(let i=0;i<count;i++){
  const side=i%4;let x,y,angle;
  if(side===0){x=rnd()*width;y=-10;angle=Math.PI/2+(rnd()-.5)*.8}
  else if(side===1){x=width+10;y=rnd()*height;angle=Math.PI+(rnd()-.5)*.8}
  else if(side===2){x=rnd()*width;y=height+10;angle=-Math.PI/2+(rnd()-.5)*.8}
  else{x=-10;y=rnd()*height;angle=(rnd()-.5)*.8}
  branch(x,y,angle,(50+rnd()*100)*depthScale,6,rnd()*.15);
 }
 return lines;
}
function paintBranches(ctx,lines,progress=1){
 ctx.save();ctx.lineCap='round';
 for(const l of lines){const t=clamp((progress-l.birth)/.15);if(t===0)continue;ctx.beginPath();ctx.moveTo(l.x,l.y);ctx.lineTo(l.x+(l.ex-l.x)*t,l.y+(l.ey-l.y)*t);ctx.lineWidth=l.width;ctx.strokeStyle=`rgba(226,245,251,${l.opacity})`;ctx.stroke()}
 ctx.restore();
}
function fitCanvas(canvas,w,h){
 const dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 const ctx=canvas.getContext('2d');if(!ctx)return null;ctx.setTransform(dpr,0,0,dpr,0,0);return ctx;
}
function prepareCanvases(){
 heroSize={w:hero.clientWidth,h:hero.clientHeight};iceSize={w:stage.clientWidth,h:stage.clientHeight};
 heroCtx=fitCanvas($('#hero-frost'),heroSize.w,heroSize.h);
 iceCtx=fitCanvas($('#ice-canvas'),iceSize.w,iceSize.h);
 if(!heroCtx||!iceCtx){$('#hero-frost').hidden=true;$('#ice-canvas').hidden=true;return}
 heroBranches=createBranches(heroSize.w,heroSize.h,21,34,.8);
 frozen=document.createElement('canvas');frozen.width=iceSize.w;frozen.height=iceSize.h;
 marks=document.createElement('canvas');marks.width=iceSize.w;marks.height=iceSize.h;
 const c=frozen.getContext('2d');
 const g=c.createLinearGradient(0,0,iceSize.w,iceSize.h);g.addColorStop(0,'rgba(74,119,141,.92)');g.addColorStop(.42,'rgba(62,102,126,.72)');g.addColorStop(1,'rgba(178,204,213,.88)');c.fillStyle=g;c.fillRect(0,0,iceSize.w,iceSize.h);
 const rnd=seedRand(93);
 for(let i=0;i<4500;i++){const x=rnd()*iceSize.w,y=rnd()*iceSize.h;c.fillStyle=`rgba(240,251,255,${rnd()*.16})`;c.fillRect(x,y,rnd()*2+.5,rnd()*2+.5)}
 paintBranches(c,createBranches(iceSize.w,iceSize.h,99,90,1.7));
 // Translucent facets make a textured, frosted surface without obscuring the story.
 for(let i=0;i<38;i++){let x=rnd()*iceSize.w,y=rnd()*iceSize.h,r=15+rnd()*90;c.beginPath();for(let j=0;j<6;j++){const a=Math.PI/3*j+.3;const xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r;j===0?c.moveTo(xx,yy):c.lineTo(xx,yy)}c.closePath();c.strokeStyle='rgba(230,248,255,.06)';c.lineWidth=.7;c.stroke()}
 frostReady=true;
}
function drawHero(intro=1){
 if(!heroCtx||noMotion)return;
 const {w,h}=heroSize;heroCtx.clearRect(0,0,w,h);
 const grow=clamp(intro+heroProgress*.35);
 paintBranches(heroCtx,heroBranches,grow);
 const vignette=heroCtx.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.3,w*.5,h*.5,Math.max(w,h)*.7);
 vignette.addColorStop(0,'rgba(204,234,243,0)');vignette.addColorStop(1,`rgba(213,238,245,${.1*grow})`);heroCtx.fillStyle=vignette;heroCtx.fillRect(0,0,w,h);
}
function drawIce(){
 if(!frostReady||noMotion)return;
 const {w,h}=iceSize;iceCtx.clearRect(0,0,w,h);iceCtx.globalCompositeOperation='source-over';iceCtx.drawImage(frozen,0,0);
 iceCtx.globalCompositeOperation='destination-out';iceCtx.drawImage(marks,0,0);
 const t=smooth(clamp((discoveryProgress-.08)/.75));
 if(t>0){
  const radius=Math.hypot(w,h)*.72*t,cx=w*.53,cy=h*.55;
  iceCtx.beginPath();
  for(let j=0;j<=120;j++){
   const a=j/120*Math.PI*2;const wav=1+Math.sin(a*7+t*4)*.035+Math.cos(a*13)*.02;
   const x=cx+Math.cos(a)*radius*wav,y=cy+Math.sin(a)*radius*wav;
   if(j===0)iceCtx.moveTo(x,y);else iceCtx.lineTo(x,y);
  }
  iceCtx.closePath();iceCtx.fillStyle='rgba(0,0,0,1)';iceCtx.shadowBlur=35;iceCtx.shadowColor='black';iceCtx.fill();iceCtx.shadowBlur=0;
 }
 iceCtx.globalCompositeOperation='source-over';
}
function scratch(e){
 if(!marks||noMotion)return;
 const rect=$('#ice-canvas').getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
 const ctx=marks.getContext('2d'),radius=e.pointerType==='touch'?65:80;
 const stamp=(xx,yy)=>{const g=ctx.createRadialGradient(xx,yy,radius*.15,xx,yy,radius);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.6,'rgba(0,0,0,.85)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(xx-radius,yy-radius,radius*2,radius*2)};
 if(lastPointer){const dist=Math.hypot(x-lastPointer.x,y-lastPointer.y),steps=Math.max(1,Math.ceil(dist/20));for(let i=1;i<=steps;i++)stamp(lastPointer.x+(x-lastPointer.x)*i/steps,lastPointer.y+(y-lastPointer.y)*i/steps)}else stamp(x,y);
 lastPointer={x,y};drawIce();
}
$('#ice-canvas').addEventListener('pointerdown',e=>{icePointer=true;scratch(e)});
$('#ice-canvas').addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||icePointer)scratch(e)},{passive:true});
$('#ice-canvas').addEventListener('pointerleave',()=>{lastPointer=null;icePointer=false});
window.addEventListener('pointerup',()=>{icePointer=false;lastPointer=null});
$('#ice-canvas').addEventListener('pointercancel',()=>{icePointer=false;lastPointer=null});

let activeChapter='';
function update(){
 framePending=false;
 if(sizePending){prepareCanvases();sizePending=false}
 const vh=innerHeight,y=scrollY;
 $('.site-header').classList.toggle('scrolled',y>80);
 const total=Math.max(1,document.documentElement.scrollHeight-vh);
 $('.reading-progress i').style.transform=`scaleX(${clamp(y/total)})`;
 heroProgress=clamp(y/hero.offsetHeight);
 document.documentElement.style.setProperty('--hero-p',noMotion?0:heroProgress);
 const drect=discovery.getBoundingClientRect();
 discoveryProgress=clamp(-drect.top/Math.max(1,discovery.offsetHeight-stage.clientHeight));
 document.documentElement.style.setProperty('--discovery-p',noMotion?1:discoveryProgress);
 if(!noMotion){
  if(y<hero.offsetHeight+vh)drawHero(clamp((performance.now()-heroIntroStart)/1600));
  if(drect.top<vh&&drect.bottom>0)drawIce();

 }
 let current=$$('[data-chapter]')[0];
 for(const el of $$('[data-chapter]'))if(el.getBoundingClientRect().top<vh*.5)current=el;
 if(current.id!==activeChapter){
  activeChapter=current.id;
  $$('.chapter-nav a').forEach(a=>{const active=a.hash===`#${current.id}`;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});
 }
 const midpoint=document.elementFromPoint(10,vh*.5);
 $('.chapter-nav').classList.toggle('on-light',!!midpoint?.closest('.comfort,.route,.details'));
}
function requestTick(){if(!framePending){framePending=true;requestAnimationFrame(update)}}
window.addEventListener('scroll',requestTick,{passive:true});
let oldWidth=innerWidth,oldHeight=innerHeight;
window.addEventListener('resize',()=>{
 if(Math.abs(innerWidth-oldWidth)>2||Math.abs(innerHeight-oldHeight)>100){sizePending=true;oldWidth=innerWidth;oldHeight=innerHeight}requestTick();
},{passive:true});
window.addEventListener('load',()=>{sizePending=true;requestTick()});
function introFrame(time){if(noMotion||scrollY>hero.offsetHeight)return;drawHero(clamp((time-heroIntroStart)/1600));if(time-heroIntroStart<1700)requestAnimationFrame(introFrame)}
requestTick();requestAnimationFrame(introFrame);

const days=[
 {location:'Иркутск',title:'Встречаемся<br>в Иркутске',copy:'Встречаем вас прямо в аэропорту и отвозим в гостиницу. Сегодня можно отдохнуть после перелёта, выдохнуть и настроиться на приключение.',note:'Встреча в аэропорту · заселение · отдых',image:'irkutsk',alt:'Зимний Иркутск'},
 {location:'Листвянка → бухта Песчаная',title:'Первый день<br>на Байкале',copy:'После завтрака едем в Листвянку, а затем отправляемся по льду на хивусах. Остановимся у красивых мысов, рассмотрим пузырьки в толще льда и согреемся за горячим обедом в юрте. Вечером — отдых на берегу озера.',note:'Хивусы · прозрачный лёд · горячий обед',image:'hovercrafts',alt:'Хивусы на зимнем Байкале'},
 {location:'Южный Ольхон → остров Огой',title:'Исследуем Ольхон<br>и остров Огой',copy:'Исследуем южную часть Ольхона: скалу Трезубец, залив с пузырьками во льду и остров Огой со ступой Просветления. На обед — байкальская уха и горячий чай. Вечером заселимся в уютную гостиницу на острове.',note:'Остров Огой · Хвост дракона · байкальская уха',image:'ice-cave',alt:'Грот с голубым льдом на Байкале'},
 {location:'Мыс Хобой → ледяные гроты',title:'Мыс Хобой<br>и ледяные гроты',copy:'Отправимся к северной части Ольхона, увидим ледяные наплески у скал и заглянем в гроты. Покатаемся на коньках по прозрачному льду. Финал дня — красивый ужин в ледяной пещере.',note:'Мыс Хобой · коньки · ужин в гроте',image:'cave',alt:'Ледяная пещера с прозрачными сосульками'},
 {location:'Этноцентр → Иркутск',title:'Знакомимся<br>с местной культурой',copy:'После завтрака и свободного времени отправимся в Иркутск. По пути посетим этноцентр «Золотая Орда»: познакомимся с юртой, местными обрядами, музыкой и танцами. Вечером соберёмся за ужином в ресторане национальной кухни.',note:'Национальные танцы · песни · местная кухня',image:'culture',alt:'Национальная культура и традиции Прибайкалья'},
 {location:'Иркутск → домой',title:'Возвращаемся<br>домой',copy:'Наше путешествие заканчивается, а впечатления остаются. Организуем трансфер в аэропорт. Забирайте с собой фотографии, новые знакомства и свою зимнюю историю.',note:'Трансфер в аэропорт · фотографии · воспоминания',image:'group',alt:'Группа путешественников на прозрачном льду Байкала'}
];
let currentDay=0;
function selectDay(index,focus=false){
 currentDay=(index+days.length)%days.length;const d=days[currentDay];
 $$('.route-tabs button').forEach((button,i)=>{button.setAttribute('aria-selected',String(i===currentDay));button.tabIndex=i===currentDay?0:-1});
 $('#day-panel').setAttribute('aria-labelledby',`day-tab-${currentDay+1}`);
 $('#day-location').textContent=d.location;$('#day-title').innerHTML=d.title;$('#day-copy').textContent=d.copy;
 $('#day-note').replaceChildren();const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';$('#day-note').append(arrow,document.createTextNode(d.note));
 $('#day-image').src=`assets/${d.image}.webp`;$('#day-image').alt=d.alt;
 $('.day-number').textContent=String(currentDay+1).padStart(2,'0');
 $('#next-day').innerHTML=currentDay===5?'Вернуться к началу <span aria-hidden="true">↺</span>':'Следующий день <span aria-hidden="true">→</span>';
 if(focus) $(`#day-tab-${currentDay+1}`).focus({preventScroll:true});
 if(innerWidth<761){const btn=$(`#day-tab-${currentDay+1}`),container=$('.route-tabs');container.scrollTo({left:btn.offsetLeft-container.offsetLeft-20,behavior:noMotion?'auto':'smooth'})}
}
$$('.route-tabs button').forEach((button,i)=>{
 button.addEventListener('click',()=>selectDay(i));
 button.addEventListener('keydown',e=>{let n;if(e.key==='ArrowRight')n=currentDay+1;if(e.key==='ArrowLeft')n=currentDay-1;if(e.key==='Home')n=0;if(e.key==='End')n=5;if(n!==undefined){e.preventDefault();selectDay(n,true)}});
});
$('#next-day').addEventListener('click',()=>selectDay(currentDay+1));
// Preload the next itinerary photo only when its section is near the viewport.
const routeObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){days.forEach(d=>{const img=new Image();img.src=`assets/${d.image}.webp`});routeObserver.disconnect()}},{rootMargin:'500px'});routeObserver.observe($('#route'));
$$('details').forEach(el=>el.addEventListener('toggle',requestTick));
})();
