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
 {id:"b",home:"UGA",away:"FLA",date:"2026-10-11",kickoff:new Date(Date.now()+86400000).toISOString(),liveStatus:"scheduled",homeScore:0,awayScore:0},
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
 SEC_LIVE_SCORES:{refresh:async()=>{}},
 SEC_TEAM_RECORDS:{entry:()=>({overall:"5-1",source:"ESPN",season:2026}),refresh:async()=>{}},
 SEC_PRIDE:{names:{TENN:"Tennessee",TEX:"Texas"},getCode:()=>"TENN"},
 SEC_NEWS:{
  getArticles:()=>[
   {title:"Tennessee wins late",source:"ESPN",url:"https://www.espn.com/test-article",
    published_at:"2026-10-11T13:00:00Z",sport:"football",teams:["Tennessee"]},
   {title:"Other SEC roundup",source:"NCAA",url:"https://www.ncaa.com/test-story",
    published_at:"2026-10-11T16:00:00Z",sport:"football",teams:["Alabama"]},
   {title:"Malicious headline",source:"Unknown",url:"javascript:alert(1)",
    published_at:"2026-10-11T17:00:00Z",teams:["Tennessee"]}
  ],
  safeUrl:url=>/^https:\/\/(?:www\.espn\.com|www\.ncaa\.com)\//.test(url)?url:null,
  reload:async()=>{}
 }
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
assert.equal(model.visible.length,1,"live game takes priority over scheduled matches");
assert.equal(model.moment,"live","real live scores take priority on Home");
assert.equal(model.leaderboard.length,2);
assert.equal(model.leaderboard[0].user_id,"friend");
current="home";home.mount();
// Home is intentionally a calm pick/league dashboard; scores and plays live in Scores.
assert.match(root.innerHTML,/Games are <em>live\\.<\\/em>/);
assert.match(root.innerHTML,/GAMEDAYS DOWN SOUTH/);
assert.match(root.innerHTML,/data-hq-route="game-center"[^>]*class="hq-primary">Watch live scores →/,
 "Live hero directs viewers to the dedicated Scores tab");
assert.doesNotMatch(root.innerHTML,/class="hq-game-score"/,
 "Do not duplicate a live scoreboard below Picks or on the Home hero");
assert.match(root.innerHTML,/FOLLOWING YOUR SCHOOL/);
assert.match(root.innerHTML,/data-hq-route="team-hub">Team Hub →/);
assert.match(root.innerHTML,/data-hq-route="teams">Edit school/);
assert.match(root.innerHTML,/Tennessee/);
assert.match(root.innerHTML,/5-1 overall/);
assert.match(root.innerHTML,/NEXT VERIFIED KICKOFF/);
assert.match(root.innerHTML,/UGA/);
assert.match(root.innerHTML,/aria-label="Your next picks"/);
assert.match(root.innerHTML,/aria-label="Picks completed"/);
assert.match(root.innerHTML,/class="hq-home-chats"/);
assert.match(root.innerHTML,/aria-label="All the important SEC features"/);
for(const route of ["picks","game-center","news","league","results","teams","trophies"]){
 assert.ok(root.innerHTML.includes('data-hq-route="'+route+'"'),
  "Important features remain navigable: "+route);
}
assert.match(root.innerHTML,/data-hq-route="basketball"/);
assert.match(root.innerHTML,/class="hq-around-news"/,
 "Recent verified news is kept in a single quiet Home panel");
assert.doesNotMatch(root.innerHTML,/Malicious headline|javascript:/,
 "Untrusted publisher links may not reach the DOM");
assert.doesNotMatch(root.innerHTML,/Rival A|Sample preview|Sample standings/,
 "Home must never present fabricated game or league data");
assert.match(src,/previousMarkup===markup/,
 "Refreshes preserve the active Home DOM if the state is unchanged");
assert.ok(css.includes(".hq-stadium-hero.hq-no-upcoming"),
 "A missing kickoff does not generate a giant placeholder");
authed=null;
model=home.snapshot(a,now);
assert.equal(model.leaderboard.length,0,"guests must not see former user's league");
current="home";home.refresh();
assert.match(root.innerHTML,/Sign in and join a league to chat with friends/);
assert.match(root.innerHTML,/Choose Team/,"signed-out users never inherit a former account's school");
assert.doesNotMatch(root.innerHTML,/5-1 overall/,"private favorite disappears on logout");
assert.match(root.innerHTML,/Find my leagues →/,"guest receives a real league entry point");
assert.doesNotMatch(root.innerHTML,/Friend &amp; Rival/,"former opponent not shown to guest");
const unknown={id:"fake",home:"TENN",away:"TEX",liveStatus:"scheduled",date:"2026-10-11"};
assert.equal(home.nextKickoff([home.gameState(unknown)],now),null,"never guess a kickoff time");
assert.equal(home.countdown(now-1,now),null,"expired kickoff not advertised");
assert.match(src,/SEC_LIVE_SCORES\?\.refresh/,"reuse the confirmed score feed");
assert.doesNotMatch(src,/\.from\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/,"homepage does not write to or separately query database");
for(const view of ["home","more"])assert.ok(html.includes('id="'+view+'-view"'));
assert.match(html,/const views=\['home'/,"router recognizes the home screen");
assert.match(css,/repeat\(5,minmax\(0,1fr\)\)/,"mobile nav is five columns");
assert.match(worker,/sec-home\.js\?v=/);
assert.match(worker,/sec-home\.css\?v=/);
console.log("Game Day HQ smoke: real scores, progress, ranking isolation, no fake scores, five-tab navigation PASS");
