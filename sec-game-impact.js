/* SEC league game impact: reveal only verified, kickoff-gated league totals.
   No public reads of members' private unstarted picks; all totals come from
   sec_league_game_pulse, whose membership/lock checks run on the server. */
(()=>{
"use strict";
const W=window,D=document;
const $=id=>D.getElementById(id);
const app=()=>W.SEC_BRIDGE;
const selected=()=>W.SEC_LEAGUE_SETTINGS?.getSelected?.();
const user=()=>W.secOnline?.getUser?.();
const db=()=>W.secOnline?.getClient?.();
const week=()=>app()?.week?.();
const now=()=>Date.now();
const cache=new Map();
const waiting=new Map();
const escape=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const n=v=>Number.isInteger(Number(v))&&Number(v)>=0?Number(v):null;
const name=code=>W.SEC_PRIDE?.names?.[code]||String(code||"Unknown");
function football(item){
 return item?.kind==="football" || item?.kind==="club"&&item.sports?.includes("football");
}
function identity(g,item){
 return [user()?.id||"",item?.kind||"",item?.id||"",week()?.num||"",g.id].join(":");
}
function started(g){
 const kick=Date.parse(g.kickoff||"");
 // A provisional or missing time may never reveal anything.
 return Number.isFinite(kick)&&kick<=now()&&app()?.isLocked?.(g)===true;
}
function modeReady(){
 return Boolean(user()?.id&&db()&&football(selected())&&app()?.week?.()?.games);
}
function relevant(g){
 return g?.liveStatus==="live"||W.SEC_FEATURES?.finalData?.(g)||
  g?.liveStatus==="final"&&g?.winner;
}
function eligible(g){
 return Boolean(modeReady()&&g&&started(g)&&relevant(g));
}
function host(card){
 const body=card.querySelector(".sec-final-detail-body")||
  card.querySelector(".sec-games-active-foot")||card;
 return body;
}
function decorate(){
 const cards=D.querySelectorAll("#games-list .game-card[data-game-id]");
 const games=week()?.games||[];
 for(const card of cards){
  const g=games.find(x=>x.id===card.dataset.gameId);
  if(!g||!eligible(g)||card.querySelector(".sec-impact"))continue;
  const target=host(card);
  const el=D.createElement("details");
  el.className="sec-impact";
  el.dataset.impactGame=g.id;
  el.innerHTML='<summary>⚡ What this game means for your league <span aria-hidden="true">⌄</span></summary>'+
   '<div class="sec-impact-body" role="status" aria-live="polite">Open for verified post-kickoff league picks.</div>';
  target.appendChild(el);
 }
}
async function pulse(g,item){
 const key=identity(g,item),old=cache.get(key);
 if(old&&now()-old.at<45000)return old.data;
 if(waiting.has(key))return waiting.get(key);
 const job=(async()=>{
  const result=await db().rpc("sec_league_game_pulse",{
   p_kind:item.kind,p_league:item.id,p_sport:"football",p_game:g.id
  });
  if(result.error)throw result.error;
  const row=Array.isArray(result.data)?result.data[0]:result.data;
  // The server, not client kickoff heuristics, is the disclosure authority.
  if(row?.locked!==true)return null;
  const away=n(row.away_picks),home=n(row.home_picks);
  if(away===null||home===null)return null;
  const model={away,home,total:away+home};
  cache.set(key,{data:model,at:now()});
  return model;
 })();
 waiting.set(key,job);
 try{return await job;}finally{waiting.delete(key);}
}
function description(g,p){
 const chosen=app()?.state?.()?.picks?.[g.id];
 const mySide=chosen===g.away?"away":chosen===g.home?"home":null;
 const ours=mySide==="away"?p.away:mySide==="home"?p.home:null;
 const theirs=mySide==="away"?p.home:mySide==="home"?p.away:null;
 const winner=W.SEC_FEATURES?.finalData?.(g)?.winner||null;
 const final=Boolean(winner&&g.liveStatus==="final");
 return {mySide,ours,theirs,winner,final};
}
function renderBody(body,g,p){
 const s=description(g,p);
 body.replaceChildren();
 const stat=D.createElement("div");stat.className="sec-impact-stats";
 const a=D.createElement("div"),h=D.createElement("div");
 a.innerHTML='<span>'+escape(name(g.away))+'</span><strong>'+p.away+'</strong>';
 h.innerHTML='<span>'+escape(name(g.home))+'</span><strong>'+p.home+'</strong>';
 stat.append(a,h);body.append(stat);
 const track=D.createElement("div");track.className="sec-impact-track";
 track.setAttribute("role","img");
 track.setAttribute("aria-label",p.away+" picked "+name(g.away)+"; "+p.home+" picked "+name(g.home));
 const fill=D.createElement("span");fill.style.width=(p.total?100*p.away/p.total:0)+"%";
 track.append(fill);body.append(track);
 const note=D.createElement("p");
 if(p.total===0)note.textContent="No league picks have been revealed for this game yet.";
 else if(s.mySide){
  note.textContent="Your "+name(s.mySide==="away"?g.away:g.home)+" pick matches "+
   s.ours+" of "+p.total+" revealed league picks. "+
   s.theirs+" pick"+(s.theirs===1?"":"s")+" favor the opponent.";
 }else{
  note.textContent=p.total+" league selections are revealed. You did not make a saved pick for this game.";
 }
 body.append(note);
 if(s.final){
  const result=D.createElement("p");result.className="sec-impact-result";
  result.textContent=s.mySide?
   ("Verified final: your pick "+(s.winner===g[s.mySide]?"won.":"lost.")+
    " Final standings will determine your position."):
   "Verified final: league standings determine the impact.";
  body.append(result);
 }else{
  const caution=D.createElement("small");
  caution.textContent="Live scores can change. This shows disclosed league pick counts, not guaranteed rank movement.";
  body.append(caution);
 }
 const actions=D.createElement("div");actions.className="sec-impact-actions";
 const share=D.createElement("button");share.type="button";share.dataset.impactShare=g.id;
 share.textContent="Share this matchup";share.disabled=!p.total;
 actions.append(share);
 const refresh=D.createElement("button");refresh.type="button";refresh.dataset.impactRefresh=g.id;
 refresh.textContent="↻ Update";
 actions.append(refresh);body.append(actions);
}
async function hydrate(el,force=false){
 const item=selected(),id=el.dataset.impactGame,g=week()?.games?.find(x=>x.id===id);
 const body=el.querySelector(".sec-impact-body");
 if(!body)return;
 if(!g||!eligible(g)||!item){body.textContent="Join a league to see post-kickoff trends.";return;}
 const key=identity(g,item);
 el.dataset.impactIdentity=key;
 if(force)cache.delete(key);
 body.textContent="Checking verified league picks…";
 try{
  const p=await pulse(g,item);
  if(el.dataset.impactIdentity!==key||identity(g,selected())!==key||!started(g)||!el.isConnected)return;
  if(!p){body.textContent="League selections remain private until the server confirms the game's lock.";return;}
  renderBody(body,g,p);
 }catch(_){
  if(el.dataset.impactIdentity===key)body.textContent="League picks temporarily unavailable. Tap Update to retry.";
 }
}
async function share(el){
 const g=week()?.games?.find(x=>x.id===el.dataset.impactGame),item=selected();
 if(!g||!item||!eligible(g))return;
 const p=cache.get(identity(g,item))?.data;
 if(!p)return;
 const status=g.liveStatus==="final"?"Final":"Game day";
 const message="SEC Pick’em · "+status+"\n"+name(g.away)+" vs "+name(g.home)+
  "\nLocked league picks: "+p.away+" "+name(g.away)+" · "+p.home+" "+name(g.home)+
  "\n"+W.location.origin+W.location.pathname+"#picks";
 try{
  if(navigator.share)await navigator.share({title:"SEC Pick’em league picks",text:message});
  else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(message);app()?.toast?.("Matchup copied.");}
  else app()?.toast?.("Sharing isn't available on this device.");
 }catch(e){if(e?.name!=="AbortError")app()?.toast?.("Couldn't share this matchup.");}
}
function onLeague(){
 const root=$("sec-next-league"),item=selected();
 if(!root)return;
 root.querySelector(".sec-impact-league")?.remove();
 if(!football(item)||!user())return;
 const games=(week()?.games||[]).filter(g=>started(g)&&relevant(g));
 const live=games.filter(g=>g.liveStatus==="live");
 const focus=live[0]||games.filter(g=>g.liveStatus==="final").slice(-1)[0];
 const me=user().id;
 const rows=item.kind==="club"?W.SEC_LEAGUE_SETTINGS?.getStandings?.()||[]:
  W.secOnline?.getStandings?.()||[];
 const points=r=>Number(item.kind==="club"?r.total:r.season_points);
 const ranked=rows.filter(r=>r?.user_id&&Number.isFinite(points(r)))
  .slice().sort((a,b)=>points(b)-points(a));
 const place=ranked.findIndex(r=>r.user_id===me);
 const graded=W.SEC_NEXT?.weekStats?.();
 const results=graded&&(graded.wins+graded.losses+graded.pushes)>0;
 const el=D.createElement("section");el.className="sec-impact-league";
 el.innerHTML='<div class="sec-impact-league-title"><strong>⚡ League game-day race</strong>'+
  '<small>'+escape(item.name||"Your league")+'</small></div>'+
  '<p>'+(place<0?"Standings appear once verified games are graded.":
   "You’re #"+(place+1)+" of "+ranked.length+" in the latest league standings.")+'</p>'+
  (focus?'<p>See the verified league pick split for '+escape(name(focus.away))+
   ' vs '+escape(name(focus.home))+'. Only started games reveal picks.</p>'+
   '<button type="button" data-impact-jump="'+escape(focus.id)+'">See matchup impact →</button>':
   '<p>When games kick off, you can see which teams your league selected. Future picks stay private.</p>')+
   (results?'<button type="button" data-next-victory>Share weekly results ↗</button>':"");
 root.insertAdjacentElement("afterbegin",el);
}
D.addEventListener("toggle",event=>{
 const target=event.target;
 if(target?.matches?.(".sec-impact")&&target.open)void hydrate(target);
},true);
D.addEventListener("click",event=>{
 const refresh=event.target.closest?.("[data-impact-refresh]");
 if(refresh){const el=refresh.closest(".sec-impact");if(el)void hydrate(el,true);return;}
 const shareButton=event.target.closest?.("[data-impact-share]");
 if(shareButton){const el=shareButton.closest(".sec-impact");if(el)void share(el);return;}
 const jump=event.target.closest?.("[data-impact-jump]");
 if(jump){
  const id=jump.dataset.impactJump;
  app()?.setView?.("picks");
  D.querySelector('[data-slate-filter="all"]')?.click();
  const card=Array.from(D.querySelectorAll("#games-list [data-game-id]"))
   .find(c=>c.dataset.gameId===id);
  if(card){card.scrollIntoView({block:"center",behavior:"smooth"});
   const fold=card.querySelector(".sec-impact");
   if(fold)fold.open=true;
  }
 }
});
W.SEC_GAME_IMPACT=Object.freeze({decorate,onLeague,eligible});
})();
