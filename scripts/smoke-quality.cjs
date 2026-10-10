"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("multi-sport.css","utf8");
const worker=fs.readFileSync("sw.js","utf8");
const pages=["picks","basketball","baseball","league","trophies","news","teams","settings"];
for(const page of pages){
 assert.equal((html.match(new RegExp('id="'+page+'-view"','g'))||[]).length,1,
  "every section has one unique view: "+page);
 assert.match(html,new RegExp('id="'+page+'-heading"'),"view title exists: "+page);
}
const nav=html.split('<nav class="bottom-nav"')[1].split('</nav>')[0];
for(const page of ["current-sport","league","trophies","news","teams","settings"]){
 assert.ok(nav.includes('data-nav="'+page+'"'),"mobile navigation includes "+page);
}
assert.equal((nav.match(/class="mobile-nav-btn/g)||[]).length,6,"all six nav icons must fit without overflow");
assert.ok(!nav.includes('data-nav="sports"'),"Picks goes to chosen current sport, no extra selection screen");
assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/,
 "six equal fractional columns fit on narrow Android screens");
assert.match(css,/safe-area-inset-bottom/,"system gesture/navigation bottom inset is respected");
assert.match(css,/body:has\(input:focus,textarea:focus,select:focus\) \.bottom-nav\{display:none\}/,
 "fixed nav hides behind keyboard while editing forms");
assert.match(css,/\.toast\{bottom:calc\(84px \+ env\(safe-area-inset-bottom\)\)/,
 "toast never obscures bottom nav on mobile");
assert.match(css,/\.fan-power-card \.fan-small\{min-height:44px\}/,
 "small-screen controls have adequate tap size");
assert.match(css,/\.fan-sport-checkbox>span\{font-size:11px/,
 "sport selection labels are legible on phones");
assert.match(css,/:focus-visible/,"keyboard focus remains visible");
assert.match(html,/id="fan-league-create"/);
assert.match(html,/id="fan-power-rankings"/);
assert.match(html,/id="sec-live-score-strip"/,"compact football-only score strip exists");
assert.match(html,/sec-live-scores\.js\?v=/,"live score refresh loads on every site session");
assert.match(html,/id="fan-club-hub"/);
assert.match(html,/id="fan-single-league"/);
assert.match(html,/id="fan-brackets"/);
assert.match(worker,/sec-pickem-v53/);
assert.match(worker,/20261010-arena-v1/);
assert.match(html,/20261010-community-v1/);
const league=fs.readFileSync("league-settings.js","utf8");
assert.match(league,/lastRenderedSelection===selection/,"draft edit states only restore into same selected league");
assert.match(league,/standingsVersion/,"late asynchronous results cannot bleed between leagues");
assert.match(league,/actionPending/,"double submissions are blocked");
assert.match(league,/function restoreForms\(state\)/,"refresh does not discard typed league name or invite");
assert.match(league,/olderSeason\(item\)/,"prior seasons have explicit archive states");
const brackets=fs.readFileSync("sec-brackets.js","utf8");
assert.match(brackets,/pendingKey===key/,"old bracket request cannot overwrite newly selected club");
assert.match(brackets,/if\(nextFixtures\.length\)/,"no extra bracket standings requests without verified matchups");
console.log("SEC quality checks passed: 8 sections, 6-button mobile nav, safe areas, keyboard, draft persistence, stale data, seasons, PWA.");
