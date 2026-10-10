"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const listeners={},root={innerHTML:"",hidden:false};
let selected={kind:"club",id:"league-A",name:"Sports Friends"};
let user={id:"player-A"};
const data={
 "league-A":[
  {user_id:"player-A",display_name:"Alex",current_rank:1,previous_rank:2,season_points:26,weekly_points:6,weekly_correct:6,weekly_graded:7,season_graded:28,week_start:"2026-10-05"},
  {user_id:"player-B",display_name:"Jordan",current_rank:2,previous_rank:1,season_points:22,weekly_points:2,weekly_correct:2,weekly_graded:6,season_graded:26,week_start:"2026-10-05"},
  {user_id:"player-C",display_name:"Taylor",current_rank:3,previous_rank:3,season_points:20,weekly_points:0,weekly_correct:0,weekly_graded:0,season_graded:22,week_start:"2026-10-05"},
  {user_id:"player-D",display_name:"Casey",current_rank:4,previous_rank:null,season_points:15,weekly_points:2,weekly_correct:2,weekly_graded:3,season_graded:15,week_start:"2026-10-05"},
  {user_id:"player-E",display_name:"Sam",current_rank:5,previous_rank:4,season_points:12,weekly_points:1,weekly_correct:1,weekly_graded:5,season_graded:20,week_start:"2026-10-05"},
  {user_id:"player-F",display_name:"Taylor <svg onload=alert(1)>",current_rank:6,previous_rank:5,season_points:5,weekly_points:0,weekly_correct:0,weekly_graded:2,season_graded:15,week_start:"2026-10-05"}],
 "league-B":[
  {user_id:"player-A",display_name:"Alex",current_rank:1,previous_rank:null,season_points:0,weekly_points:0,weekly_correct:0,weekly_graded:0,season_graded:0,week_start:"2026-10-05"}
 ]
};
const calls=[];
const client={rpc:async(name,args)=>{
 calls.push([name,args]);
 assert.equal(name,"sec_weekly_power_rankings");
 return {data:data[args.p_league],error:null};
}};
const window={
 SEC_LEAGUE_SETTINGS:{getSelected:()=>selected},
 secOnline:{getClient:()=>client,getUser:()=>user}
};
const document={getElementById:id=>id==="fan-power-rankings"?root:null,
 addEventListener:(type,fn)=>{listeners[type]=fn}};
const sandbox={window,document,console,Date,Number,Promise};
vm.runInNewContext(fs.readFileSync("sec-power-rankings.js","utf8"),sandbox,{filename:"sec-power-rankings.js"});
const rankings=window.SEC_POWER;
const main=async()=>{
 await rankings.show();
 assert.match(root.innerHTML,/Power Rankings/);
 assert.match(root.innerHTML,/Week of Oct 5/);
 assert.match(root.innerHTML,/Verified final games only/);
 assert.match(root.innerHTML,/▲ 1/);
 assert.match(root.innerHTML,/▼ 1/);
 assert.match(root.innerHTML,/6\/7 graded picks correct/);
 assert.match(root.innerHTML,/See all 6 players/,"long rankings remain collapsed");
 assert.match(root.innerHTML,/Tied|Most right this week/);
 assert.doesNotMatch(root.innerHTML,/<svg onload/,"untrusted display name escaped");
 assert.match(root.innerHTML,/&lt;svg onload=/);
 assert.equal(calls.length,1);
 await rankings.show();
 assert.equal(calls.length,1,"cached rankings avoid duplicate round trips");
 selected={kind:"baseball",id:"league-B",name:"Baseball Crew"};
 await rankings.show();
 assert.match(root.innerHTML,/Baseball Crew/);
 assert.match(root.innerHTML,/Power rankings begin once league picks have verified final results/);
 assert.doesNotMatch(root.innerHTML,/Alex.*Season leader/);
 assert.doesNotMatch(root.innerHTML,/👑 1/,"no fake crowned leader before graded finals");
 assert.equal(calls[1][1].p_kind,"baseball");
 assert.equal(calls[1][1].p_league,"league-B");
 selected={kind:"club",id:"league-A",name:"Sports Friends"};
 await rankings.show(null,true); // explicit null falls back to current selected item
 assert.equal(calls.length,3);
 assert.match(root.innerHTML,/Jordan/);
 user=null;
 await rankings.show();
 assert.equal(root.hidden,true,"not shown when signed out");
 const sql=fs.readFileSync("supabase/migrations/20261009_weekly_power_rankings.sql","utf8");
 for(const part of [
  "sec_club_is_member(p_league)","sec_is_member(p_league)","sec_sport_is_member(p_league)",
  "'football'=any(v_scope.sports)","'basketball'=any(v_scope.sports)","'baseball'=any(v_scope.sports)",
  "g.game_status='final'","p.user_id=m.user_id","at time zone 'America/Chicago'",
  "revoke all on function public.sec_weekly_power_rankings"
 ])assert.ok(sql.includes(part),"SQL permission/accuracy rule: "+part);
 assert.doesNotMatch(sql,/delete from|insert into public\.sec_(?:league_picks|sport_picks)|update public\.sec_(?:league_picks|sport_picks)/i,
  "power rankings never mutate picks");
 const html=fs.readFileSync("index.html","utf8"),
       manager=fs.readFileSync("league-settings.js","utf8"),
       worker=fs.readFileSync("sw.js","utf8");
 assert.match(html,/id="fan-power-rankings"/);
 assert.match(html,/sec-power-rankings\.js\?v=/);
 assert.match(manager,/win\.SEC_POWER\?\.show\?\.\(item\)/,"rerender when league changes");
 assert.match(worker,/sec-power-rankings\.js\?v=/);
 console.log("Weekly league power rankings smoke passed: authorized server RPC, movement, no false results, XSS, per-league data and caching.");
};
main().catch(e=>{console.error(e);process.exitCode=1;});