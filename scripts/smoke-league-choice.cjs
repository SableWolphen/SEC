"use strict";
/* League sports are PER LEAGUE, independently editable by the league owner. */
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const ids=["fan-league-choice","fan-league-create","fan-single-league","fan-club-hub",
 "fan-brackets","fan-series","league-content","fan-create-sport-options",
 "fan-edit-sport-options","fan-upgrade-sport-options","fan-new-name"];
const nodes=Object.fromEntries(ids.map(id=>[id,{innerHTML:"",hidden:false,value:"",querySelectorAll:()=>[]}]));
const handlers={},local=new Map(),rpcCalls=[],pickWrites=[],selectedCalls=[],toasts=[];
let current={id:"owner-1",email:"owner@example.com"};
let view="league";
const clubs=[
 {id:"club-A",name:"SEC Crew",owner_id:"owner-1",invite_code:"ABCDEFGHIJ",
  enabled_sports:["football","basketball"],football_league:"fb-1",basketball_league:"bb-1",
  baseball_league:"bs-1",basketball_season:2027,baseball_season:2027},
 {id:"club-B",name:"Diamond Fans",owner_id:"owner-1",invite_code:"0123456789",
  enabled_sports:["baseball"],football_league:"fb-2",basketball_league:"bb-2",
  baseball_league:"bs-2",basketball_season:2027,baseball_season:2027}
];
const football=[
 {id:"fb-1",name:"SEC Crew",owner_id:"owner-1",mode:"straight"},
 {id:"fb-2",name:"Diamond Fans",owner_id:"owner-1",mode:"straight"},
 {id:"fb-original",name:"Original Football",owner_id:"owner-1",mode:"straight"}
];
const other=[
 {id:"bb-1",name:"SEC Crew",sport:"basketball",owner_id:"owner-1",mode:"straight"},
 {id:"bb-2",name:"Diamond Fans",sport:"basketball",owner_id:"owner-1",mode:"straight"},
 {id:"bs-1",name:"SEC Crew",sport:"baseball",owner_id:"owner-1",mode:"straight"},
 {id:"bs-2",name:"Diamond Fans",sport:"baseball",owner_id:"owner-1",mode:"straight"},
 {id:"bb-original",name:"Hoops Buddies",sport:"basketball",owner_id:"someone-else",mode:"straight"}
];
const names=["sec_clubs","sec_leagues","sec_sport_leagues"];
function table(name){
 return {select(){return this;},order(){return Promise.resolve({data:
  (name==="sec_clubs"?clubs:name==="sec_leagues"?football:name==="sec_sport_leagues"?other:[])
   .filter(x=>current&&current.id==="owner-1"?true:false),error:null});}};
}
const db={from:table,rpc:async(fn,args)=>{
 rpcCalls.push({fn,args});
 if(fn==="sec_club_standings")return {data:[{user_id:"owner-1",display_name:"Owner",football:4,basketball:2,baseball:1,
  total:args.p_club==="club-A"?6:1,football_correct:4,basketball_correct:2,baseball_correct:1}],error:null};
 if(fn==="sec_club_set_sports"){
  const c=clubs.find(x=>x.id===args.p_club);if(c.owner_id!==current.id)return {error:{message:"Owner only"}};
  c.enabled_sports=[...args.p_sports];return {data:c.enabled_sports,error:null};
 }
 if(fn==="sec_club_create"){
  clubs.push({id:"club-C",name:args.p_name,owner_id:current.id,invite_code:"ZZZZZZZZZZ",
   enabled_sports:[...args.p_sports],football_league:"fb-3",basketball_league:"bb-3",
   baseball_league:"bs-3",basketball_season:2027,baseball_season:2027});
  return {data:"club-C",error:null};
 }
 if(fn==="sec_club_upgrade_single"){
  assert.deepEqual(Array.from(args.p_sports),["football","baseball"]);
  clubs.push({id:"club-D",name:"Original Football",owner_id:current.id,invite_code:"QQQQQQQQQQ",
   enabled_sports:[...args.p_sports],football_league:args.p_league,basketball_league:"bb-4",
   baseball_league:"bs-4",basketball_season:2027,baseball_season:2027});
  return {data:"club-D",error:null};
 }
 if(fn==="sec_club_join")return {data:"club-A",error:null};
 return {error:{message:"Unexpected RPC "+fn}};
 }};
const window={secOnline:{getClient:()=>db,getUser:()=>current,whenAuthReady:()=>Promise.resolve(),
 useLeague:id=>selectedCalls.push("football:"+id),refresh:async()=>{}},
 SEC_BRIDGE:{view:()=>view,setView:v=>{view=v},toast:t=>toasts.push(t)},
 SEC_SPORTS:{renderLeaguePanel:s=>'<div>Manage '+s+' league</div>',selectLeague:(s,id)=>selectedCalls.push(s+":"+id),
 load:async()=>{},year:()=>2027},
 SEC_BRACKETS:{mount:()=>{}}};
const document={getElementById:id=>nodes[id]||null,addEventListener:(type,cb)=>{handlers[type]=cb}};
const store={getItem:id=>local.get(id)||null,setItem:(id,value)=>local.set(id,value)};
const scope={window,document,console,Date,Number,Promise,navigator:{clipboard:{writeText:async()=>{}}},
 URL,URLSearchParams,localStorage:store,sessionStorage:store,
 location:{href:"https://sablewolphen.github.io/SEC/#league",pathname:"/SEC/",search:""},
 history:{replaceState:()=>{}}};
