/* Saturdays Down South — separate basketball/baseball Pick'em.
 * Legacy football storage, RPCs, and season are deliberately untouched.
 */
(()=>{
"use strict";
const SPORT={
 basketball:{name:"Men's Basketball",short:"Basketball",emoji:"🏀",startMonth:11,seasonStartYearOffset:-1,
  tagline:"Every possession. Every pick.",units:"points",maxTotal:300},
 baseball:{name:"Baseball",short:"Baseball",emoji:"⚾",startMonth:2,seasonStartYearOffset:0,
  tagline:"Nine innings. One winner.",units:"runs",maxTotal:80}
};
const MODES={straight:"Straight Picks",confidence:"Confidence",spread:"Against the Spread",h2h:"Head to Head"};
let feed={sports:{}},feedUpdated=null,feedIssue="",lastFeed=0,baseballSeries=null,seriesLoading=false;
const cache={basketball:{},baseball:{}};
const loading={basketball:false,baseball:false};
const selectedWeeks={basketball:0,baseball:0};
const notices={basketball:"",baseball:""};
const updating={basketball:0,baseball:0};
let refreshTimer=0;
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const client=()=>window.secOnline?.getClient?.()||null;
const user=()=>window.secOnline?.getUser?.()||null;
const unwrap=result=>{if(result.error)throw result.error;return result.data;};
const currentSeason=(sport,now=new Date())=>{
 const yr=now.getUTCFullYear();
 return now.getUTCMonth()>=7?yr+1:yr;
};
const seasons=(now=new Date())=>{
 const year=now.getUTCFullYear();
 return [
  {sport:"football",since:new Date(Date.UTC(now.getUTCMonth()>=7?year:year-1,7,1))},
  {sport:"basketball",since:new Date(Date.UTC(now.getUTCMonth()>=10?year:year-1,10,1))},
  {sport:"baseball",since:new Date(Date.UTC(now.getUTCMonth()>=1?year:year-1,1,1))}
 ];
};
function recommended(now=new Date()){
 return seasons(now).sort((a,b)=>b.since-a.since)[0].sport;
}
function year(sport){return currentSeason(sport);}
function nameOf(sport){return sport==="football"?"Football":SPORT[sport].name;}
function target(sport){return sport==="football"?"picks":sport;}
function prettyTime(input){
 const d=new Date(input);
 if(!Number.isFinite(d.getTime()))return "Time pending";
 return d.toLocaleString("en-US",{timeZone:"America/Chicago",month:"short",day:"numeric",
  hour:"numeric",minute:"2-digit",timeZoneName:"short"});
}
function timeLabel(iso){
 const ms=new Date(iso).getTime();
 if(!Number.isFinite(ms))return "Time unknown";
 if(ms<=Date.now())return "Locked";
 const mins=Math.ceil((ms-Date.now())/60000);
 if(mins<60)return "Locks in "+mins+"m";
 if(mins<1440)return "Locks in "+Math.floor(mins/60)+"h";
 return "Locks "+prettyTime(iso);
}
const byId=id=>document.getElementById(id);
const banner=(text,cls="sport-note")=>'<div class="'+cls+'" role="status">'+esc(text)+'</div>';
function renderHub(){
 const root=byId("sports-hub");if(!root)return;
 const active=recommended();
 const choices=["football","basketball","baseball"].sort((a,b)=>{const newest=seasons();return newest.find(x=>x.sport===b).since-newest.find(x=>x.sport===a).since;});
 const info={
 football:{emoji:"🏈",title:"Football",period:"Fall · Aug–Dec",detail:"The original SEC Pick'em. Leagues, chat, rivalry trophies and four modes."},
 basketball:{emoji:"🏀",title:"Basketball",period:"Winter · Nov–Apr",detail:"SEC men's basketball. Weekly winner picks and private leagues."},
 baseball:{emoji:"⚾",title:"Baseball",period:"Spring · Feb–Jun",detail:"SEC college baseball. Pick series games and track weekly results."}
 };
 root.innerHTML='<div class="sport-hub-intro"><div class="card-kicker">ONE CLUB · THREE SPORTS</div>'+
   '<h2>Choose your <span>game.</span></h2><p>One account. Three separate seasons of picks and competition.</p>'+
   '<div class="sport-auto-current">✦ Most recently started season: <strong>'+esc(nameOf(active))+'</strong></div></div>'+
   '<div class="sport-hub-grid">'+choices.map(s=>{
    const b=info[s];
    const count=Math.max(feed.sports?.[s]?.games?.length||0,cache[s]?.games?.filter?.(g=>g.sport===s&&g.season===year(s))?.length||0);
    return '<button type="button" class="sport-selection '+(s===active?"is-current":"")+'" data-go-sport="'+s+'">'+
     '<div class="sport-selection-top"><span class="sport-large-icon">'+b.emoji+'</span>'+
     (s===active?'<span class="sport-current-badge">LATEST SEASON</span>':'')+'</div>'+
     '<h3>'+b.title+'</h3><p class="sport-season-pill">'+b.period+'</p>'+
     '<p>'+b.detail+'</p>'+
     '<div class="sport-selection-footer">'+(s==="football"?"2026 season":String(year(s))+" season")+
     (typeof count==="number"&&s!=="football"?" · "+count+" verified games":"")+
     ' <span>Open picks →</span></div></button>';
   }).join("")+'</div>'+
   '<p class="sport-hub-footnote">Schedules come from verified sources. Seasons are chosen automatically by calendar date; switch sports anytime. '+
   'Football picks and leagues stay separate from the other sports.</p>';
}
async function fetchFeed(force=false){
 if(!force&&Date.now()-lastFeed<5*60000)return feed;
 try{
  const res=await fetch("./sports-schedules.json?refresh=1",{cache:"no-store"});
  if(!res.ok)throw Error("The sports schedule feed is temporarily unavailable");
  const data=await res.json();
  if(!data||typeof data.sports!=="object")throw Error("Unexpected sports schedule data");
  feed=data;feedUpdated=data.updated_at||null;feedIssue="";lastFeed=Date.now();
 }catch(e){feedIssue=e.message||"Schedule updates temporarily unavailable";}
 renderHub();return feed;
}
async function getBaseballSeries(){
 if(baseballSeries||seriesLoading)return;
 seriesLoading=true;
 try{
  const res=await fetch("./baseball-2027-series.json",{cache:"no-store"});
  if(!res.ok)throw Error("Conference series preview unavailable");
  const data=await res.json();
  if(data.season===2027&&Array.isArray(data.series)){
   baseballSeries=data;
  }
 }catch(error){console.warn("Baseball series schedule:",error.message);}
 finally{seriesLoading=false;if(window.SEC_BRIDGE?.view?.()==="baseball")renderSport("baseball");}
}
function renderSeries(s){
 if(s!=="baseball"||!baseballSeries||baseballSeries.season!==year("baseball"))return "";
 const all=baseballSeries.series;
 const weekends=[...new Set(all.map(x=>x.weekend))];
 const today=Date.now();
 const next=weekends.find(w=>all.some(x=>x.weekend===w&&Date.parse(x.end_date+"T23:59:59Z")>=today))||weekends.at(-1);
 const chosen=cache.baseball.seriesWeek||next;
 const group=all.filter(x=>x.weekend===chosen);
 return '<section class="sport-series-preview" aria-label="Official SEC baseball series schedule">'+
  '<div class="card-kicker">⚾ SEC BASEBALL · OFFICIAL 2027 SERIES</div>'+
  '<h3>Conference series preview <span>80 verified pairings</span></h3>'+
  '<p>Ten SEC weekends, eight series each. The SEC has released the opponents and weekend windows, but not every individual first pitch. '+
  'These series previews are <strong>not pickable games</strong>. Winner picks unlock when individual games have verified start dates.</p>'+
  '<div class="sport-week-list" role="group" aria-label="Baseball conference weekends">'+
  weekends.map(n=>'<button type="button" class="sport-week-button '+(chosen===n?"active":"")+
   '" data-series-week="'+n+'" aria-pressed="'+(chosen===n)+'">Series '+n+'</button>').join("")+'</div>'+
  '<div class="sport-series-grid">'+group.map(x=>'<article class="sport-series-card">'+
   '<strong>'+esc(x.away)+' <span>at</span> '+esc(x.home)+'</strong>'+
   '<small>SEC Weekend '+x.weekend+' · '+esc(x.start_date)+'–'+esc(x.end_date)+'</small>'+
   '<div class="sport-series-pending">Game dates &amp; first-pitch times pending</div></article>').join("")+'</div>'+
  '<p class="sport-series-source">Source: <a href="'+esc(baseballSeries.source_url)+
   '" target="_blank" rel="noopener noreferrer">SEC 2027 conference schedule ↗</a>. '+
  'Games may be rescheduled for TV, weather, travel or doubleheaders.</p></section>';
}
const allGames=(s)=>{
 const publicList=Array.isArray(feed.sports?.[s]?.games)?feed.sports[s].games:[];
 const dbList=(Array.isArray(cache[s].games)?cache[s].games:[]).filter(g=>g.sport===s&&g.season===year(s));
 const merged=new Map(publicList.filter(g=>g.season===year(s)).map(g=>[g.id,{...g,imported:false}]));
 dbList.forEach(g=>merged.set(g.id,{...merged.get(g.id),...g,imported:true}));
 return [...merged.values()].sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at));
};
const groups=s=>{
 const map=new Map();
 for(const game of allGames(s)){
  if(!map.has(game.week))map.set(game.week,[]);
  map.get(game.week).push(game);
 }
 return [...map.entries()].sort((a,b)=>a[0]-b[0]).map(([num,games])=>({num,games}));
};
const curWeek=s=>{
 const sets=groups(s);
 if(!sets.length)return null;
 const chosen=selectedWeeks[s];
 if(sets.some(w=>w.num===chosen))return sets.find(w=>w.num===chosen);
 const open=sets.find(w=>w.games.some(g=>g.game_status==="scheduled"&&new Date(g.kickoff_at).getTime()>Date.now()));
 selectedWeeks[s]=(open||sets.at(-1)).num;
 return open||sets.at(-1);
};
const ownLeague=s=>(cache[s].leagues||[]).find(l=>l.id===cache[s].active)||null;
function modeDesc(mode){
 return {straight:"One point for every correctly picked winner.",
 confidence:"Rank your confidence 1–N each week. Correct picks earn the assigned points.",
 spread:"Pick the team to cover the published spread. No line means the matchup cannot be selected.",
 h2h:"Compete against another member's weekly picks; pairings and scores update with finalized results."}[mode]||"";
}
function renderSport(s){
 const root=byId("sport-"+s+"-content");if(!root)return;
 const conf=SPORT[s],active=ownLeague(s),w=curWeek(s),weeks=groups(s);
 const person=user(),signed=Boolean(person&&client()),data=cache[s]||{};
 const picks=data.picks||{},saved=data.tiebreakers||{};
 const header='<div class="sport-heading"><div class="sport-heading-icon">'+conf.emoji+'</div>'+
  '<div><div class="card-kicker">SEC '+conf.name.toUpperCase()+' · '+year(s)+'</div>'+
  '<h2>'+esc(conf.tagline)+'</h2><p>Pick each winner. Score points together. Win your league.</p></div>'+
  '</div>';
 const note=feed.sports?.[s]?.warning&&allGames(s).length===0?
   banner(feed.sports[s].warning,"sport-warning"):"";
 const status=feedIssue?banner(feedIssue,"sport-warning"):"";
 const stale=data.error?banner(data.error,"sport-warning"):"";
 const loadingText=loading[s]?banner("Checking verified games and league results…"):"";
 const leagues=renderLeagues(s,signed,active);
 let games="";
 if(!weeks.length){
  games='<div class="sport-empty"><span>'+conf.emoji+'</span><h3>Waiting for the official schedule</h3>'+
   '<p>The '+year(s)+' '+conf.name.toLowerCase()+' schedule will appear as verified fixtures become available. '+
   'No kickoff times or winners will be made up.</p>'+
   '<button type="button" class="ghost-btn" data-sport-action="refresh" data-sport="'+s+'">Check for matchups</button></div>';
 }else{
  games='<div class="sport-week-list" role="group" aria-label="Choose a game week">'+weeks.map(group=>
   '<button type="button" data-sport-week="'+group.num+'" data-sport="'+s+'" class="sport-week-button '+(group.num===w?.num?"active":"")+
   '" aria-pressed="'+(group.num===w?.num)+'">Week '+group.num+'<small>'+group.games.length+' games</small></button>').join("")+'</div>'+
   '<div class="sport-slate-heading"><div><div class="card-kicker">THE SLATE</div><h3>Week '+w.num+' matchups <span>('+w.games.length+')</span></h3></div>'+
   '<div class="sport-mode-label">'+esc(active?MODES[active.mode]:"Straight Picks")+'</div></div>'+
   '<div class="sport-games-grid">'+w.games.map(g=>gameCard(s,g,active,picks)).join("")+'</div>'+
   renderTiebreak(s,w,active,saved);
 }
 root.innerHTML=header+note+status+stale+loadingText+leagues+games+renderSeries(s)+
  '<p class="sport-data-note">Official SEC and university schedules, with ESPN updates where available · Central time. '+ 
  'When a tipoff is not announced, a conservative 10 AM Central provisional lock is shown. '+
  'Basketball and baseball leagues have their own memberships and standings, separate from football.</p>';
}
function renderLeagues(s,signed,league){
 const data=cache[s],season=year(s);
 const available=data.leagues||[];
 const options=available.map(l=>'<option value="'+esc(l.id)+'" '+(l.id===data.active?'selected':'')+'>'+
  esc(l.name)+' · '+esc(MODES[l.mode])+'</option>').join("");
 const notice=notices[s]?banner(notices[s],"sport-notice"):"";
 if(!signed){
  return '<div class="sport-league-shell"><div class="sport-league-top"><div><div class="card-kicker">ONLINE PICK’EM</div>'+
   '<h3>Compete with your crew.</h3><p>Use your existing Saturdays Down South account to join a private '+esc(SPORT[s].short)+' league.</p></div>'+
   '<button type="button" data-nav="league" class="primary-btn">Sign in / Create account</button></div></div>'+notice;
 }
 const dropdown=available.length?'<div class="sport-active-choice"><label class="input-label" for="sport-league-'+s+'">Playing in</label>'+
  '<select class="field" id="sport-league-'+s+'" data-change-sport="'+s+'">'+options+'</select></div>':"";
 const tools='<div class="sport-league-tools"><details><summary>Create a '+esc(SPORT[s].short)+' league</summary>'+
  '<label class="input-label" for="sport-name-'+s+'">League name</label>'+
  '<input id="sport-name-'+s+'" class="field" maxlength="70" placeholder="My '+esc(SPORT[s].short)+' crew">'+
  '<label class="input-label" for="sport-mode-'+s+'">How should picks be scored?</label>'+
  '<select class="field" id="sport-mode-'+s+'">'+Object.entries(MODES).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join("")+'</select>'+
  '<p class="helper">Each sport league has its own invite link, leaderboard and picks.</p>'+
  '<button type="button" class="primary-btn" data-sport-action="create" data-sport="'+s+'">Create league</button></details>'+
  '<details><summary>Join with invite code</summary><label class="input-label" for="sport-invite-'+s+'">Invite code</label>'+
  '<input class="field" id="sport-invite-'+s+'" maxlength="10" placeholder="10-character code">'+
  '<button type="button" class="ghost-btn" data-sport-action="join" data-sport="'+s+'">Join league</button></details></div>';
 const leagueMeta=league?'<div class="sport-current-league"><div class="card-kicker">'+esc(MODES[league.mode])+' · '+season+'</div>'+
  '<strong>'+esc(league.name)+'</strong><p>'+esc(modeDesc(league.mode))+'</p>'+
  '<div class="sport-league-actions"><button class="ghost-btn" type="button" data-sport-action="share" data-sport="'+s+'">Share invite</button>'+
  '<button class="ghost-btn" type="button" data-sport-action="refresh" data-sport="'+s+'">Refresh standings</button></div></div>':"";
 const standings=league?renderStandings(s,league):'<p class="helper">Create or join a league to start saving your picks online.</p>';
 return '<section class="sport-league-shell" aria-label="Online sports leagues">'+
  '<div class="sport-league-top"><div><div class="card-kicker">YOUR '+esc(SPORT[s].short.toUpperCase())+' LEAGUE</div>'+
  '<h3>Make your picks count.</h3><p>Separate leagues for separate sports, all under your account.</p></div>'+
  (league?'<span class="sport-league-code">Invite: '+esc(league.invite_code)+'</span>':'')+'</div>'+
  dropdown+leagueMeta+standings+tools+'</section>'+notice;
}
function renderStandings(s,league){
 const rows=cache[s].standings||[];
 const head='<div class="sport-scoreboard-title"><h4>League standings</h4><span>Confirmed finals only</span></div>';
 if(!rows.length)return head+'<p class="helper">No verified standings yet.</p>';
 const table='<div class="sport-score-scroll"><table class="sport-standings"><thead><tr>'+
  '<th>Rank</th><th>Player</th><th>Picks</th><th>Week</th><th>Season</th></tr></thead><tbody>'+
  rows.map((r,i)=>'<tr><td>'+String(i+1)+'</td><td>'+esc(r.display_name||"Player")+
   (r.user_id===user()?.id?' ★':'')+'</td><td>'+Number(r.picked||0)+'</td>'+
   '<td>'+Number(r.week_points||0)+'</td><td>'+Number(r.season_points||0)+'</td></tr>').join("")+
  '</tbody></table></div>';
 let extra="";
 if(league.mode==="h2h"){
  const pairs=cache[s].pairings||[];
  extra='<div class="sport-h2h-matches"><strong>Head-to-head this week</strong>'+
   (pairs.length?pairs.map(p=>'<div class="sport-h2h-pair">'+esc(p.a_name)+' '+Number(p.a_points||0)+
    ' vs '+(p.b_name?esc(p.b_name)+' '+Number(p.b_points||0):'BYE')+
    ' <span>'+esc(p.status)+'</span></div>').join(""):'<p class="helper">Matchups appear when players join.</p>')+'</div>';
 }
 return head+table+extra;
}
function gameCard(s,g,league,picks){
 const mode=league?.mode||"straight",old=picks[g.id];
 const start=new Date(g.kickoff_at).getTime();
 const locked=!(Number.isFinite(start)&&start>Date.now()&&g.game_status==="scheduled");
 const canPick=Boolean(league&&user()&&g.imported&&!locked&&(mode!=="spread"||g.spread_home!==null&&g.spread_home!==undefined));
 const result=g.game_status==="final"?(g.winner_code?"FINAL · "+(g.winner_code===g.home_code?g.home_name:g.away_name)+" wins":"FINAL") :
  g.game_status==="live"?"LIVE":g.game_status==="canceled"?"CANCELED":timeLabel(g.kickoff_at);
 const verdict=old&&g.game_status==="final"?(g.winner_code===old.pick_code?'✓ Correct pick':'✕ Incorrect pick'):"";
 const availability=!league?"Join a league to pick":!g.imported?"Syncing game to secure pick server":locked?"Picks locked":
  mode==="spread"&&(g.spread_home===null||g.spread_home===undefined)?"Waiting for a published spread":"Choose a winner";
 const opt=code=>'<button type="button" class="sport-team-option '+(old?.pick_code===code?'selected':'')+
  '" data-sport-action="pick" data-sport="'+s+'" data-game="'+esc(g.id)+'" data-pick="'+esc(code)+'" '+
  (!canPick?'disabled':'')+' aria-pressed="'+(old?.pick_code===code)+'">'+
  '<span class="sport-team-name">'+esc(code===g.away_code?g.away_name:g.home_name)+'</span>'+
  '<span class="sport-check">'+(old?.pick_code===code?"✓":"○")+'</span></button>';
 const num=curWeek(s)?.games.length||1;
 const used=new Set(Object.entries(picks).filter(([id,p])=>id!==g.id&&allGames(s).find(x=>x.id===id)?.week===g.week).map(([,p])=>p.confidence_points));
 const options=Array.from({length:num},(_,i)=>i+1).map(n=>
   '<option value="'+n+'" '+(n===old?.confidence_points?'selected':'')+' '+(used.has(n)?'disabled':'')+'>'+n+' point'+(n===1?'':'s')+'</option>').join("");
 return '<article class="sport-game-card"><div class="sport-game-top"><span>GAME · WEEK '+g.week+'</span>'+
  '<span class="'+(g.game_status==="live"?"sport-live":"")+'">'+esc(result)+'</span></div>'+
  '<p class="sport-kickoff">'+esc(String(g.source||"").includes("provisional")?
   "Tipoff TBA · provisional pick lock "+prettyTime(g.kickoff_at):
   prettyTime(g.kickoff_at))+
  (g.away_score!==null&&g.away_score!==undefined&&g.home_score!==null&&g.home_score!==undefined?
    ' · '+Number(g.away_score)+'–'+Number(g.home_score):'')+'</p>'+
  '<div class="sport-team-options">'+opt(g.away_code)+'<span class="sport-vs">VS</span>'+opt(g.home_code)+'</div>'+
  (mode==="confidence"&&canPick?'<div class="sport-confidence"><label>Confidence value</label>'+
    '<select data-confidence="'+esc(g.id)+'" aria-label="Confidence points for '+esc(g.away_name)+' vs '+esc(g.home_name)+'">'+
    '<option value="">Choose</option>'+options+'</select></div>':'')+
  (mode==="spread"&&g.spread_home!==null&&g.spread_home!==undefined?
   '<p class="sport-odds">Published home spread: '+Number(g.spread_home)+' · pick the team to cover</p>':'')+
  '<p class="sport-game-foot">'+esc(verdict||availability)+'</p>'+
  '<small class="sport-game-provider">Source: '+esc(g.source||"ESPN")+'</small></article>';
}
function renderTiebreak(s,w,league,saved){
 if(!w||!w.games.length)return "";
 const last=w.games.slice().sort((a,b)=>Date.parse(b.kickoff_at)-Date.parse(a.kickoff_at))[0];
 const past=Date.now()>=Date.parse(last.kickoff_at)||last.game_status!=="scheduled";
 const done=saved?.[w.num];
 const can=Boolean(league&&user()&&last.imported&&!past);
 return '<section class="sport-tiebreak"><div class="card-kicker">🎯 WEEK '+w.num+' TIEBREAKER</div>'+
  '<h3>Predict the combined '+esc(SPORT[s].units)+'.</h3>'+
  '<p>'+esc(last.away_name)+' vs '+esc(last.home_name)+
   ' · Last scheduled kickoff of this week. Closest total breaks a tie.</p>'+
  '<div class="sport-tie-form"><input class="field" id="sport-total-'+s+'" type="number" min="0" max="'+SPORT[s].maxTotal+
   '" value="'+esc(done?.predicted_total??"")+'" placeholder="Combined '+SPORT[s].units+'" '+(!can?'disabled':'')+'>'+
  '<button type="button" class="primary-btn" data-sport-action="total" data-sport="'+s+'" '+(!can?'disabled':'')+'>Save prediction</button></div>'+
  '<div class="helper">'+esc(done?"Saved: "+done.predicted_total+" total "+SPORT[s].units:past?"Prediction closed":"Submit before the last game starts")+'</div></section>';
}
function inform(s,msg){notices[s]=msg;renderSport(s);}
async function load(s,force=false){
 if(!SPORT[s]||loading[s])return;
 loading[s]=true;renderSport(s);
 const seq=++updating[s];
 try{
  await fetchFeed(force);
  const c=client(),u=user(),yr=year(s);
  if(!c||!u){
   let games=[];
   if(c){
    const list=await c.from("sec_sport_games").select("*").eq("sport",s).eq("season",yr).order("kickoff_at");
    if(!list.error)games=(list.data||[]).filter(g=>g.sport===s&&g.season===yr);
   }
   cache[s]={games,leagues:[],picks:{},standings:[],tiebreakers:{},pairings:[],active:null};
   return;
  }
  // Authenticated data only; schedule writes are performed by the server, never by browser-supplied games.
  if(force||Date.now()-(cache[s].lastServerSync||0)>16*60000){
   const sync=await c.functions.invoke("sec-sport-sync",{body:{sport:s}});
   if(sync.error)console.warn("Sport schedule sync:",sync.error.message);
   cache[s].lastServerSync=Date.now();
  }
  const [g,l]=await Promise.all([
   c.from("sec_sport_games").select("*").eq("sport",s).eq("season",yr).order("kickoff_at"),
   c.from("sec_sport_leagues").select("id,name,mode,invite_code,owner_id,sport,season").eq("sport",s).eq("season",yr).order("created_at")
  ]);
  const games=(unwrap(g)||[]).filter(x=>x.sport===s&&x.season===yr);
  const leagues=(unwrap(l)||[]).filter(x=>x.sport===s&&x.season===yr);
  let active=cache[s].active||localStorage.getItem("ss-sec-sport-league-"+s+"-"+yr);
  if(!leagues.some(item=>item.id===active))active=leagues[0]?.id||null;
  const invitation=new URLSearchParams(location.search);
  if(invitation.get("sport")===s&&invitation.get("sportLeague")&&invitation.get("sportLeague")?.length===10){
   const invite=invitation.get("sportLeague");
   try{
    const join=unwrap(await c.rpc("sec_sport_join_league",{p_code:invite}));
    active=join;localStorage.setItem("ss-sec-sport-league-"+s+"-"+yr,active);
    const again=unwrap(await c.from("sec_sport_leagues").select("id,name,mode,invite_code,owner_id,sport,season").eq("sport",s).eq("season",yr));
    leagues.splice(0,leagues.length,...(again||[]));
    const url=new URL(location.href);url.searchParams.delete("sport");url.searchParams.delete("sportLeague");
    history.replaceState(null,"",url.pathname+url.search+"#"+s);
   }catch(e){notices[s]="Invite error: "+e.message;}
  }
  let picks={},standings=[],tiebreakers={},pairings=[];
  if(active){
   const [p,st,t]=await Promise.all([
    c.from("sec_sport_picks").select("game_id,pick_code,confidence_points").eq("league_id",active).eq("user_id",u.id),
    c.rpc("sec_sport_standings",{p_league:active,p_week:curWeek(s)?.num||1}),
    c.from("sec_sport_tiebreakers").select("week,predicted_total,game_id").eq("league_id",active).eq("user_id",u.id)
   ]);
   picks=Object.fromEntries((unwrap(p)||[]).map(x=>[x.game_id,x]));
   standings=unwrap(st)||[];
   tiebreakers=Object.fromEntries((unwrap(t)||[]).map(x=>[x.week,x]));
   const target=leagues.find(x=>x.id===active);
   if(target?.mode==="h2h"){
    const h=await c.rpc("sec_sport_h2h_week",{p_league:active,p_week:curWeek(s)?.num||1});
    pairings=unwrap(h)||[];
   }
  }
  if(seq!==updating[s])return;
  const oldSync=cache[s].lastServerSync;
  cache[s]={games,leagues,picks,standings,tiebreakers,pairings,active,lastServerSync:oldSync,error:""};
  if(active)localStorage.setItem("ss-sec-sport-league-"+s+"-"+yr,active);
 }catch(e){cache[s].error=e.message||"This sport is temporarily unavailable";console.warn("SEC sports:",e);}
 finally{loading[s]=false;renderSport(s);renderHub();}
}
async function action(btn){
 const s=btn.dataset.sport;const what=btn.dataset.sportAction;
 if(!SPORT[s])return;
 const c=client(),me=user(),l=ownLeague(s);
 try{
  if(what==="refresh"){await load(s,true);return;}
  if(!c||!me)throw Error("Sign in under League first.");
  if(what==="create"){
   const n=byId("sport-name-"+s)?.value?.trim(),m=byId("sport-mode-"+s)?.value;
   if(!n||n.length<2)throw Error("Enter a league name.");
   const rows=unwrap(await c.rpc("sec_sport_create_league",{p_sport:s,p_season:year(s),p_name:n,p_mode:m}));
   cache[s].active=rows?.[0]?.league_id;
   notices[s]="League created! Share the invite code with friends.";
   await load(s,true);return;
  }
  if(what==="join"){
   const code=byId("sport-invite-"+s)?.value?.trim().toUpperCase();
   if(!code||code.length!==10)throw Error("Enter a 10-character league code.");
   cache[s].active=unwrap(await c.rpc("sec_sport_join_league",{p_code:code}));
   notices[s]="Welcome to your new league!";
   await load(s,true);return;
  }
  if(!l)throw Error("Create or join a "+SPORT[s].short+" league first.");
  if(what==="pick"){
   const g=allGames(s).find(game=>game.id===btn.dataset.game);
   if(!g||!g.imported)throw Error("This game hasn't been validated by the server yet. Refresh.");
   if(Date.now()>=Date.parse(g.kickoff_at))throw Error("This game is locked.");
   const conf=l.mode==="confidence"?Number(document.querySelector('[data-confidence="'+g.id+'"]')?.value):null;
   if(l.mode==="confidence"&&!conf)throw Error("Choose a unique weekly confidence value first.");
   unwrap(await c.rpc("sec_sport_save_pick",{p_league:l.id,p_game:g.id,p_pick:btn.dataset.pick,p_confidence:conf}));
   notices[s]="Pick saved securely online.";
   await load(s);return;
  }
  if(what==="total"){
   const week=curWeek(s);if(!week)throw Error("No games this week.");
   const last=week.games.slice().sort((a,b)=>Date.parse(b.kickoff_at)-Date.parse(a.kickoff_at))[0];
   const raw=byId("sport-total-"+s)?.value?.trim();
   if(!raw||!Number.isInteger(Number(raw)))throw Error("Enter a whole-number total.");
   unwrap(await c.rpc("sec_sport_save_tiebreaker",{p_league:l.id,p_game:last.id,p_total:Number(raw)}));
   notices[s]="Week "+week.num+" tiebreaker saved.";await load(s);return;
  }
  if(what==="share"){
   const url=new URL(location.href);
   url.searchParams.set("sport",s);url.searchParams.set("sportLeague",l.invite_code);url.hash=s;
   try{if(navigator.share){await navigator.share({title:"Join my SEC "+SPORT[s].short+" league",url:url.href});return;}}
   catch(e){if(e.name==="AbortError")return;}
   await navigator.clipboard.writeText(url.href);
   notices[s]="Invite link copied!";renderSport(s);return;
  }
 }catch(error){inform(s,error.message||"Something went wrong");}
}
document.addEventListener("click",ev=>{
 const to=ev.target.closest?.("[data-go-sport]");
 if(to){ev.preventDefault();window.SEC_BRIDGE?.setView(to.dataset.goSport==="football"?"picks":to.dataset.goSport);return;}
 const button=ev.target.closest?.("[data-sport-action]");
 if(button){ev.preventDefault();void action(button);return;}
 const series=ev.target.closest?.("[data-series-week]");
 if(series){cache.baseball.seriesWeek=Number(series.dataset.seriesWeek);renderSport("baseball");return;}
  const week=ev.target.closest?.("[data-sport-week]");
 if(week){selectedWeeks[week.dataset.sport]=Number(week.dataset.sportWeek);renderSport(week.dataset.sport);void load(week.dataset.sport); }
});
document.addEventListener("change",ev=>{
 const s=ev.target.dataset?.changeSport;
 if(!SPORT[s])return;
 cache[s].active=ev.target.value;
 localStorage.setItem("ss-sec-sport-league-"+s+"-"+year(s),ev.target.value);
 void load(s,true);
});
function mount(route){
 renderHub();
 if(!SPORT[route]){void fetchFeed();return;}
 renderSport(route);
 if(route==="baseball")void getBaseballSeries();
 void load(route);
}
setInterval(()=>{
 const active=window.SEC_BRIDGE?.view?.();
 if(SPORT[active]&&document.visibilityState==="visible"&&!document.activeElement?.matches?.("input,textarea,select"))void load(active,true);
},5*60000);
window.SEC_SPORTS=Object.freeze({mount,recommended,year,groups,renderHub,load,getState:s=>cache[s]});
if(["sports","basketball","baseball"].includes(window.SEC_BRIDGE?.view?.()))mount(window.SEC_BRIDGE.view());
})();
