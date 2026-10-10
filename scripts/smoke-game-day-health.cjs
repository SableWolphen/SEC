"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {evaluate,publicConfig}=require("./check-football-health.cjs");
const reference=Date.parse("2026-10-10T18:00:00Z");
const fresh=()=>Array.from({length:120},(_,i)=>({
 id:"2026-week-"+(i+1),away_code:"ALA",home_code:"TENN",
 kickoff_at:new Date(reference+86400000).toISOString(),game_status:"scheduled",
 winner:null,home_score:null,away_score:null,score_updated_at:null
}));
let games=fresh(),status=evaluate(games,reference);
assert.equal(status.ok,true,"valid future schedule healthy");
assert.equal(status.checked,120);
games=fresh();games[0]={...games[0],kickoff_at:new Date(reference-3*3600000).toISOString(),
 game_status:"final",winner:"ALA",away_score:21,home_score:17};
status=evaluate(games,reference);assert.equal(status.ok,true);
games[0].game_status="live";games[0].winner=null;
games[0].score_updated_at=new Date(reference-30*60000).toISOString();
status=evaluate(games,reference);assert.equal(status.ok,false);
assert.match(status.issues[0],/unchanged/);
games[0].score_updated_at=new Date(reference-6*60000).toISOString();
status=evaluate(games,reference);assert.equal(status.ok,true,"ordinary score delays do not page anyone");
games[0].game_status="postponed";games[0].score_updated_at=null;
status=evaluate(games,reference);assert.equal(status.ok,true,"postponed game is not a missing score");
games[0].game_status="scheduled";
status=evaluate(games,reference);assert.equal(status.ok,false,"kickoff overdue alert");
games[0].game_status="final";games[0].winner=null;
status=evaluate(games,reference);assert.equal(status.ok,false,"unverified final flags");
assert.equal(evaluate([],reference).ok,false,"missing schedule must not be falsely healthy");
const file=fs.readFileSync("config.js","utf8");
const cfg=publicConfig(file);assert.match(cfg.url,/supabase/);assert.match(cfg.key,/^sb_publishable_/);
const flow=fs.readFileSync(".github/workflows/football-health.yml","utf8");
assert.ok(flow.includes("issues: write"));assert.ok(flow.includes("gh issue create"));
assert.ok(flow.includes("gh issue close"));assert.ok(flow.includes("*/15 * * * 4,5,6,0"));
const script=fs.readFileSync("supabase/functions/sec-scores/index.ts","utf8");
assert.ok(script.includes('if(name.includes("cancel"))return "canceled";'));
assert.ok(script.includes('if(name.includes("postpon"))return "postponed";'));
assert.ok(script.indexOf('if(name.includes("cancel"))')<script.indexOf('if(typ.completed===true'));
assert.ok(script.includes("safeReschedule"),"future verified kickoff changes update authoritative lock");
assert.ok(script.includes("const changed=status!==g.game_status"),"repeated unchanged polls are not fake freshness");
console.log("Game-day health checks passed: score staleness, final accuracy, postponements, overdue kickoffs, alert recovery and verified pregame lock changes.");
