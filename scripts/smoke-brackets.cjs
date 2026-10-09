"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const events={},root={innerHTML:""};
const fixture={id:"sec-2027-basketball-test123",sport:"basketball",season:2027,
 round_label:"Quarterfinal",away_code:"ALA",away_name:"Alabama",home_code:"TENN",
 home_name:"Tennessee",kickoff_at:"2027-03-15T20:00:00Z",winner_code:null,status:"scheduled",
 source_url:"https://www.secsports.com/sport/mens-basketball"};
let writes=[];
const client={
 from:(name)=>name==="sec_bracket_games"?{
  select:()=>({order:async()=>({data:[fixture],error:null})})
 }:{
  select:()=>({eq:()=>({eq:async()=>({data:[],error:null})})})
 },
 rpc:async(name,args)=>{
  if(name==="sec_bracket_save"){writes.push(args);return {data:null,error:null};}
  return {data:[],error:null};
 }
};
const window={
 SEC_BRIDGE:{view:()=>null,toast:()=>{}},
 SEC_FAN:{getClub:()=>({id:"club-one",basketball_season:2027,baseball_season:2027})},
 secOnline:{getUser:()=>({id:"user-one"}),getClient:()=>client}
};
const document={getElementById:id=>id==="fan-brackets"?root:null,
 addEventListener:(name,fn)=>events[name]=fn};
const context={window,document,console,Date,Number,Promise,setInterval:()=>0};
vm.runInNewContext(fs.readFileSync("sec-brackets.js","utf8"),context,{filename:"sec-brackets.js"});
const run=async()=>{
 await window.SEC_BRACKETS.mount();
 assert.equal(window.SEC_BRACKETS.getFixtures().length,1);
 assert.match(root.innerHTML,/Quarterfinal/);
 assert.match(root.innerHTML,/Alabama/);
 assert.match(root.innerHTML,/Tennessee/);
 assert.match(root.innerHTML,/data-bracket-game/);
 assert.doesNotMatch(root.innerHTML,/Fake Team|TBD Seeds/);
 events.click({target:{closest:()=>({disabled:false,dataset:{bracketGame:fixture.id,bracketPick:"TENN"}})},preventDefault:()=>{}});
 await new Promise(setImmediate);await new Promise(setImmediate);
 assert.equal(writes.length,1);
 assert.equal(writes[0].p_pick,"TENN");
 assert.equal(writes[0].p_club,"club-one");
 const sql=fs.readFileSync("supabase/migrations/20261009_secure_postseason_brackets.sql","utf8");
 assert.match(sql,/clock_timestamp\(\)>=g.kickoff_at/);
 assert.match(sql,/sec_club_is_member/);
 assert.match(sql,/sec_bracket_picks/);
 assert.match(sql,/revoke all on public.sec_bracket_games/);
 console.log("SEC postseason brackets pass: only published fixtures, server-validated pick, secure locks.");
};
run().catch(e=>{console.error(e);process.exitCode=1;});