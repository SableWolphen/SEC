/* SEC League Shockwave & Weekly Recap — secured, free, factual, no early pick reveals. */
(()=>{
"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const db=()=>window.secOnline?.getClient?.(),user=()=>window.secOnline?.getUser?.();
const selected=()=>window.SEC_LEAGUE_SETTINGS?.getSelected?.();
const FIELDS=["club","football","basketball","baseball"];
const ROWS=new Map(),PENDING=new Set(),GAMES=new Map();
let weeklyKey="";
let weeklyExpanded=false;
document.addEventListener?.("toggle",e=>{
 if(e.target?.id==="sec-weekly-fold")weeklyExpanded=e.target.open;
},true);
const code=g=>({away:String(g.away_code||g.away||""),home:String(g.home_code||g.home||"")});
function allowed(item,sport){
 return Boolean(item?.id&&FIELDS.includes(item.kind)&&
  (item.kind===sport||(item.kind==="club"&&
   Array.isArray(item.sports)&&item.sports.includes(sport))));
}
const cacheKey=(item,g,sport)=>user()?.id+":"+item.kind+":"+item.id+":"+sport+":"+g.id;
const knownScore=g=>Number.isInteger(g.away_score??g.awayScore)&&Number.isInteger(g.home_score??g.homeScore);
const status=g=>String(g.game_status||g.liveStatus||"scheduled").toLowerCase();
const names=(g,sport)=>sport==="football"?
 {away:window.SEC_PRIDE?.names?.[code(g).away]||code(g).away,
 home:window.SEC_PRIDE?.names?.[code(g).home]||code(g).home}:
 {away:g.away_name||code(g).away,home:g.home_name||code(g).home};
function upset(g,sport="football"){
 // Only explicitly sourced lines classify underdogs. In-game and postgame
 // comparisons are against the CURRENT published line, not a frozen pregame snapshot.
 const line=g?.spread_home;
 if(line===null||line===undefined||line===""||!Number.isFinite(Number(line))||
   Number(line)===0||!g.spread_source)return null;
 const source=String(g.spread_source);
 const current=status(g),{away,home}=code(g),side=Number(line)>0?away:home;
 const underdog=Number(line)>0?home:away;
 const title=names(g,sport),fav=side===away?title.away:title.home,challenger=underdog===away?title.away:title.home;
 if(current!=="live"&&current!=="final")
  return {label:"👀 UNDERDOG WATCH",message:challenger+" is the underdog against "+fav+
   " on the published "+Math.abs(Number(line)).toFixed(1)+"-point line.",underdog};
 if(!knownScore(g))return null;
 const a=Number(g.away_score??g.awayScore),h=Number(g.home_score??g.homeScore);
 const ahead=a>h?away:h>a?home:null;
 if(ahead!==underdog)return null;
 // A final upset must agree with the confirmed winner, not only the score.
 // A provisional or conflicting final may not be announced as a completed upset.
 if(current==="final"&&String(g.winner||g.winner_code||"")!==ahead)return null;
 return {label:current==="live"?"⚡ UPSET WATCH":"⚡ UNDERDOG WIN",
  message:challenger+(current==="live"?" leads right now. If that result holds, it would surprise the listed favorite.":
   " finished ahead of the currently listed favorite.")+
   " Line sourced from "+source+"; historical pregame pricing is not archived.",underdog};
}
function pulseMarkup(item,g,sport,row){
 const ts=names(g,sport),counts=Number(row?.total_picks||0);
 const a=Number(row?.away_picks||0),h=Number(row?.home_picks||0);
 const pct=counts?Math.round(a/counts*100):0;
 const correct=Number(row?.winner_picks||0),wrong=Number(row?.losing_picks||0);
 const final=row?.finalized===true,locked=row?.locked===true;
 const summary=!locked?"Picks reveal at kickoff.":
  !counts?"No league picks yet.":
  final?correct+" of "+counts+" called the winner.":
  a===h?"Your league is split evenly.":
  (a>h?ts.away:ts.home)+" has the most league picks.";
 return '<div class="sec-shockwave-compact" aria-label="League picks">'+
  '<div class="sec-shockwave-head"><strong>⚡ League picks</strong><small>'+esc(item.name||"My league")+'</small></div>'+
  '<p class="sec-shockwave-summary">'+esc(summary)+'</p>'+
  (locked&&counts?'<details class="sec-game-more"><summary>See the '+counts+' picks</summary>'+
   '<div class="sec-game-more-body"><div class="sec-shockwave-labels"><span>'+esc(ts.away)+" "+a+
   '</span><span>'+esc(ts.home)+" "+h+'</span></div>'+
   '<div class="sec-shockwave-track"><i style="width:'+pct+'%"></i></div>'+
   (final?'<small>'+correct+' correct, '+wrong+' missed based on outright results.</small>':"")+
   '</div></details>':"")+'</div>';
}
function initial(g,sport){
 const item=selected();
 if(!user()||!allowed(item,sport))return "";
 const k=cacheKey(item,g,sport),found=ROWS.get(k);
 return pulseMarkup(item,g,sport,found?.row||null);
}
function renderGame(k){
 const record=GAMES.get(k);if(!record)return;
 const {g,sport,item}=record,cache=ROWS.get(k);
 for(const panel of document.querySelectorAll("[data-community-game]")){
  if(panel.dataset.communityGame!==sport+":"+g.id)continue;
  const box=panel.querySelector(".sec-league-shockwave");
  if(box)box.innerHTML=pulseMarkup(item,g,sport,cache?.row||null);
 }
}
async function load(g,sport="football",force=false){
 const item=selected(),u=user();
 if(!g?.id||!u||!allowed(item,sport)||!db())return;
 const k=cacheKey(item,g,sport);
 GAMES.set(k,{g,sport,item});
 const kickoff=Date.parse(g.kickoff_at||g.kickoff||"");
 if(!Number.isFinite(kickoff)||kickoff>Date.now()){
  renderGame(k);return;
 }
 const found=ROWS.get(k);
 if(!force&&found&&Date.now()-found.at<(status(g)==="live"?30000:90000)){renderGame(k);return;}
 if(PENDING.has(k))return;
 PENDING.add(k);
 try{
  const res=await db().rpc("sec_league_game_pulse",{p_kind:item.kind,p_league:item.id,p_sport:sport,p_game:String(g.id)});
  if(res.error)throw res.error;
  if(user()?.id!==u.id||selected()?.kind!==item.kind||selected()?.id!==item.id)return;
  ROWS.set(k,{row:Array.isArray(res.data)&&res.data.length?res.data[0]:null,at:Date.now()});
 }catch(e){
  console.info("League Shockwave unavailable:",e.message||e);
 }finally{PENDING.delete(k);renderGame(k);}
}
function weekly(item,rows){
 const el=document.getElementById("fan-weekly-recap");if(!el)return;
 if(!user()||!allowed(item,item?.kind==="club"?"football":item?.kind)){
  if(!item||!user()){el.innerHTML="";return;}
 }
 if(!item||!Array.isArray(rows)){el.innerHTML="";return;}
 const graded=rows.filter(p=>Number(p.weekly_graded)>=3);
 if(!graded.length){
  el.innerHTML='<div class="sec-weekly-recap"><div class="sec-recap-kicker">🏅 THE WEEKLY RECEIPTS</div>'+
    '<p class="fan-subtle">Winners and bounce-backs appear after enough league picks have verified final results.</p></div>';
  return;
 }
 const sorted=graded.slice().sort((a,b)=>
  Number(b.weekly_correct)/Number(b.weekly_graded)-Number(a.weekly_correct)/Number(a.weekly_graded));
 const best=sorted[0],tough=graded.length>1?sorted[sorted.length-1]:null;
 const rise=rows.filter(p=>p.previous_rank!=null&&Number(p.previous_rank)>Number(p.current_rank))
  .sort((a,b)=>(Number(b.previous_rank)-Number(b.current_rank))-
   (Number(a.previous_rank)-Number(a.current_rank)))[0];
 const badge=p=>window.SEC_PRIDE?.badge?.(p?.user_id)||"";
 const block=(emoji,title,p,detail)=>'<div class="sec-weekly-award">'+
  '<small>'+emoji+" "+title+'</small><strong>'+
   (p?esc(p.display_name||"Player")+badge(p):"Unclaimed")+
  '</strong><span>'+esc(detail)+'</span></div>';
 el.innerHTML='<details id="sec-weekly-fold" class="sec-weekly-recap brag-fold"'+
  (weeklyExpanded?' open':'')+' aria-label="Weekly league winners and losers">'+
  '<summary>🏅 Weekly awards <small>'+esc(best.display_name||"Top picker")+
  ' · '+Number(best.weekly_correct)+'/'+Number(best.weekly_graded)+' correct</small></summary><div class="brag-fold-body">'+
  '<div class="sec-recap-kicker">🏅 THE WEEKLY RECEIPTS</div>'+
  '<h3>This week’s winners &amp; comeback stories</h3>'+
  '<div class="sec-weekly-awards">'+
   block("🎯","Sharpest picker",best,Number(best.weekly_correct)+"/"+Number(best.weekly_graded)+" correct")+
   block("😬","Toughest slate",tough,tough?Number(tough.weekly_correct)+"/"+Number(tough.weekly_graded)+" correct":"Not enough players")+
   block("🚀","Biggest comeback",rise,rise?"Up "+(Number(rise.previous_rank)-Number(rise.current_rank))+" places":"No movement yet")+
   '</div><p class="sec-shockwave-note">Calculated from verified weekly picks and league rankings · minimum 3 graded picks for accuracy awards.</p></div></details>';
}
window.SEC_LEAGUE_INSIGHTS=Object.freeze({upset,initial,load,weekly,pulseMarkup});
})();