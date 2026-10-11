/* Copy web app into Capacitor's local bundle. Does NOT change the live website. */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const base=path.resolve(__dirname,"..");
const dir=path.join(base,"mobile-dist");
const extensions=new Set([".html",".css",".js",".json",".svg",".webmanifest"]);
fs.rmSync(dir,{recursive:true,force:true});
fs.mkdirSync(dir,{recursive:true});
const copied=[];
for(const entry of fs.readdirSync(base,{withFileTypes:true})){
 if(!entry.isFile()||!extensions.has(path.extname(entry.name)))continue;
 // package.json is tooling metadata, not part of the shipped mobile web bundle.
 if(entry.name==="package.json"||entry.name==="capacitor.config.ts")continue;
 fs.copyFileSync(path.join(base,entry.name),path.join(dir,entry.name));
 copied.push(entry.name);
}
const srcTrophies=path.join(base,"trophies");
if(fs.existsSync(srcTrophies)){
 fs.cpSync(srcTrophies,path.join(dir,"trophies"),{
  recursive:true,filter:file=>fs.statSync(file).isDirectory()||path.extname(file)===".glb"
 });
}
fs.copyFileSync(path.join(base,"mobile","mobile-bridge.js"),path.join(dir,"mobile-bridge.js"));
let html=fs.readFileSync(path.join(dir,"index.html"),"utf8");
assert(html.includes("</head>"),"Unexpected SEC index.html: missing head");
assert(html.includes("navigator.serviceWorker.register('./sw.js')"),"Unexpected service worker registration");
html=html.replace("if('serviceWorker'in navigator &&",
 "if(!window.Capacitor?.isNativePlatform?.() && 'serviceWorker'in navigator &&");
html=html.replace("</head>","<script defer src=\"./mobile-bridge.js\"></script>\n</head>");
fs.writeFileSync(path.join(dir,"index.html"),html);
console.log("Prepared mobile-dist: "+copied.length+" web files + local trophies and mobile bridge.");
