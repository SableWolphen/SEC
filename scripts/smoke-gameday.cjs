"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const now=new Date("2026-10-10T16:00:00Z").getTime();
const nodes=Object.fromEntries(["sec-gameday-picks","sec-gameday-alerts","sec-day-recap","sec-day-league",
"sec-day-rivalry","sec-day-basketball","sec-day-baseball","sec-day-alert-settings"].map(id=>[id,{innerHTML:""}]));
const listeners={};
const games=[
 {id:"g1",away:"TAMU",home:"MIZ",kickoff:new Date(Date.now()-2*3600000).toISOString(),liveStatus:"live",
 awayScore:14,homeScore:10,statusDetail:"Q2 · 06:23"},
 {id:"g2",away:"ALA",home:"UGA",kickoff:"2026-10-09T15:00:00Z",liveStatus:"final",
 awayScore:31,homeScore:17},
 {id:"g3",away:"LSU",home:"TENN",kickoff:"2026-10-11T15:00:00Z",liveStatus:"scheduled",awayScore:0,homeScore:0}
];
const picks={g1:"TAMU",g2:"ALA"};
let uid="alice",selected={kind:"club",id:"club-A",name:"A"},copied=[],calls=0,shared=[];
const previous=new Date("2026-10-05T18:00:00Z"),weekStart=Math.floor(previous.getTime()/86400000);
const locker={players:[{user_id:"alice",display_name:"Alice"},{user_id:"bob",display_name:"Bob"}],
 games:[{id:"g1",away_code:"TAMU",home_code:"MIZ",kickoff_at:games[0].kickoff,game_status:"live",
  away_score:14,home_score:10,sport:"football"}],
 picks:[{user_id:"alice",game_id:"g1",pick_code:"TAMU"},{user_id:"bob",game_id:"g1",pick_code:"MIZ"}]};
const window={
 SEC_BRIDGE:{week:()=>({num:6,games}),gameById:Object.fromEntries(games.map(g=>[g.id,g])),
 state:()=>({picks,results:{g2:"ALA"}}),toast:()=>{},view:()=> "picks"},
 secOnline:{getUser:()=>uid?{id:uid}:null},
 SEC_LEAGUE_SETTINGS:{getSelected:()=>selected},
 SEC_BRAG_ARENA:{getData:()=>locker,getModel:()=>null},
 SEC_POWER:{getRows:()=>[{user_id:"alice",display_name:"Alice",current_rank:1,season_points:6}]},
 SEC_LEAGUE_INSIGHTS:{upset:()=>null},
 SEC_SPORTS:{getState:()=>({games:[],picks:{}}),year:()=>2027}
};
const document={getElementById:id=>nodes[id],addEventListener:(k,f)=>{listeners[k]=f;},visibilityState:"visible"};
const prefs={};const localStorage={getItem:k=>prefs[k]??null,setItem:(k,v)=>{prefs[k]=v;}};
const navigator={clipboard:{writeText:async t=>copied.push(t)}};
const context={window,document,Date,Math,Number,Object,String,Set,Promise,console,Intl,localStorage,navigator};
vm.runInNewContext(fs.readFileSync("sec-gameday.js","utf8"),context);
const app=window.SEC_GAMEDAY;
app.refresh();
assert.match(nodes["sec-gameday-picks"].innerHTML,/Your live picks/);
assert.match(nodes["sec-gameday-picks"].innerHTML,/Q2 · 06:23/);
assert.match(nodes["sec-gameday-picks"].innerHTML,/↑ Leading live/);
assert.match(nodes["sec-gameday-picks"].innerHTML,/✓ Correct/);
assert.match(nodes["sec-gameday-picks"].innerHTML,/Unpicked upcoming/);
assert.doesNotMatch(nodes["sec-gameday-picks"].innerHTML,/LSU 0 · 0 TENN/,"scheduled 0-0 hidden");
assert.match(nodes["sec-day-recap"].innerHTML,/1 \/ 1 confirmed picks/);
assert.match(app.recapText(),/1\/1 confirmed picks correct/);
assert.match(nodes["sec-day-league"].innerHTML,/LIVE LEAGUE OUTLOOK/);
assert.match(nodes["sec-day-league"].innerHTML,/leading picks/);
assert.match(nodes["sec-day-league"].innerHTML,/provisional/);
assert.match(nodes["sec-day-league"].innerHTML,/Official #1/);
assert.equal(app.personalStatus(games[0],"TAMU").kind,"leading");
assert.equal(app.personalStatus(games[0],"MIZ").kind,"trailing");
assert.equal(app.personalStatus(games[0],null).kind,"none");
assert.equal(app.personalStatus({...games[0],liveStatus:"final",winner:"MIZ"},"TAMU").kind,"scheduled",
 "unverified final must never award correct points");
assert.equal(app.confirmed({...games[1],winner:"ALA",away_score:31,home_score:17}),true);
assert.equal(app.confirmed({...games[1],winner:"UGA"}),false);
assert.equal(app.period({status_detail:"Top 7th"}),"Top 7th");
assert.equal(app.period({status_detail:"<script>"}),"");
app.settings();
assert.match(nodes["sec-day-alert-settings"].innerHTML,/Final scores/);
assert.match(nodes["sec-day-alert-settings"].innerHTML,/Upset results/);
assert.match(nodes["sec-day-alert-settings"].innerHTML,/Kickoff/);
listeners.click({target:{closest:()=>({dataset:{dayShare:"week"}})},preventDefault(){}});
Promise.resolve().then(()=>{
 assert.equal(copied.length,1);
 assert.match(copied[0],/verified/i);
 uid=null;app.refresh();
 assert.equal(nodes["sec-day-league"].innerHTML,"","switching to guest clears league data");
 const backend=fs.readFileSync("supabase/functions/sec-sport-sync/index.ts","utf8");
 assert.match(backend,/sec_verify_scores_job/,"background refresh validates existing Vault job token");
 assert.match(backend,/status_detail/,"server stores sourced sport periods");
 assert.match(backend,/120000:900000/,"provider requests slowed outside games");
 const sql=fs.readFileSync("supabase/migrations/20261010_auto_sport_score_refresh.sql","utf8");
 assert.match(sql,/sec-basketball-auto-scores/);
 assert.match(sql,/sec-baseball-auto-scores/);
 assert.doesNotMatch(fs.readFileSync("sec-gameday.js","utf8"),/functions\.invoke|api\.openai\.com/);
 console.log("Gameday passed: confirmed/live/uncertain picks, provisional member-only outlook, shareable recap, no early results, period and secure sports polling.");
}).catch(e=>{console.error(e);process.exitCode=1;});