/* Compact, visible NCAA/ESPN SEC football field. Never guess possession/yard line. */
(()=>{
"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const at=(g,d,a,b)=>g[a]??d?.[b]??null;
function situation(g,d,status){
 if(status!=="live")return null;
 const stamp=at(g,d,"liveSituationUpdatedAt","live_situation_updated_at");
 const elapsed=stamp?Date.now()-Date.parse(stamp):Infinity;
 const fresh=Number.isFinite(elapsed)&&elapsed>=0&&elapsed<=4*60000;
 const rawCode=at(g,d,"livePossessionCode","live_possession_code");
 const code=fresh&&[g.away,g.home].includes(rawCode)?rawCode:null;
 const raw=at(g,d,"liveFieldPercent","live_field_percent");
 const field=fresh&&code&&raw!==null&&raw!==""&&
   Number.isInteger(Number(raw))&&Number(raw)>=0&&Number(raw)<=100?Number(raw):null;
 // Our two end zones are fixed: away on the left, home on the right.
 // Backend distance is from the CURRENT OFFENSE's own goal line.
 const marker=field===null?null:(code===g.home?100-field:field);
 const rawDown=at(g,d,"liveDown","live_down");
 const rawDist=at(g,d,"liveDistance","live_distance");
 const down=fresh&&rawDown!==null&&Number.isInteger(Number(rawDown))&&
   Number(rawDown)>=1&&Number(rawDown)<=4?Number(rawDown):null;
 const distance=fresh&&rawDist!==null&&Number.isInteger(Number(rawDist))&&
   Number(rawDist)>=0&&Number(rawDist)<=99?Number(rawDist):null;
 const position=fresh?at(g,d,"livePositionText","live_position_text"):null;
 const drive=fresh?at(g,d,"liveDriveSummary","live_drive_summary"):null;
 const play=fresh?at(g,d,"liveLastPlay","live_last_play"):null;
 const downText=down!==null&&distance!==null?["","1st","2nd","3rd","4th"][down]+
   " & "+(distance===0?"Goal":distance):null;
 const detail=[code?code+" ball":null,downText,position?"at "+position:null].filter(Boolean).join(" · ");
 return {g,fresh,marker,code,detail,drive,play};
}
function field(info,mini){
 const {g,marker,code}=info;
 const description=marker!==null&&code?code+" football possession at "+Math.round(marker)+
  "% along the field, "+(info.detail||""): "Live field display. Verified ball position not yet available";
 return '<span class="fan-football-field '+(mini?"fan-field-mini":"fan-field-large")+'" role="img" aria-label="'+esc(description)+'">'+
  '<span class="fan-endzone away">'+esc(g.away)+'</span>'+
  '<span class="fan-endzone home">'+esc(g.home)+'</span>'+
  (marker!==null?'<span class="fan-football-marker" style="left:clamp(10px,'+marker+'%,calc(100% - 10px))" aria-hidden="true">🏈</span>':
    '<span class="fan-field-pending" aria-hidden="true">POSITION PENDING</span>')+
  '</span>';
}
function renderCompact(g,d,status){
 const info=situation(g,d,status);
 if(!info)return "";
 // The field lives inside the existing LIVE score row; no extra scoreboard.
 return '<span class="fan-field-inline" aria-hidden="true">'+field(info,true)+'</span>';
}
function render(g,d,status){
 const info=situation(g,d,status);
 if(!info)return "";
 return '<section class="fan-drive" aria-label="Live football field and drive">'+
  '<div class="fan-drive-heading"><strong>🏈 Football field</strong><span>'+
   esc(info.detail||(info.fresh?"Waiting for verified possession":"Live field position updating"))+'</span></div>'+
  field(info,false)+
  (info.drive?'<p class="fan-drive-summary">'+esc(String(info.drive).slice(0,100))+'</p>':"")+
  (info.play?'<p class="fan-drive-play"><b>Last play:</b> '+esc(String(info.play).slice(0,180))+'</p>':"")+
  '<small>'+(info.fresh?"ESPN play-by-play · updates automatically":
   "Waiting for fresh ESPN field position · score still updates live")+'</small></section>';
}
window.SEC_LIVE_DRIVE=Object.freeze({render,renderCompact});
})();
