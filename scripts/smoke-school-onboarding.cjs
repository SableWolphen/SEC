/* Account-level school pride: email verification, cross-account isolation and clearing. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const userA={id:"account-a",user_metadata:{display_name:"A Player",favorite_school_code:"TENN"}};
const userB={id:"account-b",user_metadata:{display_name:"B Player",favorite_school_code:"TEX"}};
let current=userA,schoolWrites=[],metaWrites=[],state={favorite:null,name:"Player Name"};
const cache=new Map();
const db={
 from(table){
  assert.equal(table,"sec_profiles");
  return {
   update(row){return {eq(field,id){return {select(){schoolWrites.push({id,value:row.favorite_school_code});return Promise.resolve({data:[{user_id:id}],error:null});}}}};},
   upsert(){throw Error("should not insert existing profile");}
  };
 },
 auth:{async updateUser(data){metaWrites.push({id:current?.id,value:data.data.favorite_school_code});
  current.user_metadata.favorite_school_code=data.data.favorite_school_code;
  return {data:{user:current},error:null};}}
};
let refreshCount=0;
const window={
 secOnline:{getUser:()=>current,getClient:()=>db},
 SEC_BRIDGE:{state:()=>state,renderHeader(){},toast(){throw Error("Unexpected favorite sync error");}},
 SEC_HOME:{refresh(){refreshCount++;}}
};
const localStorage={getItem:k=>cache.has(k)?cache.get(k):null,setItem:(k,v)=>cache.set(k,String(v))};
const doc={querySelectorAll:()=>[]};
vm.runInNewContext(fs.readFileSync("sec-pride.js","utf8"),{window,document:doc,localStorage,console,Promise},{filename:"sec-pride.js"});
const pride=window.SEC_PRIDE,settle=()=>new Promise(resolve=>setTimeout(resolve,0));
(async()=>{
 assert.equal(Object.keys(pride.names).length,16,"picker offers exactly 16 SEC teams");
 // Email was confirmed later: database row was created without the new signup metadata.
 pride.setProfile({user_id:userA.id,display_name:"A Player",favorite_school_code:null});
 assert.equal(pride.getCode(),"TENN","first verified login recovers school from signup metadata");
 await settle();await settle();
 assert.deepEqual(schoolWrites[0],{id:"account-a",value:"TENN"},"favorite syncs to correct account");
 assert.equal(state.favorite,"TENN");
 // Another user on the same browser cannot inherit account A's favorite.
 current=userB;state={favorite:"TENN",name:"B Player"};
 assert.equal(pride.getCode(),null,"getter is scoped even before second profile has loaded");
 pride.setProfile({user_id:userB.id,display_name:"B Player",favorite_school_code:"TEX"});
 assert.equal(pride.getCode(),"TEX","B gets their own account's favorite");
 assert.equal(state.favorite,"TEX");
 await pride.saveFavorite(null);
 assert.equal(pride.getCode(),null,"explicit clear removes selected school");
 assert.deepEqual(metaWrites.at(-1),{id:"account-b",value:null},"clearing also updates sign-in metadata");
 pride.setProfile({user_id:userB.id,display_name:"B Player",favorite_school_code:null});
 assert.equal(pride.getCode(),null,"cleared selection does not reappear on refresh");
 // Sign-out erases account-specific selection immediately.
 current=null;pride.setProfile(null);
 assert.equal(pride.getCode(),null);
 assert.ok(refreshCount>0);
 console.log("Favorite onboarding: confirmed signup, 16 schools, remote save, clear, account isolation PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
