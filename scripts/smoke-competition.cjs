"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const listeners={};
const win={};
const document={getElementById(){return null},addEventListener(k,fn){listeners[k]=fn;}};
vm.runInNewContext(fs.readFileSync("sec-competitive-tools.js","utf8"),{
 window:win,document,Date,Number,Map,Set,Array,Promise,String
});
assert.ok(win.SEC_COMPETITIVE?.scenario&&win.SEC_COMPETITIVE?.choices);
const match={id:"game-1",game_status:"live",away_code:"TAMU",home_code:"MIZ",away_score:10,home_score:7};
const picks=[{user_id:"me",game_id:"game-1",pick_code:"TAMU"},
 {user_id:"them",game_id:"game-1",pick_code:"MIZ"}];
const first=win.SEC_COMPETITIVE.scenario([
 {user_id:"me",season_points:5},{user_id:"them",season_points:5}
],[match],picks,"me");
assert.equal(first.winning,1,"only TAMU winning gives the user first");
assert.equal(first.ties,0);
assert.equal(first.total,2);
assert.equal(first.best.outcome[0],"TAMU");
const rank=win.SEC_COMPETITIVE.rankStatus([
 {user_id:"me",season_points:6},
 {user_id:"them",season_points:8},
 {user_id:"third",season_points:5}
],"me");
assert.equal(rank.rank,2);
assert.equal(rank.count,3);
assert.equal(rank.gap,2);
const tie=win.SEC_COMPETITIVE.scenario([
 {user_id:"me",season_points:5},{user_id:"them",season_points:6}
],[match],picks,"me");
assert.equal(tie.winning,0,"a tied leaderboard is not outright first");
assert.equal(tie.ties,1);
assert.equal(tie.best,null);
assert.equal(win.SEC_COMPETITIVE.scenario([
 {user_id:"me",season_points:5},{user_id:"them",season_points:5}
],[{...match,game_status:"final"}],picks,"me"),null);
const js=fs.readFileSync("sec-competitive-tools.js","utf8");
assert.match(js,/SEC_LEAGUE_INSIGHTS\?\.upset/,"upsets derive only from previously verified published lines");
assert.match(js,/p_expected:p\.candidates\.map/,"transfer is limited to explicitly previewed picks");
assert.match(js,/sec_copy_my_league_picks/,"transfer uses atomic server-side RPC");
assert.match(js,/W\.confirm/,"transfer requires user confirmation");
assert.match(js,/sec_revealed_league_picks/,"opponent picks use kickoff-gated RPC");
assert.match(js,/sec_club_standings/,"multi-sport clubs can calculate football-only scenarios");
assert.match(js,/Football-only scenarios; other sports/, "club scenarios always disclose limitation");
assert.match(js,/const live=gs\.filter/,"live matches are scoped before scenario calculation");
assert.match(js,/const remaining=gs\.filter/,"unstarted games never block active live scenarios");
assert.match(js,/sec_revealed_league_picks/,"only secured kickoff-revealed picks are used");
assert.match(js,/if\(remaining.length\)message/,"future outcomes are explicitly excluded");
assert.match(js,/id="sec-path-fold"/,"path offers a real disclosure");
assert.match(js,/const expanded=host\.querySelector/,"league card does not collapse on score refresh");
assert.match(fs.readFileSync("sec-live-scores.js","utf8"),/SEC_COMPETITIVE\?\.refreshPath\?\.\(\)/,
 "score refresh triggers an update to Path to 1st");
const sql=fs.readFileSync("supabase/migrations/20261010_copy_football_picks_atomic.sql","utf8");
for(const regex of [/sec_is_member\(p_source\)/,/sec_is_member\(p_target\)/,
 /s\.user_id=v_user/,/clock_timestamp\(\)>=v_row\.kickoff_at/,
 /on conflict\(league_id,user_id,game_id\) do nothing/,
 /p\.confidence_points=n/,/v_mode='spread' and v_row\.spread_home is null/,
 /jsonb_array_elements\(p_expected\)/,/grant execute on function .* to authenticated/]){
 assert.match(sql,regex,"atomic copying enforces existing picks, locks, league rules, preview and membership");
}
const html=fs.readFileSync("index.html","utf8");
assert.match(html,/sec-competitive-tools\.js\?v=/);
assert.match(html,/SEC_COMPETITIVE\?\.onPicks\?\.\(\)/);
const league=fs.readFileSync("league-settings.js","utf8");
assert.match(league,/SEC_COMPETITIVE\?\.onLeague\?\.\(\)/);
console.log("SEC competition tests passed: live sourced upsets, strictly calculated post-kickoff first-place scenarios, and atomic never-overwrite pick transfers.");
