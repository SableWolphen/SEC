/* Approved Figma V3: navigation and public score browsing. Existing services
 * retain ownership of picks, authentication, messages and trophy history. */
(()=>{
"use strict";
const app=()=>window.SEC_BRIDGE;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sports={football:"Football",basketball:"Basketball",baseball:"Baseball"};
let scoreSport="football",filter="all",loadingSport=null;
const state=g=>["live","final","scheduled","canceled","postponed"].includes(g)?g:"scheduled";
const score=n=>n!==null&&n!==undefined&&n!==""&&Number.isInteger(Number(n))&&Number(n)>=0;
function scoreGames(s){
 const rows=s==="football"?(app()?.week?.()?.games||[]):
  (window.SEC_SPORTS?.groups?.(s)||[]).flatMap(w=>w.games);
 return rows.map(g=>({id:g.id,away:g.away||g.away_code,home:g.home||g.home_code,
  status:state(s==="football"?g.liveStatus:g.game_status),
  awayScore:s==="football"?g.awayScore:g.away_score,homeScore:s==="football"?g.homeScore:g.home_score,
  kickoff:s==="football"?(g.onlineProvisional?null:g.kickoff):g.kickoff_at,week:g.week,
  detail:g.statusDetail||""}));
}
function scores(){
 const root=document.getElementById("v3-scores");if(!root)return;
 const all=scoreGames(scoreSport),now=Date.now();
 const rows=all.filter(g=>filter==="all"||g.status===filter).sort((a,b)=>{
  const rank=g=>g.status==="live"?0:g.status==="scheduled"&&Date.parse(g.kickoff)>=now?1:g.status==="final"?2:3;
  return rank(a)-rank(b)||(a.status==="final"?Date.parse(b.kickoff)-Date.parse(a.kickoff):Date.parse(a.kickoff)-Date.parse(b.kickoff));
 });
 root.innerHTML='<div class="v3-segments" role="group" aria-label="Scores sport">'+Object.entries(sports).map(([id,label])=>
  '<button type="button" data-v3-score-sport="'+id+'" aria-pressed="'+(scoreSport===id)+'">'+label+'</button>').join("")+'</div>'+
 '<div class="v3-segments" role="group" aria-label="Game status">'+[["all","All"],["live","Live"],["final","Final"]].map(([id,label])=>
  '<button type="button" data-v3-score-filter="'+id+'" aria-pressed="'+(filter===id)+'">'+label+'</button>').join("")+'</div>'+
 '<section class="v3-score-notice"><span>GAME CENTER</span><h2>Scores only when verified.</h2><p>'+esc(loadingSport===scoreSport?'Loading the latest schedule…':scoreSport==='football'?'Current football week · select a game for stats and plays.':'Verified '+sports[scoreSport].toLowerCase()+' schedule and results.')+'</p></section>'+
 '<div class="v3-score-list">'+(rows.length?rows.slice(0,60).map(g=>{
  const name=c=>window.SEC_PRIDE?.names?.[c]||c||"Team";
  const scored=["live","final"].includes(g.status)&&score(g.awayScore)&&score(g.homeScore);
  const validTime=Number.isFinite(Date.parse(g.kickoff));
  const date=validTime?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago",timeZoneName:"short"}).format(new Date(g.kickoff)):"Start time to be announced";
  return '<article class="v3-score-card"><span>'+esc(g.status==="scheduled"?"UPCOMING":g.status.toUpperCase())+'</span><h3>'+esc(name(g.away))+(scored?' '+Number(g.awayScore):'')+' <small>vs</small> '+esc(name(g.home))+(scored?' '+Number(g.homeScore):'')+'</h3><p>'+esc(date)+'</p>'+
   (g.detail&&g.status==="live"?'<p>'+esc(g.detail)+'</p>':'')+
   '<button type="button" '+(scoreSport==="football"?'data-v3-game="'+esc(g.id)+'"':'data-nav="'+scoreSport+'"')+'>'+(scoreSport==="football"?'See matchup details':'Open '+sports[scoreSport]+' games')+' →</button></article>';
 }).join(""):'<p class="v3-empty">'+(loadingSport?'Loading games…':'No '+(filter==='all'?'available':filter)+' games in this schedule. Choose another filter or sport.')+'</p>')+'</div>';
}
function showScoreDetail(){
 const detail=document.getElementById("v3-score-detail");if(detail){detail.open=true;detail.scrollIntoView({block:"start"});}
}
function onView(v){
 if(v==="game-center")scores();
}
function setup(){
 const view=document.getElementById("game-center-view"),detailRoot=document.getElementById("sdsx-game-root");
 if(view&&detailRoot){
  const title=document.createElement("div");title.className="v3-score-heading";
  title.innerHTML='<span class="hq-eyebrow">SCORES &amp; GAMES</span><h1>Every game, clearly.</h1><p>A single place for scores and match details.</p>';
  const list=document.createElement("div");list.id="v3-scores";
  const detail=document.createElement("details");detail.id="v3-score-detail";
  const summary=document.createElement("summary");summary.textContent="Game details · stats & plays";
  detail.append(summary,detailRoot);view.append(title,list,detail);
 }
 for(const id of ["news","trophies"]){
  const view=document.getElementById(id+"-view");if(!view)continue;
  const back=document.createElement("button");back.type="button";back.className="v3-back";back.dataset.nav="more";
  back.textContent="← EXPLORE / "+(id==="news"?"SEC NEWS":"TROPHY ROOM");view.prepend(back);
 }
 onView(app()?.view?.());
}
document.addEventListener("click",e=>{
 const sport=e.target.closest?.("[data-v3-score-sport]");
 if(sport&&sports[sport.dataset.v3ScoreSport]){
  scoreSport=sport.dataset.v3ScoreSport;
  if(scoreSport!=="football"){
   const selected=scoreSport;loadingSport=selected;
   void Promise.resolve(window.SEC_SPORTS?.load?.(selected)).finally(()=>{
    if(loadingSport===selected)loadingSport=null;
    if(app()?.view?.()==="game-center")scores();
   });
  }
  scores();return;
 }
 const f=e.target.closest?.("[data-v3-score-filter]");
 if(f&&["all","live","final"].includes(f.dataset.v3ScoreFilter)){filter=f.dataset.v3ScoreFilter;scores();return;}
 const game=e.target.closest?.("[data-v3-game]");
 if(game)window.SEC_PREMIUM?.openGame?.(game.dataset.v3Game);
});
window.SEC_CLEAN=Object.freeze({onView,showScoreDetail,scoreGames});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});else setup();
// Feed polling remains in the existing score services; only redraw public rows.
setInterval(()=>{if(document.visibilityState==="visible"&&app()?.view?.()==="game-center")scores();},30000);
})();
