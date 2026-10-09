/* Trophy Case smoke tests: verified final games only; no DB writes and no forged awards. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const win={};
const harness={window:win,document:{head:{appendChild(){}},createElement(){return {setAttribute(){},append(){},replaceChildren(){}};},getElementById(){return null;}},console};
vm.runInNewContext(fs.readFileSync("trophy-case.js","utf8"),harness,{filename:"trophy-case.js"});
const trophy=win.SDSTrophyCase;
assert.equal(trophy.trophies.length,4,"four rivalry trophies included");
const schedule={
 "2026-13-MSST-MISS":{id:"2026-13-MSST-MISS",away:"MSST",home:"MISS",date:"2026-11-28"},
 "2026-13-LSU-ARK":{id:"2026-13-LSU-ARK",away:"LSU",home:"ARK",date:"2026-11-28"},
 "2026-9-MIZ-ARK":{id:"2026-9-MIZ-ARK",away:"MIZ",home:"ARK",date:"2026-10-31"},
 "2026-13-LOU-UK":{id:"2026-13-LOU-UK",away:"LOU",home:"UK",date:"2026-11-28"}
};
const games=[
 {id:"2026-13-MSST-MISS",game_status:"final",winner:"MISS"},
 {id:"2026-13-LSU-ARK",game_status:"final",winner:"ARK"},
 {id:"2026-9-MIZ-ARK",game_status:"live",winner:"ARK"},
 {id:"2026-13-LOU-UK",game_status:"final",winner:null}
];
const picks={"2026-13-MSST-MISS":"MISS","2026-13-LSU-ARK":"LSU","2026-9-MIZ-ARK":"ARK","2026-13-LOU-UK":"UK"};
let result=trophy.deriveResults(games,picks,schedule,true,"league-a");
assert.equal(result.length,2,"only finished verified games that user picked");
assert.equal(result.filter(x=>x.correct).length,1,"correct award counted");
assert.equal(result.find(x=>x.trophyId==="golden-egg").correct,true);
assert.equal(result.find(x=>x.trophyId==="golden-boot").correct,false);
assert.equal(trophy.deriveResults(games,picks,schedule,false,"league-a").length,0,"signed-out picks never qualify");
assert.equal(trophy.deriveResults(games,picks,schedule,true,null).length,0,"picks without a league never qualify");
assert.equal(trophy.deriveResults(games,{},schedule,true,"league-a").length,0,"no picks gives no awards");
assert.equal(trophy.deriveResults([{id:"2026-13-MSST-MISS",game_status:"final",winner:"UK"}],picks,schedule,true,"league-a").length,0,"invalid winner cannot award");
trophy.sync({games,picks,schedule,authenticated:true,leagueId:"league-a",leagueName:"Testing Crew"});
assert.equal(trophy.getResults().length,2,"current league trophy results calculated");
trophy.sync({games,picks:{"2026-13-MSST-MISS":"MSST"},schedule,authenticated:true,leagueId:"league-b",leagueName:"Other Crew"});
assert.equal(trophy.getResults().length,1,"switch leagues clears previous results");
assert.equal(trophy.getResults()[0].correct,false,"second league result independent");
trophy.sync({authenticated:false});
assert.equal(trophy.getResults().length,0,"logout clears trophy results");
assert.throws(()=>trophy.setResults({wrong:true}),/Expected an array/);
console.log("SEC Trophy Case: 4 rivalry matches, verified awards, missed picks, league isolation and logout passed.");
