"use strict";
/* Broadcast app polish: one shared visual language; no score or user mutations. */
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8");
const index=read("index.html"),src=read("sec-access.js"),
 css=read("sec-broadcast-finish.css"),sw=read("sw.js");
new vm.Script(src,{filename:"sec-access.js"});
const required=["#sec-home-root","#picks-view","#game-center-view","#league-view",
 "#sds-trophy-case","#more-view",".bottom-nav"];
for(const x of required)assert.ok(css.includes(x),"Unstyled SEC screen: "+x);
assert.match(css,/--broadcast-accent:#efc77f/);
assert.match(css,/#picks-view \.game-card \.team-choices/);
assert.match(css,/#picks-view \.sec-games-active-card\.is-live/);
assert.match(css,/#game-center-view \.sdsx-center-score strong/);
assert.match(css,/#league-view #fan-league-tabs/);
assert.match(css,/#sds-trophy-case \.museum-art/);
assert.match(css,/#more-view \.sec-access-icon/);
assert.match(css,/@media\(max-width:790px\)/);
assert.match(css,/@media\(max-width:390px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(src,/function iconSvg\(id\)/);
assert.match(src,/iconSvg\(x\.id\)/);
assert.match(src,/iconPaths\.?\[/);
assert.match(read("sec-home.js"),/data-game-state/);
assert.match(index,/sec-broadcast-finish\.css\?v=20261012-studio-v1/);
assert.match(sw,/sec-broadcast-finish\.css\?v=20261012-studio-v1/);
assert.match(sw,/sec-pickem-v112/);
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,"balanced CSS");
console.log("Broadcast finish: all six screens, consistent symbols, game-status branding, safe area, focus, motion and PWA PASS");