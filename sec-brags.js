/* True graded season numbers from member-authorized database RPC (all enabled sports). */
(()=>{
"use strict";
const host=()=>document.getElementById("fan-bragging-content");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let key="",rows=[],loading=false,error="",request=0,loadedAt=0,expanded=false;
document.addEventListener("toggle",e=>{
 if(e.target?.id==="sec-brags-season-details")expanded=e.target.open;
},true);
const user=()=>window.secOnline?.getUser?.();
const manager=()=>window.SEC_LEAGUE_SETTINGS;
const kindOf=()=>manager()?.getSelected?.();
const winner=(field,valid)=>rows.filter(r=>valid(r[field])).sort((a,b)=>Number(b[field])-Number(a[field]))[0];
const pct=v=>v===null||v===undefined?"—":Number(v).toFixed(1)+"%";
const school=id=>window.SEC_PRIDE?.badge?.(id)||"";
function render(){
 const slot=host();if(!slot)return;
 const selected=kindOf();
 if(!selected||!user()){slot.replaceChildren();return;}
 if(loading){slot.innerHTML='<p class="fan-subtle">Loading verified league bragging stats…</p>';return;}
 if(error){slot.innerHTML='<p class="fan-subtle" role="status">Season bragging stats unavailable: '+esc(error)+'. Database migration may be required.</p>';return;}
 const correct=winner("accuracy_pct",v=>v!==null&&v!==undefined);
 const upsets=winner("upsets_correct",v=>Number(v)>0);
 const loyal=winner("favorite_pick_pct",v=>v!==null&&v!==undefined);
 const biggest=winner("biggest_upset",v=>v!==null&&v!==undefined);
 const champions=[
  ["🎯","Accuracy King",correct,correct?pct(correct.accuracy_pct):"No graded picks"],
  ["⚡","Upset Hunter",upsets,upsets?upsets.upsets_correct+" correct":"No verified upsets"],
  ["🧱","Chalk Loyalist",loyal,loyal?pct(loyal.favorite_pick_pct)+" favorites":"No published lines"],
  ["💥","Biggest Shock",biggest,biggest?Number(biggest.biggest_upset).toFixed(1)+"-point dog":"No verified upsets"]
 ];
 const names=Object.fromEntries([...(window.SEC_LEAGUE_SETTINGS?.getStandings?.()||[]),...(window.secOnline?.getStandings?.()||[])].map(r=>[r.user_id,r.display_name]));
 // Football standings live in a separate module; the authoritative name is in the stats response.
 const grid=champions.map(([emoji,title,player,value])=>'<div class="sec-brag-award"><span>'+emoji+'</span>'+
  '<small>'+title+'</small><strong>'+esc(player?.display_name||names[player?.user_id]||"Unclaimed")+
  (player?school(player.user_id):"")+'</strong><em>'+esc(value)+'</em></div>').join("");
 const table=rows.map(r=>'<tr><td>'+esc(r.display_name||names[r.user_id]||"Player")+school(r.user_id)+'</td>'+
  '<td>'+(Number(r.graded_picks)>0?pct(r.accuracy_pct):"—")+'</td>'+
  '<td>'+Number(r.upsets_correct||0)+'</td><td>'+pct(r.favorite_pick_pct)+'</td>'+
  '<td>'+(r.biggest_upset==null?"—":Number(r.biggest_upset).toFixed(1))+'</td></tr>').join("");
 slot.innerHTML='<details id="sec-brags-season-details" class="fan-panel sec-brags-panel brag-fold"'+
  (expanded?' open':'')+' aria-label="Verified season bragging rights">'+
  '<summary>📊 Season statistics <small>Accuracy, upsets &amp; picks</small></summary><div class="brag-fold-body">'+
  '<div class="card-kicker">BRAGGING RIGHTS</div><h2>Receipts or it didn’t happen.</h2>'+
  '<p class="fan-subtle">Numbers include confirmed final games with a recorded pick. Underdogs and favorites require a published point spread. Spread leagues use cover accuracy.</p>'+
  '<div class="sec-brag-awards">'+grid+'</div>'+
  '<div class="fan-table-wrap"><table class="fan-table sec-brag-table"><thead><tr><th>Player</th><th>Accuracy</th><th>Upsets</th><th>Picked fav.</th><th>Biggest</th></tr></thead>'+
  '<tbody>'+(table||'<tr><td colspan="5">No members yet.</td></tr>')+'</tbody></table></div>'+
  '<p class="fan-subtle">Accuracy = correct / graded picks. Favorite % uses games with nonzero published spreads. Biggest = point spread of a correctly called outright upset. These stats never change official league points.</p></div></details>';
}
async function load(item=kindOf(),force=false){
 const u=user(),db=window.secOnline?.getClient?.();
 if(!u||!db||!item)return;
 const k=u.id+":"+item.kind+":"+item.id;
 if(!force&&k===key&&(loading||Date.now()-loadedAt<120000)){render();return;}
 key=k;rows=[];loading=true;error="";render();const v=++request;
 try{
  const result=await db.rpc("sec_league_brag_stats_v2",{p_kind:item.kind,p_league:item.id});
  if(result.error)throw result.error;
  if(v!==request||key!==k)return;
  rows=result.data||[];
  loadedAt=Date.now();
 }catch(e){if(v===request)error=e.message||"Try again.";}
 finally{if(v===request){loading=false;render();}}
}
window.SEC_BRAGS=Object.freeze({load,render,refresh:()=>load(kindOf(),true)});
})();