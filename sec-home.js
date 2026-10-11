/*
 * Game Day HQ — reads the SEC app's existing authorized state.
 * Presentation-only: never awards points, submits picks or invents scores.
 */
(()=>{
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const app=()=>window.SEC_BRIDGE;
const user=()=>window.secOnline?.getUser?.()||null;
const routeFor=s=>s==="football"?"picks":s;
const sportText={football:"Football",basketball:"Basketball",baseball:"Baseball"};
const sportIcon={football:"🏈",basketball:"🏀",baseball:"⚾"};
const number=n=>Number.isFinite(Number(n))?Number(n):0;
const validScore=n=>Number.isInteger(n)&&n>=0;
const validDate=s=>typeof s==="string"&&Number.isFinite(Date.parse(s));
const schoolNames=()=>window.SEC_PRIDE?.names||{};
function favoriteFor(a){
 const authorized=window.secOnline?.configured===true;
 const code=authorized?(user()?window.SEC_PRIDE?.getCode?.():null):
  (a?.state?.()?.favorite||window.SEC_PRIDE?.getCode?.());
 return Object.prototype.hasOwnProperty.call(schoolNames(),code)?code:null;
}
function newsPreview(code){
 const all=window.SEC_NEWS?.getArticles?.()||[];
 const trusted=all.filter(x=>x?.title&&window.SEC_NEWS?.safeUrl?.(x.url)&&validDate(x.published_at));
 const school=schoolNames()[code]||null;
 const published=trusted.sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));
 const favored=school?published.filter(x=>Array.isArray(x.teams)&&x.teams.includes(school)):[];
 // Prioritize real school-specific stories but include broader SEC news.
 const chosen=[...favored,...published].filter((item,index,list)=>
  list.findIndex(x=>x.url===item.url)===index).slice(0,2);
 return chosen.map(x=>({
  title:String(x.title).slice(0,200),source:String(x.source||"Publisher").slice(0,50),
  url:window.SEC_NEWS.safeUrl(x.url),published:x.published_at,
  schoolRelated:Boolean(school&&Array.isArray(x.teams)&&x.teams.includes(school))
 }));
}
function discovery(model){
 const school=model.favoriteSchool;
 const name=model.favoriteName;
 const schoolLabel=school?'★ '+esc(school):'☆';
 const schoolCard='<section class="hq-feature-card hq-school-spotlight" aria-label="Your favorite SEC school">'+
  '<div class="hq-feature-kicker"><span>⭐ YOUR SCHOOL</span><span>Personalize game day</span></div>'+
  '<div class="hq-school-content"><span class="hq-school-emblem" aria-hidden="true">'+schoolLabel+'</span><div>'+
  '<h3>'+(school?esc(name):"Pick your SEC school")+'</h3>'+
  '<p>'+(school?"Your school pride follows your account, picks and league.":"Choose a school to personalize your Home, team coverage and league badge.")+'</p></div></div>'+
  '<div class="hq-feature-actions"><button type="button" data-hq-route="teams" class="hq-primary">'+
   (school?"Explore "+esc(name)+" →":"Choose favorite school →")+'</button>'+
   (school?'<button type="button" data-hq-route="teams" class="hq-text-link">Change school</button>':"")+
  '</div></section>';
 const stories=model.headlines.length?model.headlines.map(item=>
  '<a class="hq-headline" target="_blank" rel="noopener noreferrer" href="'+esc(item.url)+'" aria-label="Read article from '+esc(item.source)+': '+esc(item.title)+'">'+
  '<span class="hq-headline-meta">'+(item.schoolRelated?"★ YOUR SCHOOL · ":"")+esc(item.source)+
  ' · '+esc(new Date(item.published).toLocaleDateString("en-US",{month:"short",day:"numeric"}))+'</span>'+
  '<strong>'+esc(item.title)+'</strong><span class="hq-headline-arrow" aria-hidden="true">↗</span></a>').join(""):
  '<p class="hq-empty">Checking recent, source-linked SEC headlines. Open News to browse all sports.</p>';
 const newsCard='<section class="hq-feature-card hq-news-spotlight" aria-label="Latest SEC news">'+
  '<div class="hq-feature-kicker"><span>📰 SEC NEWS</span><span>Publisher-linked</span></div>'+
  '<h3>Headlines that matter.</h3><div class="hq-headlines">'+stories+'</div>'+
  '<button type="button" data-hq-route="news" class="hq-news-all">All SEC news &amp; breaking stories →</button>'+
  '</section>';
 return '<div class="hq-discover">'+schoolCard+newsCard+'</div>';
}