vm.runInNewContext(fs.readFileSync("league-settings.js","utf8"),scope,{filename:"league-settings.js"});
const manager=window.SEC_LEAGUE_SETTINGS;
const click=async(cmd,extra={})=>{
 const button={dataset:{leagueAction:cmd,...extra}};
 handlers.click({target:{closest:()=>button},preventDefault(){}});
 await new Promise(setImmediate);await new Promise(setImmediate);await new Promise(setImmediate);
};
const chooseSet=(group,chosen)=>{
 nodes["fan-"+group+"-sport-options"].querySelectorAll=()=>chosen.map(value=>({value}));
};
const run=async()=>{
 await manager.onView();
 const list=manager.getLeagues();
 assert.equal(list.length,4,"2 clubs plus 2 unrelated standalone leagues");

 assert.match(nodes["fan-league-choice"].innerHTML,/Each league chooses its own sports/);
 assert.match(nodes["fan-league-choice"].innerHTML,/SEC Crew/);
 assert.match(nodes["fan-league-choice"].innerHTML,/Diamond Fans/);
 assert.match(nodes["fan-league-choice"].innerHTML,/Original Football/);
 assert.doesNotMatch(fs.readFileSync("league-settings.js","utf8"),/sec_player_league_preferences/,"no global account format");
 assert.deepEqual(clubs[0].enabled_sports,["football","basketball"]);
 assert.deepEqual(clubs[1].enabled_sports,["baseball"]);
 await manager.choose("club:club-A");
 assert.match(nodes["fan-club-hub"].innerHTML,/⚙️ Change sports/);
 assert.match(nodes["fan-club-hub"].innerHTML,/🏀 Basketball/);
 assert.doesNotMatch(nodes["fan-club-hub"].innerHTML,/<th>⚾ Baseball<\/th>/);
 chooseSet("edit",["football"]);
 await click("save-sports");
 assert.deepEqual(clubs[0].enabled_sports,["football"]);
 assert.deepEqual(clubs[1].enabled_sports,["baseball"],"editing one league cannot touch another");
 assert.match(nodes["fan-club-hub"].innerHTML,/Only these sports count/);
 await manager.choose("club:club-B");
 assert.match(nodes["fan-club-hub"].innerHTML,/<th>⚾ Baseball<\/th>/);
 assert.doesNotMatch(nodes["fan-club-hub"].innerHTML,/<th>🏈 Football<\/th>/);
 chooseSet("edit",["basketball","baseball"]);
 await click("save-sports");
 assert.deepEqual(clubs[1].enabled_sports,["basketball","baseball"]);
 assert.deepEqual(clubs[0].enabled_sports,["football"]);
 nodes["fan-new-name"].value="Triple League";
 chooseSet("create",["football","basketball","baseball"]);
 await click("create");
 assert.equal(manager.getClub().id,"club-C");
 assert.deepEqual(clubs.at(-1).enabled_sports,["football","basketball","baseball"]);
 await manager.choose("football:fb-original");
 assert.equal(nodes["league-content"].hidden,false,"standalone football scoreboard remains available");
 assert.match(nodes["fan-single-league"].innerHTML,/Add sports to this league/);
 chooseSet("upgrade",["football","baseball"]);
 await click("upgrade");
 assert.equal(manager.getClub().id,"club-D");
 assert.equal(clubs.at(-1).football_league,"fb-original","same original league ID preserved");
 assert.ok(football.some(f=>f.id==="fb-original"),"original club and picks not deleted");
 assert.deepEqual(clubs[1].enabled_sports,["basketball","baseball"]);
 await manager.choose("basketball:bb-original");
 assert.doesNotMatch(nodes["fan-single-league"].innerHTML,/Save league sports/,"only owner may edit");
 assert.match(nodes["fan-single-league"].innerHTML,/Manage basketball league/);
 assert.equal(nodes["fan-club-hub"].hidden,true);
 assert.equal(nodes["league-content"].hidden,true);
 await manager.choose("club:club-D");
 assert.equal(manager.getClub().football_league,"fb-original","upgraded football league is still the original competition");
 assert.match(nodes["fan-club-hub"].innerHTML,/🏈 Football picks/,"original football picks are accessible in upgraded league");
 current=null;await manager.onView();
 assert.match(nodes["fan-league-choice"].innerHTML,/Log in below/);
 assert.equal(nodes["league-content"].hidden,false,"guest still has shared login");
 assert.equal(pickWrites.length,0,"never delete/modify past picks");
 assert.deepEqual(rpcCalls.filter(r=>r.fn==="sec_club_set_sports").map(r=>Array.from(r.args.p_sports)),
  [["football"],["basketball","baseball"]]);
 const source=fs.readFileSync("supabase/migrations/20261009_per_league_sport_selection.sql","utf8");
 assert.match(source,/enabled_sports text\[\]/);
 assert.match(source,/Only the league owner can change its sports/);
 assert.match(source,/where 'football'=any\(c.enabled_sports\)/);
 assert.match(source,/where 'basketball'=any\(c.enabled_sports\)/);
 assert.match(source,/where 'baseball'=any\(c.enabled_sports\)/);
 assert.match(source,/if not\(g.sport=any\(club.enabled_sports\)\)/);
 assert.doesNotMatch(source,/delete from public\.sec_/i);
 const h=fs.readFileSync("index.html","utf8");
 assert.match(h,/league-settings\.js\?v=/);
 assert.match(h,/id="fan-league-create"/);
 const fan=fs.readFileSync("fan-experience.js","utf8");
 assert.match(fan,/v==="league"\)return window\.SEC_LEAGUE_SETTINGS\?\.onView/);
 console.log("Per-league sports passed: independent clubs, 1/2/3 sports, owner-only edits, safe upgrade and one account.");
};
run().catch(e=>{console.error(e);process.exitCode=1;});