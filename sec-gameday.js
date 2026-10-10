/* SEC Pick'em game-day layer: verified picks, provisional league outlook,
 * optional in-app alerts and shareable factual weekly recaps.
 * No paid AI calls, fake scores, or early disclosure of other members' picks. */
(()=>{
"use strict";
const root=id=>document.getElementById(id);
const bridge=()=>window.SEC_BRIDGE;
const me=()=>window.secOnline?.getUser?.();
const league=()=>window.SEC_LEAGUE_SETTINGS?.getSelected?.();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const score=v=>v!==null&&v!==undefined&&v!==""&&Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=999?Number(v):null;
const now=()=>Date.now(),started=g=>Number.isFinite(Date.parse(g.kickoff_at||g.kickoff))&&Date.parse(g.kickoff_at||g.kickoff)<=now();
const win=g=>{const a=score(g.away_score??g.awayScore),h=score(g.home_score??g.homeScore);
 const away=String(g.away_code||g.away),home=String(g.home_code||g.home);
 if(a===null||h===null||a===h)return null;
 return a>h?away:home;};
const status=g=>String(g.game_status||g.liveStatus||"scheduled").toLowerCase();
const confirmed=g=>status(g)==="final"&&win(g)!==null&&win(g)===String(g.winner||g.winner_code||"");
const period=g=>{const value=String(g.status_detail||g.statusDetail||"").trim();
 return value&&value.length<=42&&!/[<>]/.test(value)?value:"";};
const names={ALA:"Alabama",ARK:"Arkansas",AUB:"Auburn",FLA:"Florida",UGA:"Georgia",UK:"Kentucky",LSU:"LSU",
 MISS:"Ole Miss",MSST:"Mississippi State",MIZ:"Missouri",OU:"Oklahoma",SC:"South Carolina",TENN:"Tennessee",
 TEX:"Texas",TAMU:"Texas A&M",VAN:"Vanderbilt"};
const team=c=>names[c]||String(c||"Team");
const key=()=>me()?.id||"guest";
const alertBase=()=> "sec-fan-alerts-"+key();
const setting=()=>{try{return localStorage.getItem("sec-fan-alerts-"+key())==="on";}catch{return false;}};
const preference=type=>{try{return localStorage.getItem("sec-gameday-"+key()+"-"+type)!=="off";}catch{return true;}};
const seen=new Set();let messages=[],lastLeague="",lastWeek="",lastUser="",lastToast=0;
function resetIdentity(){
 const current=key();if(current===lastUser)return;
 lastUser=current;messages=[];seen.clear();lastLeague="";
 const box=root("sec-gameday-alerts");if(box)box.innerHTML="";
}
function recentUpdate(g,minutes=20){
 const stamp=g.score_updated_at||g.scoreUpdatedAt||g.updated_at;
 const at=Date.parse(stamp||"");
 return Number.isFinite(at)&&now()-at>=0&&now()-at<minutes*60000;
}
function recentKickoff(g,hours=12){
 const at=Date.parse(g.kickoff_at||g.kickoff||"");
 return Number.isFinite(at)&&now()-at>=0&&now()-at<hours*3600000;
}
function previouslySeen(id){
 try{return (JSON.parse(localStorage.getItem("sec-gameday-seen-"+key())||"[]")||[]).includes(id);}catch{return false;}
}
function markSeen(id){
 try{
  const k="sec-gameday-seen-"+key();
  const old=JSON.parse(localStorage.getItem(k)||"[]")||[];
  localStorage.setItem(k,JSON.stringify([...old.filter(x=>x!==id),id].slice(-180)));
 }catch{}
}
function announce(type,id,message){
 const token=type+":"+id;
 if(!setting()||!preference(type)||!me()||!id||seen.has(token)||previouslySeen(token))return;
 seen.add(token);markSeen(token);messages.unshift({type,id,message,time:now()});messages=messages.slice(0,12);
 if(document.visibilityState==="visible"){
  if(now()-lastToast>15000){bridge()?.toast?.(message);lastToast=now();}
 }
 else if("Notification" in window&&Notification.permission==="granted"){
  try{new Notification("SEC Pick'em",{body:message,tag:type+":"+id});}catch{}
 }
 showInbox();
}
function showInbox(){
 const el=root("sec-gameday-alerts");if(!el)return;
 if(!setting()||!messages.length){el.innerHTML="";return;}
 el.innerHTML='<details class="sec-day-notices"><summary>🔔 '+messages.length+' game-day update'+(messages.length===1?"":"s")+'</summary>'+
  '<div>'+messages.map(x=>'<p>'+esc(x.message)+'</p>').join("")+'</div></details>';
}
function footballGames(){
 const g=bridge()?.week?.()?.games||[];
 return g.map(x=>{const row=bridge()?.gameById?.[x.id]||x;return {...x,...row,
  game_status:row.liveStatus||row.game_status||"scheduled",
  away_code:x.away,home_code:x.home,away_score:row.awayScore??row.away_score,
  home_score:row.homeScore??row.home_score,winner:bridge()?.state?.()?.results?.[x.id]||row.winner,
  status_detail:row.statusDetail||row.status_detail,kickoff_at:row.kickoff||x.kickoff};});
}
function personalStatus(g,pick){
 if(!pick)return {label:"No pick",kind:"none"};
 if(confirmed(g))return pick===win(g)?{label:"✓ Correct",kind:"correct"}:{label:"✕ Missed",kind:"miss"};
 if(status(g)==="live"&&win(g))return pick===win(g)?{label:"↑ Leading live",kind:"leading"}:{label:"↓ Trailing live",kind:"trailing"};
 if(status(g)==="live")return {label:"= Tied live",kind:"live"};
 return {label:"◷ Upcoming",kind:"scheduled"};
}
function pickDashboard(){
 const el=root("sec-gameday-picks");if(!el)return;
 const picks=bridge()?.state?.()?.picks||{},games=footballGames();
 if(!games.length){el.innerHTML="";return;}
 const rows=games.map(g=>({g,chosen:picks[g.id],status:personalStatus(g,picks[g.id])}));
 const correct=rows.filter(r=>r.status.kind==="correct").length;
 const leading=rows.filter(r=>r.status.kind==="leading").length;
 const remaining=rows.filter(r=>!r.chosen&&status(r.g)==="scheduled").length;
 const relevant=rows.filter(r=>["live","final"].includes(status(r.g)));
 el.innerHTML='<section class="sec-day-summary" aria-label="Your live pick tracker">'+
  '<div class="sec-day-heading"><div><small>🏈 GAME DAY</small><h3>Your live picks</h3></div>'+
   '<span>Final results count · live leads are provisional</span></div>'+
  '<div class="sec-day-metrics">'+
   '<div><strong>'+correct+'</strong><small>Correct finals</small></div>'+
   '<div><strong>'+leading+'</strong><small>Winning live</small></div>'+
   '<div><strong>'+remaining+'</strong><small>Unpicked upcoming</small></div></div>'+
  (relevant.length?'<div class="sec-day-pick-list">'+relevant.slice(0,5).map(({g,chosen,status:choice})=>{
   const a=g.away_score,h=g.home_score;
   return '<div class="sec-day-pick-row"><span>'+esc(team(g.away))+' '+(score(a)??"–")+
    ' · '+(score(h)??"–")+' '+esc(team(g.home))+
    '<small>'+esc(period(g)||status(g).toUpperCase())+' · Pick: '+esc(chosen?team(chosen):"None")+'</small></span>'+
    '<b class="is-'+choice.kind+'">'+esc(choice.label)+'</b></div>';
  }).join("")+'</div>':"")+
  '</section>';
 if(setting()){
  const userId=key();
  for(const {g,chosen,status:choice} of rows){
   if(status(g)==="live"&&recentUpdate(g)&&recentKickoff(g,0.5))
    announce("kickoff",userId+":"+g.id,"🔴 "+team(g.away)+" vs "+team(g.home)+" is underway.");
   if(confirmed(g)&&recentUpdate(g)&&recentKickoff(g,12)&&chosen)
    announce("final",userId+":"+g.id,"Final: "+team(win(g))+" won. Your pick was "+(choice.kind==="correct"?"correct.":"incorrect."));
   if(confirmed(g)&&recentUpdate(g)&&recentKickoff(g,12)){
    const alert=window.SEC_LEAGUE_INSIGHTS?.upset?.(g,"football");
    if(alert?.label?.includes("UNDERDOG WIN"))
     announce("upset",userId+":"+g.id,"Upset final: "+team(win(g))+" wins.");
   }
  }
 }
}
function sportsStatus(s){
 const state=window.SEC_SPORTS?.getState?.(s)||{};
 const picks=state.picks||{};
 return (state.games||[]).filter(g=>g.sport===s&&g.season===window.SEC_SPORTS?.year?.(s))
  .map(g=>({g,chosen:picks[g.id]?.pick_code,status:personalStatus(g,picks[g.id]?.pick_code)}));
}
function renderSport(s){
 const el=root("sec-day-"+s);if(!el)return;
 const rows=sportsStatus(s),active=rows.filter(r=>status(r.g)==="live");
 const finished=rows.filter(r=>r.status.kind==="correct").length;
 const leader=active.filter(r=>r.status.kind==="leading").length;
 const next=rows.filter(r=>status(r.g)==="scheduled"&&!r.chosen).length;
 el.innerHTML='<div class="sec-day-sport"><strong>📈 My '+esc(s)+" picks</strong><span>"+
  finished+' correct finals · '+leader+' leading live · '+next+' still unpicked</span></div>';
 for(const {g,chosen,status:choice} of rows){
  if(!setting()||!chosen||!confirmed(g)||!recentUpdate(g)||!recentKickoff(g,12))continue;
  announce("final",key()+":"+g.id,"Final: "+(g.away_name||team(g.away_code))+" vs "+(g.home_name||team(g.home_code))+
   ". Your "+s+" pick was "+(choice.kind==="correct"?"correct.":"incorrect."));
 }
}
function leagueOutlook(){
 const el=root("sec-day-league");if(!el)return;
 const item=league(),data=window.SEC_BRAG_ARENA?.getData?.(item),rows=window.SEC_POWER?.getRows?.(item)||[];
 const signature=item&&key()+":"+item.kind+":"+item.id;
 if(!item||!me()){el.innerHTML="";lastLeague="";return;}
 if(lastLeague!==signature){el.innerHTML="";lastLeague=signature;}
 if(!data){el.innerHTML='<details class="sec-day-league"><summary>📊 Live league outlook <small>Open Brags for verified league picks</small></summary>'+
  '<p>Official standings are available below. Live pick comparisons load for league members after kickoff.</p></details>';return;}
 // The RPC is member-gated, and its picks are server-filtered by kickoff.
 const active=data.games.filter(g=>status(g)==="live"&&started(g)&&win(g)!==null);
 if(!active.length){el.innerHTML="";return;}
 const projected=data.players.map(p=>{
  const leads=active.reduce((sum,g)=>sum+Number(data.picks.some(x=>x.user_id===p.user_id&&
   x.game_id===g.id&&x.pick_code===win(g))),0);
  const official=rows.find(r=>r.user_id===p.user_id);
  return {name:p.display_name||"Player",leads,rank:official?.current_rank??null,
   points:official?.season_points??null};
 }).sort((a,b)=>b.leads-a.leads||String(a.name).localeCompare(String(b.name)));
 el.innerHTML='<section class="sec-day-league" aria-label="League picks leading live">'+
  '<div class="sec-day-heading"><div><small>🔴 LIVE LEAGUE OUTLOOK</small><h3>Who is calling the games?</h3></div><span>'+
   active.length+' ongoing game'+(active.length===1?"":"s")+'</span></div>'+
  '<div class="sec-day-rankings">'+projected.slice(0,8).map(p=>'<div><span>'+esc(p.name)+
   (p.rank!=null?' <small>Official #'+esc(p.rank)+'</small>':"")+'</span>'+
   '<strong>'+p.leads+' <small>leading pick'+(p.leads===1?"":"s")+'</small></strong></div>').join("")+'</div>'+
  '<small>Live-call order is provisional and does not change official league rankings or award points. '+
   'Only picks locked before kickoff are counted.</small></section>';
}
function previousRivalry(){
 const m=window.SEC_BRAG_ARENA?.getModel?.(),el=root("sec-day-rivalry");
 if(!el)return;
 if(!m||!me()){el.innerHTML="";return;}
 const monday=window.SEC_BRAG_ARENA?.texasWeek?.();
 if(!monday)return;
 const prior=new Date((monday.start-7)*86400000+18*3600000);
 const pair=window.SEC_BRAG_ARENA?.weeklyPairing?.([...m.players.values()],me().id,prior);
 if(!pair?.opponent){el.innerHTML="";return;}
 const other=m.players.get(pair.opponent);
 if(!other){el.innerHTML="";return;}
 const round=window.SEC_BRAG_ARENA?.weeklyMatch?.(m,me().id,other.user_id,prior);
 if(!round?.finals){el.innerHTML="";return;}
 const winLabel=round.my>round.their?"🏆 Weekly rivalry win":round.my<round.their?"⚔️ Rival won last week":"🤝 Weekly rivalry tie";
 el.innerHTML='<section class="sec-day-rivalry"><strong>'+winLabel+'</strong>'+
   '<span>'+esc(m.players.get(me().id)?.display_name||"You")+' '+round.my+'–'+round.their+
   ' '+esc(other.display_name||"Rival")+'</span>'+
   '<button type="button" data-day-share="rival">↗ Share result</button></section>';
 if(setting()&&round.my>round.their&&now()-(monday.start*86400000)<24*3600000)
  announce("rival",key()+":"+pair.start+":"+pair.opponent,"You won last week's SEC pick rivalry!");
}
async function shareText(text){
 if(!text)return;
 try{
  if(typeof navigator.share==="function"){await navigator.share({title:"SEC Pick'em",text});return;}
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);bridge()?.toast?.("Recap copied to share.");return;}
 }catch(e){if(e?.name==="AbortError")return;}
 bridge()?.toast?.("Sharing unavailable. Use your browser's copy feature.");
}
function recapText(){
 const items=footballGames(),picks=bridge()?.state?.()?.picks||{};
 const finals=items.filter(g=>confirmed(g)&&picks[g.id]);
 const correct=finals.filter(g=>picks[g.id]===win(g)).length;
 const rank=window.SEC_POWER?.getRows?.(league())?.find?.(x=>x.user_id===me()?.id);
 const movement=rank?.previous_rank!=null?Number(rank.previous_rank)-Number(rank.current_rank):null;
 const upsets=finals.filter(g=>picks[g.id]===win(g)&&window.SEC_LEAGUE_INSIGHTS?.upset?.(g,"football")?.label?.includes("UNDERDOG WIN"));
 const misses=finals.filter(g=>picks[g.id]!==win(g));
 const parts=["🏈 SEC Pick'em weekly recap",correct+"/"+finals.length+" confirmed picks correct"];
 if(upsets.length)parts.push("⚡ Upset called: "+team(win(upsets[0])));
 if(misses.length)parts.push("😬 Tough miss: "+team(misses[0].away)+" vs "+team(misses[0].home));
 if(rank&&Number(rank.season_graded)>0){
  parts.push("🏆 Official league rank: #"+rank.current_rank);
  if(movement!=null)parts.push("Ranking movement: "+(movement>0?"up "+movement:movement<0?"down "+(-movement):"unchanged"));
 }
 parts.push("Results verified; no live leads counted as wins.");
 return parts.join("\n");
}
function shareWeekly(){
 const el=root("sec-day-recap");if(!el)return;
 const games=footballGames(),finals=games.filter(g=>confirmed(g)),picks=bridge()?.state?.()?.picks||{};
 const total=finals.filter(g=>picks[g.id]).length,correct=finals.filter(g=>picks[g.id]===win(g)).length;
 el.innerHTML='<section class="sec-day-recap"><div><small>📣 WEEKLY PICK RECEIPT</small>'+
  '<strong>'+correct+' / '+total+' confirmed picks called correctly</strong>'+
  '<span>Your recap updates when official final results arrive.</span></div>'+
  '<button type="button" data-day-share="week">↗ Share recap</button></section>';
}
function settings(){
 const el=root("sec-day-alert-settings");if(!el)return;
 const types=[["kickoff","Kickoff"],["final","Final scores"],["upset","Upset results"],["rival","Weekly rivalry wins"]];
 el.innerHTML='<div class="sec-day-alert-options"><p>Choose what to hear about while SEC Pick’em is open:</p>'+
  types.map(([id,label])=>'<label><input type="checkbox" data-day-alert="'+id+'" '+
   (preference(id)?"checked ":"")+'/> '+label+'</label>').join("")+
   '<small>Uses your existing opt-in alert switch. No background push or paid service.</small></div>';
}
function refresh(){resetIdentity();pickDashboard();leagueOutlook();previousRivalry();shareWeekly();showInbox();}
document.addEventListener("click",e=>{
 const b=e.target.closest?.("[data-day-share]");if(!b)return;
 e.preventDefault();
 if(b.dataset.dayShare==="week")void shareText(recapText());
 if(b.dataset.dayShare==="rival"){
  const m=window.SEC_BRAG_ARENA?.getModel?.();if(!m||!me())return;
  const wk=window.SEC_BRAG_ARENA.texasWeek(),prior=new Date((wk.start-7)*86400000+18*3600000);
  const pair=window.SEC_BRAG_ARENA.weeklyPairing([...m.players.values()],me().id,prior);
  if(!pair?.opponent)return;
  const other=m.players.get(pair.opponent),round=window.SEC_BRAG_ARENA.weeklyMatch(m,me().id,pair.opponent,prior);
  void shareText("⚔️ SEC weekly head-to-head: "+round.my+"–"+round.their+" against "+
   (other?.display_name||"my rival")+". "+(round.my>round.their?"I WON!":round.my<round.their?"Rematch next week!":"It's a tie!")+
   " Verified picks only · SEC Pick'em");
 }
});
document.addEventListener("change",e=>{
 const type=e.target?.dataset?.dayAlert;
 if(!["kickoff","final","upset","rival"].includes(type))return;
 try{localStorage.setItem("sec-gameday-"+key()+"-"+type,e.target.checked?"on":"off");}catch{}
});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh();});
window.SEC_GAMEDAY=Object.freeze({refresh,pickDashboard,renderSport,leagueOutlook,previousRivalry,shareWeekly,recapText,settings,personalStatus,confirmed,period});
Promise.resolve().then(()=>{if(bridge()?.view?.()==="picks")refresh();});
})();