"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const id="2026-6-TEX-OU",kickoff=new Date(Date.now()-25*60000).toISOString();
const game={id,away:"TEX",home:"OU",kickoff,liveStatus:"scheduled"};
const saved={picks:{[id]:"TEX"},results:{}},timers=[],listeners={};
const strip={innerHTML:"",hidden:true};let view="picks",reads=0,renders=0,ingested=[];
let scores=[{id,kickoff_at:kickoff,game_status:"live",status_detail:"Q2 · 8:04",
 away_score:14,home_score:10,score_updated_at:new Date().toISOString(),winner:null}];
const client={from(table){assert.equal(table,"sec_games");return {select(fields){
 assert.ok(fields.includes("status_detail")&&fields.includes("score_updated_at"));
 return {in(key,ids){assert.equal(key,"id");assert.ok(ids.includes(id));reads++;return Promise.resolve({data:scores,error:null});}};
}}}};
const app={view:()=>view,week:()=>({num:6,games:[game]}),gameById:{[id]:game},
 state:()=>saved,renderPicks(){renders++;}};
const window={SEC_BRIDGE:app,secOnline:{getClient:()=>client},
 SEC_FEATURES:{updateGames:()=>{}},SEC_FAN:{ingestScores:rows=>ingested=rows}};
const document={visibilityState:"visible",activeElement:{matches:()=>false},
 getElementById:x=>x==="sec-live-score-strip"?strip:null,
 addEventListener:(name,fn)=>listeners[name]=fn};
const sandbox={window,document,console,Date,Promise,Number,
 setInterval:fn=>{timers.push(fn);},setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync("sec-live-scores.js","utf8"),sandbox);
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
(async()=>{
 await flush();
 assert.equal(reads,1);
 assert.equal(renders,1);
 assert.equal(saved.picks[id],"TEX");
 assert.equal(saved.results[id],undefined,"live is not final");
 assert.equal(game.statusDetail,"Q2 · 8:04");
 assert.equal(ingested.length,1);
 assert.match(strip.innerHTML,/LIVE/);
 assert.match(strip.innerHTML,/Q2 · 8:04/);
 await window.SEC_LIVE_SCORES.refresh(true);
 assert.equal(renders,1,"no unnecessary redraws");
 scores=[{...scores[0],game_status:"final",status_detail:"Final",winner:"TEX",away_score:24,home_score:17}];
 await window.SEC_LIVE_SCORES.refresh(true);
 assert.equal(saved.results[id],"TEX");
 assert.equal(saved.picks[id],"TEX");
 assert.equal(strip.hidden,true);
 view="news";const count=reads;
 await window.SEC_LIVE_SCORES.refresh(true);
 assert.equal(reads,count);
 assert.equal(timers.length,1);
 const sql=fs.readFileSync("supabase/migrations/20261009_active_game_minute_scores.sql","utf8");
 assert.ok(sql.includes("g.game_status in ('scheduled','live')"));
 assert.ok(sql.includes("vault.decrypted_secrets"));
 assert.ok(sql.includes("7 hours")&&sql.includes("20 minutes"));
 const ts=fs.readFileSync("supabase/functions/sec-scores/index.ts","utf8");
 assert.ok(ts.includes("const rawClock=String(liveStatus.displayClock"));
 assert.ok(ts.includes('g.game_status==="final"&&status!=="final"'));
 assert.ok(!fs.readFileSync("sec-live-scores.js","utf8").includes('.update('),"client never writes score data");
 console.log("Verified live football score smoke passed: clock, score updates, unchanged picks, final-only grading, no repeated rerender and secure minute job.");
})().catch(e=>{console.error(e);process.exitCode=1;});