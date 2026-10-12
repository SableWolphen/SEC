/* Saturdays Down South — optional advanced play tools.
   All competitive figures come from scoped, authorized, verified data.
   Never publish another member's pre-lock picks or invent a final. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const app=()=>window.SEC_BRIDGE;
const db=()=>window.secOnline?.getClient?.();
const user=()=>window.secOnline?.getUser?.();
const selected=()=>window.SEC_LEAGUE_SETTINGS?.getSelected?.();
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const wk=()=>app()?.week?.();
const games=()=>wk()?.games||[];
const picks=()=>app()?.state?.()?.picks||{};
const isPicked=g=>picks()[g.id]===g.home||picks()[g.id]===g.away;
const isOpen=g=>!app()?.isLocked?.(g)&&!window.SEC_FEATURES?.isUnavailable?.(g);
const scope=()=>String(user()?.id||"guest")+"|"+String(selected()?.kind||"none")+"|"+String(selected()?.id||"none");
const notice=x=>app()?.toast?.(x);
const number=n=>Number.isFinite(Number(n))?Number(n):0;
let quickIndex=0,quickOpen=false,trendScope="",challengeScope="",trends=[],challenges=[],challengeError="",loadingTrends=false,loadingChallenges=false;
const brand=()=>window.SEC_PRIDE?.getCode?.()||app()?.state?.()?.favorite||"SEC";
const league=()=>selected();
function rankedName(code){return window.SEC_PRIDE?.names?.[code]||code;}
function verified(g){
 const d=window.SEC_FEATURES?.finalData?.(g);
 if(!d||!["won","lost","push"].includes(window.SEC_FINAL_CARDS?.outcome?.(d)?.kind))return null;
 const k=window.SEC_FINAL_CARDS.outcome(d).kind;
 return {g,d,kind:k};
}
function weekStats(){
 const items=games().map(verified).filter(Boolean);
 return {items,wins:items.filter(x=>x.kind==="won").length,losses:items.filter(x=>x.kind==="lost").length,pushes:items.filter(x=>x.kind==="push").length};
}
function nameCode(code){return '<span class="secnext-school" data-sds-school="'+esc(code)+'">'+
 (window.SDS_VISUALS?.mark?.(code,{className:"mini-logo"})||esc(code))+
 '<strong>'+esc(rankedName(code))+'</strong></span>';}
function matchup(g){
 const entry=(side,code)=>'<button type="button" data-next-choice="'+esc(code)+'" data-next-game="'+esc(g.id)+
 '" class="secnext-choice" data-sds-school="'+esc(code)+'">'+nameCode(code)+'</button>';
 return '<div class="secnext-quick-game"><span>WEEK '+esc(wk()?.num||"—")+' · PICK THE WINNER</span>'+
 '<div class="secnext-pair">'+entry("away",g.away)+'<b>VS</b>'+entry("home",g.home)+'</div>'+
 '<small>Locks at the verified kickoff · changes allowed before lock</small></div>';
}
const pending=()=>games().filter(g=>!isPicked(g)&&isOpen(g));
function openQuick(){
 const dialog=$("sec-next-dialog");
 if(!dialog)return;
 quickIndex=0;quickOpen=true;updateQuick();
 if(typeof dialog.showModal==="function"&&!dialog.open)dialog.showModal();
 else dialog.setAttribute("open","");
}
function closeQuick(){
 const d=$("sec-next-dialog");quickOpen=false;
 if(d?.open&&typeof d.close==="function")d.close();else d?.removeAttribute("open");
}
function updateQuick(){
 const d=$("sec-next-dialog"),content=$("sec-next-quick-content");if(!d||!content)return;
 const available=pending();
 if(quickIndex>=available.length)quickIndex=0;
 content.innerHTML=available.length?'<div class="secnext-quick-progress">'+(games().length-available.length)+
 ' / '+games().length+' selected</div>'+matchup(available[quickIndex]):
 '<div class="secnext-done"><strong>All available matchups are picked.</strong>'+
 '<p>Locked games cannot be changed. You can still review the full slate.</p>'+
 '<button type="button" data-next-close>Back to my picks</button></div>';
}
async function chooseQuick(gid,code){
 const g=games().find(x=>x.id===gid);
 if(!g||![g.away,g.home].includes(code)||!isOpen(g)){notice("This matchup is locked or unavailable.");updateQuick();return;}
 try{
  if(window.secOnline?.configured===true){
   if(!user()||!window.secOnline?.getLeague?.()){notice("Join a football league and sign in to save this pick.");return;}
   await window.secOnline.pick(g,code);
  }else{
   // Delegate to the original persisted-pick handler; never change state without saving.
   const original=[...document.querySelectorAll("#games-list [data-pick],#hero-slot [data-pick]")]
    .find(el=>el.dataset.pick===gid&&el.dataset.team===code);
   if(!original){notice("Open All games to make this selection.");closeQuick();return;}
   original.click();
  }
  updateQuick();
 }catch(e){notice(e?.message||"Couldn't save your pick.");}
}
function intelligence(g){
 const rec=code=>window.SEC_TEAM_RECORDS?.entry?.(code,"football")?.overall||"Not available";
 const hasPoll=window.SEC_RANKINGS?.hasCurrent?.("football");
 const rank=code=>hasPoll?window.SEC_RANKINGS?.rank?.(code,"football"):null;
 const history=app()?.weeks?.flatMap(w=>w.games)||[];
 const completed=history.filter(h=>(h.home===g.home&&h.away===g.away||
  h.home===g.away&&h.away===g.home)&&h.id!==g.id)
  .filter(h=>h.liveStatus==="final"&&h.homeScore!=null&&h.awayScore!=null&&Number(h.homeScore)!==Number(h.awayScore))
  .slice(-3);
 return '<details class="secnext-intelligence"><summary>Compare teams <span aria-hidden="true">⌄</span></summary>'+
  '<div class="secnext-comparison">'+[g.away,g.home].map(code=>
   '<div data-sds-school="'+esc(code)+'">'+nameCode(code)+
   '<span>Season: <strong>'+esc(rec(code))+'</strong></span>'+
   '<span>AP ranking: <strong>'+(hasPoll?(rank(code)?"#"+rank(code):"Not ranked"):"No current verified poll")+'</strong></span></div>').join("")+
  '</div><p class="secnext-footnote">Records and rankings are sourced from the current verified feeds. They are not predictions.</p>'+
  (completed.length?'<p class="secnext-footnote">Recent confirmed meetings in the available schedule: '+
   completed.map(h=>esc(h.away)+' '+number(h.awayScore)+'–'+number(h.homeScore)+' '+esc(h.home)).join("; ")+
   '</p>':"")+'</details>';
}
function onPicks(){
 const root=$("sec-next-picks");
 if(root){
  const n=pending().length;
  root.innerHTML='<div class="secnext-picks-bar"><div><strong>Quick Pick</strong><small>'+n+
   ' matchups still need a pick</small></div><button type="button" data-next-quick '+(!n?'disabled':'')+
   '>Start Quick Pick →</button></div>';
 }
 for(const card of document.querySelectorAll("#games-list .game-card[data-game-id]")){
  const g=games().find(x=>x.id===card.dataset.gameId);
  if(g&&!card.querySelector(".secnext-intelligence"))card.insertAdjacentHTML("beforeend",intelligence(g));
 }
 if(quickOpen)updateQuick();
}
function career(){
 const weeks=app()?.weeks||[];
 const rows=weeks.flatMap(w=>w.games.map(g=>({...g,week:w.num}))).map(g=>{
  const x=verified(g);return x?{...x,week:g.week}:null;
 }).filter(Boolean);
 let streak=0,longest=0;
 const byWeek=new Map();
 for(const r of rows){
  const cur=byWeek.get(r.week)||{wins:0,graded:0};
  if(r.kind==="won"){cur.wins++;streak++;longest=Math.max(longest,streak);}
  else if(r.kind==="lost")streak=0;
  cur.graded++;byWeek.set(r.week,cur);
 }
 const best=[...byWeek.entries()].sort((a,b)=>b[1].wins-a[1].wins)[0];
 return {graded:rows.length,wins:rows.filter(x=>x.kind==="won").length,
  losses:rows.filter(x=>x.kind==="lost").length,pushes:rows.filter(x=>x.kind==="push").length,
  best:best?"Week "+best[0]+" · "+best[1].wins+" wins":"Not yet",longest,season:2026};
}
function recap(){
 const {items,wins,losses,pushes}=weekStats();
 const ungraded=games().length-items.length;
 const top=items.find(x=>x.kind==="won"&&window.SEC_LEAGUE_INSIGHTS?.upset?.(x.g,"football")?.label==="⚡ UNDERDOG WIN");
 return '<p>'+esc(wk()?.num?"Week "+wk().num:"Current week")+": "+wins+
 ' correct, '+losses+' incorrect'+(pushes?', '+pushes+' pushes':'')+
 ', '+ungraded+' not yet graded.</p>'+
 (top?'<p>⚡ Sourced upset called: <strong>'+esc(rankedName(top.g.away))+
  ' vs '+esc(rankedName(top.g.home))+'</strong>.</p>':"")+
 '<small>Only source-verified final games and scored picks are included.</small>';
}
function onResults(){
 const el=$("sec-next-results");if(!el)return;
 const c=career(),local=window.secOnline?.configured!==true;
 el.innerHTML='<details class="secnext-fold" open><summary>📈 Pick’em Career <small>2026 football</small></summary>'+
 '<div class="secnext-metrics">'+[
 ["Accuracy",c.graded?Math.round(100*c.wins/c.graded)+"%":"—"],
 ["Correct",c.wins],["Best week",c.best],["Longest streak",c.longest]
 ].map(([n,v])=>'<div><small>'+n+'</small><strong>'+esc(v)+'</strong></div>').join("")+'</div>'+
 '<p class="secnext-footnote">'+(local?"Device-only results, not a synchronized career record.":
 "Current season and selected football league only. Prior seasons are not in this data source.")+'</p></details>'+
 '<details class="secnext-fold"><summary>📰 Your Week in Review</summary><div class="secnext-fold-body">'+recap()+'</div></details>'+
 '<div class="secnext-share"><span>🎨 Share a victory card made from your confirmed results</span>'+
 '<button type="button" data-next-victory>Make victory card ↗</button></div>';
}
function cardCanvas(){
 const c=career(),s=weekStats(),canvas=document.createElement("canvas");
 canvas.width=1080;canvas.height=1350;
 const x=canvas.getContext("2d");if(!x){notice("Image creation isn't supported on this device.");return;}
 const colors={ALA:"#9E1B32",ARK:"#9D2235",AUB:"#0C2340",FLA:"#0021A5",UGA:"#BA0C2F",
 UK:"#0033A0",LSU:"#461D7C",MISS:"#CE1126",MSST:"#660000",MIZ:"#F1B82D",
 OU:"#841617",SC:"#73000A",TENN:"#FF8200",TEX:"#BF5700",TAMU:"#500000",VAN:"#101010"};
 const code=brand();
 x.fillStyle="#071725";x.fillRect(0,0,1080,1350);
 x.fillStyle=colors[code]||"#19344a";x.fillRect(0,0,1080,24);
 x.fillStyle="#F7DAA3";x.font="bold 40px system-ui";x.fillText("SATURDAYS DOWN SOUTH",75,120);
 x.font="30px system-ui";x.fillStyle="#bcd1e0";x.fillText("SEC PICK’EM  •  2026 FOOTBALL",75,178);
 x.fillStyle=colors[code]||"#254a61";x.fillRect(75,260,930,210);
 x.fillStyle=(code==="MIZ"||code==="TENN")?"#161b1f":"#fff";
 x.font="bold 110px system-ui";x.fillText(code,105,397);
 x.fillStyle="#f1f4f8";x.font="bold 54px system-ui";x.fillText("WEEK "+String(wk()?.num||"—")+" RESULTS",75,575);
 x.font="bold 165px system-ui";x.fillStyle="#f1d39b";x.fillText(String(s.wins),78,796);
 x.font="42px system-ui";x.fillStyle="#b6cbdc";x.fillText("CORRECT PICKS",75,863);
 x.fillStyle="#163249";x.fillRect(75,923,930,185);
 x.fillStyle="#ffffff";x.font="bold 55px system-ui";x.fillText("2026: "+(c.graded?Math.round(100*c.wins/c.graded)+"%":"—"),105,1005);
 x.font="32px system-ui";x.fillStyle="#c6d8e6";x.fillText("Verified pick accuracy • "+c.graded+" graded",105,1060);
 x.fillStyle="#98afc0";x.font="28px system-ui";x.fillText("Confirmed results only • Unofficial fan app",75,1238);
 canvas.toBlob(async blob=>{
  if(!blob){notice("Could not generate the image.");return;}
  const file=new File([blob],"sds-pickem-week-"+(wk()?.num||"x")+".png",{type:"image/png"});
  try{
   if(navigator.canShare?.({files:[file]})&&navigator.share)await navigator.share({files:[file],title:"My SEC Pick’em results"});
   else{const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  }catch(e){if(e.name!=="AbortError")notice("Could not share this card.");}
 },"image/png");
}
async function loadTrends(){
 const el=$("sec-next-trends"),l=league(),u=user(),c=db();
 if(!el)return;
 if(!u||!l||!c||!["football","club"].includes(l.kind)){
  el.innerHTML='<p class="secnext-footnote">Choose a football league and sign in to see its picks after kickoff.</p>';return;
 }
 if(loadingTrends)return;
 const identity=scope();loadingTrends=true;
 el.innerHTML='<p class="secnext-footnote">Checking locked league picks…</p>';
 const started=games().filter(g=>{const t=Date.parse(g.kickoff||"");return Number.isFinite(t)&&t<=Date.now();}).slice(0,4);
 const list=[];
 for(const g of started){
  try{
   const r=await c.rpc("sec_league_game_pulse",{p_kind:l.kind,p_league:l.id,p_sport:"football",p_game:g.id});
   if(scope()!==identity)return;
   const p=Array.isArray(r.data)?r.data[0]:null;
   if(!r.error&&p?.locked===true)list.push({g,p});
  }catch(_){}
 }
 if(scope()!==identity)return;
 trends=list;trendScope=identity;loadingTrends=false;
 el.innerHTML=list.length?list.map(({g,p})=>{
  const a=number(p.away_picks),h=number(p.home_picks),n=a+h,pct=n?Math.round(100*a/n):0;
  return '<div class="secnext-trend"><div class="secnext-row"><strong>'+esc(g.away)+' vs '+esc(g.home)+'</strong>'+
   '<small>'+n+' revealed picks</small></div><div class="secnext-track"><i style="width:'+pct+'%"></i></div>'+
   '<div class="secnext-row"><small>'+esc(g.away)+' '+a+' ('+pct+'%)</small><small>'+esc(g.home)+' '+h+' ('+(100-pct)+'%)</small></div></div>';
 }).join(""):'<p class="secnext-footnote">League pick trends appear only after kickoff, with verified membership.</p>';
}
function race(){
 const l=league(),u=user(),rows=l?.kind==="club"?
 (window.SEC_LEAGUE_SETTINGS?.getStandings?.()||[]):(window.secOnline?.getStandings?.()||[]);
 if(!l||!u||!rows.length)return '<p class="secnext-footnote">Join a league to see the championship race.</p>';
 const points=r=>number(l.kind==="club"?r.total:r.season_points);
 const ranked=rows.slice().sort((a,b)=>points(b)-points(a));
 const me=ranked.findIndex(r=>r.user_id===u.id);
 if(me<0)return '<p class="secnext-footnote">Your current league ranking is unavailable.</p>';
 const leader=points(ranked[0]),mine=points(ranked[me]),gap=Math.max(0,leader-mine);
 const open=games().filter(g=>!window.SEC_FEATURES?.finalData?.(g)).length;
 const simple=l.kind==="football"&&["straight","h2h"].includes(l.detail?.mode||window.secOnline?.getLeague?.()?.mode||"straight");
 return '<div class="secnext-metrics"><div><small>Current place</small><strong>#'+(me+1)+'</strong></div>'+
 '<div><small>Points behind first</small><strong>'+gap.toLocaleString("en-US")+'</strong></div></div>'+
 '<p class="secnext-footnote">Verified rankings only. '+(simple?
 "What-if: "+open+" games in this week are not yet final. Each correct outright pick would earn one point; everyone else's results also matter.":
 "Available remaining points depend on sport and league mode. No projected winner is asserted.")+'</p>';
}
function onLeague(){
 const root=$("sec-next-league");if(!root)return;
 const l=league();
 const signed=!!user();
 root.innerHTML='<details class="secnext-fold"><summary>📊 League Pick Trends <small>after kickoff</small></summary>'+
 '<div class="secnext-fold-body"><div id="sec-next-trends"><p>Open to check revealed picks.</p></div>'+
 '<button type="button" data-next-trends '+(!l||!signed?'disabled':'')+'>Refresh trends</button></div></details>'+
 '<details class="secnext-fold"><summary>🏁 Live Championship Race <small>verified standings + what-if</small></summary>'+
 '<div class="secnext-fold-body">'+race()+'</div></details>'+
 '<details class="secnext-fold"><summary>⚔️ Friend Challenges <small>private to league members</small></summary>'+
 '<div class="secnext-fold-body" id="sec-next-challenge-area">'+
 '<p class="secnext-footnote">Invite a member to a weekly pick challenge, separate from league points.</p>'+
 (l?.kind==="football"&&signed?'<button type="button" data-next-load-challenges>Open challenges</button>':
 '<p class="secnext-footnote">Select a football league and sign in to participate.</p>')+
 '</div></details>';
}
function challengeMarkup(){
 const area=$("sec-next-challenge-area"),l=league(),u=user();
 if(!area||!l||l.kind!=="football"||!u)return;
 const members=(window.secOnline?.getStandings?.()||[]).filter(p=>p?.user_id&&p.user_id!==u.id);
 const current=challenges.map(r=>'<div class="secnext-challenge">'+
 '<span>'+esc((r.challenger_id===u.id?"Sent to ":"From ")+
 (members.find(x=>x.user_id===(r.challenger_id===u.id?r.recipient_id:r.challenger_id))?.display_name||"League member"))+
 ' · Week '+r.week+' · '+esc(r.status)+'</span>'+
 (r.recipient_id===u.id&&r.status==="pending"?
 '<button data-next-respond="accepted" data-next-challenge-id="'+esc(r.id)+'">Accept</button>'+
 '<button data-next-respond="declined" data-next-challenge-id="'+esc(r.id)+'">Decline</button>':"")+
 '</div>').join("");
 area.innerHTML='<p class="secnext-footnote">Both players must belong to this league. Challenge results are compared only after kickoff and verified finals. No bonus league points.</p>'+
 (members.length?'<div class="secnext-invite"><label for="sec-next-rival">Challenge a friend</label><select id="sec-next-rival">'+
 members.map(r=>'<option value="'+esc(r.user_id)+'">'+esc(r.display_name||"League member")+'</option>').join("")+
 '</select><button type="button" data-next-send-challenge>Challenge for Week '+esc(wk()?.num||"—")+'</button></div>':
 '<p class="secnext-footnote">Other members will appear after standings load.</p>')+
 (current||'<p class="secnext-footnote">No private friend challenges yet.</p>')+
 '<button type="button" data-next-load-challenges>Refresh</button>'+
 (challengeError?'<p class="secnext-footnote">'+esc(challengeError)+'</p>':"")+
 '<p class="secnext-footnote">Compare accepted face-offs under League → Brags after games finish.</p>';
}
async function loadChallenges(){
 const l=league(),u=user(),c=db(),identity=scope();
 if(!l||l.kind!=="football"||!u||!c)return;
 if(loadingChallenges)return;loadingChallenges=true;challengeError="";
 const area=$("sec-next-challenge-area");if(area)area.innerHTML='<p>Loading private challenges…</p>';
 try{
  const r=await c.from("sec_friend_challenges").select("id,league_id,challenger_id,recipient_id,week,status")
   .eq("league_id",l.id).order("created_at",{ascending:false}).limit(30);
  if(r.error)throw r.error;
  if(scope()!==identity)return;
  challenges=(r.data||[]).filter(x=>x.challenger_id===u.id||x.recipient_id===u.id);
  challengeScope=identity;
 }catch(e){if(scope()===identity)challengeError="Private challenges need the server migration enabled or are temporarily unavailable.";}
 finally{loadingChallenges=false;if(scope()===identity)challengeMarkup();}
}
async function challengeAction(action,button){
 const l=league(),u=user(),c=db();
 if(!l||l.kind!=="football"||!u||!c)return;
 button.disabled=true;
 try{
  const q=action==="send"?
   c.rpc("sec_challenge_friend",{p_league:l.id,p_opponent:$("sec-next-rival")?.value,p_week:wk()?.num}):
   c.rpc("sec_respond_friend_challenge",{p_id:button.dataset.nextChallengeId,p_status:action});
  const r=await q;if(r.error)throw r.error;
  notice(action==="send"?"Challenge sent!":"Response saved.");
  await loadChallenges();
 }catch(e){challengeError=e.message||"Could not update challenge.";challengeMarkup();}
 finally{button.disabled=false;}
}
function rivalry(){
 const picked=games().filter(g=>isOpen(g));
 const list=window.SDS_TROPHY_RIVALRIES||[];
 return picked.map(g=>({g,r:list.find(x=>Array.isArray(x.codes)&&
  x.codes.includes(g.away)&&x.codes.includes(g.home))})).filter(x=>x.r).slice(0,2);
}
function onRivalry(){
 const el=$("sec-next-rivalries");if(!el)return;
 const rivals=rivalry();
 el.innerHTML=rivals.length?'<details class="secnext-fold"><summary>🏆 Rivalry Week Challenges <small>official slate</small></summary>'+
 '<div class="secnext-fold-body">'+rivals.map(({g,r})=>
 '<div class="secnext-row"><span><strong>'+esc(r.name)+'</strong><small>'+esc(g.away)+' vs '+esc(g.home)+'</small></span>'+
 '<button type="button" data-next-rival-game="'+esc(g.id)+'">Make pick →</button></div>').join("")+
 '<p class="secnext-footnote">Pick the rivalry winner for your existing trophy eligibility. No invented bonus points or trophies.</p></div></details>':"";
}
function onSettings(){
 const el=$("sec-next-push");if(!el)return;
 const key=window.SEC_PUSH_CONFIG?.publicKey;
 const supported=!!(window.isSecureContext&&"PushManager"in window&&"serviceWorker"in navigator&&"Notification"in window);
 const enabled=Boolean(key&&db()&&user()&&supported);
 el.innerHTML='<details class="secnext-fold"><summary>🔔 Phone Push Notifications <small>opt-in</small></summary>'+
 '<div class="secnext-fold-body"><p>Optional device notifications for verified SEC events. Permission is requested only when you tap Enable.</p>'+
 (enabled?'<button type="button" data-next-push-enable>Enable on this device</button> '+
 '<button type="button" data-next-push-disable>Disable</button>':
 '<p class="secnext-footnote">Phone push delivery is not yet configured. In-app notifications still work; enabling requires a push server and VAPID public key.</p>')+
 '<small>Signed-out users cannot enroll. Push endpoints are private to each user.</small></div></details>';
}
function decodeKey(base64){
 const str=atob(String(base64).replace(/-/g,"+").replace(/_/g,"/"));
 return Uint8Array.from(str,c=>c.charCodeAt(0));
}
async function pushToggle(enable){
 const userId=user()?.id,c=db(),key=window.SEC_PUSH_CONFIG?.publicKey;
 if(!userId||!c||!key)return;
 try{
  const reg=await navigator.serviceWorker.ready;
  if(enable){
   if(Notification.permission!=="granted"){
    const permission=await Notification.requestPermission();if(permission!=="granted")return;
   }
   const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(key)});
   const data=sub.toJSON(),r=await c.from("sec_push_subscriptions").upsert({
    user_id:userId,endpoint:sub.endpoint,p256dh:data.keys.p256dh,auth_secret:data.keys.auth
   },{onConflict:"endpoint"});
   if(r.error){await sub.unsubscribe();throw r.error;}
   notice("This device is subscribed. Delivery depends on the configured push service.");
  }else{
   const sub=await reg.pushManager.getSubscription();
   if(sub){
    const r=await c.from("sec_push_subscriptions").delete().eq("user_id",userId).eq("endpoint",sub.endpoint);
    if(r.error)throw r.error;
    await sub.unsubscribe();
   }
   notice("Device push disabled.");
  }
 }catch(e){notice(e?.message||"Could not update notifications.");}
}
function onView(v){
 if(v==="picks"){onPicks();onRivalry();}
 if(v==="results")onResults();
 if(v==="league")onLeague();
 if(v==="settings")onSettings();
}
function bootstrap(){
 const d=document.createElement("dialog");d.id="sec-next-dialog";d.className="secnext-dialog";
 d.innerHTML='<header><strong>Quick Pick Mode</strong><button type="button" data-next-close aria-label="Close Quick Pick">✕</button></header>'+
 '<div id="sec-next-quick-content"></div><footer><button type="button" data-next-close>Done</button></footer>';
 document.body.appendChild(d);
 d.addEventListener("close",()=>{quickOpen=false;});
 onView(app()?.view?.());
}
document.addEventListener("click",event=>{
 const el=event.target.closest?.("[data-next-quick],[data-next-close],[data-next-choice],[data-next-trends],[data-next-load-challenges],[data-next-send-challenge],[data-next-respond],[data-next-rival-game],[data-next-victory],[data-next-push-enable],[data-next-push-disable]");
 if(!el)return;
 if(el.hasAttribute("data-next-quick"))openQuick();
 if(el.hasAttribute("data-next-close"))closeQuick();
 if(el.hasAttribute("data-next-choice"))void chooseQuick(el.dataset.nextGame,el.dataset.nextChoice);
 if(el.hasAttribute("data-next-trends"))void loadTrends();
 if(el.hasAttribute("data-next-load-challenges"))void loadChallenges();
 if(el.hasAttribute("data-next-send-challenge"))void challengeAction("send",el);
 if(el.hasAttribute("data-next-respond"))void challengeAction(el.dataset.nextRespond,el);
 if(el.hasAttribute("data-next-rival-game")){
  app()?.setView?.("picks");
  const btn=document.querySelector('#games-list [data-game-id="'+CSS.escape(el.dataset.nextRivalGame)+'"]');
  btn?.scrollIntoView({block:"start",behavior:"smooth"});
 }
 if(el.hasAttribute("data-next-victory"))cardCanvas();
 if(el.hasAttribute("data-next-push-enable"))void pushToggle(true);
 if(el.hasAttribute("data-next-push-disable"))void pushToggle(false);
});
window.SEC_NEXT=Object.freeze({bootstrap,onView,onPicks,onResults,onLeague,onSettings,career,weekStats,pending,rivalry,loadTrends});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bootstrap,{once:true});
else bootstrap();
})();