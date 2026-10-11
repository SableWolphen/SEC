/* Verify trophies are derived from verified records and never mutate picks. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const src=fs.readFileSync("sec-trophy-legacy.js","utf8");
const saved=new Map();
const me={id:"u1"},lg={id:"L1",name:"Test League"};
let currentUser=me,currentLeague=lg;
const champRows=[
 {league_id:"L1",season:2025,champion_user_id:"u1"},
 {league_id:"L1",season:2026,champion_user_id:"u2"},
 {league_id:"L2",season:2024,champion_user_id:"u1"}
];
let sportStates={basketball:{},baseball:{}};
const sandbox={
 window:{
  secOnline:{getUser:()=>currentUser,getLeague:()=>currentLeague,getStandings:()=>[]},
  SEC_SOCIAL:{getChampions:()=>champRows},
  SEC_SPORTS:{getState:s=>sportStates[s]}
 },
 document:{addEventListener(){}},
 localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},
 console
};
vm.createContext(sandbox);vm.runInContext(src,sandbox);
const engine=sandbox.window.SEC_TROPHY_LEGACY;
assert(engine&&typeof engine.catalog==="function","award engine must load");
function ctx(verified,picks,opts={}){
 return {signedIn:opts.signedIn??true,leagueId:opts.leagueId??"L1",
  records:opts.records||[],
  schedule:{
   g1:{id:"g1",week:1,date:"2026-10-10",kickoff:"2026-10-10T12:00:00Z"},
   g2:{id:"g2",week:1,date:"2026-10-10",kickoff:"2026-10-10T15:00:00Z"},
   g3:{id:"g3",week:2,date:"2026-10-17",kickoff:"2026-10-17T12:00:00Z"}
  },
  verified,myPicks:picks
 };
}
const finals=[
 {id:"g1",game_status:"final",winner:"ALA"},
 {id:"g2",game_status:"final",winner:"TENN"},
 {id:"g3",game_status:"scheduled",winner:null}
];
const userPicks={g1:"ALA",g2:"TENN",g3:"ARK"};
const before=JSON.stringify(userPicks);
const c=ctx(finals,userPicks);
const data=engine.catalog(c);
assert.equal(engine.sportFacts(c,"football").correct,2);
assert.equal(engine.sportFacts(c,"football").graded,2);
assert.equal(engine.sportFacts(c,"football").perfect,1,"entire verified week correctly picked");
assert.equal(engine.sportFacts(c,"football").streak,2);
assert.equal(data.titleCount,1,"champions must stay inside active league");
assert.equal(data.awards.find(a=>a.id==="perfect-week").tier,1);
assert.equal(JSON.stringify(userPicks),before,"must not change saved picks");
const notDone=ctx([{id:"g1",game_status:"final",winner:"ALA"},{id:"g2",game_status:"live",winner:"TENN"}],userPicks);
assert.equal(engine.sportFacts(notDone,"football").perfect,0,"no premature perfect week");
const guest=ctx(finals,userPicks,{signedIn:false,leagueId:null});
assert.equal(engine.sportFacts(guest,"football").correct,0,"guests cannot earn personal awards");
currentLeague={id:"L2",name:"Other"};
assert.equal(engine.catalog(c).titleCount,1,"only titles in the selected league count");
currentLeague={id:"L3",name:"No titles"};
assert.equal(engine.catalog(c).titleCount,0,"no cross-league title leak");
currentLeague=lg;
sportStates.basketball={
 active:"B1",leagues:[{id:"B1",mode:"spread"}],
 games:[{id:"b1",week:1,kickoff_at:"2027-02-01T18:00:00Z",game_status:"final",
 home_code:"ALA",away_code:"ARK",winner_code:"ALA",home_score:81,away_score:80,spread_home:-7}],
 picks:{b1:{pick_code:"ARK"}}
};
assert.equal(engine.sportFacts(c,"basketball").correct,1,"spread grading must use line not winner");
assert.equal(engine.sportFacts(c,"basketball").perfect,1);
sportStates.basketball.picks.b1.pick_code="ALA";
assert.equal(engine.sportFacts(c,"basketball").correct,0,"incorrect spread should not earn award");
sportStates.basketball.active=null;
assert.equal(engine.sportFacts(c,"basketball").graded,0,"inactive sport league cannot award");
console.log("SEC Trophy Legacy: verified awards, league isolation, spread picks, no data mutation PASS");
