/* Deterministic basketball regressions. No production accounts or writes. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(process.env.SEC_SPORT_SOURCE||"multi-sport.js","utf8");
const NOW=Date.parse("2027-01-10T18:00:00Z");
class Clock extends Date{constructor(...args){super(...(args.length?args:[NOW]));}static now(){return NOW;}}
const game=(id,week,extra={})=>({id,sport:"basketball",season:2027,week,
 kickoff_at:"2027-01-12T18:00:00Z",home_code:"333",home_name:"Alabama",away_code:"2633",
 away_name:"Tennessee",game_status:"scheduled",source:"ESPN",...extra});
const fixtures=[game("past",1,{kickoff_at:"2027-01-01T18:00:00Z",game_status:"final",home_score:80,away_score:75,winner_code:"333"}),
 game("next",3),game("later",4,{kickoff_at:"2027-01-19T18:00:00Z"})];
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(setImmediate);};
function setup({storedWeek,publicGames=fixtures,games=fixtures,mode="straight",coverage={}}={}){
 const state={user:{id:"A",email:"a@example.com"},games,hold:null,fail:false};
 const calls=[],events={},roots={"sport-basketball-content":{innerHTML:""},"sports-hub":{innerHTML:""}};
 const storage=new Map(storedWeek?[["sec-week-basketball-2027",String(storedWeek)]]:[]);
 const leagues=["one","two"].map(id=>({id,sport:"basketball",season:2027,name:"League "+id,mode,invite_code:"1234567890"}));
 const db={from(table){
  const filters={};
  const chain={select(){return chain;},eq(key,value){filters[key]=value;return chain;},order(){return chain;},
   then(resolve,reject){
    let data=table==="sec_sport_games"?state.games:table==="sec_sport_leagues"?leagues:
     table==="sec_sport_picks"?[{game_id:"past",pick_code:filters.league_id==="two"?"2633":"333"}]:[];
    data=JSON.parse(JSON.stringify(data));
    if(table==="sec_sport_picks"&&state.hold){
     const hold=state.hold;state.hold=null;
     return new Promise(done=>{state.release=()=>done(state.fail?{error:{message:"Old request failed"}}:{data});hold();}).then(resolve,reject);
    }
    return Promise.resolve({data}).then(resolve,reject);
   }};return chain;
 },rpc:async(name,args)=>{calls.push({name,...args});return {data:[]};},functions:{invoke:async()=>({data:{ok:true}})}};
 const window={SEC_BRIDGE:{view:()=>"basketball"},secOnline:{configured:true,getUser:()=>state.user,
  getClient:()=>db,isAuthReady:()=>true,whenAuthReady:async()=>{}}};
 const context={window,Date:Clock,console:{warn(){}},URL,URLSearchParams,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  document:{getElementById:id=>roots[id]||null,addEventListener:(type,fn)=>events[type]=fn,querySelector:()=>null},
  location:{search:"",href:"https://example.com/#basketball"},history:{replaceState(){}},setInterval(){},
  fetch:async()=>({ok:true,json:async()=>({sports:{basketball:{games:publicGames,team_coverage:coverage}}})})};
 vm.runInNewContext(source,context);
 const app=window.SEC_SPORTS;
 function click(selector,dataset){events.click({target:{closest:key=>key===selector?{dataset}:null},preventDefault(){}});}
 return {app,state,calls,roots,click,html:()=>roots["sport-basketball-content"].innerHTML};
}
const checks={
 async "only count school feeds that contain usable basketball games"(){
  const t=setup({coverage:{"333":0,"2633":12,"999":40}});await settle();
  assert.match(t.html(),/1\/16 school feeds/);
 },
 async "restore the player's selected basketball week"(){
  const t=setup({storedWeek:1});await settle();
  assert.match(t.html(),/Week 1 matchups/);
  assert.equal(t.calls.find(c=>c.name==="sec_sport_standings").p_week,1);
 },
 async "use freshly fetched database games for the first standings week"(){
  const t=setup({publicGames:[],games:[fixtures[2]]});await settle();
  assert.match(t.html(),/Week 4 matchups/);
  assert.equal(t.calls.find(c=>c.name==="sec_sport_standings").p_week,4);
 },
 async "discard a delayed previous-league response and clear its picks immediately"(){
  const t=setup();await settle();
  let started;const ready=new Promise(r=>started=r);t.state.hold=started;
  void t.app.load("basketball");await ready;
  t.app.selectLeague("basketball","two");
  assert.equal(Object.keys(t.app.getState("basketball").picks).length,0);
  t.state.release();await settle();
  assert.equal(t.app.getState("basketball").active,"two");
  assert.equal(t.app.getState("basketball").picks.past.pick_code,"2633");
 },
 async "keep a selected week while an older week request finishes"(){
  const t=setup();await settle();let started;const ready=new Promise(r=>started=r);t.state.hold=started;
  void t.app.load("basketball");await ready;
  t.click("[data-sport-week]",{sport:"basketball",sportWeek:"4"});
  t.state.release();await settle();
  assert.match(t.html(),/Week 4 matchups/);
  assert.equal(t.calls.filter(c=>c.name==="sec_sport_standings").at(-1).p_week,4);
 },
 async "discard previous-account picks and errors during login changes"(){
  for(const fail of [false,true]){
   const t=setup();await settle();t.app.authChanged();await settle();
   let started;const ready=new Promise(r=>started=r);t.state.hold=started;t.state.fail=fail;
   void t.app.load("basketball");await ready;
   t.state.user={id:"B",email:"b@example.com"};t.app.authChanged();
   assert.equal(Object.keys(t.app.getState("basketball").picks||{}).length,0);
   t.state.release();await settle();
   assert.doesNotMatch(t.html(),/Old request failed|a@example.com/);
   assert.match(t.html(),/b@example.com/);
  }
 },
 async "grade the cover instead of the straight winner, including pushes and missing data"(){
  const cases=[{spread:-7,label:"Incorrect cover"},{spread:-3,label:"Correct cover"},
   {spread:-5,label:"Push · no points"},{spread:null,label:"Result pending verification"}];
  for(const c of cases){
   const t=setup({storedWeek:1,mode:"spread",games:[{...fixtures[0],spread_home:c.spread}]});await settle();
   t.click("[data-sport-week]",{sport:"basketball",sportWeek:"1"});await settle();
   assert.ok(t.html().includes(c.label),c.label);
   if(c.spread===-5||c.spread===null)assert.doesNotMatch(t.html(),/Incorrect pick|Correct pick|Incorrect cover/);
  }
 },
 async "do not label an unverified straight result as an incorrect pick"(){
  const t=setup({storedWeek:1,games:[{...fixtures[0],winner_code:null}]});await settle();
  t.click("[data-sport-week]",{sport:"basketball",sportWeek:"1"});await settle();
  assert.match(t.html(),/Result pending verification/);assert.doesNotMatch(t.html(),/Incorrect pick/);
 }
};
(async()=>{
 let failed=0;
 for(const [name,check] of Object.entries(checks)){
  try{await check();console.log("PASS "+name);}catch(error){failed++;console.error("FAIL "+name+"\n"+error.stack);}
 }
 console.log((Object.keys(checks).length-failed)+"/"+Object.keys(checks).length+" basketball reliability checks passed");
 if(failed)process.exitCode=1;
})();
