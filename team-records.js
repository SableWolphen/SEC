/* Saturdays Down South — source-verified favorite SEC team record tracker.
 * Never fabricate W-L: SEC, licensed Sportradar and ESPN data requires validation.
 * All three sports share the existing favorite team selection.
 */
(()=>{
 "use strict";
 const META={
  football:{label:"Football",emoji:"🏈"},
  basketball:{label:"Basketball",emoji:"🏀"},
  baseball:{label:"Baseball",emoji:"⚾"}
 };
 const ORDER=["football","basketball","baseball"];
 const RECORD=/^\d{1,3}-\d{1,3}(?:-\d{1,3})?$/;
 const escape=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let snapshot=null,checked=0,loading=false,error="";
 const cleanRecord=value=>typeof value==="string"&&RECORD.test(value)?value:null;
 function seasonLabel(sport,year){
  if(!Number.isInteger(year)||year<2020||year>2100)return "Season pending";
  return sport==="basketball"?(year-1)+"–"+String(year).slice(-2):String(year);
 }
 function entry(team,sport){
  const item=snapshot?.teams?.[team]?.[sport];
  if(!item||!["ESPN","SEC","Sportradar"].includes(item.source)||!cleanRecord(item.overall)||
    !Number.isInteger(item.season)||item.season!==snapshot?.seasons?.[sport])return null;
  return item;
 }
 function updated(){
  if(!snapshot?.updated_at)return "Waiting for first verified update";
  const ms=Date.parse(snapshot.updated_at);
  return Number.isFinite(ms)?"Checked "+new Date(ms).toLocaleString("en-US",
   {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"Update time unavailable";
 }
 function sportCard(id,sport){
  const item=entry(id,sport),meta=META[sport];
  const season=item?item.season:snapshot?.seasons?.[sport];
  const overall=item?item.overall:"—";
  const conf=item&&cleanRecord(item.conference)?item.conference:null;
  const label=!item?"Verified record unavailable":
   item.scope==="Regular season"?"Regular-season record":
   item.scope==="Final 2026 season"?"2026 final record":
   item.scope==="Sportradar season standings"?"Sportradar standings":"Overall record";
  const sourceUrls={
   SEC:"https://www.secsports.com/standings/baseball",
   Sportradar:"https://developer.sportradar.com/baseball/reference/global-baseball-season-standings"
  };
  const url=item?.source==="SEC"&&item?.source_url===sourceUrls.SEC?item.source_url:
   item?.source==="Sportradar"&&item?.source_url===sourceUrls.Sportradar?item.source_url:
   item?.source==="ESPN"&&item?.source_url&&
   /^https:\/\/www\.espn\.com\/[a-z/-]+\/team\/_\/id\/\d+$/.test(item.source_url)?
   item.source_url:null;
  return '<article class="team-record-sport"><div class="record-sport-head"><span aria-hidden="true">'+meta.emoji+'</span>'+
   '<strong>'+meta.label+'</strong><span class="record-season">'+escape(seasonLabel(sport,season))+'</span></div>'+
   '<div class="record-big'+(item?"":" missing")+'">'+escape(overall)+'</div>'+
   '<div class="record-sport-desc">'+label+'</div>'+
   '<div class="record-conference">'+(conf?"SEC: "+escape(conf):"Conference record: —")+'</div>'+
   (url?'<a class="record-source" href="'+escape(url)+'" target="_blank" rel="noopener noreferrer" '+
   'aria-label="See '+meta.label+' record at original publisher">'+(item.source==="SEC"?"SEC standings ↗":item.source==="Sportradar"?"Sportradar source ↗":"ESPN records ↗")+'</a>':"")+'</article>';
 }
 function spotlight(id,teams,logo){
  if(!id||!teams[id]){
   return '<section class="team-record-empty" aria-label="Your team records">'+
    '<span aria-hidden="true">★</span><div><div class="record-eyebrow">YOUR TEAM HQ</div>'+
    '<h2>Every season. One favorite.</h2><p>Tap ★ on a school below to follow its football, basketball and baseball records here.</p>'+
    '</div></section>';
  }
  const t=teams[id];
  return '<section class="team-record-feature" aria-label="'+escape(t.name)+' season records">'+
   '<div class="team-record-feature-head"><div class="record-favorite-name">'+logo(id)+
   '<div><div class="record-eyebrow">★ YOUR FAVORITE SEC SCHOOL</div>'+
   '<h2>'+escape(t.name)+' <span>'+escape(t.nick)+'</span></h2>'+
   '<p>Follow all three teams in one place.</p></div></div>'+
   '<button type="button" class="record-refresh-btn" data-record-refresh '+(loading?'disabled':'')+'>'+
   (loading?"Updating…":"↻ Update records")+'</button></div>'+
   '<div class="team-record-grid">'+ORDER.map(s=>sportCard(id,s)).join("")+'</div>'+
   '<div class="team-record-resources" aria-label="Official college baseball data sources">'+
     '<strong>⚾ More baseball stats</strong>'+
     '<a href="https://stats.secsports.com/#team" target="_blank" rel="noopener noreferrer">SEC team statistics ↗</a>'+
     '<a href="https://www.ncaa.org/championships/statistics-and-records/baseball/" target="_blank" rel="noopener noreferrer">NCAA season records ↗</a>'+
     '<a href="https://developer.sportradar.com/baseball/reference/global-baseball-overview" target="_blank" rel="noopener noreferrer">Sportradar API details ↗</a>'+
   '</div>'+
   '<div class="record-footnote" role="status">'+escape(updated())+' · Source-verified records (not live play-by-play)'+
   (error?' · '+escape(error):"")+'</div></section>';
 }
 function compact(id){
  return '<div class="team-mini-records" aria-label="Football, basketball, and baseball season records">'+
   ORDER.map(s=>{
    const meta=META[s],e=entry(id,s),year=e?.season||snapshot?.seasons?.[s];
    return '<span class="team-mini-record" title="'+escape(meta.label)+' '+escape(seasonLabel(s,year))+
     ' overall record"><span aria-hidden="true">'+meta.emoji+'</span> <strong>'+
     escape(e?.overall||"—")+'</strong></span>';
   }).join("")+'</div>';
 }
 async function refresh(force=false){
  if(loading)return;
  if(!force&&snapshot&&Date.now()-checked<15*60000)return;
  loading=true;
  try{
   const res=await fetch("./team-records.json?feed=1",{cache:"no-store"});
   if(!res.ok)throw Error("Records feed unavailable");
   const data=await res.json();
   if(!data||data.source!=="ESPN"||!data.teams||typeof data.teams!=="object"||
      !data.seasons||typeof data.seasons!=="object")throw Error("Records feed invalid");
   snapshot=data;checked=Date.now();error="";
  }catch(e){
   error=snapshot?"Could not refresh; showing last verified records.":"Waiting for source-verified team records.";
  }finally{
   loading=false;
   if(window.SEC_BRIDGE?.view?.()==="teams")window.SEC_BRIDGE?.renderTeams?.();
  }
 }
 document.addEventListener("click",event=>{
  if(!event.target.closest("[data-record-refresh]"))return;
  event.preventDefault();void refresh(true);
 });
 window.SEC_TEAM_RECORDS=Object.freeze({
  spotlight,compact,refresh,entry,getSnapshot:()=>snapshot
 });
 // Deep-linked #teams is mounted by the inline script before this module is loaded.
 if(window.SEC_BRIDGE?.view?.()==="teams")void refresh();
})();