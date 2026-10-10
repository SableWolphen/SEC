/* Live drive requires real ESPN-sourced, recent data and never changes picks. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const win={};
vm.runInNewContext(fs.readFileSync("sec-live-drive.js","utf8"),{window:win,Date,Number});
const render=win.SEC_LIVE_DRIVE.render;
const g={away:"TAMU",home:"MIZ",livePossessionCode:"MIZ",liveDown:1,liveDistance:10,
 liveFieldPercent:35,liveDriveSummary:"4 plays, 28 yards",liveLastPlay:"Pass completed",
 liveSituationUpdatedAt:new Date().toISOString()};
const html=render(g,null,"live");
assert.match(html,/Current drive/);
assert.match(html,/MIZ ball · 1st &amp; 10/);
assert.match(html,/width:35%/);
assert.match(html,/🏈/);
assert.match(html,/4 plays, 28 yards/);
assert.match(html,/Pass completed/);
assert.doesNotMatch(html,/Watch ABC|Watch Live/);
assert.equal(render(g,null,"final"),"","a final game has no live drive");
assert.equal(render({...g,liveSituationUpdatedAt:new Date(Date.now()-10*60000).toISOString()},null,"live"),"","do not display old drive locations as current");
assert.equal(render({...g,livePossessionCode:"UNKNOWN"},null,"live").includes("fan-drive-ball"),false,"unknown possession has no field marker");
assert.equal(render({...g,liveFieldPercent:null},null,"live").includes("fan-drive-ball"),false,"no football marker without source-verified yardage");
assert.equal(render({...g,liveLastPlay:'<script>alert(1)</script>'},null,"live").includes("<script>"),false,"play texts are safely escaped");
const score=fs.readFileSync("sec-live-scores.js","utf8");
assert.match(score,/live_situation_updated_at/);
assert.match(score,/liveFieldPercent=row.live_field_percent/);
const worker=fs.readFileSync("supabase/functions/sec-scores/index.ts","utf8");
assert.match(worker,/college-football\/summary\?event=/);
assert.match(worker,/score_updated_at/);
assert.match(worker,/live_situation_updated_at/);
assert.match(worker,/verifiedCode/);
assert.match(fs.readFileSync("index.html","utf8"),/sec-live-drive.js\?v=/);
console.log("Live drive passed: verified field location, source freshness, score safety, data escaping, 30-second sync.");
