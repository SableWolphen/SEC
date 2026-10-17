"use strict";
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const home=fs.readFileSync(path.join(__dirname,"..","sec-home.js"),"utf8");
const online=fs.readFileSync(path.join(__dirname,"..","multiplayer.js"),"utf8");
const start=home.indexOf("let chatState={");
const end=home.indexOf("function homeChats(){",start);
assert.ok(start>=0&&end>start,"Chat hydration implementation must exist");
assert.match(online,/SEC_HOME\?\.onOnlineState\?\.\(\)/,"The online account restore must update Home chats");
assert.match(online,/chatDraft/,"Refreshing standings should not erase unsent chat text");
const code=home.slice(start,end);
const store=new Map();
const sessionStorage={
 getItem(key){return store.get(key)||null;},
 setItem(key,value){store.set(key,value);}
};
let account=null,leagues=[],networkError=false,refreshes=0;
const client={
 from(table){
  assert.equal(table,"sec_league_messages","Never fetch unrelated or public messages");
  return {select(){return {eq(column,id){
   assert.equal(column,"league_id","Only query one authorized league");
   return {order(){return {async limit(n){
    assert.equal(n,1);
    return networkError?{error:new Error("Temporary offline")}:
     {data:[{body:"Saved league message: "+id,created_at:"2026-10-16",user_id:"member"}]};
   }}};
  }}}};
 }
};
const api={getClient:()=>client,getLeagues:()=>leagues,getLeague:()=>leagues[0]};
const moduleForUser=()=>new Function("user","window","sessionStorage","refresh",
 code+"return {loadHomeChats,getState:()=>chatState,setSelected:id=>{chatState.selected=id},selectionKey:chatSelectionKey};"
)(()=>account,{secOnline:api},sessionStorage,()=>{refreshes++});
(async()=>{
 const first=moduleForUser();
 await first.loadHomeChats();
 assert.equal(first.getState().rows.length,0,"Never display a prior user's league data");
 account={id:"a"};leagues=[{id:"alpha",name:"Alpha"},{id:"beta",name:"Beta"}];
 await first.loadHomeChats();
 assert.deepEqual(first.getState().rows.map(x=>x.id),["alpha","beta"]);
 assert.equal(first.getState().previews.beta.body,"Saved league message: beta");
 first.setSelected("beta");
 sessionStorage.setItem(first.selectionKey("a"),"beta");
 const reloaded=moduleForUser();
 await reloaded.loadHomeChats();
 assert.equal(reloaded.getState().selected,"beta","Refresh should restore the selected chat");
 networkError=true;
 await reloaded.loadHomeChats(true);
 assert.ok(reloaded.getState().errors.beta,"A failed fetch is not an empty conversation");
 assert.equal(reloaded.getState().previews.beta.body,"Saved league message: beta",
  "Temporary network errors must not erase an existing message preview");
 account={id:"b"};leagues=[{id:"private",name:"Private"}];networkError=false;
 await reloaded.loadHomeChats();
 assert.equal(reloaded.getState().selected,"private");
 assert.equal(reloaded.getState().previews.beta,undefined,
  "Prior account's chat must never leak to another user");
 assert.ok(refreshes>0);
 console.log("PASS: chats restore after sign-in, selected league survives refresh, offline errors preserve previews, accounts isolated");
})().catch(err=>{console.error(err);process.exitCode=1;});
