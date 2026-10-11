/* Archived championship season engraving: no invented years or duplicate generic trophies. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const museumText=fs.readFileSync("trophy-museum.js","utf8");
const modelText=fs.readFileSync("sec-champion-3d.js","utf8");
const champions=[
 {league_id:"league-a",season:2026,champion_user_id:"u1"},
 {league_id:"league-a",season:"2025",champion_user_id:"u1"},
 {league_id:"league-a",season:2026,champion_user_id:"u1"}, // duplicate archive row must not duplicate the trophy
 {league_id:"league-b",season:2024,champion_user_id:"u1"},
 {league_id:"league-a",season:2023,champion_user_id:"u2"},
 {league_id:"league-a",season:"not a season",champion_user_id:"u1"}
];
const context={window:{SEC_SOCIAL:{getChampions:()=>champions}},document:{},console};
vm.runInNewContext(museumText,context);
const api=context.window.SEC_TROPHY_MUSEUM;
const league={id:"league-a",name:"Friends League"};
const years=Array.from(api.champions("football","u1",league),r=>r.season);
assert.deepEqual(years,[2026,2025],"use the actual archived seasons, most recent first");
const html=api.championshipCards(["football","basketball","baseball"],"u1",league).join("");
assert.equal((html.match(/class="museum-champ /g)||[]).length,4,"two earned football seasons and two locked sports");
assert.equal((html.match(/data-champion-card="football"/g)||[]).length,2,"repeat winners earn a trophy for each year");
assert.equal((html.match(/data-champion-season="2026"/g)||[]).length,1);
assert.equal((html.match(/data-champion-season="2025"/g)||[]).length,1);
assert.match(html,/data-champion-key="football:2026"/);
assert.match(html,/data-champion-key="football:2025"/);
assert.match(html,/data-champion-key="basketball:locked"/);
assert.match(html,/data-champion-key="baseball:locked"/);
assert.match(html,/>2026<\/text>/,"3D fallback artwork must show 2026 engraved on the plaque");
assert.match(html,/>2025<\/text>/,"3D fallback artwork must show 2025 engraved on the plaque");
const lone=api.championshipCards(["football"],"u2",league).join("");
assert.equal((lone.match(/class="museum-champ /g)||[]).length,1);
assert.match(lone,/2023/,"other players' owned year appears only in their own case");
assert.doesNotMatch(lone,/2026|2025/);
const guest=api.championshipCards(["football"],null,league).join("");
assert.match(guest,/data-champion-key="football:locked"/);
assert.doesNotMatch(guest,/data-champion-season/,"locked trophies cannot show a year");
assert.doesNotMatch(guest,/data-champion-year="2026"/);
assert.equal(api.champions("football","u1",{id:"league-b"}).length,1,"league-scoped history");
assert.equal(api.champions("basketball","u1",league).length,0,"no unverified basketball title");
assert.equal(api.champions("baseball","u1",league).length,0,"no unverified baseball title");
assert.match(modelText,/season\?String\(season\):"CHAMPION"/,"3D plaque texture must read archived year");
assert.match(modelText,/const key=stage\.dataset\.championKey\|\|sport/,"refresh preservation distinguishes multiple seasons");
assert.match(modelText,/const key=replacement\.dataset\.championKey\|\|sport/,"restoration distinguishes multiple seasons");
assert.doesNotMatch(modelText,/\.rpc\(|\.from\(/,"3D display must never change database records");
console.log("Archived trophy year engraving: deduplication, cross-league safety, repeat champions, locked-state PASS");
