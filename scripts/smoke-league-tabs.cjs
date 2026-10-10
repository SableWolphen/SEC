"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const h=fs.readFileSync("index.html","utf8"),js=fs.readFileSync("league-tabs.js","utf8");
for(const value of ["fan-league-tabs","fan-pane-scores","fan-pane-chat","fan-pane-brags","fan-pane-more","fan-league-chat-content","fan-league-club-manager","fan-league-football-manager"])
 assert.ok(h.includes('id="'+value+'"'),"Missing tab mount "+value);
assert.match(js,/actual\?\.id===item\.id/,"chat must belong to selected football league");
assert.match(js,/relocate\("league-content",".sec-scoreboard-chat"/,"chat leaves long scoreboard view");
assert.doesNotMatch(js,/trimClub\(\)|trimFootball\(\)/,"all players visible by default");
assert.match(js,/queueMicrotask/,"refresh relocation coalesces without polling");
console.log("League tabs regression passed: isolated panels, guarded chat, compact scoreboards and retained management.");
