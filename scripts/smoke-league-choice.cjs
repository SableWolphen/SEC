"use strict";
/* Regression: single/all league types are genuinely switchable and account-scoped. */
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const nodes=Object.fromEntries(["fan-league-choice","fan-single-league","fan-club-hub",
 "fan-brackets","fan-series","league-content","fan-rivalries","fan-achievements","fan-recap",
 "settings-view"].map(k=>[k,{innerHTML:"",hidden:false,querySelector:()=>null}]));
const handlers={},storage=new Map(),saves=[],deleted=[],sportLoads=[],messages=[];
let currentUser=null;
let savedByUser=new Map([["user-one",{play_format:"all",single_sport:"baseball"}]]);
const table=(name)=>({
 select(){return this;},eq(){return this;},order(){return Promise.resolve({data:[],error:null});},
 async maybeSingle(){return {data:savedByUser.get(currentUser?.id)||null,error:null};},
 async upsert(payload){
  if(name!=="sec_player_league_preferences")throw Error("Unexpected upsert table");
  saves.push({...payload});savedByUser.set(payload.user_id,{play_format:payload.play_format,single_sport:payload.single_sport});
  return {data:payload,error:null};
 }
});
const client={from:table,rpc:async()=>({data:[],error:null})};
const online={getClient:()=>client,getUser:()=>currentUser,whenAuthReady:()=>Promise.resolve()};
let view=null;
const bridge={view:()=>view,state:()=>({favorite:null}),toast:v=>messages.push(v),setView:v=>{view=v}};
const window={secOnline:online,SEC_BRIDGE:bridge,SEC_BRACKETS:{mount:()=>{}},
 SEC_SPORTS:{renderLeaguePanel:s=>'<div>Manage '+s+' league</div>',load:async s=>sportLoads.push(s)}};
const doc={getElementById:k=>nodes[k]||null,addEventListener:(n,fn)=>handlers[n]=fn,
 createElement:()=>({innerHTML:"",className:""}),visibilityState:"hidden"};
const mockStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
const context={window,document:doc,console,Date,Number,Promise,
 location:{href:"https://sablewolphen.github.io/SEC/#league",search:"",pathname:"/SEC/"},
 navigator:{},history:{replaceState:()=>{}},localStorage:mockStorage,sessionStorage:mockStorage,
 setInterval:()=>0,URL,URLSearchParams};
vm.runInNewContext(fs.readFileSync("fan-experience.js","utf8"),context,{filename:"fan-experience.js"});
const fan=window.SEC_FAN;assert.ok(fan?.getPlayChoice);
(async()=>{
 view="league";
 await fan.onView("league");
 assert.match(nodes["fan-league-choice"].innerHTML,/Single Sport/);
 assert.match(nodes["fan-league-choice"].innerHTML,/All Three Sports/);
 assert.equal(nodes["fan-single-league"].hidden,false);
 assert.equal(nodes["league-content"].hidden,false,"guests keep shared account sign in");
 await fan.choosePlay("all");
 assert.equal(nodes["fan-club-hub"].hidden,false,"all-sports mode visible to guests");
 assert.match(nodes["fan-club-hub"].innerHTML,/One league\. Three sports/);
 assert.equal(nodes["league-content"].hidden,false,"same login remains visible");
 currentUser={id:"user-one",email:"one@example.com"};
 await fan.onView("league");
 assert.equal(fan.getPlayChoice().format,"all","logged-in player's preference restored from Supabase");
 assert.equal(fan.getPlayChoice().sport,"baseball");
 assert.equal(nodes["fan-club-hub"].hidden,false);
 assert.equal(nodes["league-content"].hidden,true,"hide unrelated football league tools in all-sports mode");
 await fan.choosePlay("single","basketball");
 assert.equal(nodes["fan-single-league"].hidden,false);
 assert.equal(nodes["fan-club-hub"].hidden,true);
 assert.match(nodes["fan-single-league"].innerHTML,/Manage basketball league/,"single basketball actually embeds its league tools");
 assert.equal(nodes["league-content"].hidden,true,"football tools cannot confuse a basketball-only player");
 assert.equal(saves.at(-1).single_sport,"basketball");
 assert.equal(saves.at(-1).play_format,"single");
 assert.deepEqual(sportLoads,["basketball"]);
 await fan.choosePlay("single","picks");
 assert.equal(nodes["league-content"].hidden,false,"existing football scoreboard restored");
 assert.equal(saves.at(-1).single_sport,"football","client maps Picks route to stored football sport");
 await fan.choosePlay("all");
 assert.equal(nodes["fan-club-hub"].hidden,false,"switch back anytime");
 assert.equal(nodes["league-content"].hidden,true);
 assert.equal(saves.at(-1).play_format,"all");
 assert.equal(saves.length,3);
 assert.equal(deleted.length,0,"never touch league membership or saved picks while toggling");
 currentUser={id:"user-two",email:"two@example.com"};
 await fan.onView("league");
 assert.equal(fan.getPlayChoice().format,"single","second account never sees prior account's preferences");
 assert.equal(fan.getPlayChoice().sport,"picks");
 const sql=fs.readFileSync("supabase/migrations/20261009_switchable_league_preferences.sql","utf8");
 assert.match(sql,/user_id uuid primary key references auth\.users\(id\)/);
 assert.match(sql,/using\(user_id=\(select auth\.uid\(\)\)\)/);
 assert.match(sql,/with check\(user_id=\(select auth\.uid\(\)\)\)/);
 assert.match(sql,/Only the single-sport league owner can upgrade it/);
 assert.match(sql,/mode<>'straight'/);
 assert.match(sql,/sec_club_upgrade_single/);
 assert.match(sql,/insert into public\.sec_club_members\(club_id,user_id\)values\(new_club,me\)/);
 assert.doesNotMatch(sql,/delete from public\.sec_(?:games|leagues|sport_picks|picks|members|sport_members)/i);
 const html=fs.readFileSync("index.html","utf8");
 for(const id of ["fan-league-choice","fan-single-league","fan-club-hub"])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(fs.readFileSync("multi-sport.js","utf8").includes("renderLeaguePanel,getState"),"sports league panel exported");
 console.log("Switchable SEC league choice passed: guest view, same-account persistence, sports, reversible selection and secure upgrade.");
})().catch(e=>{console.error(e);process.exitCode=1});