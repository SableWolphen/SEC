"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const edge=fs.readFileSync("supabase/functions/sec-scores/index.ts","utf8");
const activation=fs.readFileSync("supabase/migrations/20261009_activate_football_score_cron.sql","utf8");
const fix=fs.readFileSync("supabase/migrations/20261009_missouri_kansas_football_date.sql","utf8");
const html=fs.readFileSync("index.html","utf8");
const sw=fs.readFileSync("sw.js","utf8");
assert.match(edge,/rpc\/sec_verify_scores_job/,"score updates require a verified private job token");
assert.match(edge,/valid!==true/,"no unauthenticated score updates");
assert.match(edge,/awayScore!==null&&homeScore!==null&&awayScore!==homeScore/,
 "only official completed scores with a unique winner count");
for(const code of ["AUSTPEAY","NALA","TNSTATE","CAMP"]){
 assert.match(edge,new RegExp(code+":\\["),"recognize verified 2026 nonconference opponent "+code);
}
assert.match(edge,/KSU:\["KSU","KENN","KENNESAW","KENNESAW STATE"\]/,
 "Kennesaw State is not confused with Kansas State");
assert.doesNotMatch(edge,/KSU:\[[^\]]*"KANSAS STATE"/,"incorrect team recognition would change outcomes");
assert.match(activation,/pg_cron/);
assert.match(activation,/pg_net/);
assert.match(activation,/sec_scores_job_token/);
assert.match(activation,/\*\/30 \* \* \* 4,5,6,0/,"active football weekends include Thursday nights");
assert.match(activation,/0 \*\/6 \* \* 1,2,3/,"weekday scoreboard catch-up runs");
assert.match(activation,/revoke all on function public.sec_verify_scores_job/,
 "secret-verification RPC cannot be invoked by anonymous users");
assert.doesNotMatch(activation,/grant (update|insert) on public.sec_games/i);
assert.match(fix,/update public.sec_games/);
assert.match(fix,/id='2026-2-MIZ-KANS'/);
assert.doesNotMatch(fix,/delete from public.sec_/i,"never touch historical picks or leagues");
assert.match(html,/\['MIZ','KANS','20:00','FOX',null,'2026-09-11'\]/,
 "Friday Missouri–Kansas game appears on correct date");
assert.match(html,/if\(month>=7\)return 'picks'/,
 "October home routing keeps football ahead of future sports");
assert.match(html,/2026\.10\.10-brags-arena\.2/);
assert.match(sw,/sec-pickem-v53/);
console.log("2026 live football synchronization regression passed: private Cron, correct FCS teams, ESPN verified finals, Friday game, football landing and cache.");
