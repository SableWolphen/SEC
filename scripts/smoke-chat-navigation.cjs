"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const nodes=new Map(),node=id=>{
 if(!nodes.has(id))nodes.set(id,{dataset:{},hidden:false,tabIndex:0,attributes:{},classList:{toggle(){}},
  setAttribute(k,v){this.attributes[k]=v;},replaceChildren(){},querySelector(){return null;}});
 return nodes.get(id);
};
let uid="member-a",selected={kind:"football",id:"a"},active="a",view="home",loads=[],choices=[];
const leagues=[{kind:"football",id:"a"},{kind:"football",id:"b"},
 {kind:"club",id:"club",sports:["football","basketball"],detail:{football_league:"c"}}];
const window={SEC_BRIDGE:{setView:v=>{view=v;}},secOnline:{getUser:()=>uid?{id:uid}:null,
 getLeagues:()=>[{id:"a"},{id:"b"},{id:"c"}],getLeague:()=>({id:active})},
 SEC_LEAGUE_SETTINGS:{getSelected:()=>selected,getLeagues:()=>leagues,
  load:()=>new Promise(resolve=>loads.push(resolve)),choose:async key=>{
   choices.push(key);selected=leagues.find(l=>l.kind+":"+l.id===key);
   active=selected.detail?.football_league||selected.id;
  }}};
vm.runInNewContext(fs.readFileSync("league-tabs.js","utf8"),{
 window,document:{getElementById:node,addEventListener(){}},queueMicrotask,
 MutationObserver:class{observe(){}},console
});
(async()=>{
 const tabs=window.SEC_LEAGUE_TABS;
 await tabs.openChat("not-a-membership");assert.equal(loads.length,0,"reject unknown chat membership");
 const old=tabs.openChat("a"),latest=tabs.openChat("b");
 loads[1]();await latest;loads[0]();await old;
 assert.deepEqual(choices,["football:b"],"old request cannot override latest selected chat");
 assert.equal(node("fan-tab-chat").attributes["aria-selected"],"true");
 assert.equal(view,"league");
 view="home";const pending=tabs.openChat("a");uid="member-b";loads[2]();await pending;
 assert.equal(view,"home","account change cancels pending chat navigation");
 assert.deepEqual(choices,["football:b"],"former account request cannot select a league");
 const club=tabs.openChat("c");loads[3]();await club;
 assert.equal(selected.id,"club","linked chat selects its parent multi-sport league");
 assert.equal(node("fan-tab-chat").attributes["aria-selected"],"true");
 uid=null;tabs.synchronize();assert.equal(node("fan-tab-chat").hidden,true,"sign-out removes private chat access");
 console.log("PASS: authorized chat deep links, rapid switching, account-change cancellation, linked club and sign-out.");
})().catch(e=>{console.error(e);process.exitCode=1;});
