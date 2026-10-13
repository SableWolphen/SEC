"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8");
const css=read("sec-mobile-fix.css"),html=read("index.html"),
 sw=read("sw.js"),home=read("sec-home.js"),app=read("sec-app-v2.css");
new vm.Script(home,{filename:"sec-home.js"});
for(const term of [".site-header .brand-title","#sec-home-root>.hq-stadium-hero",
 "#sec-home-root .sds-home-favorite-mini","#sec-home-root .hq-next-kickoff",
 "#sec-home-root>.hq-actions{display:none!important}","#sec-home-root .hq-picks{display:none!important}",
 ".bottom-nav",".profile-chip #header-school-pride","safe-area-inset-bottom"]){
 assert.ok(css.includes(term),"Missing screenshot fix for "+term);
}
assert.match(css,/height:60px;min-height:60px/,"header limited to a single compact row");
assert.match(css,/font:900 25px/,"hero headline no longer enormous");
assert.match(css,/grid-template-areas:"label time" "teams countdown" "link link"/);
assert.match(css,/position:fixed;left:0;right:0;bottom:0/,"tab bar is anchored");
assert.match(css,/backdrop-filter:none/,"tab bar is opaque, not see-through");
assert.match(css,/padding:12px 0 calc\(92px \+ env\(safe-area-inset-bottom\)\)/);
assert.match(html,/sec-mobile-fix.css\?v=20261012-mobile-v1/);
assert.match(sw,/sec-mobile-fix.css\?v=20261012-mobile-v1/);
assert.match(sw,/sec-pickem-v112/);
assert.match(home,/hq-hero-summary/);
assert.match(app,/#sec-home-root>.hq-app-metrics/);
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
console.log("Screenshot regression: compact header and hero, no repeat shortcuts, opaque dock, safe scroll padding PASS");