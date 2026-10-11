/* Full Saturdays Down South ten-screen stadium visual contract. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8"),html=read("index.html"),
 css=read("sds-showcase.css"),premium=read("sec-premium.js"),
 home=read("sec-home.js"),worker=read("sw.js");
for(const p of ["sds-showcase-visuals.js","sds-showcase-preferences.js","sec-premium.js","sec-home.js"]){
 new vm.Script(read(p),{filename:p});
}
const views=["home","team-hub","game-center","team-news","picks",
 "results","league","trophies","teams","settings"];
for(const route of views){
 assert.match(html,new RegExp('id="'+route+'-view"'),"missing screen: "+route);
 assert.match(css,new RegExp(route==="home"?"#sec-home-root":route==="team-hub"?"#team-hub-view":
 route==="game-center"?"#game-center-view":route==="team-news"?"#team-news-view":
 route==="results"?"#results-view":"#"+route+"-view"),"no mockup skin for "+route);
}
const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(x=>x[1]);
assert.equal(links.at(-1),"./sds-showcase.css?v=20261011-neutral-v1",
 "approved stadium skin loads after original design tokens");
assert.match(css,/@media\(max-width:360px\)/);
assert.match(css,/safe-area-inset-bottom/);
assert.match(css,/sds-team-brand/);
assert.match(css,/sds-notice-option/);
assert.match(css,/\.sdsx-team-tabs/);
assert.match(premium,/data-sdsx-team-tab/);
assert.match(premium,/data-sdsx-team-panel/);
assert.match(premium,/hasCurrent/,"no stale national ranking on Team Hub");
assert.match(home,/SDS_VISUALS\?\.mark/,"favorite school and matchups get original badges");
assert.match(worker,/sec-pickem-v97/);
for(const f of ["sds-showcase.css","sds-showcase-visuals.js","sds-showcase-preferences.js"]){
 assert.ok(worker.includes(f+"?v="+(f==="sds-showcase-preferences.js"?"20261011-ten-screens-v1":"20261011-neutral-v1")),"PWA core must include "+f);
}
assert.match(html,/sds-settings-notifications/);
assert.match(html,/sds-showcase-visuals\.js\?v=/);
assert.match(html,/sds-showcase-preferences\.js\?v=/);
assert.ok(html.indexOf("sds-showcase-visuals.js")<html.indexOf("const TEAMS ="),
 "team identity visuals load before the legacy league's display functions");
const events={};
const window={};
const document={addEventListener:(name,fn)=>{events[name]=fn;}};
vm.runInNewContext(read("sds-showcase-visuals.js"),{window,document,console},{filename:"sds-showcase-visuals.js"});
const visual=window.SDS_VISUALS;
assert.equal(Object.keys(visual.teams).length,16);
assert.equal(visual.shortLabel("TENN"),"13");
assert.equal(visual.shortLabel("ALA"),"01");
assert.equal(visual.shortLabel("TEX"),"14");
assert.equal(visual.shortLabel("SC"),"12");
assert.equal(new Set(Object.keys(visual.teams).map(visual.shortLabel)).size,16,
 "all schools get stable neutral directory numbers");
assert.match(visual.mark("TENN",{className:"mini-logo"}),/>13<\/span>/);
assert.match(visual.mark("ALA"),/>01<\/span>/);
assert.doesNotMatch(visual.mark("TENN"),/<img|http|style=|--school-accent|sds-team-logo/);
assert.doesNotMatch(visual.mark("<img src=x onerror=alert(1)>"),/<img src=x onerror=/);
assert.match(visual.mark("TENN"),/sds-team-fallback/,"all badges use original neutral numbers");
for(const src of ["sds-showcase-visuals.js","sds-showcase.css","index.html"]){
 assert.doesNotMatch(read(src),/a\.espncdn\.com|\/teamlogos\/|img\.sds-team-logo/,
  "no outside school logo artwork may ship in "+src);
}
let viewer={id:"userA"},current="settings",noticeRefresh=0;
const stored=new Map(),roots=new Map([
 ["sds-settings-notifications",{innerHTML:""}],["sds-news-notifications",{innerHTML:""}]]);
const d={getElementById:id=>roots.get(id)||null,addEventListener:(name,fn)=>{events["prefs_"+name]=fn;}};
const w={secOnline:{configured:true,getUser:()=>viewer},SEC_BRIDGE:{view:()=>current},
 SEC_GAMEDAY:{refresh:()=>noticeRefresh++}};
const localStorage={getItem:k=>stored.has(k)?stored.get(k):null,setItem:(k,v)=>stored.set(k,v)};
vm.runInNewContext(read("sds-showcase-preferences.js"),
 {window:w,document:d,localStorage,console,Promise},{filename:"sds-showcase-preferences.js"});
let mark=roots.get("sds-settings-notifications").innerHTML;
assert.match(mark,/NOTIFICATIONS/);
assert.match(mark,/Turn on Alerts/);
assert.match(mark,/background push notifications are not configured/);
assert.match(mark,/data-sds-alert-master disabled|data-sds-alert-master aria-label/);
assert.match(mark,/data-day-alert="kickoff" checked disabled/,"master switch disables individual categories by default");
const master={checked:true,matches:selector=>selector==="[data-sds-alert-master]"};
events.prefs_change({target:master});
assert.equal(stored.get("sec-fan-alerts-userA"),"on");
mark=roots.get("sds-settings-notifications").innerHTML;
assert.match(mark,/data-day-alert="kickoff" checked /);
assert.ok(!mark.includes('data-day-alert="kickoff" checked disabled'));
assert.ok(noticeRefresh>=1,"notification inbox is refreshed after enabling alerts");
viewer={id:"userB"};w.SDS_PREFERENCES.mount();
assert.match(roots.get("sds-settings-notifications").innerHTML,/Turn on Alerts/,
 "preferences should be scoped to a user's own account");
viewer=null;w.SDS_PREFERENCES.mount();
assert.match(roots.get("sds-settings-notifications").innerHTML,/Sign in/);
assert.match(roots.get("sds-settings-notifications").innerHTML,/data-sds-alert-master disabled/);
console.log("Saturdays Down South ten-screen stadium redesign: routes, original neutral badges, no external logos, 320px, alert privacy and PWA PASS");
