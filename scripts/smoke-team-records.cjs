/* SEC Teams favorite record tracker regression checks; no network or login. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const handlers={};
const example={
 updated_at:"2026-10-09T20:00:00Z",source:"ESPN",
 seasons:{football:2026,basketball:2026,baseball:2026},
 teams:{
  TENN:{
   football:{overall:"5-1",conference:"2-1",season:2026,source:"ESPN",
    source_url:"https://www.espn.com/college-football/team/_/id/2633"},
   basketball:{overall:"22-9",conference:"11-7",season:2026,scope:"Regular season",source:"ESPN"},
   baseball:{overall:"—",conference:null,season:2026,source:"ESPN"}
  },
  ALA:{
   football:{overall:"18-0",season:2025,source:"ESPN"},
   basketball:{overall:"9-1",season:2026,source:"fan"}
  }
 }
};
let rerenders=0,requests=0,recordLink=null;
const document={addEventListener:(event,handler)=>{handlers[event]=handler;}};
const window={SEC_BRIDGE:{view:()=>"teams",renderTeams:()=>{rerenders++;}}};
const context={window,document,Date,URL,console,fetch:async()=>{
 requests++;return {ok:true,json:async()=>example};
}};
vm.runInNewContext(fs.readFileSync("team-records.js","utf8"),context,{filename:"team-records.js"});
const go=async()=>{
 const app=window.SEC_TEAM_RECORDS;assert.ok(app);
 // A direct #teams visit starts loading on module initialization.
 await new Promise(setImmediate);await new Promise(setImmediate);
 await app.refresh();
 assert.ok(requests>=1,"published record snapshot requested without login");
 assert.ok(rerenders>=1,"open Teams rerenders once data arrives");
 assert.equal(app.entry("TENN","football").overall,"5-1");
 assert.equal(app.entry("TENN","basketball").overall,"22-9");
 assert.equal(app.entry("TENN","baseball"),null,"invalid record cannot appear as a result");
 assert.equal(app.entry("ALA","football"),null,"old-season record must not be presented as current");
 assert.equal(app.entry("ALA","basketball"),null,"non-ESPN source never presented as verified");
 const name={TENN:{name:"Tennessee",nick:"Volunteers"}};
 const view=app.spotlight("TENN",name,id=>'<span>'+id+'</span>');
 assert.match(view,/Football/);
 assert.match(view,/Basketball/);
 assert.match(view,/Baseball/);
 assert.match(view,/5-1/);
 assert.match(view,/22-9/);
 assert.match(view,/SEC: 2-1/);
 assert.match(view,/Regular-season record/,"historical API does not include postseason games");
 assert.match(view,/Conference record: —/,"not all sports have a published SEC split");
 assert.doesNotMatch(view,/18-0/);
 const empty=app.spotlight(null,name,()=>"<span/>");
 assert.match(empty,/Tap ★/,"favorite can be selected from existing school cards");
 const compact=app.compact("TENN");
 assert.match(compact,/5-1/);
 assert.match(compact,/22-9/);
 assert.match(compact,/—/,"unavailable sport record stays unknown");
 const html=fs.readFileSync("index.html","utf8");
 assert.match(html,/window\.SEC_TEAM_RECORDS\?\.refresh/,"Teams entry triggers feed load");
 assert.match(html,/data-fav=/,"favorite selection remains");
 assert.match(html,/records\?\.spotlight/,"Teams hero renders favorite");
 assert.match(html,/records\?\.compact/,"all 16 schools include sport previews");
 assert.match(html,/team-records\.js\?v=/,"record client cache busted");
 const sw=fs.readFileSync("sw.js","utf8");
 assert.match(sw,/team-records\.json/,"offline snapshot is cached");
 const seed=JSON.parse(fs.readFileSync("team-records.json","utf8"));
 assert.equal(Object.keys(seed.teams).length,16,"all schools appear in record feed schema");
 console.log("SEC Teams records tests passed: favorite HQ, 3 sports, ESPN validation, season isolation and empty records.");
};
go().catch(e=>{console.error(e);process.exitCode=1;});
