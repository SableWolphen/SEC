/* SEC Pick'em four league modes, verified scores, hidden-until-kickoff reveals,
   achievements and opt-in reminders. Private league data comes from Supabase RLS/RPCs. */
(function(){
"use strict";
const MODES={
 straight:{name:"Straight Picks",detail:"Pick the winner. Each correct pick earns 1 point."},
 confidence:{name:"Confidence",detail:"Rank your weekly picks with unique points from 1 to the game count. Correct picks earn those points."},
 spread:{name:"Against the Spread",detail:"Pick which team covers ESPN's published pregame line. A push earns 0.5 point; no line means no pick."},
 h2h:{name:"Head-to-Head",detail:"Pick winners as usual, but compete against a paired league rival each week."}
};
const own={},games={},revealedByGame={},notes={};
let current=null,user=null,client=null,app=null,confidence={},tiebreakers={},tieDrafts={},standings=[],history=[],reloadVersion=0;
const err=(r)=>{if(r?.error)throw r.error;return r?.data;};
const esc=s=>app?.esc?app.esc(String(s??"")):String(s??"").replaceAll("<","&lt;");
const mode=()=>current?.mode||"straight";
const oneDecimal=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:1});
const cMode=()=>MODES[mode()]||MODES.straight;
const leagueGame=g=>games[g.id]||g;
const isOpen=g=>Date.now()<Date.parse(leagueGame(g).kickoff_at||g.kickoff);
const hasNumber=n=>n!==null&&n!==undefined&&n!=="";
async function reload(c,l,u,a){
 const version=++reloadVersion;
 const switched=current?.id!==l?.id||user?.id!==u?.id;
 if(switched)tieDrafts={};
 client=c;current=l;user=u;app=a;
 Object.keys(own).forEach(k=>delete own[k]);
 Object.keys(revealedByGame).forEach(k=>delete revealedByGame[k]);
 confidence={};tiebreakers={};history=[];
 if(!c||!l||!u){if(a?.state)a.state().picks={};return;}
 const week=a.week().num;
 const [my,reveals,ties,head]=await Promise.all([
  c.from("sec_league_picks").select("game_id,pick_code,confidence_points").eq("league_id",l.id).eq("user_id",u.id),
  c.rpc("sec_revealed_league_picks",{p_league:l.id,p_week:week}),
  c.from("sec_week_tiebreakers").select("week,game_id,predicted_total").eq("league_id",l.id).eq("user_id",u.id),
  l.mode==="h2h"?c.rpc("sec_h2h_history",{p_league:l.id}):Promise.resolve({data:[]})
 ]);
 // An old request can finish after logout or after changing leagues. It must
 // never overwrite another player's saved picks or reveal another league's data.
 if(version!==reloadVersion||current?.id!==l.id||user?.id!==u.id)return;
 for(const row of err(my)||[]){own[row.game_id]=row.pick_code;confidence[row.game_id]=row.confidence_points;}
 for(const row of err(reveals)||[])(revealedByGame[row.game_id]??=[]).push(row);
 for(const t of err(ties)||[])tiebreakers[t.week]=t;
 history=err(head)||[];
 a.state().picks={...own};
}
function updateGames(list,a){
 app=a;
 for(const g of list||[]){
  games[g.id]=g;
  const local=a.gameById[g.id];
  if(local){
   local.liveStatus=g.game_status;local.homeScore=g.home_score;local.awayScore=g.away_score;
   local.spreadHome=g.spread_home;local.statusDetail=g.status_detail;
  }
 }
}
function name(code){
 const t=app?.gameById?null:null;
 return esc(code);
}
function isUnavailable(g){
 return Boolean(current&&mode()==="spread"&&!hasNumber(leagueGame(g).spread_home));
}
function scoreFor(g,pick){
 const d=leagueGame(g);
 if(!pick||d.game_status!=="final")return 0;
 if(mode()==="spread"){
  if(!hasNumber(d.spread_home)||!hasNumber(d.home_score)||!hasNumber(d.away_score))return 0;
  const margin=Number(d.home_score)-Number(d.away_score)+Number(d.spread_home);
  if(margin===0)return 0.5;
  return (margin>0&&pick===g.home)||(margin<0&&pick===g.away)?1:0;
 }
 return d.winner===pick?(mode()==="confidence"?Number(confidence[g.id])||0:1):0;
}
function pickResult(g){
 if(!current)return null; // Maintain the original offline demo's copy.
 const picked=own[g.id],d=leagueGame(g),modeName=mode();
 if(d.game_status==="final"){
  if(!picked)return "Final · no pick made";
  const earned=scoreFor(g,picked);
  if(modeName==="spread"){
   if(!hasNumber(d.spread_home))return "Final · no verified spread";
   if(earned===0.5)return '<span class="earned">↔ Spread push · +0.5 pts</span>';
   return earned?'<span class="earned">✓ Covered the spread · +1 pt</span>':'<span class="missed">✕ Did not cover · 0 pts</span>';
  }
  if(earned>0)return '<span class="earned">✓ Correct · +'+oneDecimal(earned)+' pt'+(earned===1?'':'s')+'</span>';
  return '<span class="missed">✕ Incorrect pick · 0 pts</span>';
 }
 if(!picked)return isUnavailable(g)?"Spread not yet published · pick unavailable":"Choose the winner to make your pick";
 let description='Your pick: <span class="text-strong">'+esc(picked)+'</span>';
 if(modeName==="confidence"&&hasNumber(confidence[g.id])){
  description+=' · '+esc(confidence[g.id])+' confidence pts';
 }
 if(modeName==="spread")description+=' · to cover';
 return description;
}
function summaryPoints(w){
 if(!current)return null;
 const score=w.games.reduce((total,g)=>total+scoreFor(g,own[g.id]),0);
 return {score:oneDecimal(score),label:mode()==="confidence"?"Confidence points":mode()==="spread"?"Spread points":"Correct picks"};
}
function modeDescription(){
 return current?cMode().name+' · '+cMode().detail:'Straight Picks · 1 point per correct pick';
}
function extras(g){
 const game=leagueGame(g),displayScore=hasNumber(game.away_score)&&hasNumber(game.home_score);
 const status=game.game_status||"scheduled";
 let html="";
 if(displayScore&&(status==="live"||status==="final")){
  html+='<div class="sec-live" role="status"><span>'+(status==="live"?'🔴 LIVE':'✅ FINAL')+'</span><strong>'+esc(g.away)+' '+oneDecimal(game.away_score)+' – '+oneDecimal(game.home_score)+' '+esc(g.home)+'</strong><small>'+esc(game.status_detail||"ESPN scoreboard")+'</small></div>';
 }
 if(current){
  if(mode()==="spread"){
   const line=game.spread_home;
   const source=game.spread_source||"ESPN";
   html+='<div class="sec-mode-note">'+(hasNumber(line)?
      '<strong>Spread:</strong> '+esc(g.home)+' '+(Number(line)>0?'+':'')+oneDecimal(line)+' · '+esc(source)+' · Pick who covers'
      :'<strong>Spread pending:</strong> No published line yet; picks are disabled for this matchup')+'</div>';
  }
  if(mode()==="confidence"){
   let count=app.week().games.length,pick=confidence[g.id];
   const taken=new Set(Object.keys(confidence).filter(gameId=>
     gameId!==g.id && own[gameId] && app.gameById[gameId]?.week===g.week
   ).map(gameId=>Number(confidence[gameId])).filter(Number.isFinite));
   let opts='<option value="">Auto-assign an unused value</option>';
   for(let i=count;i>=1;i--){
     const used=taken.has(i);
     opts+='<option value="'+i+'" '+(Number(pick)===i?'selected':'')+' '+(used?'disabled':'')+'>'+
       i+' point'+(i===1?'':'s')+(used?' · already used':'')+'</option>';
   }
   html+='<label class="sec-confidence-label">Confidence points <select class="field sec-confidence" data-confidence-game="'+esc(g.id)+'">'+opts+'</select></label><p class="helper">Select points, then tap a team. Use each number once this week.</p>';
  }
 }
 const r=revealedByGame[g.id]||[];
 if(r.length&&Date.now()>=Date.parse(game.kickoff_at||g.kickoff)){
  const away=r.filter(p=>p.pick_code===g.away),home=r.filter(p=>p.pick_code===g.home);
  const total=r.length,percentage=Math.round(100*away.length/total);
  html+='<div class="sec-reveal"><div class="sec-reveal-heading"><strong>Friends’ picks revealed</strong><span>'+total+' picks</span></div>'+
   '<div class="sec-reveal-bar"><span style="width:'+percentage+'%"></span></div>'+
   '<div class="sec-reveal-teams"><span>'+esc(g.away)+': '+away.length+' ('+percentage+'%)</span><span>'+esc(g.home)+': '+home.length+' ('+(100-percentage)+'%)</span></div>'+
   '<div class="sec-reveal-people">'+r.slice(0,10).map(p=>'<span>'+esc(p.display_name)+': <b>'+esc(p.pick_code)+'</b></span>').join('')+(r.length>10?'<span>+'+(r.length-10)+' more</span>':'')+'</div></div>';
 }
 return html;
}
async function save(g,id,c,l,u,a){
 if(!l)throw Error("Create or join a league before saving picks.");
 if(!isOpen(g))throw Error("This game is already locked.");
 let value=null;
 if(l.mode==="confidence"){
  const element=document.querySelector('[data-confidence-game="'+g.id+'"]');
  if(element?.value){value=Number(element.value);}
 }
 const res=await c.rpc("sec_save_league_pick",{
  p_league:l.id,p_game:g.id,p_pick:id,p_confidence:value
 });
 const row=err(res);
 if(current?.id!==l.id||user?.id!==u.id)return row;
 own[g.id]=id;confidence[g.id]=row.confidence_points;
 a.state().picks[g.id]=id;
 a.renderPicks();
 return row;
}
async function shareSlip(){
 if(!current||!user||!app){
  app?.toast?.("Sign in and choose a league before sharing your picks.");
  return;
 }
 const w=app.week(),made=w.games.filter(g=>own[g.id]===g.away||own[g.id]===g.home);
 if(!made.length){app.toast("Pick a team before sharing your slip.");return;}
 const lines=[
  "🏈 Saturdays Down South",
  current.name+" · "+cMode().name+" · Week "+w.num,
  made.length+" of "+w.games.length+" selected",
  ""
 ];
 for(const g of w.games){
  if(!own[g.id])continue;
  const bonus=mode()==="confidence"&&hasNumber(confidence[g.id])?" · "+confidence[g.id]+" confidence pts":"";
  lines.push(g.away+" vs "+g.home+" → "+own[g.id]+bonus);
 }
 lines.push("","Picks can change until kickoff. Shared voluntarily by the player.");
 lines.push(window.location?.origin+window.location?.pathname+"#picks");
 const content=lines.join("\n");
 try{
  if(navigator.share){
   await navigator.share({title:current.name+" · My Week "+w.num+" Picks",text:content});
   app.toast("Pick slip ready to share!");
  }else if(navigator.clipboard?.writeText){
   await navigator.clipboard.writeText(content);
   app.toast("My weekly picks copied!");
  }else{
   window.prompt("Copy your pick slip:",content);
  }
 }catch(error){
  if(error?.name!=="AbortError")app.toast("Couldn't share the picks. Try again.");
 }
}
function control(){
 return '<label class="input-label" for="online-league-mode">Game mode</label><select class="field" id="online-league-mode">'+
 Object.entries(MODES).map(([key,m])=>'<option value="'+key+'">'+m.name+'</option>').join('')+'</select>'+
 '<div class="sec-mode-guide">'+Object.entries(MODES).map(([key,m])=>'<p><b>'+esc(m.name)+'</b> · '+esc(m.detail)+'</p>').join('')+'</div>';
}
function badgeFor(row){
 const week=app.week(),finished=week.games.every(g=>games[g.id]?.game_status==="final");
 const correct=Number(row.correct_picks)||0,wp=Number(row.week_points)||0;
 let items=[];
 if(correct>=5)items.push("🏅 5 Correct Club");
 if(row.user_id===user?.id){
  let best=0,run=0;
  const completed=Object.keys(own).map(id=>({g:games[id],pick:own[id]}))
    .filter(x=>x.g?.game_status==="final"&&x.g?.winner)
    .sort((a,b)=>Date.parse(a.g.kickoff_at)-Date.parse(b.g.kickoff_at));
  for(const x of completed){
   run=x.pick===x.g.winner?run+1:0;
   best=Math.max(best,run);
  }
  if(best>=5)items.push("🔥 5-Game Streak");
 }
 if(finished&&mode()!=="confidence"&&mode()!=="spread"&&wp===week.games.length)items.push("🏆 Perfect Week");
 if((revealedByGame&&Object.keys(revealedByGame).length)){
  const upset=week.games.some(g=>{
    const d=games[g.id],line=Number(d?.spread_home);
    if(!d||!hasNumber(d.spread_home)||!d.winner||d.game_status!=="final")return false;
    const guessed=(revealedByGame[g.id]||[]).some(p=>p.user_id===row.user_id&&p.pick_code===d.winner);
    return guessed&&((line>0&&d.winner===g.home)||(line<0&&d.winner===g.away));
  });
  if(upset)items.push("⚡ Upset King");
 }
 return items.length?'<div class="sec-achievements">'+items.map(s=>'<span>'+esc(s)+'</span>').join('')+'</div>':'';
}
function pairings(){
 if(mode()!=="h2h"||!standings.length)return "";
 const rows=history.filter(r=>r.player_id===user?.id);
 const record=rows.reduce((out,r)=>{if(r.result==="win")out.w++;if(r.result==="loss")out.l++;if(r.result==="tie")out.t++;return out;},{w:0,l:0,t:0});
 const week=app.week().num,pair=rows.find(r=>Number(r.week)===week);
 const rival=standings.find(p=>p.user_id===pair?.opponent_id);
 let matchup='<div class="sec-h2h"><b>⚔️ Your weekly matchup</b><p class="helper">Season head-to-head record: <strong>'+record.w+'W – '+record.l+'L – '+record.t+'T</strong></p>';
 if(!pair)matchup+='<div>Matchups will appear after joining.</div>';
 else if(pair.result==="bye")matchup+='<div>You have a bye this week. Picks still count toward your overall points.</div>';
 else matchup+='<div>'+esc(standings.find(p=>p.user_id===user.id)?.display_name||"You")+
  ' <strong>'+oneDecimal(pair.player_points)+'</strong> vs '+esc(rival?.display_name||"Opponent")+
  ' <strong>'+oneDecimal(pair.opponent_points)+'</strong>'+
  ' · <b>'+esc(pair.result==="pending"?"In progress":pair.result.toUpperCase())+'</b></div>';
 matchup+='<p class="helper">Matchup results settle after all games that week finish.</p></div>';
 const scores=standings.map(p=>{
  const all=history.filter(r=>r.player_id===p.user_id);
  return {name:p.display_name,id:p.user_id,w:all.filter(r=>r.result==="win").length,
   l:all.filter(r=>r.result==="loss").length,t:all.filter(r=>r.result==="tie").length,
   points:Number(p.season_points)||0};
 }).sort((a,b)=>b.w-a.w||a.l-b.l||b.points-a.points);
 return matchup+'<div class="sec-h2h-records"><div class="small-heading">Head-to-head standings</div>'+
 scores.map((p,i)=>'<div class="sec-manage-row"><span>'+(i+1)+'. '+esc(p.name)+(p.id===user.id?' ★':'')+'</span>'+
  '<strong>'+p.w+'–'+p.l+'–'+p.t+'</strong></div>').join('')+'</div>';
}
function lastGameForWeek(w){
 if(!w?.games?.length)return null;
 return w.games.slice().sort((a,b)=>
  Date.parse(leagueGame(b).kickoff_at||b.kickoff||b.date+"T11:00:00Z")-
  Date.parse(leagueGame(a).kickoff_at||a.kickoff||a.date+"T11:00:00Z")
 )[0];
}
function tiebreakerCard(){
 if(!app)return "";
 const w=app.week(),game=lastGameForWeek(w);
 if(!game)return "";
 const saved=tiebreakers[w.num]||null;
 const draft=Object.prototype.hasOwnProperty.call(tieDrafts,w.num);
 const value=draft?tieDrafts[w.num]:String(saved?.predicted_total??"");
 const open=isOpen(game),signedIn=Boolean(user&&current&&client);
 const date=new Date(leagueGame(game).kickoff_at||game.kickoff);
 const when=Number.isFinite(date.valueOf())?date.toLocaleString("en-US",{
  month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago",timeZoneName:"short"
 }):"Kickoff TBA";
 const status=!signedIn?"Sign in and join a league to submit your prediction.":
  !open?(saved?"Locked · Saved: "+saved.predicted_total+" points":"Locked · No prediction saved"):
  draft&&value!==String(saved?.predicted_total??"")?"Unsaved changes":
  saved?"Saved: "+saved.predicted_total+" combined points":"Not saved yet";
 return '<section class="sec-tiebreaker sec-picks-tiebreaker" aria-labelledby="sec-tie-heading">'+
  '<div class="sec-tie-topline"><span>WEEK '+w.num+' · PICK SLIP</span><span>'+(open?"Open until kickoff":"Locked")+'</span></div>'+
  '<h3 id="sec-tie-heading">🎯 Weekly total-points tiebreaker</h3>'+
  '<p class="sec-tie-description">Predict the <b>combined final points</b> from both teams in the last game to kick off this week. Closest guess breaks tied league standings after the game is final.</p>'+
  '<div class="sec-tie-game"><strong>'+esc(game.away)+' vs '+esc(game.home)+'</strong><small>'+esc(when)+'</small></div>'+
  '<div class="sec-tie-entry"><label for="sec-total-guess">Your total-points prediction</label><div class="sec-tie-fields">'+
  '<input class="field" id="sec-total-guess" type="number" min="0" max="200" step="1" inputmode="numeric" data-tie-week="'+w.num+
  '" value="'+esc(value)+'" placeholder="e.g. 48" '+(!open||!signedIn?'disabled':'')+'>'+
  '<button type="button" class="primary-btn" data-extra="save-total" data-tie-week="'+w.num+'" '+
  (!open||!signedIn?'disabled':'')+'>Save tiebreaker</button></div></div>'+
  '<p class="sec-tie-feedback" role="status">'+esc(status)+'</p>'+
  (!signedIn?'<button type="button" class="ghost-btn" data-nav="league">Sign in on League page</button>':'')+
  '</section>';
}
async function saveTiebreaker(){
 if(!client||!current||!user||!app)throw Error("Join a league and sign in first.");
 const w=app.week(),game=lastGameForWeek(w);
 if(!game||!isOpen(game))throw Error("This week's tiebreaker is locked.");
 const input=document.getElementById("sec-total-guess");
 if(!input||Number(input.dataset?.tieWeek)!==Number(w.num))throw Error("The selected week changed. Try again.");
 const raw=String(input.value??"").trim();
 if(!raw)throw Error("Enter your total-points prediction.");
 const guess=Number(raw);
 if(!Number.isInteger(guess)||guess<0||guess>200)throw Error("Use a whole number from 0 to 200.");
 const response=await client.from("sec_week_tiebreakers").upsert({
  league_id:current.id,user_id:user.id,week:w.num,game_id:game.id,predicted_total:guess
 },{onConflict:"league_id,user_id,week"});
 err(response);
 tiebreakers[w.num]={week:w.num,game_id:game.id,predicted_total:guess};
 delete tieDrafts[w.num];
 app.toast("Week "+w.num+" tiebreaker saved!");
 if(app.view()==="picks")app.renderPicks();
 return tiebreakers[w.num];
}
function leagueAchievements(){
 if(!current||!user)return "";
 const earned=standings
  .map(row=>({row,badges:badgeFor(row)}))
  .filter(item=>Boolean(item.badges));
 const collection=earned.length?
  '<div class="sec-honors-achievements-list">'+earned.map(({row,badges})=>
   '<div class="sec-honors-member"><strong>'+esc(row.display_name||"League player")+
   (row.user_id===user.id?' ★':'')+'</strong>'+badges+'</div>').join("")+'</div>':
  '<div class="sec-honors-empty"><strong>Badges are still up for grabs.</strong>'+
  '<p>Verified final results unlock Perfect Week, 5 Correct Club, streaks and upsets.</p></div>';
 return '<section class="sec-honors-achievements" aria-label="League achievements">'+
  '<div class="sec-honors-achievement-heading"><span aria-hidden="true">🏅</span><div><h3>League Achievements</h3>'+
  '<p>This week’s badges · confirmed results only</p></div></div>'+collection+'</section>';
}
function leagueDetails(){
 if(!current)return "";
 const m=cMode(),shareName=esc(m.name);
 const owner=current.owner_id===user?.id;

 return '<section class="sec-league-extras">'+
  '<div class="sec-mode-summary"><div class="card-kicker">GAME MODE</div><h3>'+shareName+'</h3><p>'+esc(m.detail)+'</p></div>'+
  '<button type="button" class="ghost-btn sec-league-honors-link" data-nav="trophies">🏆 Championships &amp; achievements are in your Trophy Case →</button>'+
  pairings()+
  '<div class="sec-reminder-box"><b>🔔 Pick reminders</b><p class="helper">Opt in for alerts while the app is open. Background push is not yet available.</p>'+
  '<button type="button" class="ghost-btn" data-extra="reminders">'+(localStorage.getItem("ss-sec-reminders")==="yes"?'Disable reminders':'Enable reminders')+'</button></div>'+
  (owner?'<div class="sec-manage"><b>League manager</b><p class="helper">Only the league creator can remove a member.</p>'+
   '<button type="button" class="ghost-btn" data-extra="rotate-code">Reset invite code</button><p class="helper">Use this after removing someone to invalidate the old invite link.</p>'+
   standings.filter(r=>r.user_id!==user.id).map(r=>'<div class="sec-manage-row"><span>'+esc(r.display_name)+'</span><button type="button" class="ghost-btn" data-extra="remove-member" data-user="'+esc(r.user_id)+'">Remove</button></div>').join('')+'</div>':'')+
  '</section>';
}
function setStandings(rows){standings=rows||[];window.SDSTrophyCase?.refreshHonors?.();}
function remind(){
 if(localStorage.getItem("ss-sec-reminders")!=="yes"||!user||!app)return;
 function send(key,message){
  if(sessionStorage.getItem(key))return;
  sessionStorage.setItem(key,"yes");
  app.toast(message);
  if("Notification" in window&&Notification.permission==="granted"){
   try{new Notification("Saturdays Down South",{body:message,tag:key});}catch(e){console.info("Notification unavailable",e);}
  }
 }
 const upcoming=app.week().games.filter(g=>isOpen(g)&&!own[g.id]&&Date.parse(leagueGame(g).kickoff_at||g.kickoff)-Date.now()<3*3600000);
 if(upcoming.length){
  send("ss-sec-upcoming-"+new Date().toISOString().slice(0,10)+"-"+current?.id,
   upcoming.length+" SEC pick"+(upcoming.length===1?" is":"s are")+" due within 3 hours.");
 }
 for(const g of app.week().games){
  const status=games[g.id];
  const updated=Date.parse(status?.score_updated_at||"");
  if(status?.game_status==="final"&&Number.isFinite(updated)&&Date.now()-updated<2*3600000){
    send("ss-sec-final-"+g.id,
      "Final: "+g.away+" "+status.away_score+" – "+status.home_score+" "+g.home+". Check the league results!");
  }
 }
 const rank=standings.findIndex(p=>p.user_id===user.id);
 if(rank>=0&&current){
  const key="ss-sec-rank-"+current.id+"-"+app.week().num;
  const previous=Number(localStorage.getItem(key));
  if(previous>0&&previous!==rank+1){
   send("ss-sec-rank-alert-"+key+"-"+(rank+1),
     "Your league ranking changed: now #"+(rank+1)+" this week.");
  }
  localStorage.setItem(key,String(rank+1));
 }
}
async function action(type,target){
 if(type==="reminders"){
  const next=localStorage.getItem("ss-sec-reminders")==="yes"?"no":"yes";
  if(next==="yes"&&"Notification" in window&&Notification.permission==="default"){
   await Notification.requestPermission();
  }
  localStorage.setItem("ss-sec-reminders",next);
  app.toast(next==="yes"?"Reminders enabled while the app is open.":"Reminders disabled.");
  app.setView("league");
  return;
 }
 if(!client||!current||!user)throw Error("Sign in and join a league first.");
 if(type==="save-total"){await saveTiebreaker();return;}
 if(type==="rotate-code"){
  if(current.owner_id!==user.id)return;
  if(!window.confirm("Reset invitation link for "+current.name+"? Old links will stop working."))return;
  err(await client.rpc("sec_rotate_league_invite",{p_league:current.id}));
  app.toast("Invite code reset. Share the new link.");return "refresh";
 }
 if(type==="remove-member"){
  const id=target?.dataset?.user;
  if(!id||current.owner_id!==user.id)return;
  if(!window.confirm("Remove this member from "+current.name+"?"))return;
  err(await client.rpc("sec_remove_league_member",{p_league:current.id,p_member:id}));
  app.toast("Member removed.");return "refresh";
 }
}
document.addEventListener("input",event=>{
 if(event.target?.id!=="sec-total-guess")return;
 const n=Number(event.target.dataset?.tieWeek);
 if(Number.isInteger(n))tieDrafts[n]=String(event.target.value);
});
document.addEventListener("click",event=>{
 const el=event.target.closest("[data-extra]");if(!el)return;
 event.preventDefault();event.stopImmediatePropagation();
 Promise.resolve(action(el.dataset.extra,el)).then(v=>{
  if(v==="refresh")window.secOnline?.refresh?.();
  else if(app?.view()==="league")app.setView("league");
 }).catch(error=>{app?.toast?.(error.message||"Unable to save.");});
},true);
window.SEC_FEATURES={MODES,control,updateGames,reload,extras,save,leagueDetails,leagueAchievements,setStandings,remind,getMode:mode,isUnavailable,pickResult,summaryPoints,modeDescription,shareSlip,tiebreakerCard,saveTiebreaker};
})();