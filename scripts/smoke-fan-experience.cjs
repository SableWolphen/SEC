"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const nodes={};
for(const id of ["fan-club-hub","fan-brackets","fan-series","fan-rivalries","fan-achievements","fan-alerts"]){
 nodes[id]={innerHTML:"",querySelector:()=>null};
}
const listeners={};
const app={view:()=>null,week:()=>({num:6,games:[]}),state:()=>({favorite:null}),toast:()=>{},setView:()=>{}};
const window={SEC_BRIDGE:app,secOnline:{getClient:()=>null,getUser:()=>null,whenAuthReady:()=>Promise.resolve()}};
const doc={getElementById:id=>nodes[id]||null,addEventListener:(event,handler)=>listeners[event]=handler,
 createElement:tag=>({tagName:tag,innerHTML:"",className:"",insertAdjacentElement:()=>{}}),
 activeElement:{matches:()=>false},visibilityState:"hidden"};
const ctx={window,document:doc,console,Date,Number,Promise,URL,URLSearchParams,setInterval:()=>0,
 location:{href:"https://sablewolphen.github.io/SEC/#league",search:""},navigator:{},history:{replaceState:()=>{}},
 localStorage:{getItem:()=>null,setItem:()=>{}},sessionStorage:{getItem:()=>null,setItem:()=>{} }};
vm.runInNewContext(fs.readFileSync("fan-experience.js","utf8"),ctx,{filename:"fan-experience.js"});
const fan=window.SEC_FAN;
assert.ok(fan&&typeof fan.onView==="function"&&typeof fan.gameCenter==="function");
const match={id:"2026-6-ALA-TENN",away:"ALA",home:"TENN",kickoff:"2026-10-17T19:30:00Z"};
const center=fan.gameCenter(match,"<div>Published rankings</div>");
assert.match(center,/<details class="fan-center"/,"game center is collapsed HTML details");
assert.doesNotMatch(center,/<details[^>]+ open/,"center closed by default");
assert.match(center,/Published rankings/,"existing matchup stats are preserved inside expandable center");
assert.match(center,/Score pending/,"no false real-time scores");
const preview=fan.seriesPreviewCard({weekend:1,away:"Tennessee",home:"Florida",start_date:"2027-03-19",end_date:"2027-03-21"});
assert.match(preview,/Tennessee/);
assert.match(preview,/Florida/);
assert.match(preview,/Personal preview only/);
assert.match(preview,/data-fan-series="winner"/);
assert.match(preview,/3-0/);
assert.match(fs.readFileSync("multi-sport.js","utf8"),/seriesPreviewCard/,"series prediction is actually embedded in verified published conference previews");
const sport=fan.sportCenter("baseball",{id:"b2027",game_status:"scheduled",away_name:"Georgia",home_name:"Tennessee",source:"SEC"});
assert.match(sport,/Score & source/);
assert.doesNotMatch(sport,/LIVE|FINAL/,"does not fake an active game");
const html=fs.readFileSync("index.html","utf8"),sql=fs.readFileSync("supabase/migrations/20261009_unified_three_sport_leagues.sql","utf8");
assert.ok(html.includes('id="fan-club-hub"'));
assert.ok(html.includes('window.SEC_FAN?.onView?.(v)'));
assert.ok(html.includes('window.SEC_FAN?.gameCenter'));
assert.ok(html.includes('window.SEC_FAN?.sportCenter')===false||fs.readFileSync("multi-sport.js","utf8").includes('window.SEC_FAN?.sportCenter'));
assert.ok(html.includes('fan-experience.js?v='));
assert.match(sql,/enable row level security/);
assert.match(sql,/auth\.uid\(\)/);
assert.match(sql,/sec_club_join\(p_code text\)/);
assert.match(sql,/perform public\.sec_sport_join_league\(bbcode\)/);
assert.match(sql,/perform public\.sec_sport_join_league\(bscode\)/);
assert.match(sql,/clock_timestamp|season_points/);
fan.onView("league").then(()=>{
 assert.match(nodes["fan-club-hub"].innerHTML,/One league\. Three sports/);
 assert.match(nodes["fan-brackets"].innerHTML,/Official seeds|Only official seeds/);
 assert.match(nodes["fan-series"].innerHTML,/first pitch/);
 assert.match(nodes["fan-rivalries"].innerHTML,/Rivalry challenges/);
 console.log("SEC fan experience smoke passed: secure club, compact game center, verified source, disclosure UI");
}).catch(e=>{console.error(e);process.exitCode=1;});
