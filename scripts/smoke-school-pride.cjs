"use strict";
/* Regression: legacy browser favorite must sync to owner, never another account;
   signed-in league badge hydration must update already-rendered standings. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const storage=new Map(),profiles=new Map(),calls=[],warnings=[];
let viewer={id:"member-A",user_metadata:{display_name:"Alex"}};
let state={name:"Alex",favorite:"ALA"},friendSchool="UGA",headerUpdates=0;
let html="",removals=0;
const row={
 getAttribute:()=> "member-B",
 querySelector:s=>s===".sec-school-badge"&&html?{remove(){html="";removals++;}}:null,
 insertAdjacentHTML:(where,markup)=>{assert.equal(where,"beforeend");html=markup;}
};
const document={querySelectorAll:q=>{
 assert.equal(q,"#league-view [data-player-id]");
 return [row];
}};
const localStorage={
 getItem:k=>storage.has(k)?storage.get(k):null,
 setItem:(k,v)=>storage.set(k,String(v))
};
const client={
 from(table){
  assert.equal(table,"sec_profiles");
  return {
   update(next){
    return {eq(field,id){
     assert.equal(field,"user_id");
     return {select:async()=>{calls.push(["update",id,next.favorite_school_code]);
      profiles.set(id,next.favorite_school_code);
      return {data:[{user_id:id}],error:null};}};
    }};
   },
   async upsert(next){calls.push(["upsert",next.user_id,next.favorite_school_code]);
    profiles.set(next.user_id,next.favorite_school_code);
    return {data:next,error:null};}
  };
 },
 async rpc(name,args){
  assert.equal(name,"sec_member_pride");
  assert.equal(args.p_kind,"football");
  assert.equal(args.p_league,"fixture");
  calls.push(["members",viewer.id]);
  return {data:[
   {user_id:"member-A",favorite_school_code:profiles.get("member-A")||null},
   {user_id:"member-B",favorite_school_code:friendSchool}
  ],error:null};
 }
};
const win={
 secOnline:{getUser:()=>viewer,getClient:()=>client},
 SEC_BRIDGE:{state:()=>state,renderHeader:()=>{headerUpdates++;},
  toast:msg=>warnings.push(msg)},
 SEC_LEAGUE_SETTINGS:{getSelected:()=>({kind:"football",id:"fixture"})},
 SEC_POWER:{render(){}},SEC_BRAGS:{render(){}},SEC_SOCIAL:{refreshDisplay(){}}
};
vm.runInNewContext(fs.readFileSync("sec-pride.js","utf8"),
 {window:win,document,localStorage,console,Date,Promise,Object,String,setTimeout},
 {filename:"sec-pride.js"});
const pride=win.SEC_PRIDE;
const flush=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
(async()=>{
 pride.setProfile({favorite_school_code:null});
 await flush();
 assert.equal(pride.getCode(),"ALA","existing browser favorite not silently cleared");
 assert.equal(profiles.get("member-A"),"ALA","browser favorite migrates to first owner's profile");
 assert.match(pride.myBadge(),/ALA/,"player badge includes account team");
 await pride.load("football","fixture",true);
 assert.match(html,/UGA/,"other league member's school shown");
 friendSchool="TENN";
 await pride.load("football","fixture",true);
 assert.match(html,/TENN/,"refresh updates a visible badge without rerendering whole league");
 assert.doesNotMatch(html,/UGA/,"previous school badge is removed");
 assert.ok(removals>0&&headerUpdates>0,"existing standings and header receive updates");
 // Switching to another account on a shared browser must not claim the first account's school.
 viewer={id:"member-C",user_metadata:{display_name:"Casey"}};
 state={name:"Casey",favorite:"ALA"};
 pride.setProfile({favorite_school_code:null});
 await flush();
 assert.equal(pride.getCode(),null,"another account must not inherit this device's old favorite");
 assert.equal(state.favorite,null);
 assert.equal(profiles.has("member-C"),false,"no unintended writes to another player");
 // An account-level favorite beats any browser value, even when from another account.
 pride.setProfile({favorite_school_code:"VAN"});
 assert.equal(pride.getCode(),"VAN");
 assert.match(pride.myBadge(),/VAN/);
 await pride.saveFavorite(null);
 pride.setProfile({favorite_school_code:null});
 assert.equal(pride.getCode(),null,"cleared favorite is not automatically restored");
 assert.equal(profiles.get("member-C"),null,"account-level removal saved");
 assert.equal(warnings.length,0,"ordinary account updates should not generate warnings");
 console.log("SEC favorite-school regression passed: migrated old choices, other players, refreshes, account switching, clearing.");
})().catch(e=>{console.error(e);process.exitCode=1;});
