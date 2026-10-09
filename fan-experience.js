/* SEC Fan Experience: data-backed enhancements. No imaginary scores or league points. */
(()=>{
"use strict";
const app=()=>window.SEC_BRIDGE,client=()=>window.secOnline?.getClient?.(),user=()=>window.secOnline?.getUser?.();
const esc=x=>String(x==null?"":x).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const val=x=>{if(x?.error)throw x.error;return x?.data;},get=id=>document.getElementById(id);
const date=x=>Number.isFinite(Date.parse(x))?new Date(x).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"TBD";
const sports=[["picks","🏈","Football"],["basketball","🏀","Basketball"],["baseball","⚾","Baseball"]];
let leagues=[],clubId=null,rows=[],problem="",lastClub=0,clubLoading=false,identity=null;
let gameRows={},revealed={},myPicks=[],gamesAt=0,gamesLoading=false;
let teamRows={football:[],basketball:[],baseball:[]},teamAt=0,teamLoading=false,teamSport="football";
const openDetails=new Set();
const safeNumber=n=>Number.isFinite(Number(n))?Number(n):0;
const store=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const key=k=>"sec-fan-"+k+"-"+(user()?.id||"guest");
const toast=s=>app()?.toast?.(s);
function resetAccount(){
 const id=user()?.id||"guest";if(id===identity)return;
 identity=id;leagues=[];clubId=null;rows=[];lastClub=0;gamesAt=0;teamAt=0;
 gameRows={};revealed={};myPicks=[];teamRows={football:[],basketball:[],baseball:[]};
}
function activeClub(){return leagues.find(x=>x.id===clubId)||null;}
async function loadClubs(force=false){
 resetAccount();
 if(!client()||!user()||clubLoading||(!force&&Date.now()-lastClub<45000))return;
 clubLoading=true;problem="";
 try{
  leagues=val(await client().from("sec_clubs").select("id,name,invite_code,football_league,basketball_league,baseball_league").order("created_at",{ascending:false}))||[];
  clubId=leagues.some(x=>x.id===clubId)?clubId:
    leagues.find(x=>x.id===localStorage.getItem(key("club")))?.id||leagues[0]?.id||null;
  rows=clubId?(val(await client().rpc("sec_club_standings",{p_club:clubId}))||[]):[];
  lastClub=Date.now();
 }catch(e){problem="Could not load three-sport league: "+(e.message||"try again");}
 finally{clubLoading=false;renderClub();}
}
function renderClub(){
 const host=get("fan-club-hub");if(!host)return;
 resetAccount();
 if(!client()||!user()){
  host.innerHTML='<section class="fan-panel"><div class="card-kicker">👑 ALL-SPORTS LEAGUE</div><h2>One league. Three sports.</h2>'+
   '<p>One player account and one invite. Log in below to create or join a combined football, basketball and baseball competition.</p></section>';return;
 }
 const c=activeClub();
 const scores=c?'<div class="fan-table-wrap"><table class="fan-table"><thead><tr><th>Player</th><th>🏈</th><th>🏀</th><th>⚾</th><th>Total</th></tr></thead><tbody>'+
  rows.map((r,i)=>'<tr><td>#'+(i+1)+' '+esc(r.display_name)+(r.user_id===user()?.id?' ★':'')+'</td>'+
  ["football","basketball","baseball","total"].map(s=>'<td>'+safeNumber(r[s])+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>':"";
 const opts=leagues.length>1?'<select id="fan-club-select" aria-label="Choose combined league">'+
  leagues.map(l=>'<option value="'+esc(l.id)+'" '+(l.id===clubId?'selected':'')+'>'+esc(l.name)+'</option>').join("")+'</select>':"";
 host.innerHTML='<section class="fan-panel"><div class="fan-title-row"><div><div class="card-kicker">👑 GRAND CHAMPION RACE</div><h2>'+
  esc(c?.name||"One league. Three sports.")+'</h2><p>Same friends across football, basketball and baseball. One point per confirmed correct winner.</p></div>'+
  '<button class="fan-small" data-fan="reload" type="button">↻ Refresh</button></div>'+
  (problem?'<p class="fan-warning" role="status">'+esc(problem)+'</p>':"")+
  (c?opts+'<p class="fan-subtle">Confirmed scores only · '+rows.length+' members</p>'+scores+
    '<div class="fan-sport-links">'+sports.map(([s,emoji,title])=>'<button class="fan-small" data-fan="sport" data-sport="'+s+'">'+emoji+' '+title+' picks ↗</button>').join("")+'</div>'+
    '<button class="fan-small" data-fan="share">Share one invite ↗</button> <small>Code: '+esc(c.invite_code)+'</small>':
    '<p class="fan-subtle">Create a league or join your friends. Existing single-sport leagues remain unchanged.</p>')+
  '<details class="fan-fold" '+(!c?"open":"")+'><summary>＋ Create or join an all-sports league</summary>'+
   '<div class="fan-form"><label>League name<input id="fan-name" placeholder="SEC Legends" maxlength="50"></label>'+
   '<button class="fan-small fan-primary" data-fan="create">Create league</button>'+
   '<label>Invite code<input id="fan-code" placeholder="10-character code" maxlength="10"></label>'+
   '<button class="fan-small" data-fan="join">Join league</button></div></details></section>';
}
async function changeClub(type,el){
 if(!client()||!user()){toast("Log in first");return;}
 const host=get("fan-club-hub"),field=id=>host?.querySelector("#"+id)?.value?.trim()||"";
 try{
  if(type==="create"){
   const name=field("fan-name");if(name.length<2||name.length>50)throw Error("League name must be 2–50 characters.");
   clubId=val(await client().rpc("sec_club_create",{p_name:name}));toast("All three sports added to your league.");
  }else if(type==="join"){
   const code=field("fan-code").toUpperCase();if(!/^[A-Z0-9]{10}$/.test(code))throw Error("Enter a valid 10-character code.");
   clubId=val(await client().rpc("sec_club_join",{p_code:code}));toast("Joined one league across three sports!");
  }else if(type==="select"){clubId=el.value;}
  else if(type==="sport"){
   const c=activeClub(),s=el.dataset.sport;if(!c)return;
   if(s==="picks")window.secOnline?.useLeague?.(c.football_league);
   else window.SEC_SPORTS?.selectLeague?.(s,c[s+"_league"]);
   app()?.setView?.(s);return;
  }else if(type==="share"){
   const c=activeClub();if(!c)return;
   const url=new URL(location.href);url.searchParams.set("club",c.invite_code);url.hash="league";
   try{if(navigator.share){await navigator.share({title:c.name,text:"Join our SEC all-sports league",url:url.href});return;}
    await navigator.clipboard.writeText(url.href);toast("All-sports invite copied!");}
   catch(e){if(e.name!=="AbortError")window.prompt("Copy invite:",url.href);}return;
  }else if(type!=="reload")return;
  store(key("club"),clubId||"");lastClub=0;await window.secOnline?.refresh?.();await loadClubs(true);
 }catch(e){problem=e.message||"League update failed";renderClub();}
}
async function inviteJoin(){
 const code=new URLSearchParams(location.search).get("club");
 if(!user()||!client()||!code||!/^[A-Za-z0-9]{10}$/.test(code))return;
 const k=key("invite-"+code);if(sessionStorage.getItem(k))return;
 try{
  clubId=val(await client().rpc("sec_club_join",{p_code:code}));
  sessionStorage.setItem(k,"yes");
  const url=new URL(location.href);url.searchParams.delete("club");
  history.replaceState(null,"",url.pathname+url.search+"#league");
  store(key("club"),clubId);lastClub=0;await loadClubs(true);toast("Joined all three sports.");
 }catch(e){problem="Invite error: "+e.message;renderClub();}
}
async function loadGames(force=false){
 if(!client()||!user()||gamesLoading||(!force&&Date.now()-gamesAt<120000))return;
 gamesLoading=true;
 try{
  const gs=val(await client().from("sec_games").select("id,week,away_code,home_code,kickoff_at,game_status,away_score,home_score,winner,score_updated_at"))||[];
  gameRows=Object.fromEntries(gs.map(g=>[g.id,g]));
  const league=window.secOnline?.getLeague?.();
  if(league){
   const p=val(await client().from("sec_league_picks").select("game_id,pick_code").eq("league_id",league.id).eq("user_id",user().id))||[];
   myPicks=p;
   const reveal=val(await client().rpc("sec_revealed_league_picks",{p_league:league.id,p_week:app()?.week?.()?.num||1}))||[];
   revealed={};for(const row of reveal)(revealed[row.game_id]||(revealed[row.game_id]=[])).push(row.pick_code);
  }else{myPicks=[];revealed={};}
  gamesAt=Date.now();
 }catch(e){console.info("SEC game status unavailable:",e.message);}
 finally{gamesLoading=false;if(app()?.view?.()==="picks"&&!document.activeElement?.matches?.("input,textarea,select"))app()?.renderPicks?.();}
}
const isScore=n=>Number.isInteger(n)&&n>=0;
function gameCenter(g,insights){
 const d=gameRows[g.id],status=d?.game_status||"scheduled";
 const scored=isScore(d?.away_score)&&isScore(d?.home_score);
 const text=scored?esc(g.away)+" "+d.away_score+" – "+d.home_score+" "+esc(g.home):"Score pending";
 const rows=(revealed[g.id]||[]).filter(x=>x===g.away||x===g.home),num=rows.filter(x=>x===g.away).length;
 const locked=Number.isFinite(Date.parse(d?.kickoff_at||g.kickoff))&&Date.parse(d?.kickoff_at||g.kickoff)<=Date.now();
 const trend=locked&&rows.length?'<p class="fan-subtle">League trends (revealed after lock): '+esc(g.away)+' '+Math.round(num/rows.length*100)+
  '% · '+esc(g.home)+' '+Math.round((rows.length-num)/rows.length*100)+'%</p>':"";
 return '<details class="fan-center" data-fan-center="'+esc(g.id)+'" '+(openDetails.has(g.id)?"open":"")+'>'+
  '<summary><b class="'+(status==="live"?"fan-live":"")+'">'+(status==="live"?"🔴 LIVE":status==="final"?"✓ FINAL":"Game center")+'</b>'+
  '<span>'+(scored?text:"Scores & matchup stats")+'</span><span>⌄</span></summary>'+
  '<div class="fan-center-detail"><p>'+text+'</p>'+trend+(insights||'<p class="fan-subtle">Matchup details pending.</p>')+
  '<small>Verified game feed, updated periodically while this tab is open. No simulated play-by-play.</small></div></details>';
}
function sportCenter(s,g){
 const scored=isScore(g.away_score)&&isScore(g.home_score),id=s+"-"+g.id;
 return '<details class="fan-center" data-fan-center="'+esc(id)+'" '+(openDetails.has(id)?"open":"")+'>'+
  '<summary><b class="'+(g.game_status==="live"?"fan-live":"")+'">'+(g.game_status==="live"?"🔴 LIVE":g.game_status==="final"?"✓ FINAL":"Game center")+'</b>'+
  '<span>'+(scored?g.away_score+" – "+g.home_score:"Score & source")+'</span><span>⌄</span></summary>'+
  '<div class="fan-center-detail">'+esc(g.away_name)+' vs '+esc(g.home_name)+'<p class="fan-subtle">'+
  (scored?"Confirmed score "+g.away_score+"–"+g.home_score:"Verified score pending")+' · '+esc(g.source||"Schedule feed")+'</p></div></details>';
}
function recap(){
 const w=app()?.week?.();if(!w)return "";
 const own=Object.fromEntries(myPicks.map(p=>[p.game_id,p.pick_code]));
 const finals=w.games.filter(g=>gameRows[g.id]?.game_status==="final"&&gameRows[g.id]?.winner);
 const graded=finals.filter(g=>own[g.id]),correct=graded.filter(g=>own[g.id]===gameRows[g.id]?.winner).length;
 const pending=w.games.filter(g=>!own[g.id]&&Date.parse(gameRows[g.id]?.kickoff_at||g.kickoff)>Date.now()).length;
 return '<details class="fan-fold fan-recap"><summary>📋 Weekly recap <span>'+correct+' correct · '+(graded.length-correct)+' missed</span></summary>'+
 '<div class="fan-metrics"><span><strong>'+myPicks.length+'</strong><small>Season picks saved</small></span>'+
 '<span><strong>'+(graded.length?Math.round(correct/graded.length*100)+"%":"—")+'</strong><small>Graded accuracy</small></span>'+
 '<span><strong>'+pending+'</strong><small>Unpicked this week</small></span></div>'+
 '<p class="fan-subtle">Results use only confirmed finals and your online league picks.</p></details>';
}
function enhanceRecap(){
 let e=get("fan-recap");if(!e){e=document.createElement("div");e.id="fan-recap";get("summary-slot")?.insertAdjacentElement("afterend",e);}
 if(e)e.innerHTML=recap();
}
function honors(){
 const me=rows.find(r=>r.user_id===user()?.id),awards=[];
 if(myPicks.length)awards.push("🏈 First football picks");
 if(safeNumber(me?.basketball_correct)>0)awards.push("🏀 Court Vision");
 if(safeNumber(me?.baseball_correct)>0)awards.push("⚾ Diamond Eye");
 const host=get("fan-achievements");if(!host)return;
 host.innerHTML='<section class="fan-panel"><div class="card-kicker">YOUR PLAYER HARDWARE</div><h3>Personal trophies</h3>'+
  (awards.length?'<div class="fan-awards">'+awards.map(a=>'<span>'+esc(a)+'</span>').join("")+'</div>':
   '<p class="fan-subtle">Earn achievements from confirmed picks. No trophies are invented before results.</p>')+
  '<p class="fan-subtle">Rivalry trophies remain in the collection above.</p></section>';
}
const ids={ALA:"333",ARK:"8",AUB:"2",FLA:"57",UGA:"61",UK:"96",LSU:"99",MISS:"145",MSST:"344",MIZ:"142",OU:"201",SC:"2579",TENN:"2633",TEX:"251",TAMU:"245",VAN:"238"};
async function loadTeamGames(){
 if(!client()||teamLoading||Date.now()-teamAt<180000)return;
 teamLoading=true;
 try{
  const [f,other]=await Promise.all([
   client().from("sec_games").select("id,away_code,home_code,game_status,kickoff_at,away_score,home_score"),
   client().from("sec_sport_games").select("id,sport,away_code,home_code,away_name,home_name,game_status,kickoff_at,away_score,home_score").limit(2000)
  ]);
  teamRows.football=val(f)||[];
  const all=val(other)||[];for(const s of ["basketball","baseball"])teamRows[s]=all.filter(x=>x.sport===s);
  teamAt=Date.now();
 }catch(e){console.info("Favorite team games unavailable:",e.message);}
 finally{teamLoading=false;enhanceTeam();}
}
function enhanceTeam(){
 const code=app()?.state?.()?.favorite,host=get("teams-content");
 if(!host||!ids[code])return;
 let target=get("fan-team-form");
 if(!target){target=document.createElement("section");target.id="fan-team-form";target.className="fan-panel";
  host.querySelector(".team-record-feature")?.insertAdjacentElement("afterend",target);}
 if(!target)return;
 const id=teamSport==="picks"?code:ids[code],games=(teamRows[teamSport==="picks"?"football":teamSport]||[])
 .filter(g=>String(g.away_code)===String(id)||String(g.home_code)===String(id));
 const past=games.filter(g=>g.game_status==="final").sort((a,b)=>Date.parse(b.kickoff_at)-Date.parse(a.kickoff_at)).slice(0,5);
 const next=games.filter(g=>g.game_status==="scheduled"&&Date.parse(g.kickoff_at)>=Date.now()).sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at)).slice(0,3);
 const line=g=>{
  const away=String(g.away_code)===String(id),opp=away?g.home_name||g.home_code:g.away_name||g.away_code;
  const scored=isScore(g.away_score)&&isScore(g.home_score);
  const my=away?g.away_score:g.home_score,their=away?g.home_score:g.away_score;
  const verdict=g.game_status==="final"&&scored?(my>their?"W":my<their?"L":"T"):"—";
  return '<li><strong class="fan-verdict">'+verdict+'</strong> '+esc(opp)+' <small>'+date(g.kickoff_at)+
    (g.game_status==="final"&&scored?" · "+my+"–"+their:"")+'</small></li>';
 };
 target.innerHTML='<div class="card-kicker">★ YOUR FAVORITE TEAM</div><h3>Recent form & next games</h3>'+
 '<div class="fan-sport-links">'+sports.map(([s,e,label])=>'<button type="button" data-fan="team-sport" data-sport="'+s+'" class="fan-small '+(s===teamSport?"is-current":"")+'">'+e+' '+label+'</button>').join("")+'</div>'+
 '<div class="fan-team-columns"><div><strong>Last five</strong><ol>'+(past.length?past.map(line).join(""):'<li>No verified finals yet.</li>')+
 '</ol></div><div><strong>Upcoming</strong><ol>'+(next.length?next.map(line).join(""):'<li>No verified upcoming fixtures yet.</li>')+
 '</ol></div></div>';
}
function extras(){
 const sec=get("fan-brackets");
 if(sec)sec.innerHTML='<details class="fan-fold"><summary>🏀⚾ SEC tournament brackets <span>Only official seeds</span></summary>'+
 '<p class="fan-subtle">Bracket picks activate after official SEC postseason matchups are published. No made-up seeds.</p>'+
 '<p><a href="https://www.secsports.com/sport/mens-basketball" target="_blank" rel="noopener noreferrer">Basketball tournament ↗</a> · '+
 '<a href="https://www.secsports.com/sport/baseball" target="_blank" rel="noopener noreferrer">Baseball tournament ↗</a></p></details>';
 const series=get("fan-series");
 if(series)series.innerHTML='<details class="fan-fold"><summary>⚾ Baseball series picks <span>Preview until first pitch confirmed</span></summary>'+
 '<p>The official 2027 series weekends are shown on Baseball Picks. Individual game start times must be verified before a competition pick can lock or score.</p>'+
 '<button type="button" class="fan-small" data-fan="go-baseball">See series matchups ↗</button></details>';
 const rivalry=get("fan-rivalries");
 if(rivalry)rivalry.innerHTML='<details class="fan-fold"><summary>⚔️ Rivalry challenges <span>Earn bragging rights</span></summary>'+
 '<p>Make your normal matchup pick to compete for rivalry bragging rights. No duplicate wagers or extra points.</p>'+
 '<button type="button" class="fan-small" data-fan="go-picks">Make my picks ↗</button></details>';
}
function alertSettings(){
 const root=get("settings-view");if(!root)return;
 let slot=get("fan-alerts");if(!slot){slot=document.createElement("section");slot.id="fan-alerts";slot.className="fan-panel";root.append(slot);}
 const on=localStorage.getItem(key("alerts"))==="on";
 slot.innerHTML='<div class="card-kicker">🔔 PICK REMINDERS</div><h3>Useful alerts, not noise</h3>'+
 '<p>Opt-in pick deadlines and final scores while the website is open. Background push requires a future push server.</p>'+
 '<button class="fan-small" data-fan="alerts">'+(on?"Disable alerts":"Enable alerts")+'</button>';
}
async function toggleAlerts(){
 const on=localStorage.getItem(key("alerts"))!=="on";
 if(on&&"Notification" in window&&Notification.permission==="default"){try{await Notification.requestPermission();}catch(e){}}
 store(key("alerts"),on?"on":"off");alertSettings();toast(on?"In-app reminders enabled":"Reminders disabled");
}
function remind(){
 if(localStorage.getItem(key("alerts"))!=="on"||!user()||document.visibilityState!=="visible")return;
 const w=app()?.week?.();if(!w)return;
 const picked=new Set(myPicks.map(p=>p.game_id));
 const count=w.games.filter(g=>!picked.has(g.id)&&Date.parse(g.kickoff)>Date.now()&&Date.parse(g.kickoff)-Date.now()<2*3600000).length;
 if(!count)return;
 const k=key("deadline-"+new Date().toISOString().slice(0,10)+"-"+w.num);
 if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"yes");
 const msg=count+" SEC picks lock in the next two hours.";toast(msg);
 if("Notification" in window&&Notification.permission==="granted")try{new Notification("SEC Pick'em",{body:msg,tag:k});}catch(e){}
}
async function onView(v){
 resetAccount();
 if(v==="league"){renderClub();extras();await window.secOnline?.whenAuthReady?.();await inviteJoin();await loadClubs();extras();}
 if(v==="picks"){enhanceRecap();extras();void loadGames().then(()=>{enhanceRecap();remind();});}
 if(v==="teams"){enhanceTeam();void loadTeamGames();}
 if(v==="trophies")honors();
 if(v==="settings")alertSettings();
}
document.addEventListener("click",e=>{
 const b=e.target.closest?.("[data-fan]");if(!b)return;e.preventDefault();
 const cmd=b.dataset.fan;
 if(["create","join","share","reload","sport"].includes(cmd)){void changeClub(cmd,b);return;}
 if(cmd==="go-picks")app()?.setView?.("picks");
 if(cmd==="go-baseball")app()?.setView?.("baseball");
 if(cmd==="team-sport"){teamSport=b.dataset.sport;enhanceTeam();}
 if(cmd==="alerts")void toggleAlerts();
});
document.addEventListener("change",e=>{if(e.target.id==="fan-club-select")void changeClub("select",e.target);});
document.addEventListener("toggle",e=>{if(!e.target?.matches?.("[data-fan-center]"))return;
 if(e.target.open)openDetails.add(e.target.dataset.fanCenter);else openDetails.delete(e.target.dataset.fanCenter);},true);
window.SEC_FAN=Object.freeze({onView,gameCenter,sportCenter,enhanceRecap,enhanceTeam,honors,
 loadClubs,getClub:activeClub,getStandings:()=>rows.slice()});
if(app()?.view?.())void onView(app().view());
setInterval(()=>{if(document.visibilityState!=="visible")return;
 if(app()?.view?.()==="picks")void loadGames().then(remind);
 if(app()?.view?.()==="league")void loadClubs();},120000);
})();