function nextKickoff(games,now=Date.now()){
 return games.filter(g=>g.status==="scheduled"&&!g.provisional&&g.clock&&g.clock>now)
  .sort((a,b)=>a.clock-b.clock)[0]||null;
}
function countdown(kickoff,now=Date.now()){
 if(!kickoff||kickoff<=now)return null;
 const total=Math.max(1,Math.ceil((kickoff-now)/60000));
 const days=Math.floor(total/1440),hours=Math.floor(total%1440/60),mins=total%60;
 return (days?days+"d ":"")+hours+"h "+String(mins).padStart(2,"0")+"m";
}
function teamRecord(code){
 const entry=code&&window.SEC_TEAM_RECORDS?.entry?.(code,"football");
 return entry&&/^\d{1,3}-\d{1,3}(?:-\d{1,3})?$/.test(entry.overall||"")?entry.overall:null;
}
function favoriteGame(code,games,now=Date.now()){
 return code?games.filter(g=>g.status==="scheduled"&&!g.provisional&&g.clock>now&&
  (g.away===code||g.home===code)).sort((a,b)=>a.clock-b.clock)[0]||null:null;
}
function moreNews(primary){
 const used=new Set(primary.map(x=>x.url));
 return (window.SEC_NEWS?.getArticles?.()||[])
  .filter(x=>x?.title&&validDate(x.published_at)&&window.SEC_NEWS?.safeUrl?.(x.url))
  .sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))
  .filter(x=>!used.has(x.url)&&used.add(x.url)).slice(0,3)
  .map(x=>({title:String(x.title).slice(0,200),
   source:String(x.source||"Publisher").slice(0,50),
   url:window.SEC_NEWS.safeUrl(x.url),published:x.published_at}));
}
function closestRival(model){
 if(!model.loggedIn)return null;
 const rows=model.leaderboard||[],mine=rows.find(r=>r.user_id===user()?.id);
 if(!mine)return null;
 const value=r=>number(model.leagueKind==="club"?r.total:r.season_points);
 const others=rows.filter(r=>r.user_id!==user()?.id);
 if(!others.length)return null;
 const rival=others.sort((a,b)=>Math.abs(value(a)-value(mine))-Math.abs(value(b)-value(mine)))[0];
 return {name:String(rival.display_name||"League rival").slice(0,40),
  yourPoints:value(mine),theirPoints:value(rival),gap:Math.abs(value(mine)-value(rival))};
}

