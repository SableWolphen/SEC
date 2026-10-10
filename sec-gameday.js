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
const number=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
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
/* The live outlook is a read-only combination of two independently updated
 * sources: public scores from the 30-second sync and member-only post-kickoff
 * picks from the secured Supabase RPC. A 2-minute Brags cache is NOT a live
 * score feed. Never reveal a pick before its verified kickoff timestamp. */
const outlookPrivate=new Map(),outlookInflight=new Set();
let outlookRequestedAt=new Map();
const leagueKey=(i,u)=>u?.id+":"+i?.kind+":"+i?.id;
function outlookData(item){
 const id=leagueKey(item,me()),latest=outlookPrivate.get(id);
 return latest?.data||window.SEC_BRAG_ARENA?.getData?.(item)||null;
}
function updateOutlookPicks(item){
 const c=window.secOnline?.getClient?.(),u=me(),signature=leagueKey(item,u);
 if(!item?.id||!u||!c||bridge()?.view?.()!=="league"||document.visibilityState==="hidden")return;
 const previous=outlookRequestedAt.get(signature)||0;
 if(outlookInflight.has(signature)||now()-previous<45000)return;
 outlookRequestedAt.set(signature,now());outlookInflight.add(signature);
 void (async()=>{
  try{
   const result=await c.rpc("sec_brags_locker_room",{p_kind:item.kind,p_league:item.id});
   if(result?.error)throw result.error;
   if(leagueKey(league(),me())!==signature)return;
   const data=result?.data;
   if(!data||!Array.isArray(data.players)||!Array.isArray(data.games)||!Array.isArray(data.picks))
    throw Error("Missing verified league picks");
   outlookPrivate.set(signature,{data,at:now()});
   leagueOutlook();
  }catch(e){
   console.info("Live league picks unavailable; keeping previous confirmed snapshot:",e?.message||"Unavailable");
  }finally{outlookInflight.delete(signature);}
 })();
}
function currentLiveGame(g){
 if(g?.sport==="football"){
  const latest=bridge()?.gameById?.[g.id];
  if(latest){
   return {...g,game_status:latest.liveStatus||latest.game_status||g.game_status,
    away_score:latest.awayScore??latest.away_score??g.away_score,
    home_score:latest.homeScore??latest.home_score??g.home_score,
    status_detail:latest.statusDetail||latest.status_detail||g.status_detail,
    score_updated_at:latest.scoreUpdatedAt||latest.score_updated_at||g.score_updated_at,
    kickoff_at:latest.kickoff||latest.kickoff_at||g.kickoff_at,
    winner:latest.winner||g.winner};
  }
 }
 return g;
}
function liveLeagueGames(item,data){
 // Include every public live football matchup, even 0–0 ties and matchups
 // without any private league picks. The member-gated RPC only lists games
 // with saved picks; treating it as a scoreboard caused the stale game count.
 const all=new Map();
 if(item.kind==="football"||item.kind==="club"&&item.sports?.includes("football")){
  for(const g of footballGames()){
   if(status(g)!=="live"||!started(g))continue;
   all.set(g.id,{...g,sport:"football"});
  }
 }
 for(const original of data?.games||[]){
  if(item.kind==="football"&&original.sport!=="football")continue;
  if(item.kind==="club"&&Array.isArray(item.sports)&&!item.sports.includes(original.sport))continue;
  const g=currentLiveGame(original);
  if(status(g)==="live"&&started(g))all.set(g.id,g);
  else all.delete(g.id);
 }
 return [...all.values()].sort((a,b)=>Date.parse(a.kickoff_at||"")-Date.parse(b.kickoff_at||""));
}
function liveOutlookModel(item,data,power,clubs,uid){
 const active=liveLeagueGames(item,data);
 const picks=(data?.picks||[]).filter(p=>typeof p?.user_id==="string"&&typeof p?.game_id==="string");
 const lookup=new Map(picks.map(p=>[p.user_id+"|"+p.game_id,p.pick_code]));
 const official=new Map((item.kind==="club"?clubs:power).map(r=>[r.user_id,r]));
 const modes=new Set((data?.games||[]).filter(g=>g.sport==="football").map(g=>g.mode).filter(Boolean));
 const mode=item.kind==="football"?window.SEC_FEATURES?.getMode?.()||[...modes][0]:[...modes][0];
 const allOnePoint=["straight","h2h"].includes(mode)&&[...modes].every(m=>["straight","h2h"].includes(m));
 const rows=(data?.players||[]).filter(p=>p?.user_id).map(p=>{
  const leads=active.reduce((sum,g)=>sum+Number(lookup.get(p.user_id+"|"+g.id)===win(g)&&win(g)!==null),0);
  const entered=active.reduce((sum,g)=>sum+Number(lookup.has(p.user_id+"|"+g.id)),0);
  const officialRow=official.get(p.user_id);
  const officialPoints=number(item.kind==="club"?officialRow?.total:officialRow?.season_points);
  return {id:p.user_id,name:String(p.display_name||"Player"),leads,entered,
   officialRank:officialRow?.current_rank??null,
   officialPoints,projected:allOnePoint&&officialPoints!==null?officialPoints+leads:null,
   self:p.user_id===uid};
 });
 const projected=rows.length>0&&rows.every(r=>r.projected!==null);
 rows.sort((a,b)=>projected?b.projected-a.projected||b.leads-a.leads||a.name.localeCompare(b.name):
  b.leads-a.leads||a.name.localeCompare(b.name));
 // Equal projected points mean equal provisional position; do not invent a
 // tiebreaker. Official standings handle their actual verified tiebreakers.
 for(let i=0;i<rows.length;i++)rows[i].liveRank=projected?
  1+rows.filter(r=>r.projected>rows[i].projected).length:null;
 return {active,rows,projected};
}
function leagueOutlook(){
 const el=root("sec-day-league");if(!el)return;
 const item=league(),u=me();
 const signature=item&&leagueKey(item,u);
 if(!item||!u){el.innerHTML="";lastLeague="";return;}
 if(lastLeague!==signature){el.innerHTML="";lastLeague=signature;}
 const data=outlookData(item);
 const rows=window.SEC_POWER?.getRows?.(item)||[];
 const clubs=window.SEC_LEAGUE_SETTINGS?.getStandings?.()||[];
 const model=liveOutlookModel(item,data,rows,clubs,u.id);
 if(!model.active.length){el.innerHTML="";return;}
 // Request a new *member-gated* snapshot every 45s while on the League tab.
 // Public live game status/score is always taken directly from the score feed.
 updateOutlookPicks(item);
 const earlier=el.querySelector?.("[data-live-league-all]")?.open||false;
 const ranked=model.rows,shown=ranked.slice(0,3);
 const meRow=ranked.find(r=>r.self);
 if(meRow&&!shown.includes(meRow))shown.push(meRow);
 const others=ranked.filter(r=>!shown.includes(r));
 const title=model.projected?"Provisional league leaders":"Live leading picks";
 const viewed=()=>shown.map(r=>'<div class="sec-live-race-row'+(r.self?" is-you":"")+'">'+
   '<span class="sec-live-race-name">'+(model.projected?'<b>#'+r.liveRank+'</b> ':'')+
   esc(r.name)+(r.self?' ★':'')+
   (r.officialRank!=null?'<small>Official #'+esc(r.officialRank)+'</small>':"")+'</span>'+
   '<strong>'+r.leads+' <small>leading'+(r.leads===1?" pick":" picks")+'</small></strong>'+
   '</div>').join("");
 const extra=others.length?'<details class="sec-live-race-more" data-live-league-all'+(earlier?" open":"")+'>'+
  '<summary>See '+others.length+' more league member'+(others.length===1?"":"s")+'</summary>'+
  '<div class="sec-day-rankings">'+others.map(r=>
   '<div class="sec-live-race-row'+(r.self?" is-you":"")+'"><span class="sec-live-race-name">'+
   (model.projected?'<b>#'+r.liveRank+'</b> ':'')+esc(r.name)+
   (r.officialRank!=null?'<small>Official #'+esc(r.officialRank)+'</small>':"")+
   '</span><strong>'+r.leads+' <small>leading pick'+(r.leads===1?"":"s")+'</small></strong></div>').join("")+
  '</div></details>':"";
 const lines=model.active.slice(0,3).map(g=>{
  const a=score(g.away_score??g.awayScore),h=score(g.home_score??g.homeScore);
  const state=period(g);
  return '<span class="sec-live-race-score">'+esc(g.away_code||g.away)+' <b>'+
   (a===null?"–":a)+'–'+(h===null?"–":h)+'</b> '+esc(g.home_code||g.home)+
   (state?' · '+esc(state):'')+'</span>';
 }).join("");
 const recent=model.active.map(g=>Date.parse(g.score_updated_at||g.scoreUpdatedAt||""))
  .filter(Number.isFinite);
 const updated=recent.length?Math.max(...recent):null,delay=updated!=null?now()-updated:Infinity;
 const fresh=delay>=0&&delay<=5*60000;
 el.innerHTML='<section class="sec-day-league" aria-label="Live league results and provisional picks">'+
  '<div class="sec-day-heading"><div><small>🔴 LIVE LEAGUE OUTLOOK</small>'+
  '<h3>'+title+'</h3></div><span>'+model.active.length+' live game'+
  (model.active.length===1?"":"s")+'</span></div>'+
  '<div class="sec-live-race-scores">'+lines+'</div>'+
  (ranked.length?'<div class="sec-day-rankings">'+viewed()+'</div>'+extra:
   '<p class="sec-live-race-note">Loading post-kickoff league picks…</p>')+
  '<small class="sec-live-race-note">'+(model.projected?
   'Provisional = official points + live leading picks · not awarded until final.':
   'Provisional live leading-pick counts, not projected ranks · final results determine standings.')+
  (fresh?' · Scores updated '+Math.max(0,Math.floor(delay/1000))+'s ago':
   ' · Waiting for next score update')+'</small></section>';
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