/* Offline/PWA cache must precache exactly the asset versions index.html loads. */
"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const html=fs.readFileSync("index.html","utf8"),sw=fs.readFileSync("sw.js","utf8");
const page=new Map([...html.matchAll(/(?:src|href)="\.\/([\w.-]+\.(?:js|css))\?v=([^"]+)"/g)].map(m=>[m[1],m[2]]));
const core=(sw.match(/const CORE=\[([\s\S]*?)\];/)||[])[1];
assert.ok(core,"service worker CORE list found");
const cached=new Map([...core.matchAll(/"\.\/([\w.-]+\.(?:js|css))(?:\?v=([^"]*))?"/g)].map(m=>[m[1],m[2]||""]));
const problems=[];
for(const [file,version] of page){
 if(!cached.has(file))problems.push(file+" is loaded by the page but not precached in sw.js");
 else if(cached.get(file)!==version)problems.push(file+": sw.js caches v="+cached.get(file)+" but the page loads v="+version);
}
assert.deepEqual(problems,[],"Update the CORE list in sw.js:\n"+problems.join("\n"));
console.log("PASS: sw.js precaches all "+page.size+" versioned page assets");
