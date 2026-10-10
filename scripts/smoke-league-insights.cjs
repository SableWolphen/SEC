"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const fixed=Date.now(),past=new Date(fixed-24*3600000).toISOString(),future=new Date(fixed+24*3600000).toISOString();
let account={id:"user-a"},choice={kind:"club",id:"club-a",name:"Rivals <img onerror=alert(1)>",sports:["football"]};
let calls=0,updates=[];
const leagueBox={innerHTML:""};
const panel={dataset:{communityGame:"football:game-01"},querySelector:sel=>sel===".sec-league-shockwave"?leagueBox:null};
const weeklyBox={innerHTML:""};
const sql=fs.readFileSync("supabase/migrations/20261010_league_game_pulse.sql","utf8");
const document={getElementById:id=>id==="fan-weekly-recap"?weeklyBox:null,querySelectorAll:()=>[panel]};
const client={rpc:async(name,args)=>{
 assert.equal(name,"sec_league_game_pulse");calls++;updates.push(args);
 return {error:null,data:[{away_picks:3,home_picks:1,total_picks:4,league_members:5,
  winner_picks:3,losing_picks:1,finalized:true,locked:true}]};
}};
const window={secOnline:{getUser:()=>account,getClient:()=>client},
 SEC_LEAGUE_SETTINGS:{getSelected:()=>choice},
 SEC_PRIDE:{names:{ALA:"Alabama",UGA:"Georgia"},badge:id=>id==="first"?"<span>★ ALA</span>":""}};
vm.runInNewContext(fs.readFileSync("sec-league-insights.js","utf8"),
 {window,document,Date,Number,Math,String,Object,Promise,console},
 {filename:"sec-league-insights.js"});
const insights=window.SEC_LEAGUE_INSIGHTS;
const game={id:"game-01",away:"ALA",home:"UGA",game_status:"final",away_score:34,home_score:28,
 winner:"ALA",kickoff:past,spread_home:-4.5,spread_source:"ESPN"};
(async()=>{
 assert.equal(insights.upset(game,"football").underdog,"ALA","home negative line means home favorite");
 assert.match(insights.upset(game,"football").label,/UNDERDOG WIN/);
 assert.match(insights.upset(game,"football").message,/historical pregame pricing is not archived/);
 assert.equal(insights.upset({...game,spread_source:null},"football"),null,"no unsourced upset claims");
 assert.equal(insights.upset({...game,spread_home:null},"football"),null);
 assert.equal(insights.upset({...game,away_score:21,home_score:28},"football"),null,"no upset if favorite leads");
 assert.match(insights.upset({...game,game_status:"live"},"football").label,/UPSET WATCH/);
 assert.match(insights.initial(game,"football"),/League picks are revealed after kickoff/);
 const waiting={...game,kickoff:future,id:"game-02"};
 await insights.load(waiting,"football");
 assert.equal(calls,0,"not even an aggregate RPC before kickoff");
 await insights.load(game,"football");
 assert.equal(calls,1,"after kickoff, member-authorized aggregate");
 assert.equal(updates[0].p_kind,"club");
 assert.equal(updates[0].p_league,"club-a");
 assert.equal(updates[0].p_sport,"football");
 assert.match(leagueBox.innerHTML,/3 of 4 league picks backed the verified winner/);
 assert.match(leagueBox.innerHTML,/Alabama 3/);
 assert.match(leagueBox.innerHTML,/Georgia 1/);
 assert.doesNotMatch(leagueBox.innerHTML,/<img/,"league names must be escaped");
 await insights.load(game,"football");
 assert.equal(calls,1,"cached impact never refetches unnecessarily");
 const weekly=[
  {user_id:"first",display_name:"Winner",weekly_correct:5,weekly_graded:6,current_rank:1,previous_rank:3},
  {user_id:"second",display_name:"Challenger",weekly_correct:1,weekly_graded:5,current_rank:4,previous_rank:2},
  {user_id:"third",display_name:"New",weekly_correct:1,weekly_graded:1,current_rank:6,previous_rank:null}
 ];
 insights.weekly(choice,weekly);
 assert.match(weeklyBox.innerHTML,/Sharpest picker/);
 assert.match(weeklyBox.innerHTML,/Winner/);
 assert.match(weeklyBox.innerHTML,/Toughest slate/);
 assert.match(weeklyBox.innerHTML,/Challenger/);
 assert.match(weeklyBox.innerHTML,/Biggest comeback/);
 assert.match(weeklyBox.innerHTML,/Up 2 places/);
 assert.doesNotMatch(weeklyBox.innerHTML,/New/,"under-three-game picks do not win accuracy award");
 // Privacy and scope must hold in SQL, including multi-sport club rules.
 for(const term of ["sec_club_is_member(p_league)","sec_is_member(p_league)","sec_sport_is_member(p_league)",
   "p_sport=any(c.enabled_sports)","if v_kickoff>now() then return;end if;",
   "join members m on m.user_id=p.user_id","revoke all on function public.sec_league_game_pulse"]){
   assert.ok(sql.includes(term),"missing SQL protection "+term);
 }
 choice={kind:"basketball",id:"league-b",name:"Other",sports:["basketball"]};
 assert.doesNotMatch(insights.initial(game,"football"),/League Shockwave/,"cross sport league not queried");
 await insights.load(game,"football",true);
 assert.equal(calls,1,"cross sport query blocked");
 account=null;
 assert.match(insights.initial(game,"football"),/Join a league/);
 assert.equal(calls,1);
 console.log("League Shockwave regression passed: pregame confidentiality, winner impact, sourced upsets, weekly awards and account isolation.");
})().catch(e=>{console.error(e);process.exitCode=1;});
