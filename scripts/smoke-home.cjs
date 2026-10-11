/* Game Day HQ: truth, pick completion, league isolation and navigation. */
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const src=fs.readFileSync("sec-home.js","utf8");
const html=fs.readFileSync("index.html","utf8"),css=fs.readFileSync("sec-home.css","utf8");
const worker=fs.readFileSync("sw.js","utf8");
new vm.Script(src,{filename:"sec-home.js"});
const root={innerHTML:""};
const listeners=new Map();
const doc={
 getElementById:id=>id==="sec-home-root"?root:null,
 addEventListener:(type,cb)=>listeners.set(type,cb),visibilityState:"visible"
};
const now=Date.parse("2026-10-11T18:00:00Z");
const games=[
 {id:"a",home:"TENN",away:"ALA",date:"2026-10-11",kickoff:"2026-10-11T16:00:00Z",
  liveStatus:"live",homeScore:21,awayScore:24,statusDetail:"4th · 02:36",
  scoreUpdatedAt:"2026-10-11T17:59:10Z",liveFieldPercent:60,livePossessionCode:"ALA"},
 {id:"b",home:"UGA",away:"FLA",date:"2026-10-11",kickoff:"2026-10-11T21:00:00Z",liveStatus:"scheduled",homeScore:0,awayScore:0},
 {id:"c",home:"LSU",away:"ARK",date:"2026-10-11",kickoff:"2026-10-11T14:00:00Z",liveStatus:"final",homeScore:17,awayScore:10}
];
const state={picks:{a:"ALA",c:"LSU"}};
let authed={id:"my-user"},current="picks",tick=0;
const league={id:"a",name:"Our League"};
const standings=[{user_id:"friend",display_name:"Friend & Rival",season_points:14},
 {user_id:"my-user",display_name:"You",season_points:12}];
const a={week:()=>({num:6,games}),state:()=>state,isLocked:g=>Date.parse(g.kickoff)<=now,
 view:()=>current,setView:v=>{current=v},weekNum:6};
const window={
 SEC_BRIDGE:a,
 SEC_FEATURES:{isUnavailable:()=>false},
 SEC_SPORTS:{recommended:()=>"football"},
 SEC_LEAGUE_SETTINGS:{getSelected:()=>null,getStandings:()=>[],load:async()=>{}},
 secOnline:{configured:true,getUser:()=>authed,getLeague:()=>league,getStandings:()=>standings,isAuthReady:()=>true,whenAuthReady:()=>Promise.resolve()},
 SEC_LIVE_SCORES:{refresh:async()=>{}}
};
const ctx={window,document:doc,console,Date,Number,Promise,setInterval:()=>{},setTimeout:()=>{}};
vm.runInNewContext(src,ctx,{filename:"sec-home.js"});
const home=window.SEC_HOME;
assert.equal(typeof home.mount,"function");
let model=home.snapshot(a,now);
assert.equal(model.progress.total,3);
assert.equal(model.progress.chosen,2);
assert.equal(model.progress.unpickedOpen,1);
assert.equal(model.progress.lockedMissing,0);
assert.equal(model.liveCount,1);
assert.equal(model.visible[0].status,"live");
assert.equal(model.visible[0].homeScore,21);
assert.equal(model.visible[0].awayScore,24);
assert.equal(model.visible[1].status,"scheduled");
assert.equal(model.visible[1].scored,false,"scheduled 0-0 must NOT render as live score");
assert.equal(model.leaderboard.length,2);
assert.equal(model.leaderboard[0].user_id,"friend");
current="home";home.mount();
assert.match(root.innerHTML,/24 – 21/,"confirmed score is shown, not a sample");
assert.match(root.innerHTML,/Updated /,"score freshness is shown");
assert.match(root.innerHTML,/4th · 02:36/);
assert.match(root.innerHTML,/1 open and unpicked/);
assert.match(root.innerHTML,/Friend &amp; Rival/,"league names are escaped");
assert.match(root.innerHTML,/aria-label="Picks completed"/);
assert.match(root.innerHTML,/data-hq-route="basketball"/);
assert.doesNotMatch(root.innerHTML,/Rival A|Sample preview|Sample standings/,"never show mock numbers");
authed=null;
model=home.snapshot(a,now);
assert.equal(model.leaderboard.length,0,"guests must not see former user's league");
current="home";home.refresh();
assert.match(root.innerHTML,/Sign in to see your private league/);
assert.match(src,/SEC_LIVE_SCORES\?\.refresh/,"reuse the confirmed score feed");
assert.doesNotMatch(src,/\.from\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/,"homepage does not write to or separately query database");
for(const view of ["home","more"])assert.ok(html.includes('id="'+view+'-view"'));
assert.match(html,/const views=\['home'/,"router recognizes the home screen");
assert.match(css,/repeat\(5,minmax\(0,1fr\)\)/,"mobile nav is five columns");
assert.match(worker,/sec-home\.js\?v=/);
assert.match(worker,/sec-home\.css\?v=/);
console.log("Game Day HQ smoke: real scores, progress, ranking isolation, no fake scores, five-tab navigation PASS");
