"use strict";
// Game Center commentary: verified fallback, optional real AI, source links and HTML safety.
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
let signedIn={id:"player-1"},invokes=0,lookup=[];
const nodes={
 ".sec-community-news":{innerHTML:""},
 ".sec-community-reactions":{innerHTML:""}
};
const host={dataset:{communityGame:"football:2026-7-ALA-UGA"},querySelector:s=>nodes[s]};
const news={articles:[{title:"Alabama meets Georgia in key SEC clash",summary:"Preview of the SEC game.",
 sport:"football",teams:["Alabama","Georgia"],published_at:new Date().toISOString(),
 url:"https://www.espn.com/college-football/story/_/id/1234",source:"ESPN"}]};
const client={
 functions:{async invoke(name,args){
  invokes++;assert.equal(name,"sec-commentary");
  assert.equal(args.body.game_id,"2026-7-ALA-UGA");
  assert.equal(args.body.sport,"football");
  return {data:{available:true,generated:true,
   commentary:"Georgia and Alabama meet with plenty on the line. <script>alert(1)</script> The verified records favor no guaranteed winner."}};
 }},
 async rpc(name,args){
  assert.equal(name,"sec_game_reaction_totals");lookup.push(args.p_game);
  return {data:[],error:null};
 }
};
const window={secOnline:{getClient:()=>client,getUser:()=>signedIn},
 SEC_STATS:{getGame:()=>({away:{record:"5-1",rank:6},home:{record:"6-0",rank:2},home_win_pct:54.8})},
 SEC_BRIDGE:{state:()=>({favorite:"ALA"})}};
const document={querySelectorAll:()=>[host],addEventListener(){}};
const g={id:"2026-7-ALA-UGA",away:"ALA",home:"UGA"};
const sandbox={window,document,Date,Number,Object,Promise,URL,console,
 fetch:async()=>({ok:true,json:async()=>news})};
vm.runInNewContext(fs.readFileSync("sec-game-community.js","utf8"),sandbox,{filename:"sec-game-community.js"});
(async()=>{
 const card=window.SEC_GAME_COMMUNITY.panel(g,"football");
 assert.match(card,/fan zone/);
 assert.doesNotMatch(card,/Matchup headlines/);
 await window.SEC_GAME_COMMUNITY.load(g,"football");
 await new Promise(setImmediate);
 assert.equal(invokes,1,"AI is called exactly once when signed in");
 assert.match(nodes[".sec-community-news"].innerHTML,/🎙️ AI Commentary/);
 assert.match(nodes[".sec-community-news"].innerHTML,/AI-GENERATED/);
 assert.match(nodes[".sec-community-news"].innerHTML,/&lt;script&gt;/,"AI output is escaped");
 assert.doesNotMatch(nodes[".sec-community-news"].innerHTML,/<script>/,"no script injection");
 assert.match(nodes[".sec-community-news"].innerHTML,/noopener noreferrer/,"source links safe");
 assert.deepEqual(lookup,["football:2026-7-ALA-UGA"]);
 signedIn=null;host.dataset.communityGame="football:2026-7-TEX-OU";
 window.SEC_GAME_COMMUNITY.panel({id:"2026-7-TEX-OU",away:"TEX",home:"OU"},"football");
 await window.SEC_GAME_COMMUNITY.load({id:"2026-7-TEX-OU",away:"TEX",home:"OU"},"football");
 assert.match(nodes[".sec-community-news"].innerHTML,/MATCHUP PREVIEW/,"guest receives honest preview");
 assert.match(nodes[".sec-community-news"].innerHTML,/not currently available/,"guest not shown simulated AI");
 assert.equal(invokes,1,"guests do not invoke paid AI");
 const fn=fs.readFileSync("supabase/functions/sec-commentary/index.ts","utf8");
 assert.match(fn,/OPENAI_API_KEY/);
 assert.match(fn,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(fn,/sec_spend_commentary_credit/,"server rate limit is mandatory");
 assert.match(fn,/api.openai.com\/v1\/responses/);
 assert.match(fn,/never|Never/,"source verification present");
 console.log("AI commentary checks passed: no headline list, honest fallback, authenticated invocation, escaped AI output and rate limits.");
})().catch(e=>{console.error(e);process.exitCode=1;});
