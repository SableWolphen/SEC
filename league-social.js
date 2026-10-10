/* Saturdays Down South — private league chat, reactions and championships.
 * Uses row-level security: a league member sees only their own league.
 * The commissioner can remove messages and crown a winner only after final results. */
(()=>{
"use strict";
let client=null,league=null,user=null,standings=[],messages=[],reactions=[],champions=[];
let inFlight=false,loadingToken=0,loaded=false,error="",requestId=0,refreshAt=0;
const allowedEmoji=["🔥","🏈","😂","👏"];
const esc=value=>String(value??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const extract=result=>{if(result?.error)throw result.error;return result?.data||[];};
const toast=message=>window.SEC_BRIDGE?.toast?.(message);
function memberName(id){return standings.find(s=>s.user_id===id)?.display_name||"League member";}
function isOwner(){return league?.owner_id===user?.id;}
function names(){return messages.map(m=>m.user_id);}
function stamp(date){const d=new Date(date);return Number.isNaN(d.valueOf())?"":d.toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}
function messageHtml(){
 if(!league)return '<p class="helper">Create or join a league to chat with friends.</p>';
 if(error)return '<p class="sec-chat-error" role="alert">'+esc(error)+'</p>';
 if(!loaded)return '<p class="helper">Loading league messages…</p>';
 if(!messages.length)return '<div class="sec-chat-empty">🏈 <strong>Start the conversation.</strong><span>Make the first call before kickoff!</span></div>';
 return messages.map(m=>{
  const mine=m.user_id===user?.id;
  const counts=allowedEmoji.map(em=>{
   const people=reactions.filter(r=>r.message_id===m.id&&r.emoji===em);
   return '<button type="button" class="sec-chat-reaction '+(people.some(r=>r.user_id===user?.id)?"mine":"")+
    '" data-sec-social="react" data-message-id="'+esc(m.id)+'" data-emoji="'+em+
    '" aria-label="React '+em+' to this message">'+em+' '+people.length+'</button>';
  }).join("");
  return '<article class="sec-chat-message '+(mine?"mine":"")+'">'+
   '<div class="sec-chat-message-title"><strong>'+esc(memberName(m.user_id))+'</strong>'+(window.SEC_PRIDE?.badge?.(m.user_id)||'')+'<time>'+esc(stamp(m.created_at))+'</time></div>'+
   '<p>'+esc(m.body)+'</p><div class="sec-chat-message-footer">'+counts+
   ((mine||isOwner())?'<button type="button" class="sec-chat-delete" data-sec-social="remove-message" data-message-id="'+esc(m.id)+'" aria-label="Delete message">Remove</button>':'')+
   '</div></article>';
 }).join("");
}
function championshipHtml(){
 if(!league)return "";
 const year=2026; // The current competition's regular-season slate.
 const crowned=champions.slice().sort((a,b)=>b.season-a.season);
 const championCards=crowned.map(c=>'<div class="sec-championship-winner">'+
   '<span class="sec-champion-trophy">🏆</span>'+
   '<div><strong>'+esc(c.season)+' League Champion</strong>'+
   '<p>'+esc(memberName(c.champion_user_id))+' · '+esc(Number(c.points).toLocaleString())+' points · '+esc(c.mode||"straight")+'</p></div></div>').join("");
 const seasonGames=(window.SEC_BRIDGE?.weeks||[]).flatMap(w=>w.games).filter(g=>String(g.date||"").startsWith(String(year)));
 const finished=seasonGames.length>0 && seasonGames.every(g=>["final","canceled"].includes(g.liveStatus));
 const leader=standings.slice().sort((a,b)=>Number(b.season_points)-Number(a.season_points))[0];
 return '<div class="sec-championship-heading"><span class="sec-championship-cup">🏆</span><div><h3>League Championship</h3>'+
  '<p>Only confirmed, finished seasons can crown a champion.</p></div></div>'+
  (championCards||'<div class="sec-championship-pending"><strong>2026 season underway</strong>'+
    '<p>'+(leader?'Current points leader: '+esc(leader.display_name)+'. ':'')+'No champion has been crowned yet.</p></div>')+
  (isOwner()&&!crowned.some(c=>c.season===year)?
   '<button type="button" class="sec-championship-action" data-sec-social="crown" '+
     (!finished?'disabled title="All season games must be final or canceled"':'')+
     '>Crown 2026 Champion</button>'+
     (!finished?'<p class="helper">Locked until the complete season is finalized. No early or made-up winners.</p>':'')
  :'')+
  '<p class="helper">Championships are league-specific. Historical trophies remain available in your collection.</p>';
}
function render(){
 if(!league)return "";
 return '<div class="sec-social-root" id="sec-social-root">'+
  '<section class="sec-chat-card" aria-label="Private chat for '+esc(league.name)+'">'+
  '<div class="sec-chat-heading"><div><span class="card-kicker">LEAGUE LOCKER ROOM</span><h3>Chat & Trash Talk</h3></div>'+
  '<span class="sec-chat-league-label">🔒 '+esc(league.name)+'</span></div>'+
  '<p class="sec-chat-lead">Private conversation for <strong>'+esc(league.name)+'</strong>. Messages stay in this league. Keep the banter friendly.</p>'+
  '<div id="sec-chat-feed" class="sec-chat-feed" aria-live="polite">'+messageHtml()+'</div>'+
  '<label class="input-label" for="sec-chat-input">Message your league</label>'+
  '<textarea id="sec-chat-input" class="field sec-chat-input" rows="2" maxlength="500" placeholder="Who takes the rivalry this Saturday?"></textarea>'+
  '<div class="sec-chat-controls"><span>500 characters max · 3 seconds between messages</span>'+
  '<button type="button" class="primary-btn" data-sec-social="send">Send message ↗</button></div>'+
  '</section></div>';
}
function update(){
 const a=document.getElementById("sec-chat-feed");
 if(a)a.innerHTML=messageHtml();
 window.SDSTrophyCase?.refreshHonors?.();
}
async function load(force=false){
 if(!client||!league||!user||inFlight)return;
 if(!force&&Date.now()-refreshAt<10000)return;
 const id=league.id,token=++requestId;inFlight=true;loadingToken=token;refreshAt=Date.now();
 try{
  const [mc,cc]=await Promise.all([
   client.from("sec_league_messages").select("id,league_id,user_id,body,created_at")
    .eq("league_id",id).order("created_at",{ascending:false}).limit(45),
   client.from("sec_league_champions").select("league_id,season,champion_user_id,points,mode,crowned_at")
    .eq("league_id",id).order("season",{ascending:false})
  ]);
  const rows=extract(mc),winnerRows=extract(cc);
  let reactionsData=[];
  if(rows.length){
   reactionsData=extract(await client.from("sec_league_reactions").select("message_id,user_id,emoji")
    .in("message_id",rows.map(m=>m.id)));
  }
  if(token!==requestId||id!==league?.id)return;
  messages=rows.slice().reverse();reactions=reactionsData;champions=winnerRows;
  error="";loaded=true;update();
 }catch(e){
  if(token===requestId&&id===league?.id){
   error="League chat temporarily unavailable. "+String(e.message||"Please try again.").slice(0,125);
   loaded=true;update();
  }
 }finally{if(loadingToken===token)inFlight=false;}
}
function connect(c,l,u,rows){
 const changed=l?.id!==league?.id||u?.id!==user?.id;
 if(changed){messages=[];reactions=[];champions=[];loaded=false;error="";refreshAt=0;requestId++;inFlight=false;}
 client=c;league=l||null;user=u||null;standings=Array.isArray(rows)?rows:[];
 if(c&&l&&u)void load();
}
function setStandings(rows){standings=Array.isArray(rows)?rows:[];update();}
async function act(type,el){
 if(!client||!league||!user)throw Error("Sign in and join a league first.");
 if(type==="send"){
  const input=document.getElementById("sec-chat-input"),body=input?.value.trim()||"";
  if(body.length<1||body.length>500)throw Error("Enter a message (1–500 characters).");
  extract(await client.from("sec_league_messages").insert({league_id:league.id,user_id:user.id,body}));
  input.value="";refreshAt=0;await load(true);toast("Message sent!");
 }else if(type==="react"){
  const mid=el.dataset.messageId,emoji=el.dataset.emoji;
  if(!allowedEmoji.includes(emoji)||!messages.some(m=>m.id===mid))return;
  const own=reactions.some(r=>r.message_id===mid&&r.user_id===user.id&&r.emoji===emoji);
  let query=client.from("sec_league_reactions");
  if(own)query=query.delete().eq("message_id",mid).eq("user_id",user.id).eq("emoji",emoji);
  else query=query.insert({message_id:mid,user_id:user.id,emoji});
  extract(await query);refreshAt=0;await load(true);
 }else if(type==="remove-message"){
  const msg=messages.find(m=>m.id===el.dataset.messageId);
  if(!msg||!(msg.user_id===user.id||isOwner()))return;
  if(!window.confirm("Remove this message from the league chat?"))return;
  extract(await client.from("sec_league_messages").delete().eq("id",msg.id).eq("league_id",league.id));
  refreshAt=0;await load(true);
 }else if(type==="crown"){
  if(!isOwner())throw Error("Only the league commissioner can crown the champion.");
  if(!window.confirm("Finalize the league championship after all 2026 games are official?"))return;
  extract(await client.rpc("sec_finalize_championship",{p_league:league.id,p_season:2026}));
  refreshAt=0;await load(true);toast("Season championship finalized!");
 }
}
let busy=false;
document.addEventListener("click",event=>{
 const el=event.target.closest?.("[data-sec-social]");if(!el)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(busy)return;busy=true;el.disabled=true;
 Promise.resolve(act(el.dataset.secSocial,el)).catch(e=>toast(e.message||"Unable to complete action."))
  .finally(()=>{busy=false;if(el.isConnected)el.disabled=false;});
},true);
document.addEventListener("keydown",event=>{
 if(event.target?.id!=="sec-chat-input"||event.key!=="Enter"||event.shiftKey)return;
 event.preventDefault();
 document.querySelector('[data-sec-social="send"]')?.click();
});
setInterval(()=>{
 if(document.visibilityState==="visible"&&["league","trophies"].includes(window.SEC_BRIDGE?.view?.())&&league&&user)void load();
},15000);
window.SEC_SOCIAL={connect,setStandings,render,renderChampionship:championshipHtml,load,refreshDisplay:update,getChampions:()=>champions.map(c=>({...c}))};
})();