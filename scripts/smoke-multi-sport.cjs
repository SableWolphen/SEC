/* Test three-sport season selection, public schedules, modes and backend calls.
 * All Supabase calls are mocked; no actual leagues or picks created.
 */
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const events={},roots={
 "sports-hub":{innerHTML:""},
 "sport-basketball-content":{innerHTML:""},
 "sport-baseball-content":{innerHTML:""}
};
const now=Date.now();
const kickoff=new Date(now+4*86400000).toISOString();
const game={id:"basketball-2027-sec-test",sport:"basketball",season:2027,week:1,
 kickoff_at:kickoff,home_code:"333",home_name:"Alabama",away_code:"2633",away_name:"Tennessee",
 game_status:"scheduled",source:"SEC official conference schedule · provisional tipoff",winner_code:null};
let signed=false,syncCalls=0,pickCalls=[],standCalls=0,createCalls=0;
let authIsReady=true,restoreSession=Promise.resolve(),finishRestoring=null;
const me={id:"person-123",email:"tester@example.com"};
const league={id:"league-123",sport:"basketball",season:2027,owner_id:me.id,name:"Hoops Crew",
 mode:"straight",invite_code:"K3J59G7L4Z"};
const db={
 from(table){
  return {
   select(){return this;},eq(){return this;},order(){return Promise.resolve({data:table==="sec_sport_games"?[game]:
    table==="sec_sport_leagues"?[league]:table==="sec_sport_picks"?[]:table==="sec_sport_tiebreakers"?[]:[]});}
  };
 },
 rpc(name,args){
  if(name==="sec_sport_standings"){standCalls++;return Promise.resolve({data:[{user_id:me.id,display_name:"Tester",picked:0,week_points:0,season_points:0}]});}
  if(name==="sec_sport_save_pick"){pickCalls.push(args);return Promise.resolve({data:null});}
  if(name==="sec_sport_create_league"){createCalls++;return Promise.resolve({data:[{league_id:league.id,invite_code:league.invite_code}]});}
  if(name==="sec_sport_h2h_week")return Promise.resolve({data:[]});
  return Promise.resolve({data:[]});
 },
 functions:{invoke(){syncCalls++;return Promise.resolve({data:{ok:true}});}}
};
let activeView="sports",selected="";
const window={
 SEC_BRIDGE:{view:()=>activeView,setView:x=>{selected=x;activeView=x;}},
 secOnline:{configured:true,getUser:()=>signed?me:null,getClient:()=>db,
  isAuthReady:()=>authIsReady,whenAuthReady:()=>restoreSession},
 location:{hash:"#sports"}
};
const document={
 addEventListener(type,handler){events[type]=handler;},
 getElementById:id=>roots[id]||null,
 querySelector(){return null;},visibilityState:"visible",
 activeElement:{matches(){return false;}}
};
const localStorage={getItem(){return null;},setItem(){}};
const fixture={updated_at:"2026-10-09T20:00:00Z",
 sports:{basketball:{season:2027,games:[game]},baseball:{season:2027,games:[]}}};
const context={window,document,localStorage,URL,URLSearchParams,Date,console,
 navigator:{clipboard:{writeText:async()=>{}}},location:{hash:"#sports",href:"https://sablewolphen.github.io/SEC/#sports"},
 history:{replaceState(){}},setInterval(){},setTimeout,
 fetch:async()=>({ok:true,json:async()=>fixture})};
