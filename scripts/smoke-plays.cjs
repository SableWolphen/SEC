"use strict";
/* Full play-by-play: safe ESPN source, async caching, fallback, no fabricated
   results, official game ID scope, PWA and responsive integration. */
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const read=p=>fs.readFileSync(p,"utf8");
const html=read("index.html"),cards=read("sec-final-cards.js"),center=read("sec-premium.js"),
 sw=read("sw.js"),edge=read("supabase/functions/sec-plays/index.ts"),
 css=read("sec-play-by-play.css"),src=read("sec-play-by-play.js");
new vm.Script(src,{filename:"sec-play-by-play.js"});
assert.match(html,/sec-play-by-play\.js\?v=20261012-plays-v1/);
assert.match(html,/sec-play-by-play\.css\?v=20261012-plays-v1/);
assert.match(html,/SEC_PLAYS\?\.placeholder\?\.\(g,"games"\)/);
assert.match(html,/SEC_PLAYS\?\.hydrate\?\.\(document\.getElementById\("games-list"\)\)/);
assert.match(cards,/SEC_PLAYS\?\.placeholder\?\.\(g,"games"\)/);
assert.match(center,/SEC_PLAYS\?\.placeholder\?\.\(g,"center",true\)/);
assert.match(center,/SEC_PLAYS\?\.hydrate\?\.\(host\)/);
assert.match(sw,/sec-pickem-v108/);
assert.match(sw,/sec-play-by-play\.js\?v=20261012-plays-v1/);
assert.match(css,/@media\(max-width:390px\)/);
assert.match(edge,/req\.headers\.get\("apikey"\)!==PUBLISHABLE/);
assert.match(edge,/\.eq\("id",id\)\.maybeSingle\(\)/);
assert.match(edge,/espn_event_id/);
assert.match(edge,/source:"ESPN game summary"/);
assert.match(edge,/game\.game_status==="live"\?20:600/);
assert.match(edge,/drives\?\.previous/);
assert.doesNotMatch(edge,/\.from\("sec_(?:picks|members)"/,"play service never queries private player tables");
assert.doesNotMatch(edge,/Array\.isArray\(source\?\.scoringPlays\)/,"partial scoring data cannot pose as all plays");
const document={readyState:"loading",visibilityState:"visible",querySelector:()=>null,
 querySelectorAll:()=>[],addEventListener:()=>{}};
const game={id:"2026-7-UGA-ALA",liveStatus:"live",espnEventId:"401856714"};
const bad={id:"2026-7-ARK-LSU",liveStatus:"final"};
const window={SEC_BRIDGE:{gameById:{[game.id]:game,[bad.id]:bad}},SEC_ONLINE_CONFIG:{
 url:"https://vzjrlvkwuswkryxxrvtp.supabase.co",publishableKey:"public-test-key"}};
let calls=0;
const fetch=async(url,init)=>{
 calls++;
 assert.match(url,/functions\/v1\/sec-plays\?game=2026-7-/);
 assert.equal(init.headers.apikey,"public-test-key");
 if(url.endsWith("LSU"))throw Error("Outage");
 return {ok:true,json:async()=>({game_id:game.id,event_id:"401856714",status:"live",
  source:"ESPN game summary",updated_at:"2026-10-12T00:00:00Z",
  plays:[{id:"p1",period:3,clock:"8:42",team:"UGA",type:"Pass",text:"<img src=x onerror=alert(1)> A completed pass",
    scoring:false,firstDown:true},{id:"p2",period:3,clock:"8:30",team:"UGA",text:"Touchdown pass",
    scoring:true,turnover:false}],
  drives:[{id:"d1",team:"UGA",description:"Seven-play drive",result:"Touchdown",
    plays:7,yards:66,scoring:true}]})};
};
const root={innerHTML:""};
const el={isConnected:true,open:true,dataset:{secPbpGame:game.id,secPbpContext:"games"},
 querySelector:()=>root};
const failedRoot={innerHTML:""};
const failed={isConnected:true,open:true,dataset:{secPbpGame:bad.id,secPbpContext:"center"},
 querySelector:()=>failedRoot};
const context={document,window,fetch,console,Date,Promise,AbortSignal,Intl,setInterval:()=>1};
vm.runInNewContext(src,context,{filename:"sec-play-by-play.js"});
const mod=window.SEC_PLAYS;assert.ok(mod);
const markup=mod.placeholder(game,"games");
assert.match(markup,/sec-pbp-panel/);
assert.match(markup,/Open to load recorded plays/);
assert.match(mod.placeholder(game,"center",true),/ open>/);
assert.doesNotMatch(mod.placeholder({id:"../../foo"}),/sec-pbp-panel/);
assert.match(mod.escapePlay({text:"<script>alert(1)</script>"}).text,/&lt;script&gt;/);
assert.equal(mod.quarter(3),"Q3");assert.equal(mod.quarter(5),"OT");
(async()=>{
 await mod.load(el);
 assert.match(root.innerHTML,/Touchdown pass/);
 assert.match(root.innerHTML,/All plays \(2\)/);
 assert.match(root.innerHTML,/Scoring \(1\)/);
 assert.match(root.innerHTML,/Drives \(1\)/);
 assert.match(root.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(root.innerHTML,/<img\s/i);
 assert.equal(calls,1);
 await mod.load(el);
 assert.equal(calls,1,"cache stops repeated live requests before TTL");
 await mod.load(failed);
 assert.match(failedRoot.innerHTML,/could not be loaded/);
 assert.equal(calls,2);
 console.log("Play-by-play: scoped ESPN plays, scoring, drives, XSS escapes, live caching and honest failure PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});