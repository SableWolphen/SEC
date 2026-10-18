"use strict";
/* Source-backed honors and optional lighthearted graded-pick verdict. */
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8"),src=read("sec-fan-moments.js"),html=read("index.html");
new vm.Script(src,{filename:"sec-fan-moments.js"});
const listeners={},store=new Map();
const htmlEscape=x=>String(x).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
let activeRoute="results";
const document={
 addEventListener:(name,fn)=>listeners[name]=fn,
 getElementById:()=>null,
 visibilityState:"visible",
};
const window={SEC_BRIDGE:{view:()=>activeRoute},secOnline:{getUser:()=>null}};
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
const globalRoot={innerHTML:"",hidden:true,dataset:{},removeAttribute(name){if(name==="data-signature")delete this.dataset.signature;}};
document.getElementById=id=>id==="sec-fun-results"?resultRoot:
 id==="sec-fun-global"?globalRoot:null;
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
assert.ok(resultRoot.innerHTML.includes(htmlEscape(rotated.title)),
 "new quote is visible in the Results card");
// Remains pinned after a simulated reload.
const freshWindow={SEC_BRIDGE:{view:()=>null,week:()=>({num:7,games:[]})},
 SEC_NEXT:{weekStats:()=>({wins:3,losses:1,pushes:0,items:[]})},
 secOnline:{getUser:()=>null}};
vm.runInNewContext(src,{window:freshWindow,document,localStorage:storage,URL,Date,Number,Promise,console});
assert.equal(freshWindow.SEC_FAN_MOMENTS.cardVerdict().title,rotated.title,
 "the user does not consume a new joke by restarting the app");
assert.match(resultRoot.innerHTML,/data-fun-next/);
assert.equal(store.has("sec-roast-card-v3:device"),true);
// The same visible quote follows the person between routed screens.
activeRoute="home";m.onView(activeRoute);
assert.equal(globalRoot.hidden,false,"roast ribbon persists on Home");
assert.match(globalRoot.innerHTML,/Full recap/);
assert.match(globalRoot.innerHTML,/data-fun-next/,"another-roast works from any screen");
const across=m.cardVerdict();
assert.ok(globalRoot.innerHTML.includes(htmlEscape(across.title)),
 "persistent ribbon displays same saved quote as Results");
activeRoute="picks";m.onView(activeRoute);
assert.equal(globalRoot.hidden,false,"roast ribbon persists while picking games");
assert.ok(globalRoot.innerHTML.includes(htmlEscape(across.title)));
activeRoute="league";m.onView(activeRoute);
assert.equal(globalRoot.hidden,false,"roast ribbon persists in League");
activeRoute="results";m.onView(activeRoute);
assert.equal(globalRoot.hidden,true,"full Results card replaces global compact ribbon");
assert.ok(resultRoot.innerHTML.includes(htmlEscape(across.title)));

// Past verified picks carry the same roast across new calendar weeks with no
// scored games, and the roast updates once a new final is actually confirmed.
const originalWeek=window.SEC_BRIDGE.week;
const originalRecent=window.SEC_NEXT.recentStats;
const past=(games)=>({
 source:"recent",limit:10,
 wins:games.filter(x=>x==="won").length,
 losses:games.filter(x=>x==="lost").length,
 pushes:games.filter(x=>x==="push").length,
 fingerprint:games.map((x,i)=>"verified-game-"+i+":"+x).join("|")
});
const historical=past(["won","won","lost","won","won"]);
window.SEC_NEXT.recentStats=()=>historical;
const baseline=m.cardVerdict();
assert.equal(baseline.ready,true);
assert.equal(baseline.source,"recent");
assert.equal(baseline.judged,5);
assert.equal(baseline.percent,80);
m.onView("results");
assert.match(resultRoot.innerHTML,/RECENT PICKS/);
assert.match(resultRoot.innerHTML,/5 verified graded picks/);
assert.match(resultRoot.innerHTML,/most recent 10 graded football picks/i);
assert.match(resultRoot.innerHTML,/update after the next verified final/i);
window.SEC_BRIDGE.week=()=>({num:8,games:[{id:"new",kickoff:"2026-10-15T20:00:00Z"}]});
window.SEC_NEXT.weekStats=()=>({wins:0,losses:0,pushes:0,items:[]});
m.onView("results");
assert.equal(m.cardVerdict().title,baseline.title,
 "roast is carried from past picks until newly graded games become available");
assert.match(resultRoot.innerHTML,/80%<\/b><small>ACCURACY/);
const updated=past(["won","won","lost","won","won","lost"]);
window.SEC_NEXT.recentStats=()=>updated;
const next=m.cardVerdict();
assert.equal(next.judged,6);
assert.equal(next.percent,67);
assert.notEqual(next.title,baseline.title,
 "new source-verified final refreshes the saying even within the same week");
const stable=m.cardVerdict();
assert.equal(stable.title,next.title,
 "no fresh verified results means no unnecessary roast rotation");
