/* Private chat + championships: browser-mocked smoke tests; no Supabase user records modified. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const listeners={};
const elements={
 "sec-chat-feed":{innerHTML:""},
 "sec-championship-content":{innerHTML:""},
 "sec-chat-input":{value:"Ready for Saturday!"}
};
const user={id:"player-a"},league={id:"league-a",name:"Testing Crew",owner_id:"player-a",mode:"straight"};
const data={messages:[
{id:"msg1",league_id:"league-a",user_id:"player-b",body:"<script>alert(1)</script>",created_at:"2026-10-09T14:00:00Z"},
{id:"msg-other",league_id:"league-b",user_id:"player-a",body:"Private other league message",created_at:"2026-10-09T14:01:00Z"}
],reactions:[],champions:[],actions:[]};
const fakeDocument={
 addEventListener(type,fn){listeners[type]=fn;},
 getElementById(id){return elements[id]||null;},
 querySelector(){return null;},
 visibilityState:"visible"
};
const query=table=>{
 const q={filters:[],select(){return q;},eq(k,v){q.filters.push([k,v]);return q;},
 order(){return q;},limit(){return q;},in(k,values){q.filters.push([k,values]);return q;},
 insert(row){data.actions.push({table,type:"insert",row});if(table==="sec_league_messages")data.messages.push({id:"msg2",created_at:new Date().toISOString(),...row});if(table==="sec_league_reactions")data.reactions.push(row);return Promise.resolve({data:row});},
 delete(){q.deleting=true;return q;},
 then(resolve,reject){
  let rows=table==="sec_league_messages"?data.messages:table==="sec_league_reactions"?data.reactions:data.champions;
  for(const [key,val] of q.filters)rows=rows.filter(x=>Array.isArray(val)?val.includes(x[key]):x[key]===val);
  return Promise.resolve({data:rows}).then(resolve,reject);
 }};
 return q;
};
const client={from:query,async rpc(){return {data:"player-a"};}};
const app={view:()=>"league",weeks:[],toast:()=>{}};
const w={SEC_BRIDGE:app,confirm:()=>true};
const ctx={window:w,document:fakeDocument,console,setInterval:()=>0,localStorage:{getItem(){return null;}}};
vm.runInNewContext(fs.readFileSync("league-social.js","utf8"),ctx,{filename:"league-social.js"});
const feature=w.SEC_SOCIAL;assert.ok(feature,"league social module loaded");
assert.equal(feature.render(),"","no league content without login");
feature.connect(client,league,user,[
 {user_id:"player-a",display_name:"Commissioner",season_points:10},
 {user_id:"player-b",display_name:"Rival",season_points:9}
]);
async function run(){
 await new Promise(resolve=>setImmediate(resolve));
 await new Promise(resolve=>setImmediate(resolve));
 const html=feature.render();
 assert.match(html,/Chat & Trash Talk/,"private chat visible");
 assert.doesNotMatch(html,/League Championship/,"no duplicate championship on League page");
 const honors=feature.renderChampionship();
 assert.match(honors,/League Championship/,"Trophy Case receives season championship panel");
 assert.match(honors,/Current points leader: Commissioner/,"leader clearly tentative");
 assert.match(honors,/disabled title=/,"commissioner can't finalize before official finals");
 assert.match(honors,/data-sec-social="crown"/,"commissioner control still accessible");
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/,"chat content escaped");
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/,"chat cannot inject HTML");
 assert.match(html,/Remove/,"commissioner can moderate");
 assert.match(html,/🔒 Testing Crew/,"chat identifies its selected private league");
 assert.doesNotMatch(html,/Private other league message/,"league A cannot read league B chat");
 const multiplayer=fs.readFileSync("multiplayer.js","utf8");
 const featureSource=fs.readFileSync("league-features.js","utf8");
 assert.match(multiplayer,/sec-scoreboard-chat/,"chat mounted inside scoreboard card");
 assert.match(multiplayer,/sec-scoreboard-current-league/,"chat labels the active league");
 assert.doesNotMatch(multiplayer,/id="scoreboard-league-select"/,
   "duplicate scoreboard league chooser no longer renders");
 assert.match(fs.readFileSync("league-settings.js","utf8"),/id="fan-selected-league"/,
   "one canonical league switcher controls all sport scoreboards");
 assert.doesNotMatch(featureSource,/leagueDetails\(\)[\s\S]*?SEC_SOCIAL\?\.render\?\.\(\)/,"no second chat under league settings");
 const other={id:"league-b",name:"Other League",owner_id:"player-b",mode:"straight"};
 feature.connect(client,other,user,[{user_id:"player-a",display_name:"Guest",season_points:0}]);
 assert.doesNotMatch(feature.renderChampionship(),/Crown 2026 Champion/,"non-commissioner cannot crown another league");
 await new Promise(resolve=>setImmediate(resolve));
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(feature.render(),/Private other league message/,"league B messages load when switching scoreboard");
 assert.doesNotMatch(feature.render(),/&lt;script&gt;alert\(1\)/,"league A chat does not leak to B");
 assert.match(feature.render(),/🔒 Other League/,"league B name updates with chat");
 feature.connect(client,league,user,[{user_id:"player-a",display_name:"Commissioner",season_points:0}]);
 assert.match(feature.renderChampionship(),/Crown 2026 Champion/,"commissioner regains control in own league");
 await new Promise(resolve=>setImmediate(resolve));
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(feature.render(),/&lt;script&gt;alert\(1\)/,"switching back loads league A chat");
 assert.doesNotMatch(feature.render(),/Private other league message/,"league B messages do not leak after switching back");
  feature.connect(client,null,null,[]);
 assert.equal(feature.render(),"","league chat cleared on sign out");
 console.log("SEC league chat & championships smoke tests passed: XSS escaping, member view, commissioner gate and logout.");
}
run().catch(e=>{console.error(e);process.exitCode=1;});