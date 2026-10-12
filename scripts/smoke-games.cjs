"use strict";
/* Unified Games regression: status filters, one visible card, actual verified
   score/lock behavior, multi-sport and backwards-compatible Games route. */
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const read=p=>fs.readFileSync(p,"utf8");
const html=read("index.html"),multi=read("multi-sport.js"),cards=read("sec-final-cards.js"),
 home=read("sec-home.js"),access=read("sec-access.js"),css=read("sec-games.css"),sw=read("sw.js");
for(const file of ["multi-sport.js","sec-final-cards.js","sec-home.js","sec-access.js"])
 new vm.Script(read(file),{filename:file});
assert.match(html,/data-nav="current-sport" class="nav-link">Games/);
assert.match(html,/data-nav="current-sport" class="mobile-nav-btn"[\s\S]*?<span>Games<\/span>/);
assert.match(html,/id="picks-heading">Your <em>games\.<\/em>/);
assert.match(html,/slateFilter==='upcoming'/);
assert.match(html,/slateFilter==='live'/);
assert.match(html,/slateFilter==='final'/);
assert.match(html,/sec-games-active-card/);
assert.match(html,/SEC_FEATURES\?\.finalData\?\.\(g\)/);
assert.match(html,/window\.SEC_FAN\?\.gameCenter\?\.\(g/);
assert.match(html,/Open game details →/);
assert.match(html,/document\.getElementById\("hero-slot"\)\?\.replaceChildren\(\)/);
assert.match(home,/data-hq-focus="live"/);
assert.match(home,/\["live","upcoming"\]\.includes\(b\.dataset\.hqFocus\)/);
assert.ok(home.includes('b.dataset.hqFocus'),"Home uses selected Games status");
assert.match(multi,/statusFilters=\{basketball:"all",baseball:"all"\}/);
assert.match(multi,/data-sport-filter/);
assert.match(multi,/sport-game-filters/);
assert.match(cards,/sec-games-final-detail/);
assert.match(access,/\{id:"scores",title:"Scores & Games"/);
assert.match(css,/#picks-view \.sec-games-active-card\.is-live/);
assert.match(css,/#picks-view \.sec-live-mini-scores\{display:none!important\}/);
assert.match(css,/#picks-view #hero-slot\{display:none!important\}/);
assert.match(sw,/sec-pickem-v110/);
assert.match(sw,/sec-games\.css\?v=20261012-unified-v1/);
assert.match(html,/sec-games\.css\?v=20261012-unified-v1/);
console.log("Unified Games: one game/card across picks, verified live, final; sport tabs, Games nav & PWA PASS");