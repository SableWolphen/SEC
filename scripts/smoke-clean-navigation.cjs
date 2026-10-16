"use strict";
const fs=require("node:fs");
const assert=require("node:assert/strict");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const home=fs.readFileSync(path.join(root,"sec-home.js"),"utf8");
const app=fs.readFileSync(path.join(root,"multi-sport.js"),"utf8");
const desktop=html.match(/<nav class="desktop-nav"[\s\S]*?<\/nav>/)?.[0]||"";
const mobile=html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0]||"";
for(const bar of [desktop,mobile]){
 const destinations=[...bar.matchAll(/data-nav="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(destinations,["home","current-sport","league","game-center","settings"]);
}
for(const route of ["game-center","settings","league"]){
 assert.match(html,new RegExp("'"+route+"'"));
}
assert.match(home,/MAKE PICKS/);
assert.match(home,/LEAGUE RACE/);
assert.match(home,/LIVE SCORES/);
assert.match(app,/Pick saved securely online/);
assert.match(app,/sport-schedule-health/);
console.log("PASS: five-tab navigation, primary home actions, pick save confirmation and schedule health");
