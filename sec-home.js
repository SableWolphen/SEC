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
 const member=user(),joined=window.secOnline?.getLeagues?.()||[];
 const rows=chatState.account===member?.id?chatState.rows.filter(l=>joined.some(x=>x.id===l.id)):[];
 if(!user())return '<section class="hq-panel hq-home-chats"><div class="hq-panel-header"><span>League chats</span></div><p>Sign in and join a league to chat with friends.</p><button type="button" data-hq-route="league" class="hq-secondary">Find my leagues →</button></section>';
 if(!rows.length)return '<section class="hq-panel hq-home-chats"><div class="hq-panel-header"><span>League chats</span></div><p>Your private league conversations will appear here.</p><button type="button" data-hq-route="league" class="hq-secondary">Join a league →</button></section>';
 const selected=rows.find(l=>l.id===chatState.selected)||rows[0];
 const msg=chatState.previews[selected.id];
 return '<section class="hq-panel hq-home-chats" aria-label="Switch between your league chats">'+
 '<div class="hq-panel-header"><span>League chats</span><span class="hq-feed-pill">'+rows.length+' leagues</span></div>'+
 '<div class="hq-chat-tabs" role="group" aria-label="Choose league conversation">'+rows.map(l=>
 '<button type="button" data-hq-chat-league="'+esc(l.id)+'" aria-pressed="'+(l.id===selected.id)+'" class="'+(l.id===selected.id?'active':'')+'">'+esc(l.name||"My league")+'</button>').join("")+'</div>'+
 '<div class="hq-chat-preview"><strong>'+esc(selected.name||"League chat")+'</strong>'+
 (msg?'<p>'+esc(String(msg.body).slice(0,180))+'</p>':'<p>No messages yet. Start the conversation.</p>')+'</div>'+
 '<button type="button" class="hq-secondary" data-hq-open-chat="'+esc(selected.id)+'">Open this league chat →</button></section>';
}
function extraNews(m){
 return '<section class="hq-feature-card hq-around-news" aria-label="Around the SEC">'+
 '<div class="hq-panel-header"><span>Around the SEC</span>'+
 '<button type="button" data-hq-route="news" class="hq-inline">All news →</button></div>'+
 (m.headlines.length?'<div class="hq-extra-news">'+m.headlines.slice(0,1).map(x=>
 '<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer" class="hq-extra-story"><small>'+
 esc(x.source)+' · '+esc(new Date(x.published).toLocaleDateString("en-US",{month:"short",day:"numeric"}))+'</small><strong>'+esc(x.title)+'</strong><span aria-hidden="true">↗</span></a>').join("")+'</div>':
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
let previousMarkup=null;
function render(model){
 const root=document.getElementById("sec-home-root");
 if(!root)return;
 const p=model.progress;
 const markup='<div class="v3-home-intro"><span class="hq-eyebrow">SATURDAY, YOUR WAY</span>'+
 '<h2><span class="v3-mobile-title">Game day starts here.</span><span class="v3-desktop-title">Your SEC Saturday, all in one place.</span></h2>'+
 '<p><span class="v3-mobile-title">The essentials, not an endless dashboard.</span><span class="v3-desktop-title">Finish your picks, follow league conversations and catch up on the conference.</span></p></div>'+
 '<div class="hq-sport-tabs" role="group" aria-label="Choose sport">'+["football","basketball","baseball"].map(s=>
 '<button type="button" data-hq-route="'+routeFor(s)+'" class="'+(model.recommended===s?'suggested':'')+'">'+sportText[s]+'</button>').join("")+'</div>'+
 '<div class="v3-home-grid"><section class="hq-panel hq-picks" aria-label="Your next picks">'+
 '<span class="hq-eyebrow">YOUR NEXT ACTION · FOOTBALL</span><h3><span class="v3-mobile-title">Picks before kickoff.</span><span class="v3-desktop-title">Get your picks in before kickoff.</span></h3>'+
 '<div class="v3-progress-labels"><span>'+p.chosen+' of '+p.total+' selected</span><strong>'+p.unpickedOpen+' left</strong></div>'+
 '<div class="hq-progress" role="progressbar" aria-label="Picks selected" aria-valuemin="0" aria-valuemax="'+Math.max(1,p.total)+'" aria-valuenow="'+p.chosen+'"><span style="width:'+p.percent+'%"></span></div>'+
 (p.lockedMissing?'<p class="hq-note">'+p.lockedMissing+' unpicked games already locked.</p>':'')+
 '<button type="button" data-hq-route="picks" data-hq-focus="'+(p.unpickedOpen?'next':'all')+'" class="hq-primary">'+(p.unpickedOpen?'FINISH MY PICKS':'REVIEW MY PICKS')+' →</button>'+
 (model.authConfigured&&!model.loggedIn?'<p class="hq-note">Sign in to save picks to your account.</p>':'')+'</section>'+
 homeChats()+extraNews(model)+
 '<section class="hq-explore" aria-label="Quick access"><nav class="hq-calm-links" aria-label="Go directly to a feature">'+
 '<button type="button" data-hq-route="game-center"><strong>Scores →</strong><small>Live &amp; final</small></button>'+
 '<button type="button" data-hq-route="trophies"><strong>🏆 Trophies →</strong><small>Rivalry collection</small></button>'+
 '<button type="button" class="v3-desktop-shortcut" data-hq-route="results">✓ My Results →</button>'+
 '<button type="button" class="v3-desktop-shortcut" data-hq-route="team-hub">★ My Team →</button>'+
 '</nav></section></div><button type="button" data-sec-find class="hq-find-all">Everything else: ⌕ Find any feature</button>';
 // Do not tear down Home's interactive DOM every 30 seconds if nothing changed:
 // refreshing while users swipe the page should not reset buttons or scroll.
 if(previousMarkup===markup&&root.querySelector?.(".v3-home-intro"))return;
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
  void window.SEC_LEAGUE_TABS?.openChat?.(open.dataset.hqOpenChat);return;
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