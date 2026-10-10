/* Verified SEC Weekly League Power Rankings — one compact card per selected league.
   Rankings are calculated server-side from final scores; other members' picks stay private. */
(()=>{
"use strict";
const root=()=>document.getElementById("fan-power-rankings");
const manager=()=>window.SEC_LEAGUE_SETTINGS;
const db=()=>window.secOnline?.getClient?.();
const me=()=>window.secOnline?.getUser?.();
const escapeHtml=v=>String(v==null?"":v).replace(/[&<>"']/g,ch=>
 ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const number=n=>Number.isFinite(Number(n))?Number(n):0;
const pretty=n=>number(n).toLocaleString("en-US",{maximumFractionDigits:1});
let activeKey="",pending=new Map(),cache=new Map(),error=new Map();
const scope=item=>item?.kind==="club"?"club":item?.kind;
const fromItem=item=>item&&["club","football","basketball","baseball"].includes(scope(item))?
  {key:(me()?.id||"guest")+":"+scope(item)+":"+item.id,kind:scope(item),id:item.id}:null;
const safeDate=value=>{
 const d=new Date(String(value)+"T12:00:00Z");
 return Number.isFinite(d.getTime())?d.toLocaleDateString("en-US",{timeZone:"UTC",month:"short",day:"numeric"}):"This week";
};
function movement(row){
 const prev=row.previous_rank==null?null:Number(row.previous_rank);
 const current=Number(row.current_rank);
 if(prev==null||!Number.isFinite(prev)||!Number.isFinite(current))return '<span class="power-movement neutral" aria-label="No previous ranking">—</span>';
 const moved=prev-current;
 if(moved>0)return '<span class="power-movement up" aria-label="Up '+moved+' place'+(moved===1?"":"s")+'">▲ '+moved+'</span>';
 if(moved<0)return '<span class="power-movement down" aria-label="Down '+Math.abs(moved)+' place'+(moved===-1?"":"s")+'">▼ '+Math.abs(moved)+'</span>';
 return '<span class="power-movement neutral" aria-label="No rank change">—</span>';
}
function rankRow(p){
 const rank=Number(p.current_rank);
 const mine=p.user_id===me()?.id;
 return '<li class="power-rank-row '+(mine?"is-you":"")+'">'+
 '<span class="power-position">'+(rank===1?"👑 ":"")+rank+'</span>'+
 '<span class="power-player"><strong>'+escapeHtml(p.display_name||"Player")+(mine?" ★":"")+'</strong>'+
 '<small>'+number(p.weekly_correct)+'/'+number(p.weekly_graded)+' graded picks correct · '+
 pretty(p.weekly_points)+' pts this week</small></span>'+
 '<span class="power-points" aria-label="'+pretty(p.season_points)+' season points">'+
 '<strong>'+pretty(p.season_points)+'</strong><small>Season</small></span>'+movement(p)+'</li>';
}
function render(item=manager()?.getSelected?.()){
 const el=root();if(!el)return;
 const input=fromItem(item);
 if(!input||!me()){el.innerHTML="";el.hidden=true;return;}
 el.hidden=false;
 const data=cache.get(input.key);
 const busy=pending.has(input.key),issue=error.get(input.key);
 const rows=Array.isArray(data?.rows)?data.rows:[];
 const hasResults=rows.some(row=>number(row.season_graded)>0);
 let content="";
 if(!data&&busy)content='<p class="fan-subtle power-empty" role="status">Checking confirmed SEC results…</p>';
 else if(issue&&!data)content='<div class="fan-warning" role="alert">'+escapeHtml(issue)+'</div>';
 else if(!rows.length)content='<p class="fan-subtle power-empty">No players found in this league yet. Invite friends to get started.</p>';
 else if(!hasResults)content='<p class="fan-subtle power-empty">Power rankings begin once league picks have verified final results. No projected leaders or made-up awards.</p>';
 else {
  const leaders=rows.filter(x=>Number(x.current_rank)===1).map(x=>x.display_name||"Player");
  const weekRows=rows.filter(x=>number(x.weekly_graded)>0);
  const best=weekRows.slice().sort((a,b)=>number(b.weekly_correct)-number(a.weekly_correct)||
    number(b.weekly_points)-number(a.weekly_points)||String(a.display_name).localeCompare(String(b.display_name)))[0];
  const improved=rows.filter(x=>x.previous_rank!=null&&number(x.previous_rank)>number(x.current_rank))
    .sort((a,b)=>(number(b.previous_rank)-number(b.current_rank))-
                 (number(a.previous_rank)-number(a.current_rank)))[0];
  const highlight='<div class="power-highlights" aria-label="League weekly highlights">'+
   '<div><small>👑 Season leader</small><strong>'+escapeHtml(leaders.length===1?leaders[0]:"Tied: "+leaders.slice(0,2).join(" & ")+(leaders.length>2?" +":""))+'</strong></div>'+
   '<div><small>🔥 Most right this week</small><strong>'+escapeHtml(best&&number(best.weekly_correct)>0?
      (best.display_name||"Player")+" · "+number(best.weekly_correct):"Awaiting results")+'</strong></div>'+
   '<div><small>⬆ Biggest rise</small><strong>'+escapeHtml(improved?
      (improved.display_name||"Player")+" · +"+(number(improved.previous_rank)-number(improved.current_rank)):"No movement")+'</strong></div>'+
   '</div>';
  const top=rows.slice(0,5).map(rankRow).join("");
  const rest=rows.length>5?'<details class="power-rest"><summary>See all '+rows.length+' players</summary>'+
   '<ol class="power-rank-list" start="6">'+rows.slice(5).map(rankRow).join("")+'</ol></details>':"";
  content=highlight+'<ol class="power-rank-list">'+top+'</ol>'+rest;
 }
 const label=rows.length?safeDate(rows[0].week_start):"This week";
 el.innerHTML='<section class="fan-panel fan-power-card" aria-label="Weekly power rankings for '+escapeHtml(item.name)+'">'+
 '<div class="fan-title-row power-heading"><div><div class="card-kicker">⚡ WEEKLY LEAGUE UPDATE</div>'+
 '<h3>Power Rankings</h3><p>'+escapeHtml(item.name)+' · Week of '+label+
 ' · Verified final games only</p></div>'+
 '<button type="button" class="fan-small" data-power-refresh="true" '+(busy?"disabled ":"")+
 'aria-label="Refresh weekly league power rankings">↻ Refresh</button></div>'+
 content+(issue&&data?'<p class="fan-warning" role="status">'+escapeHtml(issue)+'</p>':"")+
 '<p class="fan-subtle power-note">Ranks use accumulated league points. Arrows compare standings at the start of this week (Mon, CT). '+
 'This week’s picks only count after final scores are confirmed.</p></section>';
}
function show(item=manager()?.getSelected?.(),force=false){
 if(item===null)item=manager()?.getSelected?.();
 const input=fromItem(item);
 if(!input||!me()){activeKey="";render(null);return Promise.resolve();}
 activeKey=input.key;
 const previous=cache.get(input.key);
 render(item);
 if(pending.has(input.key))return pending.get(input.key);
 if(!force&&previous&&Date.now()-previous.at<120000)return Promise.resolve();
 if(!db())return Promise.resolve();
 error.delete(input.key);
 const userId=me()?.id;
 const task=(async()=>{
  try{
   const resp=await db().rpc("sec_weekly_power_rankings",{p_kind:input.kind,p_league:input.id});
   if(resp?.error)throw resp.error;
   if(userId!==me()?.id)return;
   cache.set(input.key,{rows:Array.isArray(resp?.data)?resp.data:[],at:Date.now()});
  }catch(e){
   if(userId===me()?.id)error.set(input.key,"Rankings are temporarily unavailable. Try refreshing.");
   console.info("Weekly power rankings:",e?.message||"Unable to load");
  }finally{
   pending.delete(input.key);
   if(activeKey===input.key&&userId===me()?.id)render(manager()?.getSelected?.());
  }
 })();
 pending.set(input.key,task);
 render(item);
 return task;
}
document.addEventListener("click",event=>{
 if(!event.target.closest?.("[data-power-refresh]"))return;
 event.preventDefault();
 void show(manager()?.getSelected?.(),true);
});
window.SEC_POWER=Object.freeze({show,render,movement,rankRow});
})();
