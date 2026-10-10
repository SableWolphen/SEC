"use strict";
/* SEC commentary: fully offline/free, verifiable game states, safe news, no paid AI. */
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
let fetches=0,paidCalls=0;
const news={articles:[
 {sport:"football",teams:["Alabama","Georgia"],title:"Alabama <script>alert(1)</script> Georgia rivalry preview",
  source:"ESPN",summary:"Confirmed preview context",published_at:new Date().toISOString(),url:"https://www.espn.com/college-football/story/_/id/1234"},
 {sport:"football",teams:["Alabama","Georgia"],title:"Washington State Cougars vs. Utah State Aggies: Full Highlights",source:"ESPN",summary:"Irrelevant",published_at:new Date().toISOString(),url:"https://www.espn.com/college-football/story/_/id/5678"},
 {sport:"football",teams:["Alabama"],title:"Fake injection",source:"Fake",summary:"",published_at:new Date().toISOString(),url:"javascript:alert(1)"}
]};
const nodes={".sec-community-news":{innerHTML:""},".sec-community-reactions":{innerHTML:""}};
const host={dataset:{communityGame:"football:g-1"},querySelector:q=>nodes[q]};
const client={
 functions:{invoke(){paidCalls++;throw Error("Paid AI call must never happen");}},
 rpc:async(name)=>{
  if(name!=="sec_game_reaction_totals")throw Error("Unexpected API request: "+name);
  return {data:[],error:null};
 }
};
const document={querySelectorAll:()=>[host],addEventListener(){}};
const window={
 secOnline:{getClient:()=>client,getUser:()=>null},
 SEC_STATS:{getGame:()=>({away:{record:"5-1",rank:8},home:{record:"6-0",rank:3},home_win_pct:53.1})},
 SEC_BRIDGE:{state:()=>({favorite:"ALA"})}
};
const ctx={window,document,Date,Number,Object,Promise,URL,console,
 fetch:async()=>{fetches++;return {ok:true,json:async()=>news};}};
vm.runInNewContext(fs.readFileSync("sec-game-community.js","utf8"),ctx,{filename:"sec-game-community.js"});
const c=window.SEC_GAME_COMMUNITY;
const football={id:"g-1",away:"ALA",home:"UGA",game_status:"scheduled",kickoff:"2026-10-10T18:00:00Z"};
(async()=>{
 const preview=c.panel(football,"football");
 assert.match(preview,/Game take/);
 assert.match(preview,/PREGAME/);
 const pre=c.narrative(football,"football").text;
 assert.match(pre,/#8 Alabama/);
 assert.match(pre,/#3 Georgia/);
 assert.match(pre,/5-1/);
 assert.match(pre,/6-0/);
 assert.doesNotMatch(pre,/won|defeated/,"pregame never invents a winner");
 assert.doesNotMatch(preview,/AI-GENERATED|Matchup headlines/);
 await c.load(football,"football");
 assert.match(nodes[".sec-community-news"].innerHTML,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/,"publisher headline escaped");
 assert.doesNotMatch(nodes[".sec-community-news"].innerHTML,/<script>/,"untrusted headlines cannot execute");
 assert.doesNotMatch(nodes[".sec-community-news"].innerHTML,/Washington State Cougars/,"mislabeled highlights from other games are excluded");
 assert.match(nodes[".sec-community-news"].innerHTML,/noopener noreferrer/,"safe linked sources");
 assert.equal(fetches,1,"one fetch of published news");
 assert.equal(paidCalls,0,"no AI API requests");
 const live={...football,game_status:"live",away_score:20,home_score:24};
 const liveInfo=c.narrative(live,"football");
 assert.match(liveInfo.label,/LIVE/);
 assert.match(liveInfo.text,/Georgia/);
 assert.match(liveInfo.text,/20/);
 assert.match(liveInfo.text,/24/);
 assert.doesNotMatch(liveInfo.text,/wins|won|final score/);
 const tied=c.narrative({id:"b-1",away_code:"001",home_code:"002",
   away_name:"Alabama",home_name:"Kentucky",game_status:"live",away_score:68,home_score:68},"basketball");
 assert.match(tied.label,/TIED/);
 assert.match(tied.text,/68/);
 const final=c.narrative({...football,game_status:"final",away_score:35,home_score:31,winner:"ALA"},"football");
 assert.match(final.label,/FINAL/);
 assert.match(final.text,/Alabama/);
 assert.match(final.text,/35/);
 assert.match(final.text,/31/);
 const mismatch=c.narrative({...football,game_status:"final",away_score:35,home_score:31,winner:"UGA"},"football");
 assert.match(mismatch.label,/VERIFYING/);
 assert.doesNotMatch(mismatch.text,/takes the result|finished ahead|It's final:/);
 const missing=c.narrative({...football,game_status:"final",away_score:null,home_score:null},"football");
 assert.match(missing.text,/verified score is not available/);
 const postponed=c.narrative({...football,game_status:"postponed"},"football");
 assert.match(postponed.text,/postponed/);
 assert.doesNotMatch(postponed.text,/won|defeated/);
 const baseball=c.narrative({id:"b-9",away_code:"A",home_code:"B",away_name:"Auburn",home_name:"Florida",
  game_status:"final",away_score:3,home_score:4,winner_code:"B"},"baseball");
 assert.match(baseball.text,/single run/);
 assert.match(baseball.text,/4/);
 const spread=c.narrative({...football,spread_home:-3.5,spread_source:"verified"},"football");
 assert.match(spread.text,/favors Georgia by 3.5/);
 assert.match(spread.text,/isn't a guaranteed outcome/);
 const unverified=c.narrative({...football,spread_home:-3.5,spread_source:null},"football");
 assert.doesNotMatch(unverified.text,/listed point spread/);
 c.panel(live,"football");
 await c.load(live,"football",true);
 assert.match(nodes[".sec-community-news"].innerHTML,/LIVE/);
 assert.equal(paidCalls,0);
 const source=fs.readFileSync("sec-game-community.js","utf8");
 assert.doesNotMatch(source,/functions\.invoke|api\.openai\.com|OPENAI_API_KEY|aiAttempts/);
 const html=fs.readFileSync("index.html","utf8");
 assert.match(html,/sec-game-community\.js\?v=20261010-calm-v1/);
 assert.match(html,/fan-experience\.js\?v=20261010-calm-v1/);
 const fan=fs.readFileSync("fan-experience.js","utf8");
 assert.match(fan,/game_status:status,away_score:awayScore/,"verified football status passed to Game Center");
 console.log("Free SEC commentary passed: 3 sports, upcoming/live/final, safe sourcing, zero LLM requests.");
})().catch(e=>{console.error(e);process.exitCode=1;});