// If the authoritative score feed briefly has no data after a page transition,
// retain the last genuinely verified recap instead of blanking the banner.
window.SEC_NEXT.recentStats=()=>past([]);
activeRoute="home";m.onView(activeRoute);
const carried=m.cardVerdict();
assert.equal(carried.ready,true);
assert.equal(carried.source,"saved","cached VERIFIED pick data survives transient loading");
assert.equal(carried.percent,67);
assert.equal(carried.title,next.title,"no new verified scores means the message stays");
assert.equal(globalRoot.hidden,false);
assert.match(globalRoot.innerHTML,/LAST VERIFIED/);
activeRoute="results";m.onView(activeRoute);
assert.match(resultRoot.innerHTML,/Showing your saved, verified recap/);

window.SEC_NEXT.recentStats=originalRecent;
window.SEC_BRIDGE.week=originalWeek;

// Special pop-ups require actual extraordinary results, never an average recap.
assert.equal(m.milestone(),null,"normal weeks do not trigger an interruption");
window.SEC_FEATURES={finalData:()=>({winner:"verified"})};
window.SEC_BRIDGE.week=()=>({num:7,games:[{id:1},{id:2},{id:3},{id:4},{id:5}]});
window.SEC_NEXT.weekStats=()=>({wins:5,losses:0,items:[]});
assert.equal(m.milestone().id,"perfect-week",
 "perfect-week highlight only uses final-verified schedule");
window.SEC_FEATURES.finalData=()=>null;
assert.equal(m.milestone(),null,
 "incomplete week is not falsely called a perfect week");
window.SEC_FEATURES.finalData=()=>({winner:"verified"});
window.SEC_NEXT.weekStats=()=>({wins:0,losses:5,items:[]});
assert.equal(m.milestone().id,"rough-week",
 "exceptional poor completed weeks qualify for the optional roast popup");
window.SEC_FEATURES.finalData=()=>null;
window.SEC_NEXT.weekStats=()=>({wins:3,losses:2,items:[{kind:"won",g:{id:"verified-upset"}}]});
window.SEC_LEAGUE_INSIGHTS={upset:()=>({label:"⚡ UNDERDOG WIN"})};
assert.equal(m.milestone().id,"called-upset","sourced upset is a special moment");
window.SEC_LEAGUE_INSIGHTS={upset:()=>null};
assert.equal(m.milestone(),null,"no fake upset milestones");
// The recent-picks card can say "great" while a separate weekly highlight
// must rely strictly on this week's scored slate, not previous winners.
window.SEC_NEXT.recentStats=()=>historical;
window.SEC_NEXT.weekStats=()=>({wins:0,losses:5,items:[]});
window.SEC_FEATURES.finalData=()=>({winner:"verified"});
assert.equal(m.current().kind,"great");
assert.equal(m.milestone().id,"rough-week","special moments cannot misuse carried history");
window.SEC_NEXT.recentStats=originalRecent;




// Reproduce the recorded bug: a signed-in user's chosen league refreshes
// between routes but the personal results (and 57% roast) do not change.
const persisted=new Map();
persisted.set("sec-roast-card-v2:account-A|league-old",JSON.stringify({
 kind:"okay",fingerprint:"old-verified-picks",title:"THE EXCITEMENT IS MANDATORY",
 body:"Your right picks are arguing with your wrong picks, and somehow neither side is winning the argument.",
 stats:{wins:4,losses:3,pushes:0,limit:10}
}));
const persistedStorage={getItem:k=>persisted.get(k)||null,
 setItem:(k,v)=>persisted.set(k,v)};
let selectedLeague="league-old",loggedUser="account-A";
const authRibbon={innerHTML:"",hidden:true,dataset:{},removeAttribute(k){if(k==="data-signature")delete this.dataset.signature;}};
let currentReport={source:"recent",limit:10,wins:4,losses:3,pushes:0,
 fingerprint:"verified-1:won|verified-2:won|verified-3:lost|verified-4:won|verified-5:lost|verified-6:won|verified-7:lost"};
const stableWindow={
 SEC_BRIDGE:{view:()=>activeRoute,week:()=>({num:7,games:[]})},
 SEC_NEXT:{recentStats:()=>currentReport,weekStats:()=>({wins:4,losses:3,items:[]})},
 SEC_LEAGUE_SETTINGS:{getSelected:()=>({id:selectedLeague})},
 secOnline:{getUser:()=>({id:loggedUser})}
};
const stableDoc={addEventListener:()=>{},getElementById:id=>id==="sec-fun-global"?authRibbon:null,visibilityState:"visible"};
vm.runInNewContext(src,{window:stableWindow,document:stableDoc,
 localStorage:persistedStorage,URL,Date,Number,Promise,console});
