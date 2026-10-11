"use strict";
// Calendar week is independent from picks being locked and from provider
// finals; future weeks are accessible only through explicit user selection.
const assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");
const weeks=[...html.matchAll(/^\s*\[(\d+),'(\d{4}-\d{2}-\d{2})',\[$/gm)]
 .map(m=>({num:Number(m[1]),date:m[2]}));
assert.equal(weeks.length,13,"current-week behavior uses the complete SEC calendar");
const begin=html.indexOf("  function initialWeek(at=Date.now()){");
const end=html.indexOf("  function week(){",begin);
assert.ok(begin>=0&&end>begin,"calendar-based function must exist");
const select=new Function("WEEKS","Intl","Date",
 html.slice(begin,end)+"\nreturn initialWeek;")(weeks,Intl,Date);
function check(when,expected){
 assert.equal(select(new Date(when).getTime()),expected,
  when+" Central-time calendar should be Week "+expected);
}
check("2026-08-31T12:00:00-05:00",1);
check("2026-09-05T22:59:00-05:00",1);
check("2026-09-07T00:00:00-05:00",2);
check("2026-10-04T23:59:59-05:00",5);
check("2026-10-05T00:00:00-05:00",6);
check("2026-10-10T00:00:00-05:00",6);
check("2026-10-10T18:43:00-05:00",6);
check("2026-10-10T23:59:00-05:00",6);
check("2026-10-11T23:59:59-05:00",6);
check("2026-10-12T00:00:00-05:00",7);
check("2026-10-17T22:10:00-05:00",7);
check("2026-11-01T01:30:00-05:00",9);
check("2026-11-01T01:30:00-06:00",9);
check("2026-11-02T00:00:00-06:00",10);
check("2026-12-12T12:00:00-06:00",13);
assert.match(html,/let manualWeekOverride = false/);
assert.match(html,/manualWeekOverride=currentWeek!==initialWeek\(\)/,
 "manually choosing an early week must be respected");
assert.match(html,/if\(!manualWeekOverride\)\{/,
 "calendar changes are followed only when no manual week has been selected");
assert.match(html,/currentWeek=calendarWeek/);
assert.match(html,/bar\.innerHTML=WEEKS\.map/,
 "future weeks remain available in the week picker");
assert.doesNotMatch(html,/WEEKS\.find\(w=>w\.games\.some\(g=>Date\.parse\(lockTimestamp\(g\)\)>now\)\)/,
 "never jump to next week merely because all current picks are locked");
console.log("Week navigation passed: current Central-time week, Sunday retention, Monday transition, DST and manual future picks.");
