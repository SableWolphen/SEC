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
for(const label of ["Trophies","My Team","All Teams","Standings"]){
 assert.ok(home.includes(label),"Missing visible home link: "+label);
}
assert.match(home,/homeChats\(\)\+extraNews\(model\)/);
assert.match(home,/hq-calm-links/);
for(const label of ["News","Trophies","Scores","League & Chat","My Results","My Team","All Teams"]){
 assert.ok(home.includes(label),"Missing visible feature: "+label);
}
assert.match(home,/data-sec-find/);
assert.match(home,/hq-explore/);
assert.match(html,/class="sec-trophy-shortcut" data-nav="trophies"/);
assert.match(html,/id="trophies-view"/);
assert.match(html,/window\.SDSTrophyCase\?\.mount/);
assert.match(html,/sec-settings-shortcuts/);
assert.match(home,/Make my picks/);
assert.match(home,/function homeChats\(/);
assert.match(home,/data-hq-chat-league/);
assert.match(home,/data-hq-open-chat/);
assert.match(home,/sec_league_messages/);
assert.match(home,/getLeagues/);
assert.match(app,/(League|Personal) pick saved online/);
assert.match(app,/sport-schedule-health/);
console.log("PASS: five-tab navigation, primary home actions, pick save confirmation and schedule health");
