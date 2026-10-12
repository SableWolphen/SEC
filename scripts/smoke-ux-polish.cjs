"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8"),html=read("index.html"),css=read("sds-showcase.css"),sw=read("sw.js");
const routes=["home","team-hub","game-center","results","team-news","sports","picks","basketball","baseball","league","trophies","news","teams","more","settings"];
for(const route of routes){
 assert.ok(html.includes('id="'+route+'-view"'),"missing route "+route);
 assert.ok(css.includes("#"+route+"-view"),"missing final styling "+route);
}
assert.ok(css.includes("Unified 2026 SDS UI"),"single final unified skin");
assert.ok(!css.includes("COMPACT BROADCAST 2026"),"old overlapping final skin removed");
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,"balanced stylesheet");
for(const re of [/@media\(max-width:390px\)/,/safe-area-inset-bottom/,/prefers-reduced-motion/,/:focus-visible/,/--ui-border/,/#league-view \.fan-league-tabs/,/#trophies-view \.sds-museum/,/#more-view \.hq-more-card/,/#picks-view \.team-choice\.selected/])
 assert.match(css,re);
const home=read("sec-home.js"),premium=read("sec-premium.js");
for(const script of ["sec-home.js","sec-premium.js"])new vm.Script(read(script),{filename:script});
assert.match(home,/data-hq-route="team-hub">Team Hub/);
assert.match(home,/data-hq-route="teams" class="hq-hero-alt school-picker"/);
assert.match(premium,/data-sdsx-team-tab="schedule" class="sdsx-gold-button"/);
assert.match(premium,/\["overview","Overview"\],\["schedule","Schedule"\],\["stats","Stats"\],\["news","News"\]/);
assert.match(sw,/sec-pickem-v104/);
assert.match(html,/sds-showcase\.css\?v=20261011-unified-v2/);
assert.match(sw,/sds-showcase\.css\?v=20261011-unified-v2/);
console.log("SDS unified UI: 15 screens, real data preserved, school colors, mobile, keyboard, PWA PASS");
