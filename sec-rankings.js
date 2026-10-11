/* Saturdays Down South — current source-verified national rankings for SEC schools.
 * A university rank is NEVER inferred from matchup snapshots or league standings.
 */
(()=>{
"use strict";
const SPORTS=["football","basketball","baseball"];
const SEC=new Set(["ALA","ARK","AUB","FLA","UGA","UK","LSU","MISS","MSST",
                   "MIZ","OU","SC","TENN","TEX","TAMU","VAN"]);
const SOURCE={
 football:"https://www.espn.com/college-football/rankings",
 basketball:"https://www.espn.com/mens-college-basketball/rankings",
 baseball:"https://www.espn.com/college-baseball/rankings"
};
const NCAA_BASEBALL="https://www.ncaa.com/rankings/baseball/d1/d1baseballcom-top-25";
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let data=null,lastChecked=0,inFlight=null,failed=false;
function season(sport,now=new Date()){
 const y=now.getUTCFullYear(),m=now.getUTCMonth()+1;
 return sport==="football"?(m>=8?y:y-1):
  sport==="basketball"?(m>=8?y+1:y):(m>=2?y:y-1);
}
function parseDate(d){
 if(typeof d!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(d))return null;
 const date=new Date(d+"T00:00:00Z");
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===d?date:null;
}
function pollFor(sport){
 if(!SPORTS.includes(sport)||data?.source!=="ESPN")return null;
 const p=data.sports?.[sport],d=parseDate(p?.published_at);
 const verified=p?.source==="ESPN"&&p?.source_url===SOURCE[sport]||
   sport==="baseball"&&p?.source==="NCAA"&&p?.source_url===NCAA_BASEBALL;
 if(!p||!d||!verified||
    !Number.isInteger(p.season)||p.season!==season(sport,d)||
    !Number.isInteger(p.poll_size)||p.poll_size<20||p.poll_size>25||
    typeof p.poll!=="string"||!p.poll||p.poll.length>65||
    !p.teams||typeof p.teams!=="object"||Array.isArray(p.teams))return null;
 if(d.getTime()>Date.now()+48*3600000||p.season<season(sport)-1)return null;
 for(const [code,entry] of Object.entries(p.teams)){
  if(!SEC.has(code)||!entry||!Number.isInteger(entry.rank)||entry.rank<1||entry.rank>25)return null;
 }
 return p;
}
function current(sport){
 const p=pollFor(sport);if(!p)return null;
 const days=(Date.now()-parseDate(p.published_at).getTime())/86400000;
 // Beyond five weeks this is a last-published historic poll, not a current rank.
 return p.season===season(sport)&&days>=-2&&days<=35?p:null;
}
function rank(code,sport="football"){
 if(!SEC.has(code))return null;
 return current(sport)?.teams?.[code]?.rank||null;
}
function badge(code,sport="football",showUnranked=false){
 const p=current(sport);
 if(!p||!SEC.has(code))return "";
 const rank=p.teams[code]?.rank||null;
 const name=safe(p.poll),date=safe(p.published_at);
 const label=(rank?"No. "+rank:"Unranked")+" in "+name+" ("+date+")";
 if(rank)return '<span class="sds-poll-rank" role="note" title="'+safe(label)+
  '" aria-label="'+safe(label)+'"><strong>#'+rank+'</strong><small>'+name+'</small></span>';
 return showUnranked?'<span class="sds-poll-unranked" title="'+safe(label)+
  '" aria-label="'+safe(label)+'">NR</span>':"";
}
function note(sport){
 const p=pollFor(sport);
 if(!p)return "Current national poll unavailable";
 const currentPoll=current(sport),date=parseDate(p.published_at);
 const when=date?.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"})||p.published_at;
 return (currentPoll?"":"Last published · ")+p.poll+" · "+when;
}
function sourceLink(sport){
 const p=pollFor(sport),text=note(sport);
 if(!p)return '<span class="sds-poll-source">'+safe(text)+'</span>';
 return '<a class="sds-poll-source" href="'+(p.source==="NCAA"?NCAA_BASEBALL:SOURCE[sport])+
  '" target="_blank" rel="noopener noreferrer">'+safe(text)+' ↗</a>';
}
function teamRows(code){
 return SPORTS.map(s=>{
  const p=pollFor(s),c=current(s),isRanked=Boolean(c?.teams?.[code]?.rank);
  const historic=p&&!c&&p.teams?.[code]?.rank;
  let value;
  if(isRanked)value='<strong class="sds-poll-position">#'+c.teams[code].rank+'</strong>';
  else if(c)value='<strong class="sds-poll-position unranked">NR</strong>';
  else if(historic)value='<strong class="sds-poll-position historic">Last #'+historic+'</strong>';
  else value='<span class="sds-poll-position unavailable">—</span>';
  const name=s==="football"?"Football":s==="basketball"?"Men's Basketball":"Baseball";
  return '<div class="sds-poll-row"><span>'+name+'</span>'+value+
   '<small>'+safe(note(s))+'</small></div>';
 }).join("");
}
function teamPanel(code){
 if(!SEC.has(code))return "";
 return '<section class="sds-polls-panel" aria-label="National college rankings">'+
 '<div class="sds-polls-heading"><strong>🏅 NATIONAL POLL RANKINGS</strong>'+
 '<button type="button" data-rankings-refresh aria-label="Refresh university poll rankings"'+
 (inFlight?' disabled':'')+'>↻ Check latest</button></div>'+
 '<div class="sds-poll-rows">'+teamRows(code)+'</div>'+
 '<p class="sds-polls-disclaimer">AP Top 25 for football and men’s basketball; D1Baseball or another named '+
 'publisher poll for baseball when available. Rankings are dated and not league standings. NR means '+
 'unranked in a verified current poll; — means no current poll was confirmed.</p></section>';
}
function validPayload(payload){
 if(!payload||payload.source!=="ESPN"||!payload.sports||typeof payload.sports!=="object"||
    Array.isArray(payload.sports))return false;
 return Object.keys(payload.sports).every(s=>SPORTS.includes(s)&&
  // Parse at load time; reject invalid/non-source poll entries instead of
  // showing even one spurious ranking.
  (()=>{const old=data;data=payload;const ok=Boolean(pollFor(s));data=old;return ok;})());
}
function repaint(){
 const v=window.SEC_BRIDGE?.view?.();
 if(v==="teams")window.SEC_BRIDGE?.renderTeams?.();
 if(v==="picks"&&document.activeElement?.matches?.("button,input,select,textarea")!==true)
  window.SEC_BRIDGE?.renderPicks?.();
 if(v==="home")window.SEC_HOME?.refresh?.();
 if(["basketball","baseball"].includes(v))window.SEC_SPORTS?.renderSport?.(v);
}
async function refresh(force=false){
 if(inFlight)return inFlight;
 if(!force&&lastChecked&&Date.now()-lastChecked<15*60000)return;
 inFlight=(async()=>{
  try{
   const r=await fetch("./rankings.json?poll=1",{cache:"no-store"});
   if(!r.ok)throw Error("University poll feed unavailable");
   const next=await r.json();
   if(!validPayload(next))throw Error("University poll data invalid");
   const changed=JSON.stringify(next.sports)!==JSON.stringify(data?.sports);
   data=next;failed=false;lastChecked=Date.now();
   if(changed)repaint();
  }catch(e){failed=true;lastChecked=Date.now();console.info("National rankings unavailable:",e.message);}
  finally{inFlight=null;}
 })();
 return inFlight;
}
document.addEventListener("click",e=>{
 if(e.target.closest?.("[data-rankings-refresh]")){e.preventDefault();void refresh(true);}
});
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible")void refresh();
});
setInterval(()=>{if(document.visibilityState==="visible")void refresh();},15*60000);
window.SEC_RANKINGS=Object.freeze({refresh,rank,badge,note,sourceLink,teamPanel,
 hasCurrent:s=>Boolean(current(s)),hasPublished:s=>Boolean(pollFor(s)),
 getPoll:s=>pollFor(s),getSnapshot:()=>data,getFailed:()=>failed});
void refresh();
})();