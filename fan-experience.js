/* SEC Fan Experience: data-backed enhancements. No imaginary scores or league points. */
(()=>{
"use strict";
const app=()=>window.SEC_BRIDGE,client=()=>window.secOnline?.getClient?.(),user=()=>window.secOnline?.getUser?.();
const esc=x=>String(x==null?"":x).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const val=x=>{if(x?.error)throw x.error;return x?.data;},get=id=>document.getElementById(id);
const date=x=>Number.isFinite(Date.parse(x))?new Date(x).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"TBD";
// The League page has one authoritative source of truth: SEC_LEAGUE_SETTINGS.
let gameRows={},revealed={},myPicks=[],gamesAt=0,gamesLoading=false;
let teamRows={football:[],basketball:[],baseball:[]},teamAt=0,teamLoading=false,teamSport="picks";
let identity=null;
const openDetails=new Set();
const safeNumber=n=>Number.isFinite(Number(n))?Number(n):0;
const store=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const key=k=>"sec-fan-"+k+"-"+(user()?.id||"guest");
const toast=s=>app()?.toast?.(s);
function resetAccount(){
 const id=user()?.id||"guest";
 if(id===identity)return;
 identity=id;gameRows={};revealed={};myPicks=[];gamesAt=0;teamAt=0;
 teamRows={football:[],basketball:[],baseball:[]};
}
async function loadGames(force=false){
 if(!client()||gamesLoading||(!force&&Date.now()-gamesAt<120000))return;
 gamesLoading=true;
 try{
  const gs=val(await client().from("sec_games").select("id,week,away_code,home_code,kickoff_at,game_status,away_score,home_score,winner,score_updated_at"))||[];
  gameRows=Object.fromEntries(gs.map(g=>[g.id,g]));
  const league=window.secOnline?.getLeague?.();
  if(league&&user()){
   const p=val(await client().from("sec_league_picks").select("game_id,pick_code").eq("league_id",league.id).eq("user_id",user().id))||[];
   myPicks=p;
   const reveal=val(await client().rpc("sec_revealed_league_picks",{p_league:league.id,p_week:app()?.week?.()?.num||1}))||[];
   revealed={};for(const row of reveal)(revealed[row.game_id]||(revealed[row.game_id]=[])).push(row.pick_code);
  }else{myPicks=[];revealed={};}
  gamesAt=Date.now();
 }catch(e){console.info("SEC game status unavailable:",e.message);}
 finally{gamesLoading=false;if(app()?.view?.()==="picks"&&!document.activeElement?.matches?.("input,textarea,select"))app()?.renderPicks?.();}
}
// Live score polling can update one week without refetching every league's picks.
function ingestScores(rows){
 for(const row of rows||[])if(row?.id)gameRows[row.id]={...gameRows[row.id],...row};
 if((rows||[]).length)gamesAt=Date.now();
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
 const standings=window.SEC_LEAGUE_SETTINGS?.getStandings?.()||[];
 const me=standings.find(r=>r.user_id===user()?.id),awards=[];
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
 '<button type="button" data-fan="team-news" class="fan-small">📰 My team news ↗</button>'+
 '<div class="fan-sport-links">'+sports.map(([s,e,label])=>'<button type="button" data-fan="team-sport" data-sport="'+s+'" class="fan-small '+(s===teamSport?"is-current":"")+'">'+e+' '+label+'</button>').join("")+'</div>'+
 '<div class="fan-team-columns"><div><strong>Last five</strong><ol>'+(past.length?past.map(line).join(""):'<li>No verified finals yet.</li>')+
 '</ol></div><div><strong>Upcoming</strong><ol>'+(next.length?next.map(line).join(""):'<li>No verified upcoming fixtures yet.</li>')+
 '</ol></div></div>';
}
function extras(){
 const sec=get("fan-brackets");
 if(sec&&!window.SEC_BRACKETS)sec.innerHTML='<details class="fan-fold"><summary>🏀⚾ SEC tournament brackets <span>Only official seeds</span></summary>'+
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
 if(v==="league")return window.SEC_LEAGUE_SETTINGS?.onView?.();
 resetAccount();
 if(v==="picks"){enhanceRecap();extras();void loadGames().then(()=>{enhanceRecap();remind();});}
 if(v==="teams"){enhanceTeam();void loadTeamGames();}
 if(v==="trophies"){honors();void loadGames().then(honors);}
 if(v==="settings")alertSettings();
 if(v==="baseball")window.SEC_SPORTS?.mount?.("baseball");
}
document.addEventListener("click",e=>{
 const b=e.target.closest?.("[data-fan]");if(!b)return;e.preventDefault();
 const cmd=b.dataset.fan;
 if(cmd==="go-picks")app()?.setView?.("picks");
 if(cmd==="go-baseball")app()?.setView?.("baseball");
 if(cmd==="team-sport"){teamSport=b.dataset.sport;enhanceTeam();}
 if(cmd==="team-news"){
   const schoolNames={ALA:"Alabama",ARK:"Arkansas",AUB:"Auburn",FLA:"Florida",UGA:"Georgia",UK:"Kentucky",
    LSU:"LSU",MISS:"Ole Miss",MSST:"Mississippi State",MIZ:"Missouri",OU:"Oklahoma",SC:"South Carolina",
    TENN:"Tennessee",TEX:"Texas",TAMU:"Texas A&M",VAN:"Vanderbilt"};
   const selected=app()?.state?.()?.favorite;
   if(schoolNames[selected])window.SEC_NEWS?.showSchool?.(schoolNames[selected],teamSport==="picks"?"football":teamSport);
 }
 if(cmd==="alerts")void toggleAlerts();
});
document.addEventListener("toggle",e=>{if(!e.target?.matches?.("[data-fan-center]"))return;
 if(e.target.open)openDetails.add(e.target.dataset.fanCenter);else openDetails.delete(e.target.dataset.fanCenter);},true);

/* SEC's 2027 conference series pairings are verified, but exact first pitches aren't.
   Store private non-scoring previews for the current browser/player, never league points. */
function seriesKey(game){return "2027|"+String(game.weekend)+"|"+game.away+"|"+game.home;}
function seriesPredictions(){
 try{return JSON.parse(localStorage.getItem(key("series-preview"))||"{}")||{};}catch(e){return {};}
}
function seriesPreviewCard(x){
 if(!x||!x.away||!x.home||!Number.isInteger(x.weekend))return "";
 const k=seriesKey(x),prediction=seriesPredictions()[k]||{};
 const selected=prediction.winner||"",length=prediction.length||"2-1";
 return '<details class="fan-series-predict"><summary>✎ My series preview '+(selected?"· "+esc(selected):"")+'</summary>'+
  '<p>Personal preview only · no scored league points until first pitches are confirmed.</p>'+
  '<div class="fan-series-preview-buttons">'+[x.away,x.home].map(name=>'<button type="button" data-fan-series="winner" data-series-key="'+esc(k)+
   '" data-series-winner="'+esc(name)+'" class="fan-small '+(selected===name?"is-current":"")+
   '">'+esc(name)+(selected===name?" ✓":"")+'</button>').join("")+'</div>'+
  '<label class="fan-series-margin">Predicted series result <select data-fan-series-margin="'+esc(k)+'" aria-label="Expected series score">'+
   ['2-1','3-0'].map(score=>'<option value="'+score+'" '+(length===score?"selected":"")+'>'+score+'</option>').join("")+
  '</select></label></details>';
}
function saveSeries(keyValue,winner,margin){
 const current=seriesPredictions(),next=current[keyValue]||{};
 if(winner)next.winner=winner;
 if(margin)next.length=margin;
 current[keyValue]=next;
 store(key("series-preview"),JSON.stringify(current));
 if(app()?.view?.()==="baseball")window.SEC_SPORTS?.mount?.("baseball");
 toast("Series preview saved on this device. It does not affect league scoring.");
}
document.addEventListener("click",e=>{
 const button=e.target.closest?.("[data-fan-series]");if(!button)return;
 e.preventDefault();
 const k=button.dataset.seriesKey,w=button.dataset.seriesWinner,parts=k?.split("|");
 if(!parts||parts.length!==4||parts[0]!=="2027"||![parts[2],parts[3]].includes(w))return;
 saveSeries(k,w,null);
});
document.addEventListener("change",e=>{
 const k=e.target.dataset?.fanSeriesMargin;
 if(!k||!["2-1","3-0"].includes(e.target.value))return;
 saveSeries(k,null,e.target.value);
});
window.SEC_FAN=Object.freeze({onView,
 renderLeagueChoice:()=>window.SEC_LEAGUE_SETTINGS?.render?.(),
 getClub:()=>window.SEC_LEAGUE_SETTINGS?.getClub?.()||null,
 getStandings:()=>window.SEC_LEAGUE_SETTINGS?.getStandings?.()||[],
 gameCenter,sportCenter,seriesPreviewCard,enhanceRecap,enhanceTeam,honors,ingestScores});
if(app()?.view?.())void onView(app().view());
setInterval(()=>{if(document.visibilityState!=="visible")return;
 if(app()?.view?.()==="picks")void loadGames().then(remind);
 if(app()?.view?.()==="league"&&!document.activeElement?.matches?.("input,textarea,select"))void window.SEC_LEAGUE_SETTINGS?.load?.(true);},120000);
})();