vm.runInNewContext(fs.readFileSync("multi-sport.js","utf8"),context,{filename:"multi-sport.js"});
const app=window.SEC_SPORTS;
async function settle(){for(let i=0;i<15;i++)await new Promise(resolve=>setImmediate(resolve));}
(async()=>{
 assert.ok(app,"sport manager loads");
 assert.equal(app.recommended(new Date("2026-10-09T18:00:00Z")),"football");
 assert.equal(app.recommended(new Date("2026-12-09T18:00:00Z")),"basketball");
 assert.equal(app.recommended(new Date("2027-05-09T18:00:00Z")),"baseball");
 assert.equal(app.recommended(new Date("2027-09-09T18:00:00Z")),"football");
 await settle();
 assert.match(roots["sports-hub"].innerHTML,/Choose your/);
 assert.match(roots["sports-hub"].innerHTML,/LATEST SEASON/);
 assert.ok(roots["sports-hub"].innerHTML.indexOf('data-go-sport="football"')<
  roots["sports-hub"].innerHTML.indexOf('data-go-sport="basketball"'),"Newest football season is first in October");
 const series=JSON.parse(fs.readFileSync("baseball-2027-series.json","utf8"));
 assert.equal(series.season,2027);
 assert.equal(series.series.length,80,"all 80 published SEC baseball series appear in preview");
 const counts=new Map();
 series.series.forEach(item=>{
  counts.set(item.home,(counts.get(item.home)||0)+1);
  counts.set(item.away,(counts.get(item.away)||0)+1);
  assert.match(item.status,/pending|TBD/i,"individual baseball game time unconfirmed");
 });
 assert.equal(counts.size,16,"all SEC baseball programs have published series");
 assert.ok([...counts.values()].every(n=>n===10),"each SEC school has 10 conference series");
 assert.match(fs.readFileSync("multi-sport.js","utf8"),/not pickable games/,"series only, no invented individual winner picks");
 for(const sport of ["football","basketball","baseball"])
  assert.match(roots["sports-hub"].innerHTML,new RegExp('data-go-sport="'+sport+'"'));
 activeView="basketball";app.mount("basketball");await settle();
 assert.match(roots["sport-basketball-content"].innerHTML,/Alabama/,"real upcoming basketball fixture visible even to guests");
 assert.match(roots["sport-basketball-content"].innerHTML,/provisional pick lock/,"provisional lock clearly distinguished from actual tipoff");
 assert.match(roots["sport-basketball-content"].innerHTML,/Log in to your account/,"signed-out user sees login rather than another account creation");
 // The saved session may still be restoring when the player switches sports.
 authIsReady=false;
 restoreSession=new Promise(resolve=>{finishRestoring=resolve;});
 app.mount("basketball");await settle();
 assert.match(roots["sport-basketball-content"].innerHTML,/Restoring your account/,"do not demand account creation while restoring login");
 assert.doesNotMatch(roots["sport-basketball-content"].innerHTML,/Log in to your account/,"no premature login prompt");
 signed=true;authIsReady=true;finishRestoring();
 app.authChanged();await settle();
 assert.match(roots["sport-basketball-content"].innerHTML,/tester@example.com/,"football account automatically appears in basketball");
 assert.doesNotMatch(roots["sport-basketball-content"].innerHTML,/Log in to your account/,"no separate basketball signup needed");
 assert.ok(syncCalls>0,"signed-in app requests verified ESPN server sync");
 assert.ok(standCalls>0,"standings query scoped to new league");
 assert.match(roots["sport-basketball-content"].innerHTML,/Hoops Crew/,"player sees only basketball league");
 assert.match(roots["sport-basketball-content"].innerHTML,/League standings/,"new sport scoreboard visible");
 assert.match(roots["sport-basketball-content"].innerHTML,/SEC official/,"source attribution");
 const btn={dataset:{sportAction:"pick",sport:"basketball",game:game.id,pick:game.away_code}};
 events.click({target:{closest:key=>key==="[data-sport-action]"?btn:null},preventDefault(){}});
 await settle();
 assert.equal(pickCalls.length,1,"basketball picks saved through server RPC");
 assert.equal(pickCalls[0].p_game,game.id);
 assert.equal(pickCalls[0].p_pick,game.away_code);
 assert.equal(pickCalls[0].p_league,league.id);
 activeView="baseball";app.mount("baseball");await settle();
 assert.match(roots["sport-baseball-content"].innerHTML,/Waiting for the official schedule/,"no fabricated baseball games");
 assert.match(roots["sport-baseball-content"].innerHTML,/tester@example.com/,"same signed-in account carries to baseball");
 assert.equal(app.getState("baseball").games.length,0,"baseball table isolated");
 const sw=fs.readFileSync("sw.js","utf8");
 assert.match(sw,/multi-sport\.js/,"PWA includes season selector client");
 assert.match(sw,/baseball-2027-series\.json/,"PWA caches official baseball series preview");
 const html=fs.readFileSync("index.html","utf8");
 for(const id of ["sports-view","picks-view","basketball-view","baseball-view"])
  assert.ok(html.includes('id="'+id+'"'),"Sport route exists: "+id);
 assert.ok(html.includes("SEC_SPORTS?.mount"),"route calls multi-sport manager");
 assert.ok(html.includes(":seasonLanding());"),"first website visit opens the most recently started season");
 assert.ok(html.includes("if(v==='sports')v=seasonLanding()"),"old sport-hub links redirect to current season");
 assert.ok(html.includes('id="global-sport-switch"'),"persistent sport switcher exists");
 assert.ok(html.indexOf('id="picks-heading"')<html.indexOf('id="global-sport-switch"'),"football headline and description precede sport switcher");
 assert.ok(html.indexOf('id="global-sport-switch"')<html.indexOf('id="week-picker"'),"sport selector follows the football intro before matchups");
 assert.ok(html.includes("pageIntro.insertAdjacentElement('afterend',sportSwitcher)"),"one switcher moves below current screen intro on navigation");
 assert.ok(html.includes("20261009-underintro-v5"),"updated sport selector styling is cache-busted");
 for(const sport of ["football","baseball","basketball"])
  assert.ok(html.includes('data-sport-tab="'+sport+'"'),"accessible sport icon: "+sport);
 assert.ok(html.includes('data-nav="current-sport"'),"mobile and desktop Picks tabs return to the selected sport");
 assert.ok(!html.includes('data-nav="sports"'),"no mandatory choose-sport navigation");
 assert.ok(html.includes("lastSportView"),"returning from other pages preserves chosen sport");
 assert.ok(html.includes("20261009-sharedaccount-v4"),"site loads updated shared-auth scripts rather than an old cached build");
 const shared=fs.readFileSync("multiplayer.js","utf8");
 assert.match(shared,/whenAuthReady:function/,"one Supabase login exposes session restoration to all sports");
 assert.match(shared,/publishAccount\(\)/,"auth restoration triggers sport refresh");
 assert.match(shared,/var authMode = "login"/,"returning users see login, not account creation");
 const sql=fs.readFileSync("supabase/migrations/20261009_basketball_baseball.sql","utf8");
 for(const name of ["sec_sport_games","sec_sport_leagues","sec_sport_picks","sec_sport_save_pick","sec_sport_standings","sec_sport_tiebreakers"])
  assert.ok(sql.includes(name),"secure sport backend includes "+name);
 assert.doesNotMatch(sql,/alter table public\.sec_games/,"football game table never migrated");
 assert.doesNotMatch(sql,/alter table public\.sec_league_picks/,"football picks never touched");
 console.log("Three-sport SEC Pick'em tests passed: calendar default, public games, league isolation, authenticated server saves and empty baseball.");
})().catch(error=>{console.error(error);process.exitCode=1;});
