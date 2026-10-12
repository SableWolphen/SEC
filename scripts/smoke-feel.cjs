"use strict";
// Usability polish: picks do not reset keyboard state, no stale online save lock,
// important features still accessible after progressive disclosure.
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8");
const html=read("index.html"),home=read("sec-home.js"),adv=read("sec-next.js"),
 css=read("sec-feel.css"),sw=read("sw.js"),online=read("multiplayer.js");
for(const f of ["sec-home.js","sec-next.js","multiplayer.js"])new vm.Script(read(f),{filename:f});
assert.match(html,/class="side-card rules-card"><summary>How to play/);
assert.match(html,/const beforeOpen=new Set/);
assert.match(html,/requestAnimationFrame\(\(\)=>/);
assert.match(html,/focusGameId/);
assert.match(html,/focusedFilter/);
assert.match(html,/focus\?\.\(\{preventScroll:true\}\)/);
assert.ok(html.includes(".secnext-intelligence[open]"),"compared team panels are kept open through updates");
assert.match(adv,/data-next-skip/);
assert.match(adv,/data-next-previous/);
assert.match(adv,/quickSaving/);
assert.match(adv,/Matchup.*remaining/);
assert.match(adv,/saved!==true/);
assert.match(online,/finally\{working=false;\}/);
assert.ok(online.includes("}catch(err){busy(err);return false;}"),"failed online saves must report failure");
assert.ok(home.includes('data-hq-focus="upcoming"'),"Home gives a direct path to upcoming games");
assert.ok(home.includes("m.liveCount&&!p.unpickedOpen"),"live status chooses Games");
assert.ok(css.includes("#sec-home-root .hq-mobile-expand"),"secondary Home panels can expand");
assert.ok(css.includes("#sec-home-root .hq-action:nth-child(n+5)"),"less Home clutter");
assert.ok(css.includes(".secnext-quick-controls"),"Quick Pick navigation is styled");
assert.ok(css.includes("@media(prefers-reduced-motion:reduce)"),"reduced motion is respected");
assert.ok(sw.includes("sec-pickem-v110"),"Android cache is fresh");
assert.ok(sw.includes("sec-feel.css?v=20261012-feel-v1"),"PWA caches polish assets");
assert.ok(html.includes("sec-feel.css?v=20261012-feel-v1"),"the app loads polish assets");
// Dynamic Quick Pick navigation needs no authentication or writes.
const ids=["2026-7-UGA-ALA","2026-7-TENN-ARK","2026-7-LSU-UK"];
const games=ids.map((id,i)=>({id,away:["UGA","TENN","LSU"][i],home:["ALA","ARK","UK"][i],
 kickoff:"2026-11-14T20:00:00Z"}));
const roots=new Map(["sec-next-dialog","sec-next-quick-content","sec-next-picks"].map(id=>[id,{
 id,innerHTML:"",open:false,addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},
 querySelectorAll:()=>[],removeAttribute(){},setAttribute(){}
}]));
const state={picks:{}},doc={readyState:"loading",addEventListener:()=>{},
 getElementById:id=>roots.get(id)||null,querySelectorAll:()=>[],body:{appendChild(){} }};
const window={SEC_BRIDGE:{week:()=>({num:7,games}),state:()=>state,isLocked:()=>false,
 toast:()=>{}},SEC_FEATURES:{isUnavailable:()=>false},secOnline:{configured:false},
 SEC_PRIDE:{names:{UGA:"Georgia"}}};
vm.runInNewContext(adv,{window,document:doc,navigator:{},console,Date,setTimeout:()=>{}});
const quick=window.SEC_NEXT;
quick.openQuick();
assert.equal(roots.get("sec-next-dialog").open,true);
assert.match(roots.get("sec-next-quick-content").innerHTML,/Matchup 1 of 3 remaining/);
assert.match(roots.get("sec-next-quick-content").innerHTML,/Previous/);
assert.match(roots.get("sec-next-quick-content").innerHTML,/Skip this game/);
quick.closeQuick();
assert.equal(roots.get("sec-next-dialog").open,false);
console.log("SEC usability: focus restoration, skip/previous, online-save reset, less clutter and mobile settings PASS");