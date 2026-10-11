/* National university rankings: source validation, freshness, visible cards, sport isolation. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const src=fs.readFileSync("sec-rankings.js","utf8");
new vm.Script(src,{filename:"sec-rankings.js"});
const now=new Date(),recent=new Date(Date.now()-2*86400000).toISOString().slice(0,10);
function season(sport,date=new Date()){
 const year=date.getUTCFullYear(),month=date.getUTCMonth()+1;
 return sport==="football"?(month>=8?year:year-1):
        sport==="basketball"?(month>=8?year+1:year):
        (month>=2?year:year-1);
}
const LINKS={
 football:"https://www.espn.com/college-football/rankings",
 basketball:"https://www.espn.com/mens-college-basketball/rankings",
 baseball:"https://www.espn.com/college-baseball/rankings"
};
function poll(sport,name,teams,date=recent){
 return {source:"ESPN",source_url:LINKS[sport],poll:name,published_at:date,
  season:season(sport,new Date(date+"T12:00:00Z")),poll_size:25,teams};
}
let payload={source:"ESPN",checked_at:new Date().toISOString(),sports:{
 football:poll("football","AP Top 25",{ALA:{rank:3,previous:2},TENN:{rank:14,previous:16}}),
 basketball:poll("basketball","AP Top 25",{UK:{rank:6,previous:5}}),
 baseball:poll("baseball","D1Baseball Top 25",{LSU:{rank:2,previous:4}})
}};
let requests=0,redraws=0,mounted="teams",visible="visible";
const document={addEventListener(){},get visibilityState(){return visible},activeElement:null};
const window={SEC_BRIDGE:{view:()=>mounted,renderTeams:()=>redraws++,renderPicks:()=>redraws++},
 SEC_HOME:{refresh(){redraws++}},SEC_SPORTS:{renderSport(){redraws++}}};
const run={window,document,Date,Promise,URL,console,setInterval:()=>{},
 fetch:async()=>{requests++;return {ok:true,json:async()=>payload}}};
vm.runInNewContext(src,run,{filename:"sec-rankings.js"});
const settle=()=>new Promise(ok=>setImmediate(ok));
(async()=>{
 await settle();await settle();
 const rankings=window.SEC_RANKINGS;
 assert.ok(rankings,"university ranking controller is public");
 assert.equal(rankings.rank("ALA"),3);
 assert.equal(rankings.rank("TENN"),14);
 assert.equal(rankings.rank("UK","basketball"),6);
 assert.equal(rankings.rank("LSU","baseball"),2);
 assert.equal(rankings.rank("TEX","football"),null,"an unranked team is not given a fake rank");
 assert.equal(rankings.rank("OHST","football"),null,"non-SEC teams never map to another school");
 assert.match(rankings.badge("ALA"),/#3/);
 assert.match(rankings.badge("TEX","football",true),/>NR<\/span>/);
 assert.match(rankings.badge("ALA"),/AP Top 25/);
 assert.ok(rankings.note("football").includes("AP Top 25"),"poll source is labeled");
 assert.match(rankings.sourceLink("football"),/espn\.com\/college-football\/rankings/);
 const panel=rankings.teamPanel("TENN");
 assert.match(panel,/National college rankings/);
 assert.match(panel,/Men&#39;s Basketball|Men's Basketball/);
 assert.match(panel,/Baseball/);
 assert.match(panel,/Unranked|>NR</);
 assert.match(panel,/source-verified|AP Top 25/);
 assert.equal(rankings.teamPanel("BOGUS"),"");
 const first=requests;
 await rankings.refresh();
 assert.equal(requests,first,"foreground reloads are throttled");
 assert.ok(redraws>0,"visible Teams rerenders after verified poll arrives");
 payload={...payload,sports:{...payload.sports,football:
  {...payload.sports.football,poll:"<img src=x onerror=alert(1)>"}}};
 await rankings.refresh(true);
 assert.match(rankings.teamPanel("TENN"),/&lt;img/,"poll names are escaped");
 assert.doesNotMatch(rankings.teamPanel("TENN"),/<img src=/);
 const oldDate=new Date(Date.now()-50*86400000).toISOString().slice(0,10);
 payload={...payload,sports:{...payload.sports,football:
  poll("football","AP Top 25",{ALA:{rank:3}},oldDate)}};
 await rankings.refresh(true);
 assert.equal(rankings.rank("ALA"),null,"old rankings never masquerade as current");
 assert.equal(rankings.badge("ALA"),"","no active badge for old poll");
 assert.match(rankings.note("football"),/Last published/);
 assert.match(rankings.teamPanel("ALA"),/Last #3|—/);
 payload={...payload,sports:{...payload.sports,football:
  {...payload.sports.football,source_url:"javascript:alert(1)"}}};
 await rankings.refresh(true);
 assert.equal(rankings.rank("ALA"),null,"invalid poll is not loaded");
 assert.equal(rankings.getSnapshot()?.sports?.football?.source_url,LINKS.football,
  "last verified dated poll is preserved when subsequent data is invalid");
 assert.equal(rankings.getFailed(),true);
 // Baseball rankings have a second, explicitly trusted publisher:
 // NCAA's published D1Baseball Top 25, not an unverified ESPN 404 fallback.
 payload={...payload,sports:{...payload.sports,baseball:{
  ...payload.sports.baseball,source:"NCAA",
  source_url:"https://www.ncaa.com/rankings/baseball/d1/d1baseballcom-top-25"
 },football:{...payload.sports.football,source_url:LINKS.football}}};
 await rankings.refresh(true);
 assert.equal(rankings.rank("LSU","baseball"),2,"NCAA D1Baseball rank is valid for exact verified school");
 assert.match(rankings.sourceLink("baseball"),/ncaa\.com\/rankings\/baseball\/d1/);

 const html=fs.readFileSync("index.html","utf8"),sportJS=fs.readFileSync("multi-sport.js","utf8"),
  football=fs.readFileSync("matchup-stats.js","utf8"),records=fs.readFileSync("team-records.js","utf8"),
  home=fs.readFileSync("sec-home.js","utf8"),sw=fs.readFileSync("sw.js","utf8");
 assert.match(html,/SEC_RANKINGS\?\.badge\?\.\(id,"football",true\)/);
 assert.match(sportJS,/SEC_RANKINGS\?\.badge/);
 assert.match(football,/SEC_RANKINGS\?\.badge/);
 assert.match(records,/SEC_RANKINGS\?\.teamPanel/);
 assert.match(home,/SEC_RANKINGS\?\.hasCurrent/);
 assert.match(sw,/rankings\.json/);
 assert.match(sw,/sec-rankings\.js\?v=/);
 console.log("National university polls: dated AP/D1Baseball, validated ranks, unranked and stale states, XSS, all sport/team views PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