const bound=stableWindow.SEC_FAN_MOMENTS;
const before=bound.cardVerdict();
assert.equal(before.title,"THE EXCITEMENT IS MANDATORY","migrate the already-seen roast");
assert.equal(before.percent,57);
assert.equal(persisted.has("sec-roast-card-v3:account-A"),true);
selectedLeague="league-new";
// A real Supabase token refresh can briefly return null between navigation,
// even though the user has not signed out. This was reproduced in the video.
loggedUser=null;
for(const route of ["home","picks","league","home","news"]){
 activeRoute=route;bound.onView(route);
 assert.equal(bound.cardVerdict().title,before.title,
  "changing pages and selected leagues must not rotate a person's roast");
 assert.equal(authRibbon.hidden,false,"roast remains visible while auth refresh returns null");
 assert.ok(authRibbon.innerHTML.includes(before.title),
  "quote remains available throughout a temporary null user state");
}
loggedUser="account-A";
currentReport={...currentReport,fingerprint:"verified-7:lost|verified-6:won|verified-5:lost|verified-4:won|verified-3:lost|verified-2:won|verified-1:won"};
assert.equal(bound.cardVerdict().title,before.title,
 "same verified accuracy in a different order is not a new result");
currentReport={...currentReport,wins:1,losses:1,fingerprint:"partial-refresh"};
const pending=bound.cardVerdict();
assert.equal(pending.source,"saved","loading fewer picks retains the last verified report");
assert.equal(pending.percent,57);
assert.equal(pending.title,before.title);
currentReport={...currentReport,wins:5,losses:3,fingerprint:"verified-8:won|verified-7:lost"};
const finished=bound.cardVerdict();
assert.equal(finished.percent,63);
assert.notEqual(finished.title,before.title,"new verified outcome advances the roast");
// Explicit sign-out is not a refresh; never show the prior account's quote.
loggedUser=null;
currentReport={...currentReport,wins:0,losses:0,fingerprint:"signed-out-empty"};
bound.onAuthSignOut();
assert.equal(authRibbon.hidden,false,"signed-out Home has a neutral roast placeholder");
assert.match(authRibbon.innerHTML,/Roast warming up/);
assert.ok(!authRibbon.innerHTML.includes(finished.title),
 "sign-out must not expose the previous player's saved roast");
assert.equal(bound.cardVerdict().ready,false);
currentReport={...currentReport,wins:5,losses:3,fingerprint:"new-user-verifications"};
loggedUser="account-B";selectedLeague="league-new";
assert.equal(persisted.has("sec-roast-card-v3:account-B"),false,
 "another signed-in account never inherits the previous user's recap");
bound.cardVerdict();
assert.equal(persisted.has("sec-roast-card-v3:account-B"),true);
assert.equal(persisted.get("sec-roast-card-v3:account-A")!==persisted.get("sec-roast-card-v3:account-B"),true,
 "saved scores and sayings remain separate between users");
loggedUser="account-A";
assert.equal(bound.cardVerdict().title,finished.title,
 "switching back to the original account restores its pinned roast");

// Assert every grade receives the new stronger SEC trash talk while still
// preserving the correct thresholds and extended no-repeat roast decks.
assert.match(src,/YOUR FOOTBALL LICENSE HAS BEEN REVOKED/);
assert.match(src,/YOU'RE THE DEFINITION OF MID/);
assert.match(src,/THE LEAGUE HAS FOUND ITS CLOWN/);
assert.match(src,/THE LEAGUE IS GETTING EMBARRASSED/);
assert.match(src,/YOUR PICKS HAVE BEEN DECLARED A DISASTER AREA/);
assert.match(src,/Your opponents showed up with opinions/);
assert.ok(!src.includes("Half of your calls aged beautifully"),
 "remove the old mild roast bank");
assert.equal(m.grade(4,3).kind,"okay","57% gets an appropriately mid roast");
assert.equal(m.grade(1,4).kind,"roast","20% gets the brutal roast tier");
assert.equal(m.grade(5,0).kind,"fire","100% celebrates dominating opponents");

const counts=m.roastCounts();
assert.deepEqual({...counts},{fire:12,great:12,okay:12,rough:18,roast:22},
 "expanded roast decks keep 18 rough and 22 savage sayings");
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
assert.match(html,/sec-fan-moments\.js\?v=20261015-savage-v1/);
assert.match(read("sw.js"),/sec-fan-moments\.js\?v=20261015-savage-v1/);

assert.equal(m.safeUrl("https://www.secsports.com/news/2026/10/fake"),true);
assert.equal(m.safeUrl("javascript:alert(1)"),false);
assert.equal(m.safeUrl("https://www.secsports.com.evil.invalid/"),false);
assert.match(html,/id="sec-fun-results"/,"feedback accessible within Results");
assert.match(html,/id="sec-fun-global"/,"persistent roast has a site-wide mounting point");
assert.ok(html.indexOf('id="sec-fun-global"')<html.indexOf('id="home-view"'),
 "global roast must live outside any hidden routed view");
assert.match(html,/sec-screen-consistency\.css\?v=20261014-ui-continuity-v3/);
assert.match(read("sw.js"),/sec-screen-consistency\.css\?v=20261014-ui-continuity-v3/);
assert.match(read("sw.js"),/sec-pickem-v113/);
assert.match(read("sec-screen-consistency.css"),/#sec-fun-global\[hidden\]/);
assert.match(read("sec-screen-consistency.css"),/\.sdsx-brandline/);

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
