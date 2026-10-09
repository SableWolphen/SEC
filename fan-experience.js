/* SEC Fan Experience: data-backed enhancements. No imaginary scores or league points. */
(()=>{
"use strict";
const app=()=>window.SEC_BRIDGE,client=()=>window.secOnline?.getClient?.(),user=()=>window.secOnline?.getUser?.();
const esc=x=>String(x==null?"":x).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const val=x=>{if(x?.error)throw x.error;return x?.data;},get=id=>document.getElementById(id);
const date=x=>Number.isFinite(Date.parse(x))?new Date(x).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"TBD";
const sports=[["picks","🏈","Football"],["basketball","🏀","Basketball"],["baseball","⚾","Baseball"]];
let leagues=[],clubId=null,rows=[],problem="",lastClub=0,clubLoading=false,identity=null;
let playChoice={format:"single",sport:"picks"},choiceLoaded=false,choiceLoading=false,choiceVersion=0,choiceProblem="";
let ownedSingle=[];
let gameRows={},revealed={},myPicks=[],gamesAt=0,gamesLoading=false;
let teamRows={football:[],basketball:[],baseball:[]},teamAt=0,teamLoading=false,teamSport="picks";
const openDetails=new Set();
const safeNumber=n=>Number.isFinite(Number(n))?Number(n):0;
const store=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const key=k=>"sec-fan-"+k+"-"+(user()?.id||"guest");
const toast=s=>app()?.toast?.(s);
function resetAccount(){
 const id=user()?.id||"guest";if(id===identity)return;
 identity=id;leagues=[];clubId=null;rows=[];lastClub=0;gamesAt=0;teamAt=0;
 choiceLoaded=false;choiceLoading=false;choiceProblem="";choiceVersion=0;ownedSingle=[];
 const format=localStorage.getItem(key("format")),savedSport=localStorage.getItem(key("single-sport"));
 playChoice={format:format==="all"?"all":"single",
  sport:["picks","basketball","baseball"].includes(savedSport)?savedSport:"picks"};
 gameRows={};revealed={};myPicks=[];teamRows={football:[],basketball:[],baseball:[]};
}
function activeClub(){return leagues.find(x=>x.id===clubId)||null;}
const backendSport=s=>s==="picks"?"football":s;
function renderLeagueChoice(){
 const root=get("fan-league-choice"),singleRoot=get("fan-single-league"),multiRoot=get("fan-club-hub");
 if(!root)return;
 const format=playChoice.format,sport=playChoice.sport,loggedIn=Boolean(user());
 const button=(mode,icon,title,subtitle)=>'<button type="button" class="fan-format-card '+(format===mode?'active':'')+
  '" data-fan="format" data-format="'+mode+'" aria-pressed="'+(format===mode)+'"><span class="fan-format-icon">'+icon+'</span>'+
  '<span class="fan-format-title">'+title+'</span><small>'+subtitle+'</small><span class="fan-format-check">'+(format===mode?'✓ Selected':'Choose')+'</span></button>';
 root.innerHTML='<section class="fan-format-wrap" aria-label="How do you want to play?">'+
  '<div class="fan-format-title-row"><div><div class="card-kicker">CHOOSE YOUR COMPETITION</div>'+
  '<h2>One sport or the whole SEC?</h2><p>Pick your league style below. You can change this choice whenever you want.</p></div></div>'+
  '<div class="fan-format-grid" role="group" aria-label="League type">'+
  button("single","🏈","Single Sport","Football, basketball, or baseball. One sport at a time.")+
  button("all","🏆","All Three Sports","One invite and an overall Grand Champion race.")+'</div>'+
  '<p class="fan-format-note">↔ Change anytime · Your account, league memberships, picks, and results stay saved.</p>'+
  (choiceProblem?'<p class="fan-warning" role="status">'+esc(choiceProblem)+'</p>':'')+'</section>';
 if(singleRoot){
  singleRoot.hidden=format!=="single";
  if(format==="single"){
   const sportButtons='<div class="fan-sport-picker" role="group" aria-label="Choose your single sport">'+
    sports.map(([value,icon,label])=>'<button type="button" data-fan="single-sport" data-sport="'+value+
    '" class="fan-sport-choice '+(sport===value?'active':'')+'" aria-pressed="'+(sport===value)+'">'+
    icon+' '+label+'</button>').join("")+'</div>';
   const context=sport==="picks"?
    '<p class="fan-subtle">Your football league, invitations, chat, and standings are below.</p>':
    (loggedIn?(window.SEC_SPORTS?.renderLeaguePanel?.(sport)||
     '<p class="fan-subtle">Loading your '+(sport==="basketball"?"basketball":"baseball")+' leagues…</p>'):
    '<p class="fan-subtle">Sign in below using your existing account to create or join a league for this sport.</p>');
   singleRoot.innerHTML='<section class="fan-panel fan-single-panel"><div class="card-kicker">ONE SPORT LEAGUE</div>'+
    '<h3>Which sport are you playing?</h3>'+sportButtons+
    (sport!=="picks"&&loggedIn?'<div class="fan-single-actions"><button class="fan-small fan-primary" data-fan="open-sport" data-sport="'+sport+
      '" type="button">Make '+(sport==="basketball"?"basketball":"baseball")+' picks →</button></div>':"")+
    context+'</section>';
  }
 }
 if(multiRoot)multiRoot.hidden=format!=="all";
 for(const id of ["fan-brackets","fan-series"]){const el=get(id);if(el)el.hidden=format!=="all";}
 const football=get("league-content");
 // Keep shared sign-in/password recovery accessible regardless of league style.
 if(football)football.hidden=loggedIn&&(format==="all"||sport!=="picks");
}
async function readLeaguePreference(){
 resetAccount();
 const u=user(),c=client(),id=u?.id;
 if(!id||!c||choiceLoaded||choiceLoading)return;
 choiceLoading=true;const revision=choiceVersion;
 try{
  const response=await c.from("sec_player_league_preferences")
   .select("play_format,single_sport").eq("user_id",id).maybeSingle();
  const record=val(response);
  if(identity!==id||revision!==choiceVersion)return;
  if(record){
   playChoice={format:record.play_format==="all"?"all":"single",
    sport:record.single_sport==="basketball"||record.single_sport==="baseball"?
     record.single_sport:"picks"};
   store(key("format"),playChoice.format);store(key("single-sport"),playChoice.sport);
  }
  choiceLoaded=true;choiceProblem="";
 }catch(e){
  if(identity===id){choiceProblem="Your saved league choice is temporarily unavailable. Current choice is kept on this device.";
   choiceLoaded=true;}
 }finally{choiceLoading=false;if(identity===id)renderLeagueChoice();}
}
async function choosePlay(format,sport=playChoice.sport){
 if(!["single","all"].includes(format)||!["picks","basketball","baseball"].includes(sport))return;
 resetAccount();
 if(playChoice.format===format&&playChoice.sport===sport)return;
 const prior={...playChoice},id=user()?.id,revision=++choiceVersion;
 playChoice={format,sport};choiceLoaded=true;choiceProblem="";
 store(key("format"),format);store(key("single-sport"),sport);
 renderLeagueChoice();
 if(format==="all"){
  void loadClubs();void window.SEC_BRACKETS?.mount?.();
 }else if(sport!=="picks"&&id){
  void window.SEC_SPORTS?.load?.(sport);
 }
 if(!id||!client()){toast("Log in to save this choice on your account.");return;}
 try{
  val(await client().from("sec_player_league_preferences").upsert({
   user_id:id,play_format:format,single_sport:backendSport(sport)
  },{onConflict:"user_id"}));
  if(revision===choiceVersion&&identity===id)toast(format==="all"?
   "All-sports view selected. Your existing leagues and picks are safe.":
   "Single-sport view selected. Your other sports are still saved.");
 }catch(e){
  if(revision===choiceVersion&&identity===id){
   playChoice=prior;store(key("format"),prior.format);store(key("single-sport"),prior.sport);
   choiceProblem="Could not save this change to your account. Please try again.";
   renderLeagueChoice();
  }
 }
}

async function loadClubs(force=false){
 resetAccount();
 if(!client()||!user()||clubLoading||(!force&&Date.now()-lastClub<45000))return;
 clubLoading=true;problem="";
 try{
  const [all,football,other]=await Promise.all([
   client().from("sec_clubs").select("id,name,invite_code,football_league,basketball_league,baseball_league").order("created_at",{ascending:false}),
   client().from("sec_leagues").select("id,name,owner_id,mode").eq("owner_id",user().id),
   client().from("sec_sport_leagues").select("id,name,sport,owner_id,mode").eq("owner_id",user().id)
  ]);
  leagues=val(all)||[];
  const old=[...(val(football)||[]).map(l=>({...l,sport:"football"})),...(val(other)||[])];
  const linked=new Set(leagues.flatMap(c=>[c.football_league,c.basketball_league,c.baseball_league]));
  ownedSingle=old.filter(l=>l.mode==="straight"&&!linked.has(l.id)&&
   ["football","basketball","baseball"].includes(l.sport));
  clubId=leagues.some(x=>x.id===clubId)?clubId:
    leagues.find(x=>x.id===localStorage.getItem(key("club")))?.id||leagues[0]?.id||null;
  rows=clubId?(val(await client().rpc("sec_club_standings",{p_club:clubId}))||[]):[];
  lastClub=Date.now();
 }catch(e){problem="Could not load three-sport league: "+(e.message||"try again");}
 finally{clubLoading=false;renderClub();if(playChoice.format==="all")window.SEC_BRACKETS?.mount?.();}
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
 const mine=rows.find(row=>row.user_id===user()?.id);
 const stats=c&&mine?'<details class="fan-fold"><summary>📈 My three-sport stats <span>Season to date</span></summary>'+
  '<div class="fan-metrics">'+sports.map(([sport,icon,label])=>{
   const key=sport==="picks"?"football":sport,correct=mine[key+"_correct"];
   return '<span><strong>'+safeNumber(correct)+'</strong><small>'+icon+' '+label+' correct</small></span>';
  }).join("")+'</div>'+
  '<p class="fan-subtle">Total championship points: '+safeNumber(mine.total)+
  '. Straight-pick scoring; only verified results count. Your older seasons remain in their original leagues.</p></details>':"";
 const upgradeOptions=ownedSingle.map(l=>'<option value="'+esc(l.sport+":"+l.id)+'">'+
  esc(({football:"🏈",basketball:"🏀",baseball:"⚾"}[l.sport]||"")+" "+l.name)+'</option>').join("");
 const upgrade=ownedSingle.length?'<details class="fan-fold"><summary>↗ Upgrade an existing single-sport league</summary>'+
  '<p>League owners can keep their original Straight Picks league and its history, then add the other two sports. '+
  'Existing members must opt in with the new all-sports invite; nobody is enrolled without permission.</p>'+
  '<label for="fan-upgrade-league" class="input-label">Your owned league</label>'+
  '<select id="fan-upgrade-league" class="field">'+upgradeOptions+'</select>'+
  '<button type="button" class="fan-small fan-primary" data-fan="upgrade">Upgrade to all three →</button></details>':"";
 const opts=leagues.length>1?'<select id="fan-club-select" aria-label="Choose combined league">'+
  leagues.map(l=>'<option value="'+esc(l.id)+'" '+(l.id===clubId?'selected':'')+'>'+esc(l.name)+'</option>').join("")+'</select>':"";
 host.innerHTML='<section class="fan-panel"><div class="fan-title-row"><div><div class="card-kicker">👑 GRAND CHAMPION RACE</div><h2>'+
  esc(c?.name||"One league. Three sports.")+'</h2><p>Same friends across football, basketball and baseball. One point per confirmed correct winner.</p></div>'+
  '<button class="fan-small" data-fan="reload" type="button">↻ Refresh</button></div>'+
  (problem?'<p class="fan-warning" role="status">'+esc(problem)+'</p>':"")+
  (c?opts+'<p class="fan-subtle">Confirmed scores only · '+rows.length+' members</p>'+scores+stats+
    '<div class="fan-sport-links">'+sports.map(([s,emoji,title])=>'<button class="fan-small" data-fan="sport" data-sport="'+s+'">'+emoji+' '+title+' picks ↗</button>').join("")+'</div>'+
    '<button class="fan-small" data-fan="share">Share one invite ↗</button> <small>Code: '+esc(c.invite_code)+'</small>':
    '<p class="fan-subtle">Create a league or join your friends. Existing single-sport leagues remain unchanged.</p>')+
  '<details class="fan-fold" '+(!c?"open":"")+'><summary>＋ Create or join an all-sports league</summary>'+
   '<div class="fan-form"><label>League name<input id="fan-name" placeholder="SEC Legends" maxlength="50"></label>'+
   '<button class="fan-small fan-primary" data-fan="create">Create league</button>'+
   '<label>Invite code<input id="fan-code" placeholder="10-character code" maxlength="10"></label>'+
   '<button class="fan-small" data-fan="join">Join league</button></div></details>'+
  upgrade+'</section>';
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
  else if(type==="upgrade"){
   const valId=field("fan-upgrade-league"),[sport,id]=valId.split(":");
   if(!ownedSingle.some(l=>l.id===id&&l.sport===sport))throw Error("Choose a league you own.");
   clubId=val(await client().rpc("sec_club_upgrade_single",{p_sport:sport,p_league:id}));
   toast("Your original picks and members were preserved. Share the new invite for the other sports!");
  }
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
 resetAccount();
 if(v==="league"){
  renderLeagueChoice();extras();
  await window.secOnline?.whenAuthReady?.();
  resetAccount();await readLeaguePreference();
  const inviteCode=new URLSearchParams(location.search).get("club");
  if(user()&&/^[A-Za-z0-9]{10}$/.test(inviteCode||"")&&playChoice.format!=="all"){
   await choosePlay("all");
  }
  if(playChoice.format==="all"){await inviteJoin();await loadClubs();window.SEC_BRACKETS?.mount?.();}
  else if(user()&&playChoice.sport!=="picks")void window.SEC_SPORTS?.load?.(playChoice.sport);
  renderLeagueChoice();extras();
 }
 if(v==="picks"){enhanceRecap();extras();void loadGames().then(()=>{enhanceRecap();remind();});}
 if(v==="teams"){enhanceTeam();void loadTeamGames();}
 if(v==="trophies"){honors();void loadGames().then(honors);}
 if(v==="settings")alertSettings();
 if(v==="baseball")window.SEC_SPORTS?.mount?.("baseball");
}
document.addEventListener("click",e=>{
 const b=e.target.closest?.("[data-fan]");if(!b)return;e.preventDefault();
 const cmd=b.dataset.fan;
 if(cmd==="format"){void choosePlay(b.dataset.format);return;}
 if(cmd==="single-sport"){void choosePlay("single",b.dataset.sport);return;}
 if(cmd==="open-sport"){app()?.setView?.(b.dataset.sport);return;}
 if(["create","join","share","reload","sport","upgrade"].includes(cmd)){void changeClub(cmd,b);return;}
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
document.addEventListener("change",e=>{if(e.target.id==="fan-club-select")void changeClub("select",e.target);});
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
window.SEC_FAN=Object.freeze({onView,renderLeagueChoice,readLeaguePreference,choosePlay,getPlayChoice:()=>({...playChoice}),gameCenter,sportCenter,seriesPreviewCard,enhanceRecap,enhanceTeam,honors,
 loadClubs,getClub:activeClub,getStandings:()=>rows.slice()});
if(app()?.view?.())void onView(app().view());
setInterval(()=>{if(document.visibilityState!=="visible")return;
 if(app()?.view?.()==="picks")void loadGames().then(remind);
 if(app()?.view?.()==="league")void loadClubs();},120000);
})();