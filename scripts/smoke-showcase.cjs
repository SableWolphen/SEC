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
assert.equal(links.at(-10),"./sds-showcase.css?v=20261011-unified-v2",
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
assert.match(premium,/\["overview","Overview"\],\["schedule","Schedule"\],\["stats","Stats"\],\["news","News"\]/,
 "Team Hub uses four useful tabs including News");
assert.match(html,/data-sds-school="\$\{esc\(id\)\}"/,
 "football pick buttons retain university color identities");
assert.match(worker,/sec-pickem-v111/);
assert.equal(links.at(-9),"./sec-next.css?v=20261012-advanced-v1");
assert.equal(links.at(-8),"./sec-access.css?v=20261012-access-v1");
assert.equal(links.at(-7),"./sec-games.css?v=20261012-unified-v1");
assert.equal(links.at(-6),"./sec-play-by-play.css?v=20261012-plays-v1");
assert.equal(links.at(-5),"./sec-feel.css?v=20261012-feel-v1");
assert.equal(links.at(-4),"./sec-app-v2.css?v=20261012-app-v2");
assert.equal(links.at(-3),"./sec-mobile-fix.css?v=20261012-mobile-v1");
assert.equal(links.at(-2),"./sec-ux-v3.css?v=20261012-context-v1");
assert.equal(links.at(-1),"./sec-broadcast-finish.css?v=20261012-studio-v1");
for(const f of ["sds-showcase.css","sds-showcase-visuals.js","sds-showcase-preferences.js"]){
 assert.ok(worker.includes(f+"?v="+(f==="sds-showcase-preferences.js"?"20261011-ten-screens-v1":f==="sds-showcase-visuals.js"?"20261011-team-colors-v2":"20261011-unified-v2")),"PWA core must include "+f);
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
for(const school of Object.keys(visual.teams)){
 assert.ok(css.includes('[data-sds-school="'+school+'"]{--sds-school-primary:'),
  "university color palette missing for "+school);
}
assert.match(read("multi-sport.js"),/schoolMark\(code\)/,
 "basketball and baseball must render SEC abbreviation badges");
assert.match(read("sec-pride.js"),/data-sds-school/,
 "league favorites use the same university palette");
assert.match(html,/data-sds-school="\$\{esc\(id\)\}"/,
 "team directory cards carry school color identity");
const expected={ALA:"ALA",ARK:"ARK",AUB:"AUB",FLA:"FLA",UGA:"UGA",
 UK:"UK",LSU:"LSU",MISS:"MISS",MSST:"MSST",MIZ:"MIZ",
 OU:"OU",SC:"SC",TENN:"TENN",TEX:"TEX",TAMU:"TAMU",VAN:"VAN"};
for(const [code,abbr] of Object.entries(expected)){
 assert.equal(visual.shortLabel(code),abbr,"use familiar plain university abbreviation");
 assert.match(visual.mark(code),new RegExp(">"+abbr+"<\\/span>"),
  "short text badge instead of logo or random number for "+code);
}
assert.equal(new Set(Object.keys(visual.teams).map(visual.shortLabel)).size,16,
 "all schools have distinct abbreviation labels");
assert.equal(visual.shortLabel("BAY"),"BAY","nonconference opponents keep their abbreviations");
assert.equal(visual.shortLabel("TXST"),"TXST");
assert.equal(visual.shortLabel("<img onerror=alert(1)>"),"—");
assert.doesNotMatch(visual.mark("TENN"),/<img|http|style=|--school-accent|sds-team-logo/);
assert.doesNotMatch(visual.mark("<img src=x onerror=alert(1)>"),/<img src=x onerror=/);
assert.match(visual.mark("TENN"),/sds-team-fallback/,"plain university abbreviation stays visible");
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
console.log("Saturdays Down South: 16 university color palettes, abbreviations, no logo art, 320px, alert privacy and PWA PASS");