function gameState(g){
 const status=["live","final","scheduled","canceled","postponed"].includes(g?.liveStatus)?g.liveStatus:"scheduled";
 const updated=validDate(g?.scoreUpdatedAt)?Date.parse(g.scoreUpdatedAt):null;
 const scores=(status==="live"||status==="final")&&validScore(g.awayScore)&&validScore(g.homeScore);
 return {id:g.id,away:g.away,home:g.home,status,updated,scored:scores,
  awayScore:scores?g.awayScore:null,homeScore:scores?g.homeScore:null,
  phase:status==="live"&&g.statusDetail?String(g.statusDetail).slice(0,64):"",
  possession:status==="live"?g.livePossessionCode||null:null,
  fieldPercent:status==="live"&&Number.isFinite(Number(g.liveFieldPercent))?
   Math.min(100,Math.max(0,Number(g.liveFieldPercent))):null,
  clock:validDate(g.kickoff)?Date.parse(g.kickoff):null,
  provisional:Boolean(g.onlineProvisional)||!validDate(g.kickoff),
  down:g.liveDown??null,distance:g.liveDistance??null,position:g.livePositionText||null};
}
function pickProgress(games,picks,locked,unavailable){
 const total=games.length;let chosen=0,unpickedOpen=0,lockedMissing=0,open=0;
 for(const g of games){
  const picked=picks?.[g.id]===g.away||picks?.[g.id]===g.home;
  if(picked)chosen++;
  const closed=locked(g)||unavailable(g);
  if(!closed)open++;
  if(!picked){if(closed)lockedMissing++;else unpickedOpen++;}
 }
 return {total,chosen,unpickedOpen,lockedMissing,open,percent:total?Math.round(chosen*100/total):0};
}
function snapshot(a=app(),today=Date.now()){
 const w=a?.week?.(),games=Array.isArray(w?.games)?w.games:[];
 const picks=a?.state?.()?.picks||{};
 const locked=g=>a?.isLocked?.(g)??(validDate(g.kickoff)&&today>=Date.parse(g.kickoff));
 const unavailable=g=>!!window.SEC_FEATURES?.isUnavailable?.(g);
 const progress=pickProgress(games,picks,locked,unavailable);
 const gameList=games.map(gameState);
 const live=gameList.filter(g=>g.status==="live");
 const upcoming=gameList.filter(g=>g.status==="scheduled"&&(!g.clock||g.clock>=today-45*60000))
  .sort((x,y)=>(x.clock??Infinity)-(y.clock??Infinity));
 const finals=gameList.filter(g=>g.status==="final")
  .sort((x,y)=>(y.clock??0)-(x.clock??0));
 const visible=[...live,...upcoming,...finals].slice(0,3);
 const selected=window.SEC_LEAGUE_SETTINGS?.getSelected?.()||null;
 let leagueName=selected?.name||null,rows=[];
 if(selected?.kind==="club"){
  rows=window.SEC_LEAGUE_SETTINGS?.getStandings?.()||[];
 }else if(!selected||selected.kind==="football"){
  const football=window.secOnline?.getLeague?.()||null;
  // Never show standings from another selected league, even while switching.
  if(football&&(!selected||selected.id===football.id)){
   leagueName=selected?.name||football.name;rows=window.secOnline?.getStandings?.()||[];
  }
 }
 const hasIdentity=Boolean(user());
 const authenticated=window.secOnline?.configured===true;
 const ordered=rows.filter(r=>r&&r.user_id).slice().sort((x,y)=>{
  const score=r=>number(selected?.kind==="club"?r.total:r.season_points);
  return score(y)-score(x);
 }).slice(0,4);
 return {week:Number(w?.num)||null,season:"football",progress,visible,liveCount:live.length,
  leagueName,leaderboard:hasIdentity?ordered:[],leagueKind:selected?.kind||"football",
  loggedIn:hasIdentity,authConfigured:authenticated,
  scoreFreshness:Math.max(0,...live.map(g=>g.updated||0)),
  favoriteSchool:favoriteFor(a),favoriteName:schoolNames()[favoriteFor(a)]||null,
  headlines:newsPreview(favoriteFor(a)),
  recommended:window.SEC_SPORTS?.recommended?.()||"football"};
}
function niceTime(ms){
 if(!Number.isFinite(ms)||ms<=0)return "Kickoff TBA";
 return new Date(ms).toLocaleString("en-US",{weekday:"short",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"});
}
function shortAge(ms){
 if(!ms)return "Update time unavailable";
 const mins=Math.max(0,Math.floor((Date.now()-ms)/60000));
 return mins<1?"Updated less than a minute ago":mins<60?"Updated "+mins+" min ago":
  "Updated "+Math.floor(mins/60)+" hr ago";
}
function match(g){
 const live=g.status==="live",finished=g.status==="final";
 const score=g.scored?'<strong class="hq-game-score">'+g.awayScore+' – '+g.homeScore+'</strong>':
  '<strong class="hq-game-score muted">— : —</strong>';
 const field=live&&g.fieldPercent!==null&&g.possession?
  '<div class="hq-field" aria-label="Live field position"><div class="hq-field-lines"></div>'+
  '<span class="hq-field-ball" style="left:'+g.fieldPercent+'%"></span>'+
  '<span class="hq-possession">'+esc(g.possession)+' possession</span></div>':"";
 return '<article class="hq-matchup"><div class="hq-matchup-head"><span class="hq-status '+(live?"live":"")+'">'+
  (live?"● LIVE":finished?"✓ FINAL":"UPCOMING")+'</span><span class="hq-time">'+
  (live?esc(g.phase||"In progress"):finished?"Game complete":esc(niceTime(g.clock)))+'</span></div>'+
  '<div class="hq-matchup-body"><strong>'+esc(g.away)+'</strong>'+score+'<strong>'+esc(g.home)+'</strong></div>'+
  field+(live?'<small class="hq-freshness">'+esc(shortAge(g.updated))+
   ((!g.updated||Date.now()-g.updated>180000)?" · Score may be delayed":"")+'</small>':"")+
  '</article>';
}
function standings(model){
 if(!model.loggedIn)return '<p class="hq-empty">Sign in to see your private league and compete with friends.</p>';
 if(!model.leaderboard.length)return '<p class="hq-empty">Join a league or open its standings to see the verified race.</p>';
 const who=user()?.id;
 return '<div class="hq-standings">'+model.leaderboard.map((r,i)=>{
  const value=number(model.leagueKind==="club"?r.total:r.season_points);
  const name=esc(String(r.display_name||"League member").slice(0,40));
  const mine=r.user_id===who;
  return '<div class="hq-standings-row'+(mine?" mine":"")+'"><span class="hq-rank">'+(i+1)+'</span>'+
   '<span class="hq-standing-name">'+name+(mine?' <small>YOU</small>':"")+'</span>'+
   '<strong>'+value+' <small>pts</small></strong></div>';
 }).join("")+'</div>'+
 '<p class="hq-note">Verified league points only · No projected winners</p>';
}
function render(model){
 const root=document.getElementById("sec-home-root");
 if(!root)return;
 const {progress:p}=model;
 const signedOut=model.authConfigured&&!model.loggedIn;
 const heading=p.unpickedOpen?p.unpickedOpen+" picks left before lock":
  !p.total?"Your next slate is coming":"You're caught up on available picks";
 const detail=p.lockedMissing?
  p.lockedMissing+" unpicked game"+(p.lockedMissing===1?" is":"s are")+" already locked.":
  p.unpickedOpen?"Make your remaining selections before kickoff.":
  "Review your saved choices or explore the league.";
 const sportNames=["football","basketball","baseball"];
 root.innerHTML='<div class="hq-welcome"><div><span class="hq-eyebrow">YOUR HOME FIELD</span>'+
  '<h2>Every game. Every pick. <em>Your league.</em></h2>'+
  '<p>One place for your next slate, live SEC games and the race with friends.</p></div>'+
  '<div class="hq-hero-emblem" aria-hidden="true">🏆</div></div>'+
  discovery(model)+
  '<div class="hq-sport-tabs" role="group" aria-label="Pick a sport">'+sportNames.map(s=>
   '<button type="button" data-hq-route="'+routeFor(s)+'"'+(model.recommended===s?' class="suggested"':'')+'>'+
   sportIcon[s]+' '+sportText[s]+(model.recommended===s?'<small>Latest season</small>':"")+'</button>').join("")+'</div>'+
  '<div class="hq-grid">'+
   '<section class="hq-panel hq-picks" aria-label="Your football picks"><div class="hq-panel-header">'+
    '<span>01 · YOUR PICKS</span><strong>Week '+(model.week||"—")+'</strong></div>'+
    '<div class="hq-pick-head"><div><h3>'+esc(heading)+'</h3><p>'+esc(detail)+'</p></div>'+
    '<span class="hq-pick-count">'+p.chosen+'<small> / '+p.total+'</small></span></div>'+
    '<div class="hq-progress" role="progressbar" aria-label="Picks completed" aria-valuemin="0" aria-valuemax="'+p.total+
    '" aria-valuenow="'+p.chosen+'"><span style="width:'+p.percent+'%"></span></div>'+
    '<div class="hq-progress-caption"><span>'+p.percent+'% selected</span><span>'+p.unpickedOpen+' open and unpicked</span></div>'+
    (signedOut?'<p class="hq-note">Sign in to save picks to your account.</p>':"")+
    '<button type="button" data-hq-route="picks" data-hq-focus="'+(p.unpickedOpen?"next":"all")+
    '" class="hq-primary">'+(p.unpickedOpen?"Finish my picks →":"Review football picks →")+'</button></section>'+
   '<section class="hq-panel hq-games" aria-label="Current football scores"><div class="hq-panel-header">'+
    '<span>02 · GAME CENTER</span><span class="hq-feed-pill">'+(model.liveCount?model.liveCount+" LIVE":"Verified score feed")+'</span></div>'+
    '<h3>On the field</h3><p class="hq-panel-sub">Only confirmed results and scheduled SEC matchups.</p>'+
    '<div class="hq-games-list">'+(model.visible.length?model.visible.map(match).join(""):
      '<p class="hq-empty">No current football matchups available for Week '+(model.week||"—")+'. Switch sports or check back for updated fixtures.</p>')+'</div>'+
    '<button type="button" data-hq-route="picks" class="hq-secondary">Open full Game Center →</button></section>'+
   '<section class="hq-panel hq-league" aria-label="League race"><div class="hq-panel-header">'+
    '<span>03 · LEAGUE RACE</span><span class="hq-feed-pill">Verified points</span></div>'+
    '<h3>'+esc(model.leagueName||"Your league")+'</h3>'+
    '<p class="hq-panel-sub">See where you stand. Only finalized games affect the points.</p>'+
    standings(model)+
    '<button type="button" data-hq-route="league" class="hq-secondary">See full league standings →</button></section>'+
   '<section class="hq-panel hq-quick" aria-label="Explore more"><div class="hq-panel-header"><span>04 · CLUBHOUSE</span></div>'+
    '<h3>Your season, your story</h3><p class="hq-panel-sub">Your rivalries, trophies and headlines are one tap away.</p>'+
    '<div class="hq-quick-links"><button type="button" data-hq-route="trophies">🏆 Trophy Room <span>→</span></button>'+
    '<button type="button" data-hq-route="news">📰 SEC News <span>→</span></button>'+
    '<button type="button" data-hq-route="teams">⭐ Favorite Teams <span>→</span></button></div></section>'+
  '</div><p class="hq-disclaimer">Independent SEC fan game · No live score is shown until confirmed by the score feed. '+
   '3D trophies and player information load only when you open their sections.</p>';
}
let ticking=false;
function refresh(){
 if(app()?.view?.()!=="home")return;
 render(snapshot());
}
function mount(){
 if(app()?.view?.()!=="home")return;
 refresh();
 if(window.secOnline?.isAuthReady?.()===false){
  const id=user()?.id||null;
  window.secOnline.whenAuthReady?.().then(()=>{
   if(app()?.view?.()==="home"&&(user()?.id||null)!==id)refresh();
  }).catch(()=>{});
 }
 if(!ticking){
  ticking=true;
  setInterval(()=>{if(document.visibilityState==="visible")refresh();},30000);
 }
 // Share the existing verified feeds; never run a second independent news scraper.
 void window.SEC_LIVE_SCORES?.refresh?.();
 void window.SEC_NEWS?.reload?.();
 if(window.secOnline?.isAuthReady?.()!==false){
  void Promise.resolve(window.SEC_LEAGUE_SETTINGS?.load?.()).then(()=>refresh()).catch(()=>{});
 }else{
  void Promise.resolve(window.secOnline?.whenAuthReady?.()).then(()=>
   window.SEC_LEAGUE_SETTINGS?.load?.()
  ).then(()=>refresh()).catch(()=>{});
 }
}
document.addEventListener("click",e=>{
 const b=e.target.closest?.("[data-hq-route]");
 if(!b)return;
 const target=b.dataset.hqRoute;
 if(!["picks","basketball","baseball","league","trophies","news","teams","settings"].includes(target))return;
 app()?.setView?.(target);
 if(target==="picks"&&b.dataset.hqFocus==="next"){
  document.querySelector('[data-slate-next]')?.click();
 }
});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh();});
window.SEC_HOME=Object.freeze({mount,refresh,snapshot,pickProgress,gameState});
if(app()?.view?.()==="home")mount();
})();