"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const code=fs.readFileSync("sec-competitive-tools.js","utf8");
const ms=Date.now(),past=new Date(ms-3600000).toISOString(),future=new Date(ms+3600000).toISOString();
const standings=[{user_id:"me",season_points:5},{user_id:"other",season_points:5}];
const revealed=[{user_id:"me",game_id:"live-1",pick_code:"TAMU"},
 {user_id:"other",game_id:"live-1",pick_code:"MIZ"}];
const league={kind:"football",id:"league-1",sports:["football"],name:"Friends"};
async function fixture(games){
 const host={hidden:true,innerHTML:"",querySelector:()=>({open:true})};
 const copy={hidden:true,innerHTML:""};
 const el=id=>({
  "sec-path-first":host,"sec-competition-league":copy,
  "fan-league-choice":{insertAdjacentElement(){}}
 })[id]||null;
 const calls=[];
 const db={
  from(table){assert.equal(table,"sec_leagues");
   return {select(){return this;},eq(){return this;},
    single:async()=>({data:{id:"league-1",mode:"straight"},error:null})};},
  async rpc(name,args){
   calls.push({name,args});
   if(name==="sec_league_standings_v3")
    return {data:standings,error:null};
   if(name==="sec_revealed_league_picks")
    return {data:revealed,error:null};
   throw Error("Unrecognized RPC "+name);
  }
 };
 const app={view:()=>"league",week:()=>({num:6,games}),
  weeks:[{num:6,games},{num:7,games:[{id:"future-week",kickoff:future}]}],
  gameById:Object.fromEntries(games.map(g=>[g.id,g]))};
 const user={id:"me"},win={
  secOnline:{getClient:()=>db,getUser:()=>user},
  SEC_BRIDGE:app,
  SEC_LEAGUE_SETTINGS:{getSelected:()=>league,getLeagues:()=>[league]},
 };
 const document={getElementById:el,addEventListener(){}};
 vm.runInNewContext(code,{window:win,document,Date,Map,Set,Number,Array,String,Promise,console});
 await new Promise(resolve=>setTimeout(resolve,5));
 return {host,calls,win};
}
const live={id:"live-1",away:"TAMU",home:"MIZ",awayScore:10,homeScore:7,
 liveStatus:"live",kickoff:past};
const upcoming={id:"upcoming",away:"SC",home:"FLA",liveStatus:"scheduled",kickoff:future};
(async()=>{
 const active=await fixture([live,upcoming]);
 assert.match(active.host.innerHTML,/1 of 2 live-game outcomes put you in outright first/,
  "unstarted matchups must NOT block a valid live-game path");
 assert.match(active.host.innerHTML,/1 game has not started or reached confirmed live status/,
  "future games are not included in the provisional path");
 assert.match(active.host.innerHTML,/TAMU needs to win/);
 assert.match(active.host.innerHTML,/id="sec-path-fold" open/,
  "an open Path to 1st stays open on live score refresh");
 assert.equal(active.calls.filter(c=>c.name==="sec_revealed_league_picks").length,1,
  "post-kickoff picks use the server-protected reveal RPC");
 const pre=await fixture([upcoming]);
 assert.match(pre.host.innerHTML,/No confirmed live games right now/);
 assert.match(pre.host.innerHTML,/picks stay hidden until kickoff/);
 assert.equal(pre.calls.some(c=>c.name==="sec_revealed_league_picks"),false,
  "pre-kickoff Path never requests other players' hidden picks");
 const done=await fixture([{...live,liveStatus:"final",winner:"TAMU"}]);
 assert.match(done.host.innerHTML,/Week 6 has finished/);
 assert.match(done.host.innerHTML,/Next games are in Week 7/);
 assert.equal(done.calls.some(c=>c.name==="sec_revealed_league_picks"),false);
 console.log("Path to 1st passed: live scenarios despite future games, no leaks before kickoff, helpful completed week status, retained open state.");
})().catch(error=>{console.error(error);process.exitCode=1;});
