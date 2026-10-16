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
 return '<div class="hq-discover">'+newsCard+'</div>';
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


function hero(m){
 const game=m.favoriteUpcoming||m.nextKickoff;
 const p=m.progress;
 const action=m.moment==="finals"?"results":"picks";
 const actionLabel={
  live:"Watch live scores →",picks:"Finish my picks →",
  finals:"See my results →",upcoming:"View upcoming games →",idle:"Browse games →"
 }[m.moment]||"Browse games →";
 const title={
  live:"Games are <em>live.</em>",picks:"Make your <em>picks.</em>",
  finals:"Final <em>scores.</em>",upcoming:"Game Day <em>HQ</em>",
  idle:"Game Day <em>HQ</em>"
 }[m.moment]||"Game Day <em>HQ</em>";
 const line=m.liveCount?m.liveCount+" live football game"+(m.liveCount===1?"":"s"):
  p.unpickedOpen?p.unpickedOpen+" football pick"+(p.unpickedOpen===1?"":"s")+" still open":
  p.total?p.chosen+" of "+p.total+" football picks selected · Week "+(m.week||"—"):
  "Pick your school and get ready for game day.";
 return '<section class="hq-stadium-hero'+(game?"":" hq-no-upcoming")+
  '" aria-label="Game Day HQ"'+(m.favoriteSchool?' data-sds-school="'+esc(m.favoriteSchool)+'"':'')+'>'+
 '<div class="hq-hero-copy"><span class="hq-eyebrow">SATURDAYS DOWN SOUTH</span>'+
 '<h2>'+title+'</h2>'+
 (m.favoriteSchool?'<div class="sds-home-favorite-mini" data-sds-school="'+esc(m.favoriteSchool)+'">'+
  (window.SDS_VISUALS?.mark?.(m.favoriteSchool,{className:"sdsx-crest"})||'<span>'+esc(m.favoriteSchool)+'</span>')+
  '<div><span>★ FOLLOWING YOUR SCHOOL</span><strong>'+esc(m.favoriteName||m.favoriteSchool)+'</strong>'+
  '<small>'+(window.SEC_RANKINGS?.hasCurrent?.("football")&&window.SEC_RANKINGS?.rank?.(m.favoriteSchool,"football")?
   '#'+window.SEC_RANKINGS.rank(m.favoriteSchool,"football")+' AP Top 25 · ':"")+
  esc(m.favoriteRecord?m.favoriteRecord+" overall":"Your university, all season")+'</small>'+
  '<div class="sds-home-favorite-actions" role="group" aria-label="Favorite school shortcuts">'+
  '<button type="button" data-hq-route="team-hub">Team Hub →</button>'+
  '<button type="button" data-hq-route="teams">Edit school</button></div></div></div>':
  '<strong>Same schools. Bigger rivalries.</strong>')+
 '<p class="hq-hero-summary">'+esc(line)+'</p>'+
 '<div class="hq-hero-buttons"><button type="button" data-hq-route="'+action+'"'+
 (m.moment==="live"?' data-hq-focus="live"':m.moment==="picks"?' data-hq-focus="unpicked"':
  m.moment==="upcoming"?' data-hq-focus="upcoming"':'')+' class="hq-primary">'+
 actionLabel+
 '</button>'+(m.favoriteSchool?"":'<button type="button" data-hq-route="teams" class="hq-hero-alt school-picker">☆ Choose Team →</button>')+
 '</div></div>'+
 (game?'<div class="hq-next-kickoff"><span class="hq-hero-next-label">NEXT VERIFIED KICKOFF</span>'+
  '<div class="hq-next-teams"><span>'+
  (window.SDS_VISUALS?.mark?.(game.away,{className:"sdsx-crest"})||"")+
  '<b>'+esc(game.away)+'</b></span><small>VS</small><span>'+
  (window.SDS_VISUALS?.mark?.(game.home,{className:"sdsx-crest"})||"")+
  '<b>'+esc(game.home)+'</b></span></div>'+
  '<strong>'+esc(countdown(game.clock)||"Starting soon")+'</strong><small>'+
  esc(niceTime(game.clock))+' CT</small><button type="button" data-hq-route="picks" data-hq-focus="upcoming">View matchup →</button></div>':"")+
 '</section>';
}
let chatState={account:null,rows:[],selected:null,previews:{},loadedAt:0,busy:false};
async function loadHomeChats(force=false){
 const me=user(),api=window.secOnline,client=api?.getClient?.();
 const uid=me?.id||null,leagues=uid?(api.getLeagues?.()||[]):[];
 if(chatState.account!==uid){chatState={account:uid,rows:[],selected:null,previews:{},loadedAt:0,busy:false};}
 const ids=leagues.map(l=>l.id).filter(Boolean).sort().join(",");
 if(!client||!uid||!leagues.length){chatState.rows=[];chatState.previews={};refresh();return;}
 if(chatState.busy||(!force&&chatState.loadedAt&&Date.now()-chatState.loadedAt<45000&&
  chatState.rows.map(l=>l.id).sort().join(",")===ids))return;
 chatState.busy=true;
 try{
  const previews={};
  await Promise.all(leagues.slice(0,20).map(async l=>{
   const {data,error}=await client.from("sec_league_messages")
    .select("body,created_at,user_id").eq("league_id",l.id)
    .order("created_at",{ascending:false}).limit(1);
   if(!error&&data?.[0])previews[l.id]=data[0];
  }));
  if(user()?.id!==uid)return;
  chatState.rows=leagues.slice(0,20);
  chatState.previews=previews;
  if(!chatState.rows.some(l=>l.id===chatState.selected))
   chatState.selected=api.getLeague?.()?.id||chatState.rows[0]?.id;
  chatState.loadedAt=Date.now();refresh();
 }catch(_error){chatState.loadedAt=Date.now();}finally{chatState.busy=false;}
}
function homeChats(){
 const rows=chatState.rows;
 if(!user())return '<section class="hq-panel hq-home-chats"><div class="hq-panel-header"><span>LEAGUE CHATS</span></div><p>Sign in and join a league to chat with friends.</p><button type="button" data-hq-route="league" class="hq-secondary">Find my leagues →</button></section>';
 if(!rows.length)return '<section class="hq-panel hq-home-chats"><div class="hq-panel-header"><span>LEAGUE CHATS</span></div><p>Your private league conversations will appear here.</p><button type="button" data-hq-route="league" class="hq-secondary">Join a league →</button></section>';
 const selected=rows.find(l=>l.id===chatState.selected)||rows[0];
 const msg=chatState.previews[selected.id];
 return '<section class="hq-panel hq-home-chats" aria-label="Switch between your league chats">'+
 '<div class="hq-panel-header"><span>💬 LEAGUE CHATS</span><span class="hq-feed-pill">'+rows.length+' leagues</span></div>'+
 '<div class="hq-chat-tabs" role="group" aria-label="Choose league conversation">'+rows.map(l=>
 '<button type="button" data-hq-chat-league="'+esc(l.id)+'" aria-pressed="'+(l.id===selected.id)+'" class="'+(l.id===selected.id?'active':'')+'">'+esc(l.name||"My league")+'</button>').join("")+'</div>'+
 '<div class="hq-chat-preview"><strong>'+esc(selected.name||"League chat")+'</strong>'+
 (msg?'<p>'+esc(msg.body).slice(0,180)+'</p>':'<p>No messages yet. Start the conversation.</p>')+'</div>'+
 '<button type="button" class="hq-secondary" data-hq-open-chat="'+esc(selected.id)+'">Open this league chat →</button></section>';
}
function actionCards(m){
 const p=m.progress,idx=m.leaderboard.findIndex(r=>r.user_id===user()?.id);
 const tiles=[
 ["picks","✓","MAKE PICKS",p.unpickedOpen?p.unpickedOpen+" remaining":p.chosen+"/"+p.total+" selected"],
 ["league","▥","LEAGUE RACE",idx>=0?"You're #"+(idx+1):"View standings"],
 ["picks","◉","LIVE SCORES",m.liveCount?m.liveCount+" live now":"See scores"]
 ];
 return '<nav class="hq-actions" aria-label="Game Day shortcuts">'+tiles.map(t=>
 '<button type="button" data-hq-route="'+t[0]+'"'+(t[2]==="LIVE SCORES"?' data-hq-focus="live"':'')+
 ' class="hq-action"><span class="hq-action-icon" aria-hidden="true">'+
 t[1]+'</span><strong>'+t[2]+'</strong><small>'+esc(t[3])+'</small></button>').join("")+'</nav>';
}
function rivalCard(m){
 const r=m.rival;
 return '<section class="hq-rival-card" aria-label="Closest league rival"><div class="hq-panel-header">'+
 '<span>⚔ YOUR LEAGUE RIVAL</span><button type="button" data-hq-route="league" class="hq-inline">League →</button></div>'+
 (r?'<p class="hq-panel-sub">Closest opponent by verified season points.</p>'+
 '<div class="hq-rival-score"><div><small>YOU</small><strong>'+r.yourPoints+'</strong><small>points</small></div>'+
 '<span>VS</span><div><small>'+esc(r.name)+'</small><strong>'+r.theirPoints+'</strong><small>points</small></div></div>'+
 '<div class="hq-rival-track"><span style="width:'+(r.yourPoints+r.theirPoints>0?
 Math.round(100*r.yourPoints/(r.yourPoints+r.theirPoints)):50)+'%"></span></div>'+
 '<small>'+r.gap+' point'+(r.gap===1?"":"s")+' apart · Season totals, not a separate challenge</small>':
 '<p class="hq-empty">Join a league with friends to unlock your closest-rival spotlight.</p>')+'</section>';
}
function extraNews(m){
 return '<section class="hq-feature-card hq-around-news" aria-label="Around the SEC">'+
 '<div class="hq-panel-header"><span>📰 AROUND THE SEC</span>'+
 '<button type="button" data-hq-route="news" class="hq-inline">All news →</button></div>'+
 (m.moreHeadlines.length?'<div class="hq-extra-news">'+m.moreHeadlines.map(x=>
 '<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer" class="hq-extra-story"><small>'+
 esc(x.source)+'</small><strong>'+esc(x.title)+'</strong><span aria-hidden="true">↗</span></a>').join("")+'</div>':
 '<p class="hq-empty">More verified headlines will appear as publishers update.</p>')+'</section>';
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
 // A single timely primary story keeps Home calm. Never infer game results.
 const moment=live.length?"live":progress.unpickedOpen?"picks":
  finals.length?"finals":upcoming.length?"upcoming":"idle";
 const visible=(moment==="live"?live:
  moment==="finals"?finals:[...upcoming,...finals]).slice(0,2);
 const next=nextKickoff(gameList,today);
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
 }).slice(0,5);
 const favorite=favoriteFor(a),headlines=newsPreview(favorite);
 const model={week:Number(w?.num)||null,season:"football",progress,visible,liveCount:live.length,
  finalCount:finals.length,moment,
  leagueName,leaderboard:hasIdentity?ordered:[],leagueKind:selected?.kind||"football",
  loggedIn:hasIdentity,authConfigured:authenticated,
  scoreFreshness:Math.max(0,...live.map(g=>g.updated||0)),
  favoriteSchool:favorite,favoriteName:schoolNames()[favorite]||null,
  favoriteRecord:teamRecord(favorite),favoriteUpcoming:favoriteGame(favorite,gameList,today),
  headlines,moreHeadlines:moreNews(headlines),nextKickoff:next,
  recommended:window.SEC_SPORTS?.recommended?.()||"football"};
 return {...model,rival:closestRival(model)};
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
 return '<article class="hq-matchup" data-game-state="'+(live?"live":finished?"final":"upcoming")+'"><div class="hq-matchup-head"><span class="hq-status '+(live?"live":"")+'">'+
  (live?"● LIVE":finished?"✓ FINAL":"UPCOMING")+'</span><span class="hq-time">'+
  (live?esc(g.phase||"In progress"):finished?"Game complete":esc(niceTime(g.clock)))+'</span></div>'+
  '<div class="hq-matchup-body"><span class="hq-matchup-team" data-sds-school="'+esc(g.away)+'">'+
  (window.SDS_VISUALS?.mark?.(g.away,{className:"mini-logo"})||'<strong>'+esc(g.away)+'</strong>')+
  '<strong>'+esc(g.away)+'</strong></span>'+score+
  '<span class="hq-matchup-team" data-sds-school="'+esc(g.home)+'">'+
  (window.SDS_VISUALS?.mark?.(g.home,{className:"mini-logo"})||'<strong>'+esc(g.home)+'</strong>')+
  '<strong>'+esc(g.home)+'</strong></span></div>'+
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
let previousMarkup=null;
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
 const currentUser=window.secOnline?.getUser?.()?.id||null;
 const leaguePosition=currentUser?model.leaderboard.findIndex(row=>row.user_id===currentUser):-1;
 // Derived solely from current authorized picks and standings, never sample data.
 const thirdLabel=model.moment==="live"?"LIVE NOW":model.moment==="finals"?
  "FINAL GAMES":p.unpickedOpen?"TO PICK":"PICK STATUS";
 const thirdValue=model.moment==="live"?model.liveCount:model.moment==="finals"?
  model.finalCount:p.unpickedOpen||"✓";
 const appMetrics='<div class="hq-app-metrics" aria-label="Your game day snapshot">'+
  '<div class="hq-app-metric"><span>YOUR PICKS</span><strong>'+p.chosen+'<small>/'+p.total+'</small></strong></div>'+
  '<div class="hq-app-metric"><span>LEAGUE RANK</span><strong>'+(leaguePosition>=0?'#'+(leaguePosition+1):'—')+'</strong></div>'+
  '<div class="hq-app-metric"><span>'+thirdLabel+'</span><strong>'+thirdValue+'</strong></div></div>';
 const markup=hero(model)+
 '<div class="hq-sport-tabs" role="group" aria-label="Choose sport">'+sportNames.map(s=>
 '<button type="button" data-hq-route="'+routeFor(s)+'"'+(model.recommended===s?' class="suggested"':'')+'>'+
 sportIcon[s]+' '+sportText[s]+'</button>').join("")+'</div>'+
 '<section class="hq-panel hq-picks hq-calm-picks" aria-label="Your next picks">'+
 '<div class="hq-panel-header"><span>YOUR PICKS</span><strong>Week '+(model.week||"—")+'</strong></div>'+
 '<div class="hq-pick-head"><div><h3>'+esc(heading)+'</h3><p>'+esc(detail)+'</p></div>'+
 '<span class="hq-pick-count">'+p.chosen+'<small> / '+p.total+'</small></span></div>'+
 '<div class="hq-progress" role="progressbar" aria-label="Picks completed" aria-valuemin="0" aria-valuemax="'+p.total+
 '" aria-valuenow="'+p.chosen+'"><span style="width:'+p.percent+'%"></span></div>'+
 (signedOut?'<p class="hq-note">Sign in to save picks to your account.</p>':"")+
 '<button type="button" data-hq-route="picks" data-hq-focus="'+(p.unpickedOpen?"next":"all")+
 '" class="hq-primary">'+(p.unpickedOpen?"Make my picks →":"Review my picks →")+'</button></section>'+
 homeChats()+extraNews(model)+
 '<section class="hq-explore" aria-label="All the important SEC features">'+
 '<div class="hq-panel-header"><span>EXPLORE</span><button type="button" data-sec-find class="hq-find-all">Find anything ⌕</button></div>'+
 '<nav class="hq-calm-links" aria-label="Go directly to a feature">'+
 '<button type="button" data-hq-route="news">📰 News <span>→</span></button>'+
 '<button type="button" data-hq-route="trophies">🏆 Trophies <span>→</span></button>'+
 '<button type="button" data-hq-route="game-center">◉ Scores <span>→</span></button>'+
 '<button type="button" data-hq-route="league">▥ League & Chat <span>→</span></button>'+
 '<button type="button" data-hq-route="results">✓ My Results <span>→</span></button>'+
 '<button type="button" data-hq-route="team-hub">★ My Team <span>→</span></button>'+
 '<button type="button" data-hq-route="teams">▦ All Teams <span>→</span></button>'+
 '</nav></section>'+
 '<p class="hq-disclaimer">Independent SEC fan game · Scores and news are shown only from available sources.</p>';
 // Do not tear down Home's interactive DOM every 30 seconds if nothing changed:
 // refreshing while users swipe the page should not reset buttons or scroll.
 if(previousMarkup===markup&&root.querySelector?.(".hq-stadium-hero"))return;
 previousMarkup=markup;
 const keepExpanded=root.classList?.contains("hq-expanded")||false;
 if(root.dataset)root.dataset.moment=model.moment;
 root.innerHTML=markup;
 const toggle=root.querySelector?.("[data-hq-expand]");
 toggle?.setAttribute?.("aria-expanded",String(keepExpanded));
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
 void loadHomeChats();
 if(!ticking){
  ticking=true;
  setInterval(()=>{if(document.visibilityState==="visible")refresh();},30000);
 }
 // Share the existing verified feeds; never run a second independent news scraper.
 void window.SEC_LIVE_SCORES?.refresh?.();
 void window.SEC_NEWS?.reload?.();
 void Promise.resolve(window.SEC_TEAM_RECORDS?.refresh?.()).then(()=>refresh()).catch(()=>{});
 if(window.secOnline?.isAuthReady?.()!==false){
  void Promise.resolve(window.SEC_LEAGUE_SETTINGS?.load?.()).then(()=>refresh()).catch(()=>{});
 }else{
  void Promise.resolve(window.secOnline?.whenAuthReady?.()).then(()=>
   window.SEC_LEAGUE_SETTINGS?.load?.()
  ).then(()=>refresh()).catch(()=>{});
 }
}
document.addEventListener("click",e=>{
 const more=e.target.closest?.("[data-hq-expand]");
 if(more){
  const root=document.getElementById("sec-home-root");
  const expanded=root?.classList?.toggle("hq-expanded")||false;
  more.setAttribute("aria-expanded",String(expanded));
  more.querySelector("span")?.replaceChildren(expanded?"⌃":"⌄");
  return;
 }
 const tab=e.target.closest?.("[data-hq-chat-league]");
 if(tab&&chatState.rows.some(l=>l.id===tab.dataset.hqChatLeague)){
  chatState.selected=tab.dataset.hqChatLeague;refresh();return;
 }
 const open=e.target.closest?.("[data-hq-open-chat]");
 if(open&&chatState.rows.some(l=>l.id===open.dataset.hqOpenChat)){
  window.secOnline?.useLeague?.(open.dataset.hqOpenChat);
  app()?.setView?.("league");return;
 }
  const b=e.target.closest?.("[data-hq-route]");
 if(!b)return;
 const target=b.dataset.hqRoute;
 if(!["picks","basketball","baseball","league","trophies","news","teams","settings",
  "team-hub","game-center","team-news","results"].includes(target))return;
 app()?.setView?.(target);
 if(target==="picks"&&b.dataset.hqFocus==="next"){
  document.querySelector('[data-slate-next]')?.click();
 }
 if(target==="picks"&&["live","upcoming","unpicked"].includes(b.dataset.hqFocus)){
  document.querySelector('[data-slate-filter="'+b.dataset.hqFocus+'"]')?.click();
 }
});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){refresh();void loadHomeChats();}});
window.SEC_HOME=Object.freeze({mount,refresh,snapshot,pickProgress,gameState,nextKickoff,countdown});
if(app()?.view?.()==="home")mount();
})();