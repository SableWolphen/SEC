"use strict";
/* Two independent auth sessions with overlapping requests. No real accounts created. */
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const USER_A={id:"player-a",email:"a@example.org",user_metadata:{display_name:"Alpha"}};
const USER_B={id:"player-b",email:"b@example.org",user_metadata:{display_name:"Bravo"}};
const fixture={id:"2026-6-UGA-ALA",week:6,away:"UGA",home:"ALA",kickoff:new Date(Date.now()+86400000).toISOString()};
const state={session:{user:USER_A},picks:{},results:{},name:""};
let releaseA=null,aStarted=false;
const leagues={
 "player-a":[{id:"league-A",name:"Only Alpha",owner_id:"player-a",mode:"straight",invite_code:"AAAAAAAAAA"}],
 "player-b":[{id:"league-B",name:"Only Bravo",owner_id:"player-b",mode:"straight",invite_code:"BBBBBBBBBB"}]
};
function rows(table,selectedUser){
 if(table==="sec_leagues")return leagues[selectedUser]||[];
 if(table==="sec_picks")return [{game_id:fixture.id,pick_code:selectedUser==="player-a"?"UGA":"ALA"}];
 if(table==="sec_games"||table==="sec_week_tiebreakers")return [];
 return [];
}
function from(table){
 let filtered=null;
 const chain={
  select(){return chain;},
  eq(column,value){if(column==="user_id")filtered=value;return chain;},
  order(){return chain;},
  maybeSingle:async()=>({data:{user_id:filtered||state.session?.user?.id,
   display_name:filtered==="player-a"?"Alpha":"Bravo"},error:null}),
  then(resolve,reject){
   const who=filtered||state.session?.user?.id;
   if(table==="sec_picks"&&who==="player-a"){
    aStarted=true;
    return new Promise(complete=>{releaseA=()=>complete({data:rows(table,who),error:null});}).then(resolve,reject);
   }
   return Promise.resolve({data:rows(table,who),error:null}).then(resolve,reject);
  }
 };
 return chain;
}
const client={
 from,
 auth:{
  getSession:async()=>({data:{session:state.session},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  signOut:async()=>{state.session=null;return {error:null}}
 },
 rpc:async(name,args)=>{
  if(name==="sec_league_standings_v3")return {data:[{user_id:state.session?.user?.id,
    display_name:state.session?.user?.id==="player-b"?"Bravo":"Alpha",
    picked:1,week_points:0,season_points:0}],error:null};
  return {data:[],error:null};
 }
};
const elements={};
const document={
 getElementById:id=>elements[id]||null,
 addEventListener:()=>{},
};
const storage=new Map();
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
const app={
 esc:x=>String(x).replaceAll("<","&lt;"),
 weeks:[{num:6,games:[fixture]}],gameById:{[fixture.id]:fixture},
 state:()=>state,week:()=>({num:6,games:[fixture]}),
 view:()=>"picks",renderPicks(){},renderLeague(){},renderSettings(){},toast(){},setView(){}
};
const window={
 SEC_BRIDGE:app,
 SEC_ONLINE_CONFIG:{url:"https://test-project.supabase.co",publishableKey:"sb_publishable_mock"},
 supabase:{createClient:()=>client},
 SEC_FEATURES:{reload:async()=>{},updateGames:()=>{},setStandings:()=>{},remind:()=>{}},
 SEC_SOCIAL:{connect:()=>{},setStandings:()=>{}},
 SDSTrophyCase:{sync:()=>{},refreshHonors:()=>{}},
 SEC_SPORTS:{authChanged:()=>{}}
};
const scope={window,document,console,Promise,URL,URLSearchParams,localStorage,
 location:{href:"https://example.org/SEC/#picks",search:"",pathname:"/SEC/",hash:"#picks",reload(){}},
 history:{replaceState(){}},
 setTimeout(fn){Promise.resolve().then(fn);return 1;},
 setInterval(){return 1;},navigator:{clipboard:{writeText:async()=>{}}}};
vm.runInNewContext(fs.readFileSync("multiplayer.js","utf8"),scope,{filename:"multiplayer.js"});
const wait=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 for(let i=0;i<12&&!aStarted;i++)await wait();
 assert.ok(aStarted&&releaseA,"Account A's picks request should be in-flight");
 state.session={user:USER_B};
 await window.secOnline.refresh();
 assert.equal(window.secOnline.getUser()?.id,"player-b");
 assert.equal(state.picks[fixture.id],"ALA","B sees only their own picks");
 assert.equal(window.secOnline.getLeague()?.name,"Only Bravo","B sees only their league");
 releaseA();await wait();await wait();
 assert.equal(window.secOnline.getUser()?.id,"player-b","A's slower response cannot change B's identity");
 assert.equal(state.picks[fixture.id],"ALA","A's late picks must not overwrite B's picks");
 assert.equal(window.secOnline.getLeague()?.id,"league-B");
 state.session=null;
 await window.secOnline.refresh();
 assert.equal(window.secOnline.getUser(),null);
 assert.deepEqual(Object.keys(state.picks),[],"logout must clear private saved picks");
 assert.equal(window.secOnline.getLeague(),undefined,"logout clears the last league");
 console.log("Two-account stale-request test passed: isolated picks, leagues, and sign-out.");
})().catch(e=>{console.error(e);process.exitCode=1;});