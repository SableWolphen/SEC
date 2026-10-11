/* Saturdays Down South — plain university abbreviations.
 * Names and short team identifiers are factual score labels. The badges are
 * plain abbreviation text, not school logos, athletic lettermarks, official
 * typography or mascots. School-inspired colors are assigned in CSS; no images.
 */
(()=>{
"use strict";
const ORDER=Object.freeze([
 ["ALA","Alabama"],["ARK","Arkansas"],["AUB","Auburn"],["FLA","Florida"],
 ["UGA","Georgia"],["UK","Kentucky"],["LSU","LSU"],["MISS","Ole Miss"],
 ["MSST","Mississippi State"],["MIZ","Missouri"],["OU","Oklahoma"],["SC","South Carolina"],
 ["TENN","Tennessee"],["TEX","Texas"],["TAMU","Texas A&M"],["VAN","Vanderbilt"]
]);
const TEAMS=Object.freeze(Object.fromEntries(ORDER.map(([code,label])=>
 [code,Object.freeze({label,abbreviation:code})])));
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// Use the same textual short codes that identify teams in fixtures and scores,
// including nonconference opponents. Never infer an "official" athletic logo.
function shortLabel(code){
 const value=String(code??"").trim().toUpperCase();
 return /^[A-Z0-9]{2,6}$/.test(value)?value:"—";
}
function mark(code,{className="sds-team-mark"}={}){
 const abbr=shortLabel(code);
 return '<span class="'+safe(className)+' sds-team-brand" data-sds-school="'+safe(code)+
  '" aria-hidden="true"><span class="sds-team-fallback">'+safe(abbr)+'</span></span>';
}
window.SDS_VISUALS=Object.freeze({mark,shortLabel,teams:TEAMS});
})();
