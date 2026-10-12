/* Whole-app visual contract, without touching player data or scoring. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const html=read("index.html"),css=read("sec-design-system.css"),
 sports=read("multi-sport.css"),football=read("sec-final-cards.css"),
 museum=read("trophy-case.js"),manifest=JSON.parse(read("manifest.webmanifest")),
 sw=read("sw.js"),icon=read("icon.svg");
const paths=["home","team-hub","game-center","results","team-news","sports","picks","basketball","baseball","league","trophies","news","teams","more","settings"];
const selected=html.match(/<link rel="stylesheet" href="[^"]+"/g)||[];
assert.equal(selected.at(-3),'<link rel="stylesheet" href="./sec-design-system.css?v=20261011-broadcast-v1"',
 "broadcast design tokens must load before the approved stadium skin");
assert.equal(selected.at(-2),'<link rel="stylesheet" href="./sds-showcase.css?v=20261011-unified-v2"',
 "approved ten-screen visual layer must load last");
assert.match(css,/--sds-gold:#f0c775/);
assert.match(css,/--sds-panel:#112538/);
assert.match(css,/--sds-success:#8ed0ae/);
assert.match(css,/--sds-error:#f6a0a1/);
assert.match(css,/--sds-radius:15px/);
assert.match(css,/@media\(max-width:790px\)/);
assert.match(css,/@media\(max-width:540px\)/);
assert.match(css,/@media\(max-width:365px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/:focus-visible/);
assert.match(css,/env\(safe-area-inset-bottom\)/);
assert.ok(css.includes(".brand-title>span")&&css.includes(".mobile-nav-btn.active"),
 "brand and mobile active nav have dedicated gold treatment");
for(const id of paths){
 assert.ok(html.includes('id="'+id+'-view"'),"all prior routes remain intact: "+id);
 if(id!=="home"&&!["team-hub","game-center","results","team-news"].includes(id))
  assert.ok(css.includes("#"+id+"-view"),"design system intentionally styles "+id);
 if(["team-hub","game-center","results","team-news"].includes(id))
  assert.ok(read("sec-premium.css").includes("#"+id+"-view"),"premium styling covers "+id);
}
for(const file of ["index.html","multi-sport.css","sec-final-cards.css","trophy-case.js"]){
 const source=read(file);
 for(const neon of ["#d7fa65","#d5ff65","#d6fa63","#d8ff64"]){
  assert.ok(!source.toLowerCase().includes(neon),"stale neon accent in "+file+" "+neon);
 }
}
assert.match(icon,/#f0c775/,"app logo uses the same brand accent");
assert.equal(manifest.name,"Saturdays Down South — SEC Pick'em",
 "preserve established app name");
assert.equal(manifest.theme_color,"#081321");
assert.equal(manifest.background_color,"#081321");
assert.match(html,/<meta name="theme-color" content="#081321"/);
assert.match(sw,/sec-pickem-v103/,"new cache version reaches Android installs");
assert.match(sw,/sec-design-system\.css\?v=20261011-broadcast-v1/,
 "offline PWA pre-caches shared design system");
for(const file of ["multi-sport.css","sec-final-cards.css","trophy-case.js"]){
 const ver=file==="trophy-case.js"?"20261011-neutral-v1":"20261011-broadcast-v1";
 assert.ok(html.includes("./"+file+"?v="+ver),"web loads latest "+file);
 assert.ok(sw.includes("./"+file+"?v="+ver),"offline cache recognizes latest "+file);
}
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,
 "design stylesheet has balanced rule blocks");
const noDB=/\bsupabase\b\s*\.\s*(?:from|rpc|auth)\s*\(|\.insert\(|\.update\(|\.delete\(/;
assert.ok(!noDB.test(css),"CSS cannot change accounts or scores");
console.log("SDS Broadcast UI system: all 15 views, navy/gold tokens, branding, mobile fit, PWA, accessibility PASS");
