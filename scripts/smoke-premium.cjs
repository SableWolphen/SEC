/* Mockup-aligned premium screens — real sources, account isolation, routes, no invented stats. */
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const source=fs.readFileSync("sec-premium.js","utf8");
new vm.Script(source,{filename:"sec-premium.js"});
const docs=new Map(["team-hub","game-center","results","team-news"].map(x=>["sdsx-"+(x==="team-hub"?"team":x==="game-center"?"game":x==="team-news"?"news":"results")+"-root",{innerHTML:""}]));
const handlers={};
const document={getElementById:id=>docs.get(id)||null,
 addEventListener:(type,fn)=>{handlers[type]=fn;},
 visibilityState:"visible",activeElement:{matches:()=>false}};
const gameA={id:"gA",home:"TENN",away:"ALA",date:"2026-10-11",week:6,
 kickoff:new Date(Date.now()+86400000).toISOString(),liveStatus:"scheduled",
 network:"ESPN"};
const gameB={id:"gB",home:"ALA",away:"TENN",date:"2026-10-04",week:5,
 kickoff:new Date(Date.now()-86400000*7).toISOString(),liveStatus:"final",
 awayScore:24,homeScore:21,espnEventId:"401777123"};
const gameC={id:"gC",home:"UK",away:"UGA",date:"2026-10-11",week:6,
 kickoff:new Date(Date.now()-400000).toISOString(),liveStatus:"live",
 awayScore:10,homeScore:7,statusDetail:"3rd · 7:24",
 liveLastPlay:"Verified third-down pass for 12 yards",
 liveSituationUpdatedAt:new Date(Date.now()-40000).toISOString(),
 scoreUpdatedAt:new Date(Date.now()-30000).toISOString()};
const weeks=[{num:5,games:[gameB]},{num:6,games:[gameA,gameC]}];
let view="team-hub",account={id:"A"},chosen="TENN",rendered=0;
const app={weeks,week:()=>weeks[1],view:()=>view,setView:x=>{view=x;},
 state:()=>({picks:{"gB":"TENN","gA":"ALA"},results:{"gB":"TENN"},favorite:"TENN"})};
const sourceNews=[
 {title:"Tennessee prepares for Alabama",source:"ESPN",url:"https://www.espn.com/story1",
  published_at:new Date().toISOString(),teams:["Tennessee"]},
 {title:"Conference roundup",source:"NCAA",url:"https://www.ncaa.com/story2",
  published_at:new Date().toISOString(),teams:["Georgia"]},
 {title:"Malicious headline",source:"Bad",url:"javascript:alert(1)",
  published_at:new Date().toISOString(),teams:["Tennessee"]}];
const rankPoll={poll:"AP Top 25",published_at:new Date().toISOString().slice(0,10),
 teams:{TENN:{rank:14,previous:16},ALA:{rank:8,previous:6},UGA:{rank:12,previous:14}}};
const resultB={winner:"TENN",pick:"TENN",points:1,mode:"straight",awayScore:24,
 homeScore:21,eventId:"401777123"};
