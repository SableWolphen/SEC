/* The Scores tab owns the complete SEC football slate; pick cards are not scoreboards.
 * Verified score objects are supplied by SEC_BRIDGE + SEC_LIVE_SCORES.
 */
(()=>{
 "use strict";
 const app=()=>window.SEC_BRIDGE;
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const names=()=>window.SEC_PRIDE?.names||{};
 const label=code=>names()[code]||String(code||"Unknown");
 const status=g=>["live","final","scheduled","canceled","postponed"].includes(g?.liveStatus)?g.liveStatus:"scheduled";
 const scored=g=>["live","final"].includes(status(g))&&
  [g?.awayScore,g?.homeScore].every(x=>x!==null&&x!==undefined&&x!==""&&Number.isInteger(Number(x))&&Number(x)>=0&&Number(x)<=999);
 const kickoff=g=>Date.parse(g?.kickoff||"")||Date.parse(String(g?.date||"")+"T12:00:00Z")||0;
 let weekNumber=null,scrollTimer=0,ignoreUntil=0;
 const priorScroll=new Map();
 function weeks(){return app()?.weeks||[];}
 function currentWeek(){return weeks().find(w=>w.num===weekNumber)||app()?.week?.()||weeks()[0]||null;}
 function scoreGames(){return currentWeek()?.games?.slice().sort((a,b)=>kickoff(a)-kickoff(b)||String(a.id).localeCompare(String(b.id)))||[];}
 function scoreWeekNumber(){return currentWeek()?.num||null;}
 function trackGame(id){
  const w=weeks().find(w=>w.games.some(g=>g.id===id));
  if(w)weekNumber=w.num;
 }
 function choose(w){
  return w?.games?.find(g=>status(g)==="live")||
   w?.games?.filter(g=>status(g)==="scheduled"&&kickoff(g)>Date.now()).sort((a,b)=>kickoff(a)-kickoff(b))[0]||
   w?.games?.filter(g=>status(g)==="final").sort((a,b)=>kickoff(b)-kickoff(a))[0]||
   w?.games?.[0]||null;
 }
 function changeGame(g){
  if(!g)return;
  const rail=document.querySelector("#game-center-view [data-score-rail]");
  if(rail&&rail.dataset.scoreWeek===String(scoreWeekNumber()))
   priorScroll.set(scoreWeekNumber(),rail.scrollLeft);
  trackGame(g.id);
  window.SEC_PREMIUM?.selectScoreGame?.(g.id);
 }
 function decorate(host,selected){
  if(!host||!selected||app()?.view?.()!=="game-center")return;
  trackGame(selected.id);
  const w=currentWeek(),games=scoreGames();if(!w||!games.length)return;
  const idx=games.findIndex(x=>x.id===selected.id);
  const count=games.reduce((s,g)=>{s[status(g)]=(s[status(g)]||0)+1;return s;},{});
  const options=weeks().map(x=>'<option value="'+x.num+'"'+(x.num===w.num?' selected':'')+'>Week '+x.num+'</option>').join("");
  const cards=games.map((g,i)=>{
   const st=status(g),has=scored(g),state=st==="live"?"● LIVE":st==="final"?"FINAL":st==="scheduled"?"UPCOMING":st.toUpperCase();
   const teamRow=(id,num)=>'<span class="sdsx-rail-team"><b>'+esc(label(id))+'</b><strong>'+
    (has?Number(num):"–")+'</strong></span>';
   return '<button type="button" class="sdsx-rail-game'+(i===idx?' active':'')+(st==="live"?' is-live':'')+
    '" data-score-match="'+esc(g.id)+'" aria-pressed="'+(i===idx)+'" aria-label="'+
    esc(label(g.away)+' at '+label(g.home)+', '+state+(has?', '+g.awayScore+' to '+g.homeScore:''))+'">'+
    '<span class="sdsx-rail-top"><small>'+esc(state)+'</small><small>'+esc(g.network||"SEC")+'</small></span>'+
    teamRow(g.away,g.awayScore)+teamRow(g.home,g.homeScore)+'</button>';
  }).join("");
  const box=document.createElement("section");
  box.className="sdsx-score-browser";
  box.setAttribute("aria-label","All SEC football game scores");
  box.innerHTML='<div class="sdsx-score-browser-top"><div><h2>Every game. Every score.</h2>'+
   '<p>'+games.length+' games'+(count.live?' · '+count.live+' live':'')+
   (count.final?' · '+count.final+' final':'')+' · Swipe for another matchup</p></div>'+
   '<label>Football week <select data-score-week aria-label="Choose football scores week">'+options+'</select></label></div>'+
   '<div class="sdsx-rail-controls"><button type="button" data-score-shift="-1" aria-label="Previous game" '+
   (idx<=0?'disabled':'')+'>‹</button><span aria-live="polite">Game '+(idx+1)+' of '+games.length+'</span>'+
   '<button type="button" data-score-shift="1" aria-label="Next game" '+
   (idx===games.length-1?'disabled':'')+'>›</button></div>'+
   '<div class="sdsx-score-rail" data-score-rail data-score-week="'+w.num+
   '" role="group" aria-label="Swipe through week '+w.num+' scores" tabindex="0">'+cards+'</div>';
  host.prepend(box);
  const rail=box.querySelector("[data-score-rail]");
  const buttons=[...rail.querySelectorAll("[data-score-match]")];
  const active=buttons[idx];
  const center=active?Math.max(0,active.offsetLeft-rail.offsetLeft-(rail.clientWidth-active.offsetWidth)/2):0;
  ignoreUntil=Date.now()+500;
  const saved=priorScroll.get(w.num);
  // On score changes preserve the user's exact position; selecting another
  // game via week, arrow, or external link centers that game's card.
  rail.scrollLeft=saved!==undefined&&buttons.some(b=>b.dataset.scoreMatch===selected.id&&b.offsetLeft-rail.offsetLeft<=saved+rail.clientWidth)?saved:center;
  priorScroll.set(w.num,rail.scrollLeft);
  box.addEventListener("click",e=>{
   const btn=e.target.closest?.("[data-score-match]");
   if(btn){changeGame(games.find(g=>g.id===btn.dataset.scoreMatch));return;}
   const arrow=e.target.closest?.("[data-score-shift]");
   if(arrow){changeGame(games[idx+Number(arrow.dataset.scoreShift)]);}
  });
  box.addEventListener("change",e=>{
   if(!e.target.matches?.("[data-score-week]"))return;
   const chosen=weeks().find(x=>x.num===Number(e.target.value));
   if(chosen){weekNumber=chosen.num;priorScroll.delete(chosen.num);changeGame(choose(chosen));
    void window.SEC_LIVE_SCORES?.refresh?.(true);}
  });
  rail.addEventListener("keydown",e=>{
   if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;
   e.preventDefault();
   changeGame(games[idx+(e.key==="ArrowLeft"?-1:1)]);
  });
  rail.addEventListener("scroll",()=>{
   priorScroll.set(w.num,rail.scrollLeft);
   if(Date.now()<ignoreUntil)return;
   clearTimeout(scrollTimer);
   scrollTimer=setTimeout(()=>{
    if(!rail.isConnected||app()?.view?.()!=="game-center")return;
    const centerX=rail.getBoundingClientRect().left+rail.clientWidth/2;
    const near=buttons.slice().sort((a,b)=>
     Math.abs(a.getBoundingClientRect().left+a.offsetWidth/2-centerX)-
     Math.abs(b.getBoundingClientRect().left+b.offsetWidth/2-centerX))[0];
    if(near&&near.dataset.scoreMatch!==selected.id)
     changeGame(games.find(g=>g.id===near.dataset.scoreMatch));
   },150);
  },{passive:true});
 }
 window.SEC_SCORE_HUB=Object.freeze({decorate,trackGame,scoreGames,scoreWeekNumber});
 if(app()?.view?.()==="game-center")window.SEC_PREMIUM?.mount?.("game-center");
})();
