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

// The Results screen is a persistent weekly card, never an ordinary popup.
const resultRoot={innerHTML:""};
document.getElementById=id=>id==="sec-fun-results"?resultRoot:null;
window.SEC_NEXT={weekStats:()=>({wins:3,losses:1,pushes:0,items:[]})};
window.SEC_BRIDGE.week=()=>({num:7,games:[{id:"a"},{id:"b"},{id:"c"},{id:"d"}]});
m.onView("results");
assert.match(resultRoot.innerHTML,/data-fun-next/,"Results recap has an Another roast button");
assert.match(resultRoot.innerHTML,/data-fun-share/,"Results recap has a Share button");
assert.match(resultRoot.innerHTML,/3<\/b><small>RIGHT/,"real scored picks show on card");
assert.match(resultRoot.innerHTML,/1<\/b><small>WRONG/);
assert.match(resultRoot.innerHTML,/75%<\/b><small>ACCURACY/);
assert.match(resultRoot.innerHTML,/No surprise highlight pop-ups/,"opt-out still available");
const pinned=m.cardVerdict();
m.onView("results");
assert.equal(m.cardVerdict().title,pinned.title,"same saying when reopening Results");
m.anotherRoast();
const rotated=m.cardVerdict();
assert.notEqual(rotated.title,pinned.title,"Another roast immediately gets a new one");
assert.ok(resultRoot.innerHTML.includes(rotated.title.replace(/&/g,"&amp;").replace(/</g,"&lt;")),
 "new quote is visible in the Results card");
// Remains pinned after a simulated reload.
const freshWindow={SEC_BRIDGE:{view:()=>null,week:()=>({num:7,games:[]})},
 SEC_NEXT:{weekStats:()=>({wins:3,losses:1,pushes:0,items:[]})},
 secOnline:{getUser:()=>null}};
vm.runInNewContext(src,{window:freshWindow,document,localStorage:storage,URL,Date,Number,Promise,console});
assert.equal(freshWindow.SEC_FAN_MOMENTS.cardVerdict().title,rotated.title,
 "the user does not consume a new joke by restarting the app");
assert.match(resultRoot.innerHTML,/data-fun-next/);
assert.equal(store.has("sec-roast-card-v1:device|local|7"),true);
// Special pop-ups require actual extraordinary results, never an average recap.
assert.equal(m.milestone(m.grade(3,1)),null,"normal weeks do not trigger an interruption");
window.SEC_FEATURES={finalData:()=>({winner:"verified"})};
window.SEC_BRIDGE.week=()=>({num:7,games:[{id:1},{id:2},{id:3},{id:4},{id:5}]});
window.SEC_NEXT.weekStats=()=>({wins:5,losses:0,items:[]});
assert.equal(m.milestone(m.grade(5,0)).id,"perfect-week",
 "perfect-week highlight only uses final-verified schedule");
window.SEC_FEATURES.finalData=()=>null;
assert.equal(m.milestone(m.grade(5,0)),null,
 "incomplete week is not falsely called a perfect week");
window.SEC_FEATURES.finalData=()=>({winner:"verified"});
assert.equal(m.milestone(m.grade(0,5)).id,"rough-week",
 "exceptional poor completed weeks qualify for the optional roast popup");
window.SEC_FEATURES.finalData=()=>null;
window.SEC_NEXT.weekStats=()=>({wins:3,losses:2,items:[{kind:"won",g:{id:"verified-upset"}}]});
window.SEC_LEAGUE_INSIGHTS={upset:()=>({label:"⚡ UNDERDOG WIN"})};
assert.equal(m.milestone(m.grade(3,2)).id,"called-upset","sourced upset is a special moment");
window.SEC_LEAGUE_INSIGHTS={upset:()=>null};
assert.equal(m.milestone(m.grade(3,2)),null,"no fake upset milestones");


const counts=m.roastCounts();
assert.deepEqual({...counts},{fire:12,great:12,okay:12,rough:12,roast:12},
 "every performance tier has twelve original roasts");
const kinds=Object.keys(counts);
for(const kind of kinds){
 // Card persistence tests already consume quotes; start the independent deck
 // exhaustion test from a clean, controlled fixture.
 store.delete("sec-roast-deck-v1:device:"+kind);
 const firstCycle=Array.from({length:counts[kind]},()=>m.rotateRoast(kind));
 assert.equal(new Set(firstCycle.map(x=>x.title)).size,counts[kind],
  kind+" has no repeats before the deck is exhausted");
 const end=firstCycle.at(-1).title,again=m.rotateRoast(kind);
 assert.notEqual(again.title,end,kind+" does not repeat at deck boundaries");
 assert.ok(firstCycle.every(x=>x.body&&x.title&&x.kind===kind));
 // A new script instance with the same storage continues its previous rotation.
 const another={SEC_BRIDGE:{view:()=>null},secOnline:{getUser:()=>null}};
 vm.runInNewContext(src,{window:another,document,localStorage:storage,URL,Date,Number,Promise,console});
 const continued=another.SEC_FAN_MOMENTS.rotateRoast(kind);
 assert.notEqual(continued.title,again.title,kind+" persists across app restarts");
}
// Changing accounts must not mix the last-seen state with another user's deck.
const isolated={SEC_BRIDGE:{view:()=>null},secOnline:{getUser:()=>({id:"test-user"})}};
vm.runInNewContext(src,{window:isolated,document,localStorage:storage,URL,Date,Number,Promise,console});
const chosen=isolated.SEC_FAN_MOMENTS.rotateRoast("rough");
assert.equal(store.has("sec-roast-deck-v1:test-user:rough"),true,"signed-in rotation is account scoped");
assert.ok(chosen.title);
assert.equal(store.has("sec-roast-deck-v1:device:rough"),true);
assert.match(src,/data-fun-again/,"users can request a fresh saying right away");
assert.match(src,/latestVerdict/,"share matches the displayed roast");
assert.match(html,/sec-fan-moments\.js\?v=20261014-fun-v3/);
assert.match(read("sw.js"),/sec-fan-moments\.js\?v=20261014-fun-v3/);

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
