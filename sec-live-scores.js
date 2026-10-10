/* Secure SEC football live scores. Reads public confirmed scores only.
   The existing private scoreboard job handles provider calls / authorization.
   This browser client never writes results or changes anyone's picks. */
(()=>{
"use strict";
const app=()=>window.SEC_BRIDGE;
const client=()=>window.secOnline?.getClient?.();
const host=()=>document.getElementById("sec-live-score-strip");
const esc=x=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let busy=false,lastRequest=0,lastError="",activeRequest=0;
const fingerprints=new Map();
const now=()=>Date.now();
const visible=()=>document.visibilityState!=="hidden";
const isScore=x=>Number.isInteger(x)&&x>=0;
const clock=g=>Date.parse(g?.kickoff||g?.kickoff_at||"");
function liveWindow(g,time=now()){
 const kick=clock(g);
 if(g?.liveStatus==="live")return true;
 return Number.isFinite(kick)&&kick>0&&time>=kick-30*60000&&time<=kick+7*3600000&&
    !["final","canceled","postponed"].includes(g?.liveStatus);
}
function shouldFetchFast(){
 const w=app()?.week?.();
 return Boolean(w?.games?.some(g=>liveWindow(g)));
}
function renderStatus(){
 const el=host(),a=app();if(!el||a?.view?.()!=="picks")return;
 const games=a.week()?.games||[];
 const live=games.filter(g=>g.liveStatus==="live");
 const starting=games.filter(g=>liveWindow(g));
 if(!live.length&&!starting.length){el.hidden=true;el.innerHTML="";return;}
 el.hidden=false;
 const recent=live.map(g=>g.scoreUpdatedAt).filter(Boolean).map(Date.parse).filter(Number.isFinite);
 const newest=recent.length?Math.max(...recent):0;
 const age=newest?now()-newest:null;
 const stale=age!=null&&age>3*60000;
 const heading=live.length?'🔴 '+live.length+' game'+(live.length===1?'':'s')+' LIVE':'🏈 Game-day scores';
 const scores=live.map(g=>'<span class="sec-live-mini-score"><b>'+esc(g.away)+'</b> '+(isScore(g.awayScore)?g.awayScore:'–')+
    ' <span aria-hidden="true">·</span> '+(isScore(g.homeScore)?g.homeScore:'–')+' <b>'+esc(g.home)+'</b>'+
    (g.statusDetail?' <small>'+esc(g.statusDetail)+'</small>':'')+'</span>').join("");
 el.innerHTML='<div class="sec-live-strip-title"><strong>'+heading+'</strong><span>'+
   (stale?'Score feed delayed':lastError?'Retrying score feed':live.length?'Checks every 30 seconds':'Automatic updates near kickoff')+
   '</span></div>'+(scores?'<div class="sec-live-mini-scores">'+scores+'</div>':'')+
   '<small>Provider-confirmed scores · refreshes automatically while this page is open</small>';
}
function matchValue(g){
 return [g.game_status,g.status_detail,g.away_score,g.home_score,g.winner,g.kickoff_at].join("|");
}
async function refresh(force=false){
 const a=app(),c=client();if(!a||a.view?.()!=="picks"||!visible()||!c||busy)return;
 // Unchanged pregame schedules need just an occasional recheck, never 30s.
 if(!force&&now()-lastRequest<(shouldFetchFast()?30000:180000))return;
 const selected=a.week?.(),games=selected?.games||[];
 if(!games.length)return;
 const ids=games.map(g=>g.id);
 const selectedWeek=selected.num;
 busy=true;lastRequest=now();const request=++activeRequest;
 try{
  const response=await c.from("sec_games").select(
   "id,kickoff_at,winner,game_status,status_detail,away_score,home_score,score_updated_at,provisional,spread_home,spread_source"
  ).in("id",ids);
  if(response?.error)throw response.error;
  if(!Array.isArray(response?.data))throw Error("Missing score response");
  const rows=response.data.filter(g=>ids.includes(g.id));
  // Don't paint an old week's scoreboard into the newly chosen week.
  if(request!==activeRequest)return;
  const valid=rows.filter(g=>["scheduled","live","final","canceled","postponed"].includes(g.game_status));
  let changed=false;
  for(const row of valid){
   const previous=fingerprints.get(row.id),signature=matchValue(row);
   if(previous!==signature){changed=true;fingerprints.set(row.id,signature);}
   const local=a.gameById?.[row.id];
   if(local){
    if(row.kickoff_at)local.kickoff=row.kickoff_at;
    local.liveStatus=row.game_status;
    local.statusDetail=row.status_detail||"";
    local.awayScore=row.away_score;
    local.homeScore=row.home_score;
    local.scoreUpdatedAt=row.score_updated_at;
    if(row.provisional!=null)local.onlineProvisional=row.provisional;
    if(row.winner&&row.game_status==="final")a.state().results[row.id]=row.winner;
   }
  }
  window.SEC_FEATURES?.updateGames?.(valid,a);
  window.SEC_FAN?.ingestScores?.(valid);
  lastError="";
  if(a.view?.()==="picks"&&a.week?.()?.num===selectedWeek){
   if(changed&&!document.activeElement?.matches?.("input,textarea,select"))a.renderPicks?.();
   renderStatus();
  }
 }catch(e){
  lastError="Scores temporarily unavailable";
  if(a.view?.()==="picks")renderStatus();
  console.info("SEC live score refresh:",e?.message||"Unavailable");
 }finally{busy=false;}
}
document.addEventListener("click",event=>{
 if(event.target.closest?.('[data-week],[data-nav="picks"],[data-sport-tab="football"],[data-nav="current-sport"]')){
  setTimeout(()=>{renderStatus();void refresh(true);},0);
 }
});
document.addEventListener("visibilitychange",()=>{
 if(visible()){renderStatus();void refresh(true);}
});
setInterval(()=>{if(visible())void refresh();},30000);
renderStatus();
void refresh(true);
window.SEC_LIVE_SCORES=Object.freeze({refresh,liveWindow,renderStatus});
})();
