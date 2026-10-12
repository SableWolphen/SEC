/* Lightweight safety checks for cinematic 3D championship enhancement. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const moduleText=fs.readFileSync("sec-champion-3d.js","utf8");
const museum=fs.readFileSync("trophy-museum.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const styles=fs.readFileSync("sec-champion-3d.css","utf8");
const worker=fs.readFileSync("sw.js","utf8");
new vm.Script(moduleText,{filename:"sec-champion-3d.js"});
const observed=[];
let observerCount=0;
class Observer{
 constructor(fn){this.callback=fn;observerCount++;}
 observe(el){observed.push(el);}
}
const context={
 window:{IntersectionObserver:Observer},
 document:{},console
};
vm.runInNewContext(moduleText,context);
const manager=context.window.SEC_CHAMPION_3D;
assert.equal(typeof manager?.enhance,"function","3D card enhancer exported");
const football={dataset:{championSport:"football"},isConnected:true};
const basketball={dataset:{championSport:"basketball"},isConnected:true};
const baseball={dataset:{championSport:"baseball"},isConnected:true};
const other={dataset:{championSport:"soccer"},isConnected:true};
const root={querySelectorAll:()=>[football,basketball,baseball,other]};
manager.enhance(root);manager.enhance(root);
assert.equal(observerCount,1,"one observer handles lazy-loaded models");
assert.equal(observed.length,3,"the three SEC sports register only once");
assert.equal(new Set(observed).size,3,"no duplicate lazy loading");
assert.equal(typeof manager.beforeRender,"function","3D canvas preservation hook is available");
for(const stage of [football,basketball,baseball]){
 stage.remove=function(){this.isConnected=false;};
 stage.querySelector=()=>null;
 stage.append=()=>{};
}
manager.beforeRender(root);
assert.ok([football,basketball,baseball].every(s=>!s.isConnected),
 "old art is temporarily detached, not destroyed");
const replacements=[football,basketball,baseball].map(old=>({
 dataset:{championSport:old.dataset.championSport},isConnected:true,querySelector:()=>null,
 replaceWith(stage){stages[stages.indexOf(this)]=stage;stage.isConnected=true;this.isConnected=false;}
}));
const stages=[...replacements];
const freshRoot={querySelectorAll:()=>stages};
manager.enhance(freshRoot);
assert.equal(stages[0],football,"football 3D surface stays the exact same element");
assert.equal(stages[1],basketball,"basketball 3D surface stays the exact same element");
assert.equal(stages[2],baseball,"baseball 3D surface stays the exact same element");
assert.equal(observed.length,3,"refresh must not start extra WebGL mounts");
assert.match(moduleText,/staticMode:mobile\(\)\|\|reduced\(\)/,
 "phones must avoid constant GPU redraws");

assert.match(moduleText,/WebGLRenderer/,"real 3D rendering must be used");
assert.match(moduleText,/SphereGeometry/,"sports balls are modeled geometrically");
assert.match(moduleText,/TubeGeometry/,"3D trophy details are modeled");
assert.match(moduleText,/pointermove/,"people can turn a 3D trophy");
assert.match(moduleText,/model\.traverse|modelRoot\.traverse/,"old scenes are disposed safely");
assert.match(moduleText,/museum-trophy-svg|using SVG fallback|SVG fallback/,"SVG fallback is retained");
assert.doesNotMatch(moduleText,/\.from\(|\.rpc\(|\.functions\.invoke\(/,"visual layer must never access the database");
assert.match(museum,/data-champion-sport/,"championship cards need per-sport 3D mounts");
assert.match(museum,/SEC_CHAMPION_3D\?\.enhance/,"museum must activate 3D renderer");
for(const [file,version] of [
 ["sec-champion-3d.js","20261011-engraved-v1"],
 ["trophy-case.js","20261011-neutral-v1"],
 ["sec-champion-3d.css","20261011-cinematic-v1"]
]){
 assert.ok(html.includes("./"+file+"?v="+version),"app loads "+file);
 assert.ok(worker.includes("./"+file+"?v="+version),"offline cache recognizes "+file);
}
assert.match(worker,/sec-pickem-v108/,"service worker cache must invalidate old 3D trophy assets");
assert.ok(html.includes("./trophy-museum.js?v=20261011-neutral-v1"),"new engraved SVG card script loaded");
assert.ok(worker.includes("./trophy-museum.js?v=20261011-neutral-v1"),"offline cache includes engraved card script");
assert.match(styles,/museum-champion-canvas/,"3D drawing surface styled");
assert.match(styles,/@media\(max-width:375px\)/,"small phones remain supported");
console.log("Cinematic 3D champion trophy smoke checks passed.");