const window={
 SEC_BRIDGE:app,
 secOnline:{configured:true,getUser:()=>account,getLeague:()=>({name:"Friends League",id:"x"}),
 getStandings:()=>[{user_id:"friend",display_name:"Rival",season_points:9},
 {user_id:"A",display_name:"You",season_points:7}]},
 SEC_PRIDE:{names:{TENN:"Tennessee",ALA:"Alabama",UK:"Kentucky",UGA:"Georgia"},
  getCode:()=>chosen},
 SEC_RANKINGS:{rank:(code,sport)=>sport==="football"&&code==="TENN"?14:null,
 note:()=>"AP Top 25 · Oct 11",getPoll:()=>rankPoll,hasCurrent:()=>true,refresh:async()=>{}},
 SEC_TEAM_RECORDS:{entry:(code,sport)=>({overall:code==="TENN"?"5-1":"4-2",season:2026}),
 refresh:async()=>{}},
 SEC_NEWS:{getArticles:()=>sourceNews,safeUrl:url=>/^https:\/\/(www\.)?(espn|ncaa)\.com\//.test(url)?url:null,
 reload:async()=>{}},
 SEC_FEATURES:{finalData:g=>g.id==="gB"?resultB:null},
 SEC_FINAL_CARDS:{outcome:d=>({kind:d.pick===d.winner?"won":"lost"})},
 SEC_LEAGUE_SETTINGS:{getSelected:()=>null,getStandings:()=>[],load:async()=>{}},
 SEC_LIVE_DRIVE:{render:()=>""},SEC_STATS:{render:()=>""},
 SEC_LIVE_SCORES:{refresh:async()=>{}}
};
vm.runInNewContext(source,{window,document,console,Date,Promise,setInterval:()=>1},{filename:"sec-premium.js"});
const premium=window.SEC_PREMIUM;
assert.ok(premium);
premium.mount("team-hub");
const team=docs.get("sdsx-team-root").innerHTML;
assert.match(team,/SCHEDULE &amp; RESULTS/);
assert.match(team,/Tennessee/);
assert.match(team,/Volunteers/);
assert.match(team,/#14/);
assert.match(team,/Tennessee prepares for Alabama/);
assert.doesNotMatch(team,/Malicious headline|javascript:/);
assert.match(team,/NEXT VERIFIED MATCHUP/);
assert.match(team,/Verified roster photography and player data are not yet available/);
premium.openGame("gC");
const center=docs.get("sdsx-game-root").innerHTML;
assert.equal(view,"game-center");
assert.match(center,/● LIVE/);
assert.match(center,/10/);
assert.match(center,/Verified third-down pass/);
assert.match(center,/Live yardage stats unavailable|MATCHUP SNAPSHOT/);
assert.doesNotMatch(center,/286|342|Jalen Milroe/,"do not invent specific player or live stat data");
premium.openResults(5);
const results=docs.get("sdsx-results-root").innerHTML;
assert.equal(view,"results");
assert.match(results,/1 <small>correct picks/);
assert.match(results,/CORRECT/);
assert.match(results,/#2/);
assert.match(results,/7 verified season points/);
assert.match(results,/1<\/small>/);
assert.doesNotMatch(results,/PROJECTED|Top 10%|Streak/);
premium.mount("team-news");
const news=docs.get("sdsx-news-root").innerHTML;
assert.match(news,/AP RANKING MOVERS/);
assert.match(news,/Tennessee prepares for Alabama/);
assert.doesNotMatch(news,/Malicious headline/);
assert.match(news,/Push notifications on a locked phone are not yet enabled/);
assert.match(news,/D1Baseball|AP Top 25|RANKING MOVERS/);
// Guests must not see a former account's favorite or league ranking.
account=null;chosen=null;view="team-hub";premium.mount("team-hub");
const guest=docs.get("sdsx-team-root").innerHTML;
assert.match(guest,/Choose your SEC school/);
assert.doesNotMatch(guest,/Volunteers/);
view="results";premium.mount("results");
assert.doesNotMatch(docs.get("sdsx-results-root").innerHTML,/Rival/);
const html=fs.readFileSync("index.html","utf8");
for(const id of ["team-hub","game-center","results","team-news"]){
 assert.match(html,new RegExp('id="'+id+'-view"'));
 assert.match(html,new RegExp('id="'+id+'-heading"'));
}
assert.match(html,/SEC_PREMIUM\?\.mount/);
assert.match(html,/data-sdsx-school/);
assert.match(html,/sec-premium\.css\?v=/);
assert.match(html,/sec-premium\.js\?v=/);
assert.match(fs.readFileSync("sw.js","utf8"),/sec-premium\.css\?v=/);
assert.match(fs.readFileSync("sw.js","utf8"),/sec-premium\.js\?v=/);
assert.match(fs.readFileSync("sec-live-scores.js","utf8"),/viewing==="game-center"/);
console.log("Premium experience: verified team, game, news, results, source safety, guest privacy, routes PASS");
