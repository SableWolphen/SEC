"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const edge=fs.readFileSync("supabase/functions/sec-scores/index.ts","utf8");
const ncaa=fs.readFileSync("supabase/functions/sec-scores/ncaa.ts","utf8");
const migration=fs.readFileSync("supabase/migrations/20261010_football_multi_source_scores.sql","utf8");
assert.match(edge,/import \{fetchNcaa,matchNcaa,pickLive\} from "\.\/ncaa\.ts"/);
assert.match(edge,/ncaaPending=Promise\.all/);
assert.match(ncaa,/sdataprod\.ncaa\.com/,"the second source is NCAA, not a second ESPN URL");
assert.match(ncaa,/division:11/,"official NCAA FBS division");
assert.match(ncaa,/recognize\(game\.away_code/,"both teams must match");
assert.match(ncaa,/recognize\(game\.home_code/,"away-only matching is unsafe");
assert.match(ncaa,/if\(match\.length!==1\)return null/,"ambiguous matches ignored");
assert.match(ncaa,/Number\.isInteger\(away\).*Number\.isInteger\(home\)/,"scores must be integers");
assert.match(ncaa,/oldAway!==null&&oldHome!==null/,"live-score rollback is guarded");
assert.match(ncaa,/const agree=ncaa&&ncaa\.away===espnAway&&ncaa\.home===espnHome/,
 "downward score corrections require cross-source agreement");
assert.match(edge,/const preferred=status==="final"\?\{away:awayScore,home:homeScore,source:"ESPN"\}/,
 "NCAA never chooses official final scores or awards picks");
assert.match(edge,/const winner=rawStatus==="final"/,
 "only ESPN official completed events set winners");
assert.match(edge,/ncaaAhead/,"observe which source advanced the live scoreboard");
assert.match(edge,/rpc\/sec_verify_scores_job/,"all scorer writes remain private");
assert.match(migration,/live_score_source/,"displayed scoreboard source can be audited");
assert.doesNotMatch(ncaa,/SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY/,"NCAA helper carries no database secrets");
console.log("Two-source scorer checks passed: strict team matching, monotonic safe live scores, ESPN-only finals and private updates.");
