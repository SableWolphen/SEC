/*
 * SEC Pick'Em — cinematic interactive champion sculptures.
 * Purely visual enhancement: no API/database writes or trophy eligibility changes.
 * Three.js is loaded only when a champion card is visible; existing SVG art remains
 * as an accessible fallback if WebGL or the optional CDN cannot load.
 */
(()=>{
"use strict";
const SPORTS=new Set(["football","basketball","baseball"]);
const SOURCE="https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
const instances=new Set(), queued=new WeakSet(), preserved=new Map();
let threePromise=null,observer=null,resizeObserver=null,libraryFailed=false;
const mobile=()=>!!window.matchMedia?.("(pointer: coarse)")?.matches||window.innerWidth<=790;
/* Trophy Room data updates rebuild the surrounding cards. Preserve the art
 * nodes (and therefore their GPU contexts and drag listeners) across renders. */
function beforeRender(root){
 if(!root)return;
 for(const stage of root.querySelectorAll(".museum-art[data-champion-sport]")){
  const sport=stage.dataset.championSport;
  if(!SPORTS.has(sport))continue;
  const previous=preserved.get(sport);
  if(previous&&previous!==stage){
   const old=[...instances].find(i=>i.stage===previous);
   if(old)dispose(old);
  }
  preserved.set(sport,stage);
  stage.remove();
 }
}
function restore(root){
 for(const replacement of root.querySelectorAll(".museum-art[data-champion-sport]")){
  const sport=replacement.dataset.championSport;
  const original=preserved.get(sport);
  if(!original||original.isConnected)continue;
  // Keep the artwork but use the latest authorized locked/earned state.
  original.querySelector(".museum-lock")?.remove();
  const lock=replacement.querySelector(".museum-lock");
  if(lock)original.append(lock);
  replacement.replaceWith(original);
  const instance=[...instances].find(i=>i.stage===original);
  if(instance)instance.visible=true;
  preserved.delete(sport);
 }
 for(const original of preserved.values()){
  const entry=[...instances].find(i=>i.stage===original);
  if(entry)dispose(entry);
 }
 preserved.clear();
}
const reduced=()=>!!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
function library(){
 if(libraryFailed)return Promise.reject(new Error("3D renderer unavailable for this session"));
 if(!threePromise)threePromise=import(SOURCE).catch(err=>{
  libraryFailed=true;
  throw err;
 });
 return threePromise;
}
function texture(THREE,mode){
 const c=document.createElement("canvas");c.width=256;c.height=256;
 const g=c.getContext("2d");if(!g)return null;
 const light=mode==="baseball"?"#f1e8d2":mode==="basketball"?"#bb722d":"#b17b31";
 g.fillStyle=light;g.fillRect(0,0,256,256);
 let seed=mode==="baseball"?12931:mode==="basketball"?21933:43892;
 for(let i=0;i<2800;i++){
  seed=(seed*1664525+1013904223)>>>0;const x=seed%256;
  seed=(seed*1664525+1013904223)>>>0;const y=seed%256;
  const a=(i%4)*.022+.025;
  g.fillStyle="rgba(55,29,7,"+a.toFixed(3)+")";
  g.fillRect(x,y,mode==="baseball"?1:2,mode==="baseball"?1:2);
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.anisotropy=2;
 return t;
}
function decal(THREE,label,opts={}){
 const c=document.createElement("canvas");c.width=512;c.height=160;
 const g=c.getContext("2d");
 g.clearRect(0,0,512,160);
 if(opts.backing){
  g.fillStyle="#111d29";g.fillRect(0,0,512,160);
  g.lineWidth=9;g.strokeStyle="#e7b75e";g.strokeRect(7,8,498,144);
 }
 g.font=(opts.size||82)+"px Georgia, serif";g.textAlign="center";g.textBaseline="middle";
 g.fillStyle="#ffe6a4";g.shadowColor="#fbd17b88";g.shadowBlur=6;g.fillText(label,256,85);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 return t;
}
function model(THREE,sport){
 const root=new THREE.Group();
 const gold=new THREE.MeshStandardMaterial({color:0xe2a947,metalness:.83,roughness:.23});
 const bright=new THREE.MeshStandardMaterial({color:0xffdc8a,metalness:.78,roughness:.19});
 const copper=new THREE.MeshStandardMaterial({color:0x9e6325,metalness:.7,roughness:.3});
 const edge=new THREE.MeshStandardMaterial({color:0x37271b,metalness:.7,roughness:.38});
 const midnight=new THREE.MeshStandardMaterial({color:0x0e1b2b,metalness:.28,roughness:.29});
 const white=new THREE.MeshStandardMaterial({color:0xf3e5c7,metalness:.12,roughness:.45});
 const red=new THREE.MeshStandardMaterial({color:0xac3239,metalness:.18,roughness:.5});
 const add=(geo,mat,parent=root)=>{const m=new THREE.Mesh(geo,mat);parent.add(m);return m;};
 const cyl=(r1,r2,h,y,mat,segments=60)=>{const a=add(new THREE.CylinderGeometry(r1,r2,h,segments),mat);a.position.y=y;return a;};
 const box=(w,h,d,y,mat)=>{const a=add(new THREE.BoxGeometry(w,h,d),mat);a.position.y=y;return a;};
 const tube=(points,r,material,parent=root)=>add(new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(14,points.length*6),r,9,false),material,parent);
 // Black-marble pedestal with realistic metallic trim.
 const plinth=box(2.18,.21,1.35,.11,midnight);
 box(2.23,.045,1.39,.245,bright);
 box(1.9,.28,1.16,.41,midnight);
 box(1.97,.075,1.21,.575,gold);
 cyl(.69,.78,.25,.74,gold);
 cyl(.61,.69,.052,.896,bright);
 cyl(.4,.54,.24,1.035,gold);
 cyl(.39,.4,.05,1.18,bright);
 // Championship plaque, front-facing and framed.
 const plate=box(1.28,.22,.045,.403,edge);
 plate.position.z=.616;
 const plaque=add(new THREE.PlaneGeometry(1.17,.19),new THREE.MeshBasicMaterial({
  map:decal(THREE,"CHAMPION",{backing:true,size:66}),transparent:true,depthWrite:false
 }));
 plaque.position.set(0,.404,.645);
 // Curling 3D arms, each independent tube to catch specular highlights.
 for(const side of [-1,1]){
  tube([[side*.42,1.17,0],[side*.83,1.42,.01],[side*1.0,1.78,0],[side*.93,2.16,0],[side*.72,2.41,0]],.092,gold);
  tube([[side*.45,1.19,.115],[side*.85,1.52,.105],[side*.96,1.98,.105],[side*.77,2.4,.105]],.026,bright);
 }
 // Round SEC seal applied to the front body.
 const medallion=add(new THREE.CylinderGeometry(.325,.325,.075,64),gold);
 medallion.rotation.x=Math.PI/2;medallion.position.set(0,1.26,.47);
 const medallionFace=add(new THREE.CircleGeometry(.28,64),midnight);
 medallionFace.position.set(0,1.26,.518);
 const badge=add(new THREE.PlaneGeometry(.52,.25),new THREE.MeshBasicMaterial({
  map:decal(THREE,"SEC",{size:103}),transparent:true,depthWrite:false
 }));
 badge.position.set(0,1.25,.525);
 // Sport-specific textured balls with 3D geometry, seams and stitching.
 const ball=new THREE.Group();root.add(ball);ball.position.y=2.37;
 const material=sport==="baseball"?
  new THREE.MeshStandardMaterial({color:0xfff3db,map:texture(THREE,sport),metalness:.12,roughness:.64}):
  new THREE.MeshStandardMaterial({color:sport==="basketball"?0xc08a37:0xd6a13e,
   map:texture(THREE,sport),metalness:.6,roughness:.37});
 if(sport==="football"){
  const oval=add(new THREE.SphereGeometry(.8,56,40),material,ball);
  oval.scale.set(.74,1.37,.82);
  ball.rotation.z=-.42;ball.rotation.y=-.19;
  // End rings and gold raised laces.
  for(const y of [-.78,.78]){
   const seam=add(new THREE.TorusGeometry(.37,.023,8,56),bright,ball);
   seam.rotation.x=Math.PI/2;seam.position.y=y;
  }
  tube([[-.013,-.43,.62],[0,-.2,.67],[0,.08,.67],[0,.38,.62]],.025,white,ball);
  for(const y of [-.31,-.18,-.05,.08,.21,.34]){
   tube([[-.13,y,.646],[0,y,.69],[.13,y,.646]],.024,white,ball);
  }
 }else if(sport==="basketball"){
  add(new THREE.SphereGeometry(.86,56,42),material,ball);
  const seamMat=new THREE.MeshStandardMaterial({color:0x4c311f,metalness:.3,roughness:.66});
  for(const v of [0,Math.PI/2]){
   const ring=add(new THREE.TorusGeometry(.866,.021,9,88),seamMat,ball);
   ring.rotation.y=v;
  }
  const horizontal=add(new THREE.TorusGeometry(.869,.023,9,88),seamMat,ball);
  horizontal.rotation.x=Math.PI/2;
  for(const side of [-1,1]){
   const arr=[];
   for(let i=0;i<=30;i++){
    const t=i/30*Math.PI-.5*Math.PI, y=.83*Math.sin(t), x=side*(.28+.14*Math.cos(t));
    const z=Math.sqrt(Math.max(.001,.86**2-x*x-y*y))+.008;
    arr.push([x,y,z]);
   }
   tube(arr,.019,seamMat,ball);
  }
 }else{
  add(new THREE.SphereGeometry(.86,64,48),material,ball);
  for(const side of [-1,1]){
   const seam=[],other=[];
   for(let i=0;i<=36;i++){
    const t=-1.27+(2.54*i/36),y=.8*Math.sin(t);
    const x=side*(.40+.085*Math.cos(t*2));
    const z=Math.sqrt(Math.max(.006,.86**2-x*x-y*y))+.007;
    seam.push([x,y,z]);
    if(i%2===0){
     tube([[x-side*.067,y-.025,z+.004],[x,y,z+.017],[x+side*.073,y+.024,z+.004]],.013,red,ball);
    }
   }
   tube(seam,.019,red,ball);
  }
 }
 // Tilt slightly toward the user: keeps sport texture and side handles visible.
 root.rotation.y=-.16;root.position.y=-.18;
 return root;
}
async function mount(stage){
 if(!stage?.isConnected||!SPORTS.has(stage.dataset.championSport)||
  ["pending","ready","fallback"].includes(stage.dataset.trophy3d))return;
 stage.dataset.trophy3d="pending";
 try{
  const THREE=await library();
  if(!stage.isConnected){stage.dataset.trophy3d="idle";return;}
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(32,1,.1,50);
  camera.position.set(4.1,2.8,7.6);camera.lookAt(0,1.43,0);
  const modelRoot=model(THREE,stage.dataset.championSport);scene.add(modelRoot);
  scene.add(new THREE.AmbientLight(0xffdfb0,1.25));
  const lights=[
   [0xffdc9a,120,-3,5,4],[0xffffff,115,3,4,2],[0xe69d3b,70,0,1,-4],[0x76b2ee,32,-2,2,-3]
  ];
  for(const [col,power,x,y,z]of lights){
   const l=new THREE.PointLight(col,power);l.position.set(x,y,z);scene.add(l);
  }
  let renderer;
  try{
   renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"});
  }catch(err){throw new Error("WebGL unavailable: "+err.message);}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.42;
  renderer.setClearColor(0x0c1c2a,0);
  renderer.domElement.className="museum-champion-canvas";
  renderer.domElement.setAttribute("role","img");
  renderer.domElement.setAttribute("aria-label",stage.dataset.championSport+" rotating three-dimensional championship trophy");
  const holder=document.createElement("div");holder.className="museum-champion-canvas-holder";
  holder.append(renderer.domElement);
  const w=()=>{const rect=stage.getBoundingClientRect();const w=Math.max(70,Math.round(rect.width)),h=Math.max(90,Math.round(rect.height));
   renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  };
  stage.append(holder);w();
  const entry={stage,scene,camera,renderer,holder,modelRoot,frame:0,visible:true,last:0,dragging:false,spin:0,staticMode:mobile()||reduced()};
  instances.add(entry);stage.dataset.trophy3d="ready";
  if(window.ResizeObserver){
   if(!resizeObserver)resizeObserver=new window.ResizeObserver(entries=>{
    for(const item of entries){const instance=[...instances].find(i=>i.stage===item.target);
     if(instance?.stage.isConnected){const r=instance.stage.getBoundingClientRect();
      instance.renderer.setSize(Math.max(70,r.width),Math.max(90,r.height),false);
      instance.camera.aspect=Math.max(70,r.width)/Math.max(90,r.height);instance.camera.updateProjectionMatrix();
     }}
   });
   resizeObserver.observe(stage);
  }
  // Drag-to-rotate is available on locked cards too, without unlocking them.
  const start=e=>{entry.dragging=true;entry.pointerX=e.clientX;};
  const drag=e=>{if(!entry.dragging)return;const dx=e.clientX-entry.pointerX;entry.pointerX=e.clientX;
   entry.spin+=dx*.012;modelRoot.rotation.y=-.16+entry.spin;
   if(entry.staticMode)renderer.render(scene,camera);};
  const end=()=>{entry.dragging=false;};
  renderer.domElement.addEventListener("pointerdown",start,{passive:true});
  renderer.domElement.addEventListener("pointermove",drag,{passive:true});
  renderer.domElement.addEventListener("pointerup",end);
  renderer.domElement.addEventListener("pointercancel",end);
  renderer.domElement.addEventListener("pointerleave",end);
  renderer.domElement.addEventListener("webglcontextlost",e=>{
   e.preventDefault();
   // On resource-constrained devices, use the stable SVG instead of flickering.
   stage.classList.remove("museum-has-3d");
   stage.dataset.trophy3d="fallback";
   dispose(entry);
  },{once:true});
  // First paint BEFORE switching off the SVG prevents a blank frame on Android.
  renderer.render(scene,camera);
  stage.classList.add("museum-has-3d");
  const frame=time=>{
   if(!stage.isConnected){dispose(entry);return;}
   if(!entry.visible||document.visibilityState==="hidden"){
    if(!entry.staticMode)entry.frame=requestAnimationFrame(frame);
    return;
   }
   if(time-entry.last>40||entry.staticMode){
    entry.last=time;
    if(!entry.dragging&&!entry.staticMode){
     entry.spin+=.0017;modelRoot.rotation.y=-.16+entry.spin;
    }
    renderer.render(scene,camera);
   }
   if(!entry.staticMode)entry.frame=requestAnimationFrame(frame);
  };
  if(!entry.staticMode)entry.frame=requestAnimationFrame(frame);
 }catch(err){
  // Surface art remains intact and accessible; do not interfere with trophy scoring.
  if(stage?.dataset)stage.dataset.trophy3d="fallback";
  console.info("3D champion art unavailable; using SVG fallback:",String(err?.message||err));
 }
}
function dispose(item){
 cancelAnimationFrame(item.frame);
 resizeObserver?.unobserve(item.stage);
 item.stage.classList.remove("museum-has-3d");
 if(item.stage.dataset.trophy3d==="ready")item.stage.dataset.trophy3d="idle";
 item.modelRoot.traverse(obj=>{obj.geometry?.dispose?.();
  const mats=Array.isArray(obj.material)?obj.material:[obj.material];
  for(const mat of mats){mat?.map?.dispose?.();mat?.dispose?.();}
 });
 try{item.renderer.dispose();}catch{}
 item.holder.remove();instances.delete(item);
}
function enhance(root){
 if(!root)return;
 restore(root);
 for(const old of [...instances])if(!old.stage.isConnected)dispose(old);
 if(!observer&&window.IntersectionObserver){
  observer=new window.IntersectionObserver(items=>{
   for(const item of items){
    const stage=item.target;
    if(!stage.isConnected)continue;
    if(item.isIntersecting){
     const prev=[...instances].find(i=>i.stage===stage);
     if(prev)prev.visible=true;
     else if(stage.dataset.trophy3d!=="fallback")void mount(stage);
    }else{
     const prev=[...instances].find(i=>i.stage===stage);
     if(prev)prev.visible=false;
    }
   }
  },{rootMargin:"100px"});
 }
 for(const stage of root.querySelectorAll(".museum-art[data-champion-sport]")){
  if(!SPORTS.has(stage.dataset.championSport)||queued.has(stage))continue;
  queued.add(stage);
  if(observer)observer.observe(stage);else void mount(stage);
 }
}
window.SEC_CHAMPION_3D=Object.freeze({beforeRender,enhance});
})();