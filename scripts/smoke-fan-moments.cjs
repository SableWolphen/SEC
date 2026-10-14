"use strict";
/* Source-backed honors and optional lighthearted graded-pick verdict. */
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8"),src=read("sec-fan-moments.js"),html=read("index.html");
new vm.Script(src,{filename:"sec-fan-moments.js"});
const listeners={},store=new Map();
const document={
 addEventListener:(name,fn)=>listeners[name]=fn,
 getElementById:()=>null,
 visibilityState:"visible",
};
const window={SEC_BRIDGE:{view:()=>null},secOnline:{getUser:()=>null}};
const storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
vm.runInNewContext(src,{window,document,localStorage:storage,URL,Date,Number,Promise,console});
const m=window.SEC_FAN_MOMENTS;
assert.ok(m,"moments surface exists");
assert.equal(m.grade(2,0).ready,false,"do not roast after only two finals");
assert.equal(m.grade(3,0).kind,"fire");
assert.equal(m.grade(4,1).kind,"great");
assert.equal(m.grade(2,2).kind,"okay");
assert.equal(m.grade(1,3).kind,"roast");
assert.equal(m.grade(0,4).kind,"roast");
assert.equal(m.grade(1,2).kind,"rough");
assert.equal(m.grade(3,0,2).judged,3,"pushes excluded from accuracy denominator");
assert.equal(m.grade(3,0,2).percent,100);
assert.equal(m.grade(0,0).ready,false,"no fake results");
assert.equal(m.safeUrl("https://www.secsports.com/news/2026/10/fake"),true);
assert.equal(m.safeUrl("javascript:alert(1)"),false);
assert.equal(m.safeUrl("https://www.secsports.com.evil.invalid/"),false);
assert.match(html,/id="sec-fun-results"/,"feedback accessible within Results");
assert.match(html,/id="sec-athlete-awards-root"/,"athlete honors accessible in News");
assert.match(html,/SEC_FAN_MOMENTS\?\.onView\?\.\(v\)/,"visible route hook");
assert.match(read("sec-power-rankings.js"),/SEC_FAN_MOMENTS\?\.leagueUI/,"weekly MVP refreshes after verified RPC");
assert.match(read("sec-fan-moments.css"),/@media\(prefers-reduced-motion:reduce\)/);
assert.match(read("sec-fan-moments.css"),/focus-visible/);
const awards=JSON.parse(read("sec-athlete-awards.json"));
assert.ok(awards.official.length>=5);
for(const a of awards.official){
 assert.ok(["football","basketball","baseball"].includes(a.sport));
 assert.ok(["week","year"].includes(a.period),"monthly award must not be called official without source");
 assert.ok(m.safeUrl(a.url),"external awards must come from SEC official site");
 assert.match(a.date,/^\d{4}-\d\d-\d\d$/);
 assert.ok(a.title);
}
assert.ok(awards.official.some(a=>a.period==="year"&&a.sport==="basketball"));
assert.ok(awards.official.some(a=>a.period==="year"&&a.sport==="baseball"));
assert.ok(awards.official.some(a=>a.period==="year"&&a.sport==="football"&&a.year===2025));
assert.ok(!awards.official.some(a=>a.period==="year"&&a.sport==="football"&&a.year===2026),
 "never announce 2026 football annual results before the season is over");
assert.ok(src.includes("This is personal to this device"),"monthly fan choice is never mislabeled as official");
assert.ok(src.includes("sec-fun-disabled"),"users can turn surprise popups off");
assert.ok(src.includes('view!=="results"'),"do not interrupt navigation with a roast");
assert.ok(!src.includes('.from("sec_league_picks")'),"no reads of private league picks");
console.log("SEC fan verdict and sourced athlete honors: verified scoring, opt-out, safe sources and unofficial monthly choices PASS");
