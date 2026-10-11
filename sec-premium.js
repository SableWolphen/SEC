/* Saturdays Down South — cinematic Game Day, Team Hub, Team News and Results.
   Presentation only. Scores, picks, league rankings and national polls are read
   exclusively from the existing authorized SEC app and verified public feeds.
   Never generate a score, award points, guess possession or expose private picks.
 */
(()=>{
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;":"&quot;","'":"&#39;"}[c]));
const app=()=>window.SEC_BRIDGE;
const user=()=>window.secOnline?.getUser?.();
const codes=()=>window.SEC_PRIDE?.names||{};
const verifiedId=s=>Object.prototype.hasOwnProperty.call(codes(),s);
const teamName=s=>codes()[s]||String(s||"Unknown");
const gameList=()=>app()?.weeks?.flatMap(w=>w.games)||[];
const recent=()=>app()?.week?.()?.games||[];
const identity=()=>window.secOnline?.configured!==true||!!user();
const favorite=()=>{
 const c=window.secOnline?.configured===true?
  (user()?window.SEC_PRIDE?.getCode?.():null):
  (app()?.state?.()?.favorite||window.SEC_PRIDE?.getCode?.());
 return verifiedId(c)?c:null;
};
const status=g=>["live","final","scheduled","canceled","postponed"].includes(g?.liveStatus)?g.liveStatus:"scheduled";
const validScore=s=>s!==null&&s!==undefined&&s!==""&&Number.isInteger(Number(s))&&Number(s)>=0&&Number(s)<=999;
const scores=g=>["live","final"].includes(status(g))&&validScore(g?.awayScore)&&validScore(g?.homeScore);
const time=g=>{const n=Date.parse(g?.kickoff||"");return Number.isFinite(n)?n:null;};
const fmt=t=>t?new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago",timeZoneName:"short"}).format(new Date(t)):"Kickoff time to be announced";
const now=()=>Date.now();
const dateText=g=>fmt(time(g))||"TBA";
const logo=code=>'<span class="sdsx-crest" aria-hidden="true">'+esc(String(code||"SEC").slice(0,5))+'</span>';
const named=code=>'<span class="sdsx-team">'+logo(code)+'<strong>'+esc(teamName(code))+'</strong></span>';
const meta=(eyebrow,title,subtitle)=>'<div class="sdsx-section-intro"><span class="sdsx-eyebrow">'+eyebrow+'</span><h2>'+title+'</h2>'+(subtitle?'<p>'+subtitle+'</p>':"")+'</div>';
const empty=(title,desc)=>'<div class="sdsx-empty"><strong>'+esc(title)+'</strong><p>'+esc(desc)+'</p></div>';
const link=(label,url,cls="sdsx-link")=>url?'<a class="'+cls+'" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>':"";
const eventUrl=g=>/^\d{7,14}$/.test(String(g?.espnEventId||""))?"https://www.espn.com/college-football/game/_/gameId/"+g.espnEventId:null;
const boxUrl=g=>/^\d{7,14}$/.test(String(g?.espnEventId||""))?"https://www.espn.com/college-football/boxscore/_/gameId/"+g.espnEventId:null;
const storiesFor=(code,limit=3)=>{
 const t=teamName(code),get=window.SEC_NEWS;
 return (get?.getArticles?.()||[]).filter(x=>x&&typeof x.title==="string"&&
  Array.isArray(x.teams)&&x.teams.includes(t)&&get.safeUrl?.(x.url)&&
  Number.isFinite(Date.parse(x.published_at))).
 sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)).slice(0,limit);
};
const latestStories=(limit=3)=>{
 const get=window.SEC_NEWS;
 return (get?.getArticles?.()||[]).filter(x=>x&&x.title&&get.safeUrl?.(x.url)&&
  Number.isFinite(Date.parse(x.published_at))).
 sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)).slice(0,limit);
};
const newsLink=s=>window.SEC_NEWS?.safeUrl?.(s.url);
function stories(items){
 return items.length?'<div class="sdsx-news-stack">'+items.map(x=>
  '<a class="sdsx-news-row" href="'+esc(newsLink(x))+'" target="_blank" rel="noopener noreferrer">'+
  '<span class="sdsx-news-image" aria-hidden="true">SDS</span><span class="sdsx-news-copy">'+
  '<strong>'+esc(x.title)+'</strong><small>'+esc(x.source||"Publisher")+' · '+
  esc(new Date(x.published_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}))+
  '</small></span><span aria-hidden="true">›</span></a>').join("")+'</div>':
  empty("No verified stories yet","New articles will appear here when the publisher feed has coverage.");
}
function nextFor(code){
 return gameList().filter(g=>(g.home===code||g.away===code)&&status(g)==="scheduled"&&
 time(g)!==null&&time(g)>now()&&g.onlineProvisional!==true)
  .sort((a,b)=>time(a)-time(b))[0]||null;
}
function gamesFor(code){return gameList().filter(g=>g.home===code||g.away===code)
 .sort((a,b)=>(time(b)||Date.parse(b.date||"")||0)-(time(a)||Date.parse(a.date||"")||0));}
