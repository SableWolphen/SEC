/* SEC tiebreaker regression tests: moves to Picks, week isolation, lock and server save. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const handlers={};
const clock=Date.now();
const game=(id,week,offset)=>({id,week,away:"ALA",home:"UGA",
 date:new Date(clock+offset).toISOString().slice(0,10),
 kickoff:new Date(clock+offset).toISOString()});
const g6Early=game("g6-early",6,6*86400000);
const g6Last=game("g6-last",6,8*86400000);
const g7Early=game("g7-early",7,13*86400000);
const g7Last=game("g7-last",7,14*86400000);
const g5Locked=game("g5-past",5,-86400000);
const weeks={
 5:{num:5,games:[g5Locked]},
 6:{num:6,games:[g6Last,g6Early]},
 7:{num:7,games:[g7Early,g7Last]}
};
let selected=6;
const tieRows=[
 {week:6,game_id:"g6-last",predicted_total:46},
 {week:7,game_id:"g7-last",predicted_total:58},
 {week:5,game_id:"g5-past",predicted_total:41}
];
const writes=[];
let input={id:"sec-total-guess",dataset:{tieWeek:"6"},value:"52"};
let picksRender=0;
const win={};
const doc={
 addEventListener(type,fn){handlers[type]=fn;},
 getElementById(id){return id==="sec-total-guess"?input:null;}
};
function from(name){
 let filters=[];
 const q={
 select(){return q;},eq(k,v){filters.push([k,v]);return q;},
 async upsert(row,{onConflict}={}){
  assert.equal(name,"sec_week_tiebreakers");
  assert.equal(onConflict,"league_id,user_id,week");
  writes.push({...row});
  const existing=tieRows.findIndex(r=>r.week===row.week);
  const r={week:row.week,game_id:row.game_id,predicted_total:row.predicted_total};
  if(existing>=0)tieRows[existing]=r;else tieRows.push(r);
  return {data:r};
 },
 then(resolve,reject){
  let rows=name==="sec_week_tiebreakers"?tieRows:[];
  for(const [key,val] of filters)if(key==="week")rows=rows.filter(r=>r.week===val);
  return Promise.resolve({data:rows}).then(resolve,reject);
 }};
 return q;
}
const client={from,async rpc(name){assert.equal(name,"sec_revealed_league_picks");return {data:[]};}};
const current={id:"league-a",name:"Testing Crew",mode:"straight",owner_id:"p1"};
const user={id:"p1"};
const state={picks:{},results:{}};
const app={
 week:()=>weeks[selected],
 state:()=>state,
 gameById:Object.fromEntries(Object.values(weeks).flatMap(w=>w.games).map(g=>[g.id,g])),
 view:()=>"picks",
 toast:()=>{},
 renderPicks:()=>{picksRender++;},
 esc:value=>String(value)
};
const env={
 window:win,document:doc,console,Date,Promise,setInterval:()=>{},localStorage:{getItem(){return null;}},
 sessionStorage:{getItem(){return null;},setItem(){}}
};
vm.runInNewContext(fs.readFileSync("league-features.js","utf8"),env,{filename:"league-features.js"});
const t=win.SEC_FEATURES;
async function run(){
 await t.reload(client,current,user,app);
 assert.match(t.tiebreakerCard(),/WEEK 6/);
 assert.match(t.tiebreakerCard(),/g6-last|ALA vs UGA/);
 assert.match(t.tiebreakerCard(),/value="46"/,"week 6 guess restored");
 assert.match(t.tiebreakerCard(),/Saved: 46 combined points/);
 assert.doesNotMatch(t.leagueDetails(),/sec-total-guess/,"no duplicate tiebreaker on League");
 selected=7;
 assert.match(t.tiebreakerCard(),/WEEK 7/);
 assert.match(t.tiebreakerCard(),/value="58"/,"week 7 independent guess");
 selected=6;
 handlers.input({target:{id:"sec-total-guess",dataset:{tieWeek:"6"},value:"52"}});
 assert.match(t.tiebreakerCard(),/Unsaved changes/);
 await t.reload(client,current,user,app);
 assert.match(t.tiebreakerCard(),/value="52"/,"draft persists across background refresh");
 input={id:"sec-total-guess",dataset:{tieWeek:"6"},value:"52"};
 await t.saveTiebreaker();
 assert.equal(writes.length,1);
 assert.equal(writes[0].week,6);
 assert.equal(writes[0].game_id,"g6-last","last kickoff used");
 assert.equal(writes[0].predicted_total,52);
 assert.equal(picksRender,1);
 assert.match(t.tiebreakerCard(),/Saved: 52 combined points/);
 selected=7;
 assert.match(t.tiebreakerCard(),/value="58"/,"saving week 6 doesn't overwrite week 7");
 selected=5;
 assert.match(t.tiebreakerCard(),/Locked/);
 assert.match(t.tiebreakerCard(),/disabled/);
 input={id:"sec-total-guess",dataset:{tieWeek:"5"},value:"40"};
 await assert.rejects(t.saveTiebreaker(),/locked/,"locked games can't accept guesses");
 selected=6;
 input={id:"sec-total-guess",dataset:{tieWeek:"6"},value:""};
 await assert.rejects(t.saveTiebreaker(),/Enter your/);
 input.value="201";
 await assert.rejects(t.saveTiebreaker(),/0 to 200/);
 input.value="45.5";
 await assert.rejects(t.saveTiebreaker(),/whole number/);
 const html=fs.readFileSync("index.html","utf8");
 assert.match(html,/id="weekly-tiebreaker-slot"/,"tiebreaker slot on Picks screen");
 assert.match(html,/SEC_FEATURES\?\.tiebreakerCard/,"Picks page renders live tiebreaker");
 t.reload(null,null,null,app);
 assert.match(t.tiebreakerCard(),/Sign in and join a league/);
 console.log("SEC tiebreaker tests passed: Picks location, per-week persistence, saved/unsaved state, last kickoff, validation and locking.");
}
run().catch(e=>{console.error(e);process.exitCode=1;});