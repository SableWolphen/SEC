/* Compact SEC competitive tools: underdog watch, post-lock path to first,
 and explicit one-way transfer of only your own still-open football picks. */
(()=>{
"use strict";
const W=window,esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const mgr=()=>W.SEC_LEAGUE_SETTINGS,app=()=>W.SEC_BRIDGE,client=()=>W.secOnline?.getClient?.(),me=()=>W.secOnline?.getUser?.(),selected=()=>mgr()?.getSelected?.();
const open=()=>app()?.week?.()?.games||[];
const gameRow=g=>app()?.gameById?.[g.id]||g;
const number=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))?Number(x):null;
const day=()=>Date.now();
const footballLeague=item=>item?.kind==="football"?item.id:item?.kind==="club"&&item.sports?.includes("football")?item.detail?.football_league:null;
const key=item=>me()?.id+":"+item?.kind+":"+item?.id+":"+app()?.week?.()?.num;
let busy=false,preview=null,lastSelection="",pathCache=null,pathPending=null;
const upsetImpact=new Map(),upsetPending=new Set();
async function loadUpsetImpact(g){
 const item=selected(),u=me(),db=client();
 if(!item?.id||!u||!db||!["club","football"].includes(item.kind))return;
 const id=String(g.id),cacheKey=u.id+":"+item.kind+":"+item.id+":"+id;
 const value=upsetImpact.get(cacheKey);
 if(upsetPending.has(cacheKey)||value&&Date.now()-value.at<45000)return;
 upsetPending.add(cacheKey);
 try{
  const r=await db.rpc("sec_league_game_pulse",{
   p_kind:item.kind,p_league:item.id,p_sport:"football",p_game:id
  });
  if(r.error)throw r.error;
  if(me()?.id!==u.id||selected()?.id!==item.id||selected()?.kind!==item.kind)return;
  const row=Array.isArray(r.data)?r.data[0]:null;
  upsetImpact.set(cacheKey,{row,at:Date.now()});
  if(app()?.view?.()==="picks")renderUpsets();
 }catch{
  upsetImpact.set(cacheKey,{row:null,at:Date.now()});
 }finally{upsetPending.delete(cacheKey);}
}
function getImpact(g,underdog){
 const item=selected(),u=me();
 if(!item||!u)return "";
 const entry=upsetImpact.get(u.id+":"+item.kind+":"+item.id+":"+g.id)?.row;
 if(!entry?.locked||!Number.isFinite(Number(entry.total_picks)))return "";
 const home=underdog===g.away_code,atRisk=Number(home?entry.home_picks:entry.away_picks);
 const count=Number(entry.total_picks);
 if(!Number.isFinite(atRisk)||count<=0)return "";
 return atRisk+" of "+count+" league picks are on the favorite";
}
const toast=s=>app()?.toast?.(s);
function codeToName(c){return W.SEC_PRIDE?.names?.[c]||c;}
function renderUpsets(){
 const host=document.getElementById("sec-competition-picks");
 if(!host)return;
 const games=open().map(gameRow);
 const rows=games.map(g=>{
  const state=g.liveStatus||g.game_status||"scheduled";
  const obj={...g,game_status:state,away_score:g.awayScore??g.away_score,
   home_score:g.homeScore??g.home_score,spread_home:g.spread_home??g.spreadHome,
   away_code:g.away_code||g.away,home_code:g.home_code||g.home};
  if(state!=="live")return null;
  const u=W.SEC_LEAGUE_INSIGHTS?.upset?.(obj,"football");
  if(!u?.label?.includes("UPSET WATCH"))return null;
  const a=number(obj.away_score),h=number(obj.home_score);
  const underdog=u.underdog;
  const lead=underdog===obj.away_code?a-h:h-a;
  if(a===null||h===null||lead<=0)return null;
  void loadUpsetImpact(obj);
  return {id:g.id,label:codeToName(underdog),lead,match:obj.away_code+" – "+obj.home_code,
   impact:getImpact(obj,underdog)};
 }).filter(Boolean).slice(0,3);
 if(!rows.length){host.innerHTML="";host.hidden=true;return;}
 host.hidden=false;
 host.innerHTML='<details class="sec-competition-fold"><summary>⚡ Upset watch <span>'+rows.length+' underdog'+(rows.length===1?"":"s")+' leading</span></summary>'+
  '<div class="sec-competition-rows">'+rows.map(r=>'<div class="sec-competition-row"><strong>'+esc(r.label)+' leading by '+r.lead+
   '</strong><small>'+esc(r.match)+' · live, not final'+(r.impact?' · '+esc(r.impact):"")+'</small></div>').join("")+
  '</div><small class="sec-competition-muted">Based on published pregame lines; results are not final until confirmed.</small></details>';
}
function choices(){
 const list=(mgr()?.getLeagues?.()||[]).filter(i=>footballLeague(i)&&i.sports?.includes("football"));
 return list.map(i=>({...i,footballId:footballLeague(i),k:i.kind+":"+i.id}));
}
function copyUI(item){
 const els=choices(),host=document.getElementById("sec-competition-league");
 if(!host)return;
 const u=me(),current=els.find(x=>x.k===item?.kind+":"+item?.id);
 const options=els.map(i=>'<option value="'+esc(i.k)+'">'+esc(i.name)+' ('+esc(i.kind==="club"?"Multi-sport":"Football")+')</option>').join("");
 if(!u||els.length<2){host.innerHTML="";host.hidden=true;preview=null;return;}
 host.hidden=false;
 const cachedSource=preview?.source, cachedTarget=preview?.target;
 const src=cachedSource&&els.some(i=>i.k===cachedSource)?cachedSource:(current?.k||els[0].k);
 const dst=cachedTarget&&els.some(i=>i.k===cachedTarget&&i.footballId!==els.find(x=>x.k===src)?.footballId)?
  cachedTarget:(els.find(i=>i.footballId!==els.find(x=>x.k===src)?.footballId)?.k||"");
 if(!dst){host.hidden=true;host.innerHTML="";return;}
 const validPreview=preview?.at>0&&preview?.source===src&&preview?.target===dst&&preview?.user===u.id&&preview?.week===app()?.week?.()?.num;
 host.innerHTML='<details class="sec-competition-fold" id="sec-copy-fold" '+(preview?.open?'open':'')+'><summary>⇄ Copy picks between leagues <span>Only your picks</span></summary>'+
  '<p class="sec-competition-muted">Copy available football picks from one league into another. Existing destination picks are never replaced.</p>'+
  '<div class="sec-competition-transfer"><label>From<select data-copy-source aria-label="Copy picks from league">'+options.replace('value="'+esc(src)+'"','value="'+esc(src)+'" selected')+'</select></label>'+
  '<label>To<select data-copy-target aria-label="Copy picks to league">'+options.replace('value="'+esc(dst)+'"','value="'+esc(dst)+'" selected')+'</select></label></div>'+
  (src===dst?'<p class="sec-competition-muted">Choose two different leagues.</p>':
   validPreview?'<div class="sec-competition-preview" role="status">'+esc(preview.message)+
    (preview.candidates.length?'<button type="button" class="fan-small fan-primary" data-competition="apply" '+(busy?"disabled":"")+
     '>Confirm &amp; copy '+preview.candidates.length+' pick'+(preview.candidates.length===1?"":"s")+'</button>':"")+'</div>':
    '<button type="button" class="fan-small" data-competition="preview">Preview available picks</button>')+
  '</details>';
}
function entry(){
 let picks=document.getElementById("sec-competition-picks");
 const slate=document.getElementById("slate-pick-tools");
 if(slate&&!picks){picks=document.createElement("div");picks.id="sec-competition-picks";picks.hidden=true;slate.insertAdjacentElement("afterend",picks);}
 let leagues=document.getElementById("sec-competition-league");
 const anchor=document.getElementById("fan-league-choice");
 if(anchor&&!leagues){leagues=document.createElement("section");leagues.id="sec-competition-league";leagues.hidden=true;anchor.insertAdjacentElement("afterend",leagues);}
 const path=document.getElementById("sec-path-first");
 if(!path&&anchor){const el=document.createElement("section");el.id="sec-path-first";el.hidden=true;anchor.insertAdjacentElement("afterend",el);}
}
function onPicks(){entry();renderUpsets();}
function onLeague(){
 entry();
 const item=selected(),k=key(item);
 if(lastSelection!==k){preview=null;lastSelection=k;pathCache=null;}
 copyUI(item);
 renderPath();
 if(footballLeague(item)&&me()&&app()?.view?.()==="league")void loadPath(item);
}
async function previewCopy(){
 if(busy||!me()||!client())return;
 const host=document.getElementById("sec-competition-league"),src=host?.querySelector("[data-copy-source]")?.value,
  dst=host?.querySelector("[data-copy-target]")?.value;
 const list=choices(),a=list.find(x=>x.k===src),b=list.find(x=>x.k===dst);
 if(!a||!b||a.footballId===b.footballId){toast("Choose two different football leagues.");return;}
 busy=true;preview=null;
 const who=me().id,week=app()?.week?.()?.num;
 try{
  const games=open(),ids=games.map(g=>g.id);
  if(!ids.length)throw Error("This week has no matchups.");
  const [source,dest,modes,rows]=await Promise.all([
   client().from("sec_league_picks").select("game_id,pick_code").eq("league_id",a.footballId).eq("user_id",who).in("game_id",ids),
   client().from("sec_league_picks").select("game_id,pick_code").eq("league_id",b.footballId).eq("user_id",who).in("game_id",ids),
   client().from("sec_leagues").select("id,mode").in("id",[a.footballId,b.footballId]),
   client().from("sec_games").select("id,kickoff_at,away_code,home_code,spread_home").in("id",ids)
  ]);
  for(const r of [source,dest,modes,rows])if(r.error)throw r.error;
  if(me()?.id!==who||app()?.week?.()?.num!==week)return;
  const destSet=new Set((dest.data||[]).map(p=>p.game_id));
  const gameMap=new Map((rows.data||[]).map(g=>[g.id,g]));
  const targetMode=(modes.data||[]).find(i=>i.id===b.footballId)?.mode;
  if(!targetMode)throw Error("You must be a member of the destination football league.");
  const all=(source.data||[]).filter(p=>{
    const g=gameMap.get(p.game_id);
    return g&&day()<Date.parse(g.kickoff_at)&&
     !destSet.has(p.game_id)&&[g.away_code,g.home_code].includes(p.pick_code)&&
     !(targetMode==="spread"&&g.spread_home===null);
  });
  preview={source:src,target:dst,user:who,week,candidates:all,
   open:true,mode:targetMode,at:day(),
   message:all.length?all.length+" eligible pick"+(all.length===1?"":"s")+
    " ready to copy into "+b.name+". Locked games and existing picks will be skipped.":
    "No eligible picks to copy. Existing or locked games were skipped."};
  copyUI(selected());
 }catch(e){toast("Could not preview picks: "+(e.message||"Try again"));}
 finally{busy=false;copyUI(selected());}
}
async function applyCopy(){
 if(busy||!preview||!me()||!client())return;
 const p=preview,source=choices().find(x=>x.k===p.source),target=choices().find(x=>x.k===p.target);
 if(!source||!target||!p.candidates.length||p.user!==me().id||p.week!==app()?.week?.()?.num||
   day()-p.at>90000){preview=null;toast("Preview expired. Check again.");copyUI(selected());return;}
 if(!W.confirm("Copy "+p.candidates.length+" football picks from "+source.name+
   " to "+target.name+"? Only unpicked, unlocked games will be changed."))return;
 busy=true;
 try{
  // One server-side transaction: check membership, selected source picks,
  // game locks, destination rules and conflicts atomically. Never overwrites.
  const who=p.user;
  const result=await client().rpc("sec_copy_my_league_picks",{
   p_source:source.footballId,p_target:target.footballId,p_week:p.week,
   p_expected:p.candidates.map(x=>({game_id:x.game_id,pick_code:x.pick_code}))
  });
  if(result.error)throw result.error;
  if(me()?.id!==who)return;
  const saved=Number(result.data?.copied)||0,skipped=Number(result.data?.skipped)||0;
  preview=null;
  toast(saved+" pick"+(saved===1?"":"s")+" copied to "+target.name+(skipped?"; "+skipped+" skipped.":"."));
  if(W.secOnline?.getLeague?.()?.id===target.footballId)void W.secOnline?.refresh?.();
 }catch(e){toast("Could not copy picks: "+(e.message||"Try again"));}
 finally{busy=false;copyUI(selected());}
}
function scenario(standings,games,picks,uid){
 // Only started, revealed, nonfinal games can be projected. This is a set of
 // logical outcome scenarios, NOT a probability or prediction.
 const relevant=games.filter(g=>g.game_status==="live"&&!g.winner);
 if(!relevant.length||relevant.length>11||!standings.some(p=>p.user_id===uid))return null;
 const map=new Map(picks.map(p=>[p.user_id+"|"+p.game_id,p.pick_code]));
 const pts=p=>number(p.season_points)??0;
 const meRow=standings.find(p=>p.user_id===uid),rival=standings.filter(p=>p.user_id!==uid);
 if(!rival.length)return null;
 let best=null,winning=0,ties=0;
 for(let n=0;n<2**relevant.length;n++){
  const outcome=relevant.map((g,i)=>(n&(1<<i))?g.home_code:g.away_code);
  const calc=p=>pts(p)+relevant.reduce((total,g,i)=>
    total+Number(map.get(p.user_id+"|"+g.id)===outcome[i]),0);
  const own=calc(meRow),ahead=Math.max(...rival.map(calc)),margin=own-ahead;
  if(margin>0)winning++;
  else if(margin===0)ties++;
  if(margin<=0)continue;
  const distance=outcome.reduce((sum,c,i)=>{
   const g=relevant[i];return sum+Number((g.away_score>g.home_score?g.away_code:
    g.home_score>g.away_score?g.home_code:null)!==c);
  },0);
  if(!best||distance<best.distance){best={distance,outcome,games:relevant};}
 }
 return {best,winning,ties,total:2**relevant.length};
}
// A live scenario is a snapshot of confirmed games and revealed picks.
// Upcoming games NEVER block it; they stay excluded to preserve pick privacy.
// Official league rankings may apply tiebreakers absent from the simulation.
function rankStatus(rows,who){
 if(!rows.length)return {rank:null,count:0,gap:null,points:null};
 const points=p=>number(p.season_points);
 const mine=rows.find(p=>p.user_id===who),valid=rows.map(points).filter(x=>x!==null);
 if(!mine||!valid.length||points(mine)===null)return {rank:null,count:rows.length,gap:null,points:null};
 const minePoints=points(mine),top=Math.max(...valid);
 return {rank:1+rows.filter(p=>points(p)!==null&&points(p)>minePoints).length,
  count:rows.length,gap:Math.max(0,top-minePoints),points:minePoints};
}
function followingWeek(){
 const weeks=app()?.weeks||[],now=day();
 return weeks.flatMap(w=>w.games?.map(g=>({week:w.num,kickoff:Date.parse(g.kickoff||g.date+"T23:59:00Z")}))||[])
  .filter(x=>Number.isFinite(x.kickoff)&&x.kickoff>now)
  .sort((a,b)=>a.kickoff-b.kickoff)[0]||null;
}
async function loadPath(item){
 if(!footballLeague(item)||!me()||!client())return;
 const k=key(item),league=footballLeague(item),who=me().id;
 if(pathPending===k||pathCache?.key===k&&day()-pathCache.at<45000)return;
 pathPending=k;
 try{
  const db=client();
  const info=await db.from("sec_leagues").select("id,mode").eq("id",league).single();
  if(info.error)throw info.error;
  const mode=info.data?.mode;
  if(!["straight","h2h"].includes(mode)){
   pathCache={key:k,at:day(),message:"This league uses "+String(mode||"custom")+
    " scoring. An exact Path to 1st isn't supported for those scoring rules yet.",details:[]};
   renderPath();return;
  }
  const gs=open().map(g=>{
   const row=gameRow(g);
   return {id:g.id,away_code:g.away,home_code:g.home,
    kickoff_at:row.kickoff||g.kickoff,
    game_status:row.liveStatus||row.game_status||"scheduled",
    away_score:row.awayScore??row.away_score??null,
    home_score:row.homeScore??row.home_score??null,
    winner:row.winner||null};
  });
  const live=gs.filter(g=>g.game_status==="live"&&!g.winner&&
   Number.isFinite(Date.parse(g.kickoff_at))&&Date.parse(g.kickoff_at)<=day());
  const remaining=gs.filter(g=>g.game_status!=="final"&&
    !live.includes(g));
  const standingsRequest=item.kind==="club"?
   db.rpc("sec_club_standings",{p_club:item.id}):
   db.rpc("sec_league_standings_v3",{p_league:league,p_week:app().week().num});
  // Never request another member's picks until the kickoff-gated RPC permits
  // it. The server filters non-kicked-off picks even within the same week.
  const [s,r]=await Promise.all([
   standingsRequest,
   live.length&&live.length<=11?
    db.rpc("sec_revealed_league_picks",{p_league:league,p_week:app().week().num}):
    Promise.resolve({data:[],error:null})
  ]);
  if(s.error||r.error)throw s.error||r.error;
  if(key(selected())!==k||me()?.id!==who)return;
  const rows=(s.data||[]).map(p=>item.kind==="club"?{...p,season_points:p.total}:p);
  const rank=rankStatus(rows,who);
  const headline=rank.rank===null?"League standings are not available yet.":
   "Currently #"+rank.rank+" of "+rank.count+" · "+
   (rank.gap===0?"tied for the lead or leading":
    rank.gap+" point"+(rank.gap===1?"":"s")+" behind the leader");
  let message="",details=[];
  if(!live.length){
   const next=followingWeek();
   if(remaining.length){
    message=headline+". No confirmed live games right now. "+
     remaining.length+" matchup"+(remaining.length===1?" hasn't":"s haven't")+
     " started or been confirmed live yet. Opponents' picks stay hidden until kickoff.";
   }else{
    message=headline+". Week "+app().week().num+
     " has finished. "+(next?"Next games are in Week "+next.week+".":"No upcoming football games are scheduled.");
   }
  }else if(live.length>11){
   message=headline+". "+live.length+" games are live; too many combinations to show an exact scenario.";
  }else{
   const outcome=scenario(rows,live,r.data||[],who);
   if(!outcome){
    message=headline+". Waiting for confirmed live picks and standings.";
   }else{
    const qualify=outcome.winning+" of "+outcome.total;
    if(outcome.best){
     message=qualify+" live-game outcomes put you in outright first "+
      (remaining.length?"temporarily":"for the current slate")+".";
     details=outcome.best.games.map((g,i)=>({id:g.id,code:outcome.best.outcome[i]}));
    }else if(outcome.ties){
     message="No outright-first live outcome right now, but "+outcome.ties+
      " of "+outcome.total+" scenarios can tie for the lead.";
    }else{
     message="No combination of the currently live games moves you to outright first.";
    }
    if(remaining.length)message+=" "+remaining.length+
     " game"+(remaining.length===1?" has":"s have")+" not started or reached confirmed live status;"+
     " these future results are not included.";
    message=headline+". "+message;
   }
  }
  if(item.kind==="club")
   message="Football-only scenarios; other sports' points held constant. "+message;
  pathCache={key:k,at:day(),message,details,liveCount:live.length,
   pendingCount:remaining.length,week:app().week().num};
  renderPath();
 }catch(e){
  if(key(selected())===k){
   console.info("Path to 1st:",e?.message||"Unable to load");
   pathCache={key:k,at:day(),message:"Unable to load verified league standings. "+
    "Use Recheck to retry; your existing picks were not changed.",details:[]};
   renderPath();
  }
 }finally{if(pathPending===k)pathPending=null;}
}
function renderPath(){
 const host=document.getElementById("sec-path-first"),item=selected();
 if(!host)return;
 if(!footballLeague(item)||!me()){host.innerHTML="";host.hidden=true;return;}
 const expanded=host.querySelector?.("#sec-path-fold")?.open||false;
 host.hidden=false;
 const valid=pathCache?.key===key(item);
 const data=valid?pathCache:null;
 host.innerHTML='<details class="sec-competition-fold" id="sec-path-fold"'+
  (expanded?' open':'')+'><summary>🏆 Path to 1st <span>'+
  (data?.liveCount?data.liveCount+" live game"+(data.liveCount===1?"":"s"):"Your league outlook")+
  '</span></summary>'+
  '<div class="sec-competition-preview" role="status" aria-live="polite"><p>'+
  esc(data?.message||"Checking league standings and game status…")+'</p>'+
  (data?.details?.length?'<strong>One possible live-game route:</strong>'+
   '<div class="sec-competition-rows">'+data.details.map(x=>
    '<div class="sec-competition-row">'+esc(codeToName(x.code))+
    ' needs to win</div>').join("")+'</div>'+
   '<small class="sec-competition-muted">Provisional scenario, not a forecast or an official tiebreaker. Opponents’ unstarted picks stay private.</small>':"")+
  '<button type="button" class="fan-small" data-competition="path">↻ Recheck</button>'+
  '</div></details>';
}

document.addEventListener("change",e=>{
 if(!e.target.matches?.("[data-copy-source],[data-copy-target]"))return;
 const host=document.getElementById("sec-competition-league"),from=host?.querySelector("[data-copy-source]")?.value,to=host?.querySelector("[data-copy-target]")?.value;
 const wasOpen=host?.querySelector("#sec-copy-fold")?.open;
 preview={source:from,target:to,user:me()?.id,week:app()?.week?.()?.num,candidates:[],message:"",open:wasOpen,at:0};
 copyUI(selected());
});
document.addEventListener("click",e=>{
 const button=e.target.closest?.("[data-competition]");if(!button)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(button.dataset.competition==="preview")void previewCopy();
 if(button.dataset.competition==="apply")void applyCopy();
 if(button.dataset.competition==="path"){pathCache=null;void loadPath(selected());}
},true);
W.SEC_COMPETITIVE=Object.freeze({onPicks,onLeague,renderUpsets,scenario,rankStatus,choices,
 refreshPath:()=>{const item=selected();if(footballLeague(item)&&app()?.view?.()==="league")void loadPath(item);}});
if(app()?.view?.()==="league")onLeague();
else if(app()?.view?.()==="picks")onPicks();
})();