function scoreLine(g){
 const final=status(g)==="final",live=status(g)==="live";
 const code=final?"FINAL":live?"● LIVE":status(g)==="scheduled"?"UPCOMING":status(g).toUpperCase();
 return '<span class="sdsx-game-state'+(live?" live":"")+'">'+code+'</span>'+
 (scores(g)?'<b class="sdsx-scores">'+Number(g.awayScore)+' – '+Number(g.homeScore)+'</b>':
 '<b class="sdsx-unscored">'+(time(g)?esc(fmt(time(g))):"TBA")+'</b>');
}
const ranking=(code,sport)=>window.SEC_RANKINGS?.rank?.(code,sport)||null;
const records=(code,sport)=>window.SEC_TEAM_RECORDS?.entry?.(code,sport)||null;
let pickedGame=null,pickedTeam=null,selectedWeek=null,gameTab="game",newsTab="news",lastRendered="",timer=null;
function selectTeam(code){if(verifiedId(code))pickedTeam=code;return pickedTeam||favorite();}
function openTeam(code){
 if(verifiedId(code))pickedTeam=code;
 app()?.setView?.("team-hub");
}
function openGame(id){
 if(typeof id==="string"&&gameList().some(g=>g.id===id))pickedGame=id;
 app()?.setView?.("game-center");
}
function openResults(weekNo){
 if(Number.isInteger(weekNo)&&app()?.weeks?.some(w=>w.num===weekNo))selectedWeek=weekNo;
 app()?.setView?.("results");
}
function header(code,label,tag){
 const rank=ranking(code,"football"),record=records(code,"football");
 return '<div class="sdsx-team-hero"><div class="sdsx-hero-mark">'+logo(code)+'</div>'+
  '<div class="sdsx-hero-body"><span class="sdsx-eyebrow">'+esc(tag||"YOUR SEC TEAM")+'</span>'+
  '<h2>'+esc(teamName(code))+'</h2><strong>'+esc(label||"Game day starts here")+'</strong>'+
  '<div class="sdsx-hero-meta">'+(rank?'<span>#'+rank+' · '+esc(window.SEC_RANKINGS?.note?.("football")||"AP poll")+'</span>':"")+
  (record?'<span>'+esc(record.overall)+' record</span>':"")+'</div></div></div>';
}
function rankings(code){
 return '<section class="sdsx-section"><div class="sdsx-section-head"><h3>NATIONAL RANKINGS</h3>'+
  '<span>Published polls</span></div><div class="sdsx-ranking-grid">'+
  [["football","🏈","Football"],["basketball","🏀","Men's Basketball"],["baseball","⚾","Baseball"]].map(([sport,emoji,label])=>{
  const p=window.SEC_RANKINGS?.getPoll?.(sport),current=window.SEC_RANKINGS?.hasCurrent?.(sport);
  const r=current?ranking(code,sport):null;
  const old=!current?p?.teams?.[code]?.rank:null;
  return '<div class="sdsx-ranking-card"><span>'+emoji+' '+esc(label)+'</span>'+
  '<strong>'+ (r?"#"+r:current?"NR":old?"Last #"+old:"—")+'</strong>'+
  '<small>'+esc(window.SEC_RANKINGS?.note?.(sport)||"Poll unavailable")+'</small></div>';
 }).join("")+'</div><p class="sdsx-source-note">National rankings are dated; a completed season\'s last poll is never labeled current.</p></section>';
}
function teamSchedule(code){
 const items=gamesFor(code).slice().sort((a,b)=>(time(a)||Date.parse(a.date||"")||0)-(time(b)||Date.parse(b.date||"")||0));
 return '<section class="sdsx-section"><div class="sdsx-section-head"><h3>FOOTBALL SCHEDULE &amp; RESULTS</h3><span>2026 season</span></div>'+
 (items.length?'<div class="sdsx-schedule">'+items.map(g=>{
   const rival=g.home===code?g.away:g.home;
   const d=window.SEC_FEATURES?.finalData?.(g);
   const verifiedFinal=Boolean(d);
   const won=verifiedFinal&&d.winner===code;
   const score=verifiedFinal?
    (g.home===code?d.homeScore+"–"+d.awayScore:d.awayScore+"–"+d.homeScore):
    status(g)==="live"&&scores(g)?(g.home===code?Number(g.homeScore)+"–"+Number(g.awayScore):Number(g.awayScore)+"–"+Number(g.homeScore)):
    status(g)==="final"?"Final score pending":time(g)?fmt(time(g)):"Kickoff TBA";
   return '<button type="button" class="sdsx-schedule-row" data-sdsx-game="'+esc(g.id)+'">'+
    '<small>'+esc(String(g.date||""))+'</small><span class="sdsx-vs"><span class="sdsx-crest tiny">'+esc(rival)+'</span>'+esc(g.home===code?"vs ":"@ ")+esc(teamName(rival))+'</span>'+
    (verifiedFinal?'<span class="sdsx-wl '+(won?"won":"lost")+'">'+(won?"W":"L")+'</span>':
    status(g)==="live"?'<span class="sdsx-live-chip">LIVE</span>':'')+
    '<strong>'+esc(score)+'</strong><span aria-hidden="true">›</span></button>';
 }).join("")+'</div>':empty("Schedule unavailable","Your favorite school's 2026 football fixtures will appear here."))+
 '</section>';
}
function teamHub(){
 const code=selectTeam(pickedTeam),host=document.getElementById("sdsx-team-root");if(!host)return;
 if(!code){host.innerHTML=meta("TEAM HUB","Choose your SEC school","Your personalized team experience starts with one favorite.")+
  empty("No favorite selected","Choose a school in Teams and it will appear here.")+
 '<button type="button" class="sdsx-gold-button" data-sdsx-view="teams">Choose favorite university →</button>';return;}
 const next=nextFor(code),news=storiesFor(code,3),rec=records(code,"football");
 host.innerHTML=header(code,"Your university. All season long.","YOUR TEAM HUB")+
  '<div class="sdsx-button-row"><button type="button" data-sdsx-game="'+esc(next?.id||"")+'" class="sdsx-gold-button" '+(!next?'disabled':'')+'>▶ Open Game Day</button>'+
  '<button type="button" class="sdsx-outline-button" data-sdsx-view="teams">★ Change team</button>'+
  '<button type="button" class="sdsx-outline-button" data-sdsx-view="team-news">▤ Team news</button></div>'+
  (next?'<section class="sdsx-next"><span>YOUR NEXT VERIFIED MATCHUP</span><div>'+named(next.away)+
   '<strong>VS</strong>'+named(next.home)+'</div><p>'+esc(fmt(time(next)))+
   '</p><button type="button" data-sdsx-game="'+esc(next.id)+'">Open Game Center ›</button></section>':
   empty("No confirmed upcoming football game","Check the schedule below or switch to basketball/baseball picks."))+
  rankings(code)+
  '<section class="sdsx-section"><div class="sdsx-section-head"><h3>SEASON SNAPSHOT</h3>'+
  '<span>Verified records</span></div><div class="sdsx-mini-metrics">'+
  [["🏈","Football",rec?.overall],["🏀","Basketball",records(code,"basketball")?.overall],
  ["⚾","Baseball",records(code,"baseball")?.overall]].map(([i,t,v])=>
  '<div><span>'+i+' '+esc(t)+'</span><strong>'+esc(v||"—")+'</strong></div>').join("")+'</div></section>'+
  teamSchedule(code)+
  '<section class="sdsx-section"><div class="sdsx-section-head"><h3>LATEST '+esc(teamName(code).toUpperCase())+
  ' NEWS</h3><button type="button" data-sdsx-view="team-news">See all ›</button></div>'+stories(news)+'</section>'+
  '<section class="sdsx-section sdsx-roster-info"><div class="sdsx-section-head"><h3>ROSTER &amp; PLAYER STATS</h3></div>'+
  '<p>Verified roster photography and player data are not yet available in the app\'s feed. Use the official college football source for current player details.</p>'+
  link("View college football team coverage","https://www.espn.com/college-football/teams")+'</section>';
}
function chooseGame(){
 const games=recent(),all=gameList();
 return all.find(g=>g.id===pickedGame)||
  games.find(g=>status(g)==="live")||
  games.filter(g=>status(g)==="scheduled"&&time(g)>now()).sort((a,b)=>time(a)-time(b))[0]||
  games.find(g=>status(g)==="final")||games[0]||null;
}
function gameCenter(){
 const host=document.getElementById("sdsx-game-root");if(!host)return;
 const g=chooseGame();
 if(!g){host.innerHTML=meta("GAME CENTER","Follow every play","Provider-confirmed scores and game data.")+
 empty("No matchup available","Choose a game from the football slate.");return;}
 pickedGame=g.id;
 const st=status(g),live=st==="live",final=st==="final",scored=scores(g);
 const updated=Number.isFinite(Date.parse(g.scoreUpdatedAt||""))?Date.parse(g.scoreUpdatedAt):null;
 const stale=live&&(!updated||now()-updated>180000);
 const phase=String(g.statusDetail||"").slice(0,65);
 const statusText=live?"● LIVE":final?"✓ FINAL":st==="scheduled"?"UPCOMING":st.toUpperCase();
 const down=window.SEC_LIVE_DRIVE?.render?.(g,null,st)||"";
 const verifiedScores=scored?('<div class="sdsx-center-score"><div>'+named(g.away)+
  '<strong>'+Number(g.awayScore)+'</strong></div><span>'+esc(phase||statusText)+'</span><div>'+named(g.home)+
  '<strong>'+Number(g.homeScore)+'</strong></div></div>'):
  '<div class="sdsx-center-score"><div>'+named(g.away)+'</div><span>VS</span><div>'+named(g.home)+'</div></div>';
 const typeLabel=live?"CURRENT DRIVE":final?"FINAL SCORE":"NEXT GAME";
 const lastPlay=live&&g.liveLastPlay&&g.liveSituationUpdatedAt&&
  now()-Date.parse(g.liveSituationUpdatedAt)<=240000?String(g.liveLastPlay).slice(0,240):null;
 host.innerHTML='<section class="sdsx-score-hero"><div class="sdsx-score-top"><span class="'+
 (live?"sdsx-live-chip":"sdsx-finished-chip")+'">'+statusText+'</span>'+
 '<span>'+esc(dateText(g))+'</span></div>'+verifiedScores+
 '<p class="sdsx-score-fresh">'+(live?(stale?"Score feed may be delayed":"Provider-confirmed live score"):
 final?"Verified final result":"Picks lock at kickoff")+
 (updated?" · Updated "+esc(new Date(updated).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})):"")+
 '</p></section>'+
 '<div class="sdsx-button-row"><button type="button" data-sdsx-view="picks" class="sdsx-gold-button">View picks →</button>'+
 '<button type="button" class="sdsx-outline-button" data-sdsx-view="results">Pick\'em results</button>'+
 '<button type="button" class="sdsx-outline-button" data-sdsx-view="league">League discussion</button></div>'+
 '<div class="sdsx-tabs" role="tablist" aria-label="Game Center tabs">'+
 [['game',"Game"],["stats","Stats"],["plays","Plays"],["discussion","Discussion"]].map(([key,label])=>
 '<button type="button" role="tab" data-sdsx-tab="'+key+'" aria-selected="'+(gameTab===key)+'" class="'+(gameTab===key?"active":"")+'">'+label+'</button>').join("")+'</div>'+
 '<div class="sdsx-tab-body">'+
 (gameTab==="game"?'<section class="sdsx-section"><div class="sdsx-section-head"><h3>'+typeLabel+'</h3>'+
  '<span>'+esc(phase||statusText)+'</span></div>'+
  (down||empty(live?"Field position awaiting update":final?"Game completed":"Waiting for kickoff",
    live?"The football and verified possession will appear when the play feed updates.":
    final?"Choose Plays to see the official recap link.":"The game will start at its published kickoff."))+
  (lastPlay?'<div class="sdsx-play-call"><strong>LAST VERIFIED PLAY</strong><p>'+esc(lastPlay)+'</p></div>':"")+
  '</section><section class="sdsx-section"><div class="sdsx-section-head"><h3>MATCHUP SNAPSHOT</h3>'+
  '<span>Source-verified</span></div><div class="sdsx-mini-metrics"><div><span>'+esc(g.away)+'</span>'+
  '<strong>'+esc(records(g.away,"football")?.overall||"—")+'</strong><small>Season record</small></div>'+
  '<div><span>'+esc(g.home)+'</span><strong>'+esc(records(g.home,"football")?.overall||"—")+
  '</strong><small>Season record</small></div></div>'+
  (window.SEC_STATS?.render?.(g)||"")+'</section>':
 gameTab==="stats"?'<section class="sdsx-section"><div class="sdsx-section-head"><h3>TEAM STATS</h3></div>'+
  empty("Live yardage stats unavailable","The app has verified scores, but does not yet receive a complete live box-score feed. No stats are fabricated.")+
  (window.SEC_STATS?.render?.(g)||"")+
  link("Official game box score",boxUrl(g))+'</section>':
 gameTab==="plays"?'<section class="sdsx-section"><div class="sdsx-section-head"><h3>PLAY-BY-PLAY</h3></div>'+
  (lastPlay?'<p class="sdsx-play-call">'+esc(lastPlay)+'</p>':
   empty("Detailed plays unavailable","For full scoring plays and player updates, open the original game summary."))+
  link("Open official game plays",eventUrl(g))+'</section>':
 '<section class="sdsx-section"><div class="sdsx-section-head"><h3>LEAGUE DISCUSSION</h3></div>'+
  '<p>Chat with your league about this game. Existing league conversations remain private.</p>'+
  '<button type="button" class="sdsx-gold-button" data-sdsx-view="league">Go to my league →</button></section>')+
 '</div>';
}
function leagueRows(){
 const selected=window.SEC_LEAGUE_SETTINGS?.getSelected?.();
 let rows=[],title="Your league",kind="football";
 if(selected?.kind==="club"){
  rows=window.SEC_LEAGUE_SETTINGS?.getStandings?.()||[];
  title=selected.name||title;kind="club";
 }else{
  const l=window.secOnline?.getLeague?.();
  if(l&&(!selected||selected.id===l.id)){
   rows=window.secOnline?.getStandings?.()||[];title=selected?.name||l.name||title;
  }
 }
 const metric=r=>Number(kind==="club"?r.total:r.season_points)||0;
 return {rows:identity()&&user()?rows.filter(r=>r?.user_id).slice().sort((a,b)=>metric(b)-metric(a)):[],title,metric};
}
function resultDetails(weekNum){
 const wk=app()?.weeks?.find(w=>w.num===weekNum)||app()?.week?.();
 const list=wk?.games||[];
 const picks=app()?.state?.()?.picks||{};
 const finals=list.map(g=>({g,data:window.SEC_FEATURES?.finalData?.(g)})).filter(x=>x.data);
 const graded=finals.filter(x=>x.data.pick!==null&&x.data.pick!==undefined);
 const outcome=window.SEC_FINAL_CARDS?.outcome;
 const wins=graded.filter(x=>outcome?.(x.data)?.kind==="won").length;
 const losses=graded.filter(x=>outcome?.(x.data)?.kind==="lost").length;
 const pending=finals.filter(x=>outcome?.(x.data)?.kind==="pending").length;
 const points=graded.reduce((sum,x)=>sum+(typeof x.data.points==="number"&&Number.isFinite(x.data.points)?x.data.points:0),0);
 const chosen=list.filter(g=>picks[g.id]===g.away||picks[g.id]===g.home).length;
 return {wk,finals,graded,wins,losses,pending,points,chosen,total:list.length,all:list};
}
function results(){
 const root=document.getElementById("sdsx-results-root");if(!root)return;
 if(!selectedWeek)selectedWeek=app()?.week?.()?.num;
 const info=resultDetails(selectedWeek);
 const league=leagueRows(),me=league.rows.findIndex(r=>r.user_id===user()?.id);
 const leader=league.rows.length?league.metric(league.rows[0]):0;
 const mine=me>=0?league.metric(league.rows[me]):null;
 const remaining=info.total-info.finals.length;
 root.innerHTML='<div class="sdsx-results-hero"><div class="sdsx-results-title">'+
  '<span class="sdsx-eyebrow">MY PICKS · WEEK '+esc(info.wk?.num||"—")+'</span>'+
  '<h2>'+info.wins+' <small>correct picks</small></h2>'+
  '<div class="sdsx-progress-track" role="progressbar" aria-label="Finalized football games" aria-valuemin="0" aria-valuemax="'+info.total+
  '" aria-valuenow="'+info.finals.length+'"><span style="width:'+ (info.total?Math.round(info.finals.length/info.total*100):0)+'%"></span></div>'+
  '<div class="sdsx-hero-stat-grid"><div><strong>'+info.wins+'</strong><small>Correct finals</small></div>'+
  '<div><strong>'+info.losses+'</strong><small>Incorrect finals</small></div>'+
  '<div><strong>'+remaining+'</strong><small>Unconfirmed games</small></div>'+
  '<div><strong>'+info.points.toLocaleString("en-US",{maximumFractionDigits:1})+'</strong><small>Earned points</small></div></div>'+
  '</div><div class="sdsx-results-cup" aria-hidden="true">🏆</div></div>'+
  '<section class="sdsx-section"><div class="sdsx-section-head"><h3>YOUR LEAGUE RACE</h3>'+
  '<button type="button" data-sdsx-view="league">Full standings ›</button></div>'+
  (me<0?empty("League rank unavailable","Sign in and join a league to see your position."):
  '<div class="sdsx-results-rank"><strong>#'+(me+1)+'</strong><div><span>'+esc(league.title)+'</span>'+
  '<p>'+mine+' verified season points · '+Math.max(0,leader-mine)+' behind first</p></div></div>')+
  (league.rows.length?'<div class="sdsx-leaderboard">'+league.rows.slice(0,5).map((r,i)=>
  '<div class="'+(r.user_id===user()?.id?"mine":"")+'"><span>'+ (i+1) +'</span>'+
  '<strong>'+esc(String(r.display_name||"Player").slice(0,38))+'</strong><span>'+league.metric(r)+'</span></div>').join("")+'</div>':"")+'</section>'+
  '<div class="sdsx-results-filters"><label for="sdsx-week">REVIEW WEEK</label><select id="sdsx-week" aria-label="Choose week for pick results">'+
  (app()?.weeks||[]).map(w=>'<option value="'+w.num+'"'+(w.num===info.wk?.num?" selected":"")+'>Week '+w.num+'</option>').join("")+
  '</select><span>'+info.chosen+'/'+info.total+' picks selected</span></div>'+
  '<section class="sdsx-section"><div class="sdsx-section-head"><h3>WEEK '+esc(info.wk?.num||"—")+' RESULTS</h3>'+
  '<span>✓ correct &nbsp; ✕ incorrect</span></div>'+
  (info.all.length?'<div class="sdsx-results-list">'+info.all.map(g=>{
  const d=window.SEC_FEATURES?.finalData?.(g);
  const kind=d?window.SEC_FINAL_CARDS?.outcome?.(d)?.kind||"pending":"pending";
  const chosen=app()?.state?.()?.picks?.[g.id];
  const signed=kind==="won"?"won":kind==="lost"?"lost":kind==="push"?"push":"pending";
  const desc=!d?"Awaiting verified final":kind==="won"?"CORRECT":kind==="lost"?"INCORRECT":
   kind==="push"?"SPREAD PUSH":kind==="none"?"NO PICK":"PENDING";
  const score=d?d.awayScore+" – "+d.homeScore:"— : —";
  const earned=d&&typeof d.points==="number"?("+"+d.points.toLocaleString("en-US",{maximumFractionDigits:1})+" pts"):"";
  return '<button class="sdsx-result-row" data-sdsx-game="'+esc(g.id)+'" type="button">'+
    '<span class="sdsx-result-game"><small>'+ (d?"FINAL":esc(status(g).toUpperCase())) +'</small>'+
    '<strong>'+esc(teamName(g.away))+' '+esc(score)+' '+esc(teamName(g.home))+'</strong>'+
    '<small>Your pick: '+esc(chosen?teamName(chosen):"None")+'</small></span>'+
    '<span class="sdsx-result-status '+signed+'"><b>'+(signed==="won"?"✓":signed==="lost"?"✕":"·")+
    '</b>'+desc+(earned?'<small>'+esc(earned)+'</small>':"")+'</span></button>';
 }).join("")+'</div>':empty("No games for this week","Choose another week to review football picks."))+'</section>'+
  '<button type="button" class="sdsx-gold-button sdsx-full" data-sdsx-view="league">View full standings →</button>';
}
function movers(code){
 const poll=window.SEC_RANKINGS?.getPoll?.("football");
 if(!poll||!window.SEC_RANKINGS?.hasCurrent?.("football"))return empty("Ranking changes unavailable",
  "Movement appears only when the latest AP poll includes a verified previous position.");
 const movers=Object.entries(poll.teams||[]).filter(([c,d])=>verifiedId(c)&&
  Number.isInteger(d.rank)&&Number.isInteger(d.previous)).
 sort((a,b)=>(a[0]===code?-1:0)-(b[0]===code?-1:0)||
  Math.abs(b[1].previous-b[1].rank)-Math.abs(a[1].previous-a[1].rank)).slice(0,8);
 return movers.length?'<div class="sdsx-mover-strip">'+movers.map(([c,d])=>{
  const change=d.previous-d.rank;
  return '<div class="sdsx-mover'+(c===code?" favorite":"")+'">'+logo(c)+
  '<strong>#'+d.rank+'</strong><span class="'+(change>0?"up":change<0?"down":"flat")+'">'+
  (change>0?"↑ +"+change:change<0?"↓ "+change:"– 0")+'</span><small>'+esc(teamName(c))+'</small></div>';
 }).join("")+'</div><p class="sdsx-source-note">'+
 esc(window.SEC_RANKINGS?.note?.("football")||"AP Top 25")+' · movement calculated from published current and previous positions.</p>':
 empty("Ranking movers unavailable","This poll doesn't include previous rankings for SEC universities.");
}
function teamNews(){
 const root=document.getElementById("sdsx-news-root");if(!root)return;
 const code=selectTeam(pickedTeam);
 const storiesList=code?storiesFor(code,12):latestStories(12);
 root.innerHTML=(code?header(code,"Never miss your school's biggest moments.","TEAM NEWS"):
  meta("TEAM NEWS","Around the SEC","Publisher-linked headlines and verified ranking changes."))+
 '<section class="sdsx-section"><div class="sdsx-section-head"><h3>IN-APP ALERTS</h3>'+
 '<button type="button" data-sdsx-view="settings">Manage preferences ›</button></div>'+
 '<p>Game-day reminders are available through the app’s existing opt-in alert settings. '+
 'Push notifications on a locked phone are not yet enabled.</p>'+
 '<div class="sdsx-alert-tiles">'+[
  ["🏈","Kickoff alerts"],["✓","Final scores"],["▥","Ranking changes"],["▤","Team news"]
 ].map(([i,title])=>'<div><span>'+i+'</span><strong>'+title+'</strong><small>Set up in Settings</small></div>').join("")+'</div></section>'+
 '<section class="sdsx-section"><div class="sdsx-section-head"><h3>AP RANKING MOVERS</h3>'+
 '<button type="button" data-sdsx-view="teams">Full rankings ›</button></div>'+movers(code)+'</section>'+
 '<section class="sdsx-section"><div class="sdsx-section-head"><h3>LATEST VERIFIED HEADLINES</h3>'+
 '<button type="button" data-sdsx-view="news">All SEC News ›</button></div>'+stories(storiesList)+'</section>';
}
function mount(v){
 if(!["team-hub","game-center","results","team-news"].includes(v))return;
 if(v==="team-hub")teamHub();
 if(v==="game-center")gameCenter();
 if(v==="results")results();
 if(v==="team-news")teamNews();
 if(!timer){
  timer=setInterval(()=>{const v=app()?.view?.();if(["team-hub","game-center","results","team-news"].includes(v)&&
   document.visibilityState==="visible"){
   // Don't interrupt keyboard focus or a user reading a different Game Center tab.
   if(document.activeElement?.matches?.("input,textarea,select"))return;
   mount(v);
  }},45000);
 }
 if(v==="game-center")void window.SEC_LIVE_SCORES?.refresh?.();
 if(v==="team-hub"||v==="team-news"){
  void window.SEC_TEAM_RECORDS?.refresh?.();
  void window.SEC_RANKINGS?.refresh?.();
  void window.SEC_NEWS?.reload?.();
 }
 if(v==="results")void window.SEC_LEAGUE_SETTINGS?.load?.();
}
document.addEventListener("click",ev=>{
 const g=ev.target.closest?.("[data-sdsx-game]");
 if(g){const id=g.dataset.sdsxGame;if(id)openGame(id);return;}
 const route=ev.target.closest?.("[data-sdsx-view]");
 if(route){const name=route.dataset.sdsxView;
  if(["team-hub","game-center","results","team-news"].includes(name))app()?.setView?.(name);
  else if(["home","teams","news","settings","picks","league","basketball","baseball"].includes(name))
   app()?.setView?.(name);
  return;
 }
 const tab=ev.target.closest?.("[data-sdsx-tab]");
 if(tab&&["game","stats","plays","discussion"].includes(tab.dataset.sdsxTab)){
  gameTab=tab.dataset.sdsxTab;if(app()?.view?.()==="game-center")gameCenter();
 }
});
document.addEventListener("change",ev=>{
 if(ev.target?.id==="sdsx-week"){
  const num=Number(ev.target.value);
  if(Number.isInteger(num)&&app()?.weeks?.some(w=>w.num===num)){
   selectedWeek=num;if(app()?.view?.()==="results")results();
  }
 }
});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){
 const v=app()?.view?.();if(["team-hub","game-center","results","team-news"].includes(v))mount(v);
}});
window.SEC_PREMIUM=Object.freeze({mount,openTeam,openGame,openResults,teamHub,gameCenter,teamNews,results,
 resultDetails,movers,storiesFor,chooseGame});
})();
