/* ESPN-sourced play-by-play for SEC football Games + Game Center.
 * Public verified game data only. Opens lazily and never guesses a play.
 */
(()=>{
"use strict";
const app=()=>window.SEC_BRIDGE;
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isGame=id=>/^\d{4}-\d{1,2}-[A-Z0-9]{2,12}-[A-Z0-9]{2,12}$/.test(String(id||""));
const validEvent=id=>/^\d{6,14}$/.test(String(id||""));
const cache=new Map(),loading=new Map(),prefs=new Map();
const game=id=>app()?.gameById?.[id]||null;
const alive=el=>el?.isConnected===true;
const now=()=>Date.now();
const reqId=el=>el?.dataset?.secPbpGame;
const preference=el=>{
 const id=reqId(el),context=el.dataset.secPbpContext||"games",key=context+":"+id;
 if(!prefs.has(key))prefs.set(key,{mode:"plays",count:45});
 return prefs.get(key);
};
function placeholder(g,context="games"){
 if(!g||!isGame(g.id))return "";
 const st=g.liveStatus||"scheduled";
 const active=st==="live"||st==="final";
 const id=esc(g.id),old=document.querySelector(
  '[data-sec-pbp-game="'+id+'"][data-sec-pbp-context="'+context+'"]');
 const wasOpen=old?.open===true;
 const label=st==="final"?"Review the full play timeline":"Live play-by-play";
 return '<details class="sec-pbp-panel" data-sec-pbp-game="'+id+
  '" data-sec-pbp-context="'+esc(context)+'"'+(wasOpen?" open":"")+ '>'+
  '<summary><span>▶ '+label+'</span><span class="sec-pbp-chevron" aria-hidden="true">⌄</span></summary>'+
  '<div class="sec-pbp-body" data-sec-pbp-output aria-live="polite">'+
   (active?'<p class="sec-pbp-hint">Open to load recorded plays from the verified game source.</p>':
    '<p class="sec-pbp-hint">Play-by-play becomes available after kickoff.</p>')+
  '</div></details>';
}
function escapePlay(p){
 return {text:esc(String(p?.text||"").slice(0,350)),shortText:esc(String(p?.shortText||"").slice(0,120)),
  period:Number.isInteger(p?.period)&&p.period>=1&&p.period<=20?p.period:0,
  clock:esc(String(p?.clock||"").slice(0,16)),type:esc(String(p?.type||"").slice(0,60)),
  team:esc(String(p?.team||"").slice(0,20)),scoring:p?.scoring===true,
  firstDown:p?.firstDown===true,turnover:p?.turnover===true};
}
function quarter(n){return n<=0?"PLAY":n<=4?"Q"+n:"OT"+(n-4>1?n-4:"");}
function playMarkup(item){
 const p=escapePlay(item);
 const tag=p.scoring?'<span class="sec-pbp-tag score">Scoring play</span>':
   p.turnover?'<span class="sec-pbp-tag turnover">Turnover</span>':
   p.firstDown?'<span class="sec-pbp-tag first">First down</span>':"";
 return '<li class="sec-pbp-play'+(p.scoring?" is-scoring":"")+'">'+
   '<div class="sec-pbp-time">'+quarter(p.period)+(p.clock?' · '+p.clock:"")+'</div>'+
   '<div class="sec-pbp-play-body"><div class="sec-pbp-play-head">'+
   (p.team?'<b>'+p.team+'</b>':"")+
   (p.type?'<small>'+p.type+'</small>':"")+tag+'</div>'+
   '<p>'+p.text+'</p></div></li>';
}
function driveMarkup(d){
 const id=esc(String(d?.id||"").slice(0,70));
 const desc=esc(String(d?.description||"").slice(0,140));
 const result=esc(String(d?.result||"").slice(0,100));
 const team=esc(String(d?.team||"").slice(0,12));
 const count=Math.max(0,Math.min(500,Number(d?.plays)||0));
 return '<li class="sec-pbp-drive"><strong>'+(team?team+" · ":"")+ (desc||"Recorded drive")+'</strong>'+
  '<span>'+count+' play'+(count===1?"":"s")+
  (d?.yards!==null&&Number.isFinite(Number(d?.yards))?' · '+Number(d.yards)+' yards':"")+
  (d?.scoring===true?' · Scoring drive':"")+'</span>'+
  (result?'<small>'+result+'</small>':"")+'</li>';
}
function sourceLink(data,id){
 const gameId=String(data?.event_id||game(id)?.espnEventId||"");
 return validEvent(gameId)?'<a href="https://www.espn.com/college-football/game/_/gameId/'+
  esc(gameId)+'" target="_blank" rel="noopener noreferrer">View original ESPN game recap ↗</a>':"";
}
function controls(mode,plays,drives){
 return '<div class="sec-pbp-controls" role="group" aria-label="Play-by-play view">'+
  [["plays","All plays ("+plays.length+")"],["scoring","Scoring ("+plays.filter(x=>x.scoring===true).length+")"],
   ["drives","Drives ("+drives.length+")"]].map(([key,label])=>
    '<button type="button" data-sec-pbp-filter="'+key+'" class="'+(mode===key?"is-active":"")+
     '" aria-pressed="'+(mode===key)+'">'+label+'</button>').join("")+'</div>';
}
function render(el,entry){
 if(!alive(el)||!el.open)return;
 const root=el.querySelector("[data-sec-pbp-output]");if(!root)return;
 const id=reqId(el),p=preference(el),data=entry?.data||{};
 if(entry?.error){
  root.innerHTML='<p class="sec-pbp-unavailable">Play-by-play could not be loaded right now. Your picks and live scores still work.</p>'+
   '<div class="sec-pbp-footer"><button type="button" data-sec-pbp-refresh>Try again</button>'+sourceLink(data,id)+'</div>';
  return;
 }
 const plays=Array.isArray(data.plays)?data.plays:[],drives=Array.isArray(data.drives)?data.drives:[];
 if(!plays.length){
  root.innerHTML='<p class="sec-pbp-unavailable">'+esc(data.message||
   "No full play timeline has been published for this game yet.")+'</p>'+
   '<div class="sec-pbp-footer"><button type="button" data-sec-pbp-refresh>Check again</button>'+
   sourceLink(data,id)+'</div>';
  return;
 }
 const selected=p.mode==="drives"?drives:p.mode==="scoring"?plays.filter(x=>x.scoring===true):plays;
 const page=selected.slice(0,p.count);
 const items=p.mode==="drives"?page.map(driveMarkup):page.map(playMarkup);
 const updated=Number.isFinite(Date.parse(data.updated_at||""))?
  " · Checked "+new Date(data.updated_at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):"";
 const header='<p class="sec-pbp-source">Source: ESPN game summary'+esc(updated)+
  (data.truncated?' · Earliest plays may be unavailable':"")+'</p>';
 root.innerHTML=header+controls(p.mode,plays,drives)+
  (items.length?'<ol class="'+(p.mode==="drives"?"sec-pbp-drives":"sec-pbp-plays")+'">'+items.join("")+'</ol>':
   '<p class="sec-pbp-hint">No verified '+(p.mode==="drives"?"drives":"scoring plays")+' yet.</p>')+
  (selected.length>page.length?'<button type="button" data-sec-pbp-more>Show '+Math.min(45,selected.length-page.length)+' more →</button>':"")+
  '<div class="sec-pbp-footer"><button type="button" data-sec-pbp-refresh>Refresh plays</button>'+
  sourceLink(data,id)+'</div>';
}
async function load(el,force=false){
 if(!alive(el)||!el.open)return;
 const id=reqId(el);if(!isGame(id))return;
 const existing=cache.get(id);
 if(!force&&existing&&existing.until>now()){render(el,existing);return;}
 if(!force&&loading.has(id)){
  try{await loading.get(id);}catch(_){}
  if(el.open)render(el,cache.get(id)||{error:true});return;
 }
 const root=el.querySelector("[data-sec-pbp-output]");
 if(root)root.innerHTML='<p class="sec-pbp-loading" role="status">Loading verified plays…</p>';
 const job=(async()=>{
  try{
   const cfg=window.SEC_ONLINE_CONFIG;
   if(!cfg?.url||!cfg?.publishableKey)throw Error("Score provider not configured");
   const res=await fetch(cfg.url+"/functions/v1/sec-plays?game="+encodeURIComponent(id),{
    method:"GET",headers:{"apikey":cfg.publishableKey,"Accept":"application/json"},
    signal:AbortSignal.timeout(13000),cache:"no-store"
   });
   if(!res.ok)throw Error("Play source temporarily unavailable");
   const data=await res.json();
   if(!data||data.game_id!==id||data.source!=="ESPN game summary"||
    !Array.isArray(data.plays)||!Array.isArray(data.drives))throw Error("Invalid verified play data");
   // Only permit bounded, source-parsed structured data; don't render arbitrary HTML.
   data.plays=data.plays.slice(0,450).filter(x=>typeof x?.text==="string");
   data.drives=data.drives.slice(0,45);
   const ttl=data.status==="final"?10*60000:data.status==="live"?20000:60000;
   cache.set(id,{data,until:now()+ttl});
  }catch(e){
   // Avoid hammering a failing upstream provider while still permitting Retry.
   cache.set(id,{error:true,until:now()+12000});
  }finally{loading.delete(id);}
 })();
 loading.set(id,job);
 await job;
 if(el.open)render(el,cache.get(id));
}
function hydrate(root=document){
 root.querySelectorAll?.("[data-sec-pbp-game][open]").forEach(el=>{void load(el);});
}
function invalidate(id){
 if(isGame(id))cache.delete(id);
}
document.addEventListener("toggle",ev=>{
 const el=ev.target;
 if(el?.matches?.("[data-sec-pbp-game]")&&el.open)void load(el);
},true);
document.addEventListener("click",ev=>{
 const btn=ev.target.closest?.("[data-sec-pbp-filter],[data-sec-pbp-more],[data-sec-pbp-refresh]");
 if(!btn)return;
 const el=btn.closest("[data-sec-pbp-game]");if(!el)return;
 ev.preventDefault();
 if(btn.hasAttribute("data-sec-pbp-refresh")){cache.delete(reqId(el));void load(el,true);return;}
 const p=preference(el);
 if(btn.hasAttribute("data-sec-pbp-filter")){p.mode=btn.dataset.secPbpFilter;p.count=45;}
 if(btn.hasAttribute("data-sec-pbp-more"))p.count+=45;
 render(el,cache.get(reqId(el))||{error:true});
});
setInterval(()=>{
 if(document.visibilityState==="hidden")return;
 for(const el of document.querySelectorAll("[data-sec-pbp-game][open]")){
  const id=reqId(el),g=game(id);
  if(g?.liveStatus==="live"&&cache.get(id)?.until<=now())void load(el);
 }
},20000);
window.SEC_PLAYS=Object.freeze({placeholder,hydrate,invalidate,load,escapePlay,quarter});
if(document.readyState!=="loading")hydrate();
else document.addEventListener("DOMContentLoaded",()=>hydrate(),{once:true});
})();