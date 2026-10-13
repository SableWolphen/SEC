"use strict";
/* Regression: league impact must never leak picks before server-confirmed lock. */
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync("sec-game-impact.js","utf8");
new vm.Script(source,{filename:"sec-game-impact.js"});
const html=fs.readFileSync("index.html","utf8"),sw=fs.readFileSync("sw.js","utf8");
assert.match(html,/sec-game-impact\.js\?v=/);
assert.match(html,/sec-game-impact\.css\?v=/);
assert.match(html,/SEC_GAME_IMPACT\?\.decorate\?\.\(\)/);
assert.match(fs.readFileSync("sec-next.js","utf8"),/SEC_GAME_IMPACT\?\.onLeague\?\.\(\)/);
assert.match(sw,/sec-game-impact\.js\?v=/);
const eventHandlers={};
let signed=false,started=false,selectedKind="football",calls=0,side="TEX";
const game={id:"fixture-1",away:"TEX",home:"OU",kickoff:new Date(Date.now()+3600000).toISOString(),liveStatus:"live"};
const state={picks:{"fixture-1":side}};
let fold=null;
function el(){
 return {
  dataset:{},className:"",innerHTML:"",isConnected:true,
  children:[],style:{},open:false,
  querySelector(selector){return selector===".sec-impact-body"?this.impactBody:null;},
  setAttribute(){},append(...x){this.children.push(...x);},
  appendChild(x){this.children.push(x);if(x.className==="sec-impact"){fold=x;fold.impactBody=el();}},
  replaceChildren(...x){this.children=x;}
 };
}
const card=el(),leagues=el();
card.dataset.gameId=game.id;
card.querySelector=selector=>selector===".sec-impact"?fold:null;
const D={
 addEventListener:(key,fn)=>{eventHandlers[key]=fn;},
 querySelectorAll:()=>[card],
 getElementById:key=>key==="sec-next-league"?leagues:null,
 createElement:()=>el()
};
leagues.querySelector=()=>null;
leagues.insertAdjacentElement=(position,node)=>{leagues.added=node;};
const db={rpc:async(name,args)=>{
 calls++;
 assert.equal(name,"sec_league_game_pulse");
 assert.equal(args.p_game,game.id);
 return {data:[{locked:true,away_picks:2,home_picks:3}],error:null};
}};
const W={
 SEC_BRIDGE:{week:()=>({num:7,games:[game]}),view:()=> "home",
  isLocked:()=>started,state:()=>state,toast(){}},
 SEC_FEATURES:{finalData:()=>null},
 SEC_PRIDE:{names:{TEX:"Texas",OU:"Oklahoma"}},
 SEC_LEAGUE_SETTINGS:{getSelected:()=>({kind:selectedKind,id:"league-1",name:"SEC Fans"})},
 SEC_NEXT:{weekStats:()=>({wins:0,losses:0,pushes:0})},
 secOnline:{getUser:()=>signed?{id:"member-1"}:null,getClient:()=>db,
  getStandings:()=>[{user_id:"member-1",season_points:2},{user_id:"member-2",season_points:3}]},
 location:{origin:"https://example.com",pathname:"/SEC/"}
};
vm.runInNewContext(source,{window:W,document:D,navigator:{},Date,console,Map,Number,Promise});
assert.ok(W.SEC_GAME_IMPACT);
W.SEC_GAME_IMPACT.decorate();
assert.equal(fold,null,"guests never show the league impact entry");
signed=true;
W.SEC_GAME_IMPACT.decorate();
assert.equal(fold,null,"future game picks remain private");
game.kickoff=new Date(Date.now()-1000000).toISOString();
started=true;
W.SEC_GAME_IMPACT.decorate();
assert.ok(fold,"started games show an optional league-impact disclosure");
assert.equal(calls,0,"closed disclosure makes no network requests");
async function main(){
 fold.open=true;
 eventHandlers.toggle({target:fold});
 await new Promise(r=>setImmediate(r));
 await new Promise(r=>setImmediate(r));
 assert.equal(calls,1,"authorized server RPC requested on demand");
 assert.equal(fold.impactBody.children.length>0,true,"rendered source-confirmed counts");
 assert.equal(String(fold.impactBody.children[0].children[0].innerHTML).includes("2"),true);
 eventHandlers.toggle({target:fold});
 await new Promise(r=>setImmediate(r));
 assert.equal(calls,1,"briefly cached rows avoid repeated reads");
 W.SEC_GAME_IMPACT.onLeague();
 assert.ok(leagues.added?.innerHTML.includes("League game-day race"),"race surfaced for league members");
 selectedKind="basketball";
 W.SEC_GAME_IMPACT.onLeague();
 assert.ok(!leagues.added?.innerHTML.includes("Private football"),"other sports cannot read football league picks");
 assert.match(source,/if\(row\?\.locked!==true\)return null/);
 assert.match(source,/if\(!g\|\|!eligible\(g\)/);
 assert.doesNotMatch(source,/\.from\("sec_league_picks"\)/,"member picks never fetched directly");
 console.log("SEC game impact passed: no guest/future reads, post-kickoff RPC only, cache and league race.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
