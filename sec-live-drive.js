/* Tiny, verified football play-by-play slice of the existing expandable Game Center. */
(()=>{
"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function render(g,d,status){
 if(status!=="live")return "";
 const get=(camel,snake)=>g[camel]??d?.[snake]??null;
 const at=get("liveSituationUpdatedAt","live_situation_updated_at");
 const age=at?Date.now()-Date.parse(at):Infinity;
 // Stale drive positions can be misleading after a possession change.
 if(!Number.isFinite(age)||age<0||age>4*60000)return "";
 const possession=get("livePossessionCode","live_possession_code");
 const code=[g.away,g.home].includes(possession)?possession:null;
 const rawDown=get("liveDown","live_down"),rawDistance=get("liveDistance","live_distance");
 const down=rawDown!==null&&Number.isInteger(Number(rawDown))&&Number(rawDown)>=1&&Number(rawDown)<=4?Number(rawDown):null;
 const distance=rawDistance!==null&&Number.isInteger(Number(rawDistance))&&Number(rawDistance)>=0&&Number(rawDistance)<=99?Number(rawDistance):null;
 const position=get("livePositionText","live_position_text");
 const rawPercent=get("liveFieldPercent","live_field_percent");
 const pct=rawPercent!==null&&Number.isInteger(Number(rawPercent))&&Number(rawPercent)>=0&&Number(rawPercent)<=100?Number(rawPercent):null;
 const drive=get("liveDriveSummary","live_drive_summary"),play=get("liveLastPlay","live_last_play");
 if(!code&&down===null&&!drive&&!play)return "";
 const downText=down!==null&&distance!==null?["","1st","2nd","3rd","4th"][down]+" & "+(distance===0?"Goal":distance):null;
 const label=[code?code+" ball":null,downText,position?"at "+position:null].filter(Boolean).join(" · ");
 return '<section class="fan-drive" aria-label="ESPN live football drive"><div class="fan-drive-heading">'+
  '<strong>🏈 Current drive</strong><span>'+esc(label||"Live play-by-play")+'</span></div>'+
  (pct!==null&&code?'<div class="fan-drive-track" role="img" aria-label="'+esc(code+" ball position "+pct+" percent of field")+'">'+
  '<span class="fan-drive-progress" style="width:'+pct+'%"></span>'+
  '<span class="fan-drive-ball" style="left:'+pct+'%" aria-hidden="true">🏈</span></div>':"")+
  (drive?'<p class="fan-drive-summary">'+esc(String(drive).slice(0,100))+'</p>':"")+
  (play?'<p class="fan-drive-play"><b>Last play:</b> '+esc(String(play).slice(0,180))+'</p>':"")+
  '<small>ESPN play-by-play · automatically updated</small></section>';
}
window.SEC_LIVE_DRIVE=Object.freeze({render});
})();
