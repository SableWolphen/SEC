/* Saturdays Down South — original, unbranded team identifiers.
 *
 * School names appear as factual matchup labels elsewhere in the app.
 * Badges are a neutral, numbered directory UI, NOT university logos,
 * athletic lettermarks, team colors, mascots, or licensed artwork.
 * No remote image request is made, including on installed PWAs.
 */
(()=>{
"use strict";
const ORDER=Object.freeze([
 ["ALA","Alabama"],["ARK","Arkansas"],["AUB","Auburn"],["FLA","Florida"],
 ["UGA","Georgia"],["UK","Kentucky"],["LSU","LSU"],["MISS","Ole Miss"],
 ["MSST","Mississippi State"],["MIZ","Missouri"],["OU","Oklahoma"],["SC","South Carolina"],
 ["TENN","Tennessee"],["TEX","Texas"],["TAMU","Texas A&M"],["VAN","Vanderbilt"]
]);
const TEAMS=Object.freeze(Object.fromEntries(ORDER.map(([code,label],i)=>
 [code,Object.freeze({label,slot:String(i+1).padStart(2,"0")})])));
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// Slots identify entries in the app's neutral directory. They are not standings or poll ranks.
function shortLabel(code){return TEAMS[code]?.slot||"—";}
function mark(code,{className="sds-team-mark"}={}){
 const label=shortLabel(code);
 return '<span class="'+safe(className)+' sds-team-brand" data-sds-school="'+safe(code)+
  '" aria-hidden="true"><span class="sds-team-fallback">'+safe(label)+'</span></span>';
}
window.SDS_VISUALS=Object.freeze({mark,shortLabel,teams:TEAMS});
})();
