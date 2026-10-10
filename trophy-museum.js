/* SEC Trophy Museum — visual presentation on top of verified existing results. */
(()=>{
"use strict";
let selectedSport="all",historyOpen=false,showAllRivals=false,expandedAllSchools=false;
let lastContext=null,lastRoot=null,weeklyCache=new Map(),weeklyInFlight=new Set();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const winList=()=>window.SEC_SOCIAL?.getChampions?.()||[];
const currentLeague=()=>window.secOnline?.getLeague?.()||null;
const currentUser=()=>window.secOnline?.getUser?.()||null;
function trophySvg(sport){
 const ball=sport==="football"
  ?'<path d="M86 51Q116 12 153 42Q169 71 128 106Q91 89 86 51Z" fill="url(#ball)" stroke="#ffe9ab" stroke-width="2"/><path d="M96 45Q125 51 145 85M102 83Q129 62 143 54" fill="none" stroke="#b57b38" stroke-width="2"/><path d="M115 48L131 77M119 54L111 60M124 61L116 67M129 69L121 75" stroke="#fff1d0" stroke-width="2" fill="none"/>'
  :sport==="basketball"
  ?'<circle cx="122" cy="59" r="43" fill="url(#ball)" stroke="#fff0b3" stroke-width="2"/><circle cx="122" cy="59" r="42" fill="none" stroke="#945b20" stroke-width="1.7"/><path d="M79 59H165M122 16V102M90 30Q129 60 91 91M154 28Q112 59 155 91" fill="none" stroke="#9f6427" stroke-width="3"/>'
  :'<circle cx="122" cy="59" r="42" fill="url(#baseball)" stroke="#fff1c5" stroke-width="3"/><path d="M100 21Q125 58 99 96M143 21Q119 58 146 96" fill="none" stroke="#b74442" stroke-width="2.5" stroke-dasharray="5 4"/>';
 return '<svg class="museum-trophy-svg" viewBox="0 0 244 252" role="img" aria-label="'+esc(sport)+' championship trophy illustration" xmlns="http://www.w3.org/2000/svg">'+
 '<defs><linearGradient id="metal" x1="0" x2="1"><stop offset="0" stop-color="#704116"/><stop offset=".18" stop-color="#ffdc81"/><stop offset=".38" stop-color="#b98233"/><stop offset=".67" stop-color="#ffeaaa"/><stop offset="1" stop-color="#784116"/></linearGradient>'+
 '<radialGradient id="ball"><stop offset="0" stop-color="#fff0ac"/><stop offset=".6" stop-color="#e7ac4b"/><stop offset="1" stop-color="#94551f"/></radialGradient><radialGradient id="baseball"><stop offset="0" stop-color="#fffdf1"/><stop offset="1" stop-color="#d1b894"/></radialGradient></defs>'+
 '<ellipse cx="121" cy="222" rx="95" ry="16" fill="#d3943755"/>'+
 '<path d="M79 117L92 190H151L166 116L144 102H99Z" fill="url(#metal)" stroke="#e8b965" stroke-width="3"/>'+
 '<path d="M73 125Q46 123 56 70M170 124Q199 120 188 70" fill="none" stroke="url(#metal)" stroke-width="15" stroke-linecap="round"/>'+
 ball+
 '<path d="M97 103H147L152 185H91Z" fill="url(#metal)" opacity=".65"/>'+
 '<circle cx="122" cy="153" r="27" fill="#10233a" stroke="#ffe4a0" stroke-width="5"/>'+
 '<text x="122" y="162" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="20" fill="#ffdc79">SEC</text>'+
 '<rect x="70" y="187" width="104" height="13" rx="3" fill="url(#metal)"/>'+
 '<path d="M58 202H185L193 224H50Z" fill="url(#metal)" stroke="#e7b45d" stroke-width="2"/>'+
 '<rect x="71" y="207" width="102" height="15" rx="2" fill="#162335" stroke="#fff0b1" stroke-width="1.5"/>'+
 '<text x="122" y="217.5" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="11" fill="#f4c46b">CHAMPION</text>'+
 '<rect x="37" y="224" width="170" height="14" rx="2" fill="#8e581f" stroke="#ffe098" stroke-width="2"/>'+
 '</svg>';
}
function sectionHead(icon,title,subtitle,right=""){
 return '<div class="museum-section-head"><div class="museum-section-title"><span class="museum-section-icon" aria-hidden="true">'+icon+'</span><div><h3>'+esc(title)+'</h3><p>'+esc(subtitle)+'</p></div></div>'+right+'</div>';
}
const sportNames={football:"Football",basketball:"Basketball",baseball:"Baseball"};
function champions(sport,userId){
 if(sport!=="football")return []; // No finalized archive for these sports yet.
 return winList().filter(c=>String(c.champion_user_id)===String(userId)&&userId);
}
function champCard(sport,userId,league){
 const owned=champions(sport,userId).length>0,c=champions(sport,userId)[0];
 const future=sport!=="football";
 const note=owned?c.season+" · "+esc(league?.name||"Your league"):future?"Awaiting verified season titles":league?"Season underway":"Join a league to compete";
 return '<article class="museum-champ '+(owned?"earned":"locked")+'"><div class="museum-art">'+trophySvg(sport)+
  (!owned?'<span class="museum-lock" aria-label="Not earned">🔒</span>':'')+'</div>'+
  '<div class="museum-caption"><strong>'+sportNames[sport]+' Champion</strong>'+
  '<small>Win your league at the end of the season</small>'+
  '<span class="museum-status '+(owned?"earned":"")+'">'+(owned?"✓ EARNED · "+esc(String(c.season)):"◷ "+esc(note))+'</span></div></article>';
}
function confirmedWeek(w,results){
 return w.games.length>0&&w.games.every(g=>{
  const row=results.get(g.id);
  return row&&["final","canceled"].includes(row.game_status||row.liveStatus);
 });
}
function loadWeekly(ctx){
 const league=currentLeague(),user=currentUser(),client=window.secOnline?.getClient?.();
 if(!ctx.signedIn||!league?.id||!user?.id||!client?.rpc)return;
 const resultMap=new Map(ctx.verified.map(x=>[x.id,x]));
 const year=2026,keyBase=String(league.id)+"|"+String(user.id)+"|"+year;
 for(const w of (window.SEC_BRIDGE?.weeks||[])){
  if(!confirmedWeek(w,resultMap))continue;
  const key=keyBase+"|"+w.num;
  if(weeklyCache.has(key)||weeklyInFlight.has(key))continue;
  weeklyInFlight.add(key);
  Promise.resolve(client.rpc("sec_league_standings_v3",{p_league:league.id,p_week:w.num}))
   .then(res=>{
    if(res?.error)throw res.error;
    const rows=Array.isArray(res?.data)?res.data:[];
    const best=Math.max(0,...rows.map(x=>Number(x.week_points)||0));
    const earned=best>0&&rows.some(x=>x.user_id===user.id&&Number(x.week_points)===best);
    weeklyCache.set(key,{earned,score:best});
    if(currentLeague()?.id===league.id&&currentUser()?.id===user.id&&window.SEC_BRIDGE?.view?.()==="trophies")refresh();
   })
   .catch(e=>{console.info("Weekly medal standings unavailable:",e.message)})
   .finally(()=>weeklyInFlight.delete(key));
 }
}
function weeklyAwards(ctx){
 const league=currentLeague(),user=currentUser();
 const results=new Map(ctx.verified.map(x=>[x.id,x]));
 const weeks=(window.SEC_BRIDGE?.weeks||[]).slice(0,14);
 if(!weeks.length)return '<p class="museum-muted">Weekly medals appear when football league results are available.</p>';
 const keyBase=String(league?.id||"")+"|"+String(user?.id||"")+"|2026";
 return '<div class="museum-medals" aria-label="Weekly award medals">'+weeks.map(w=>{
  const rec=weeklyCache.get(keyBase+"|"+w.num);
  const earned=Boolean(ctx.signedIn&&rec?.earned);
  const settled=confirmedWeek(w,results);
  return '<div class="museum-medal-wrap"><div class="museum-medal '+(earned?"earned":"locked")+'" aria-label="'+
   (earned?"Earned weekly top score":"Weekly medal locked")+' for week '+w.num+'">'+
   (earned?"★":'<span class="lock" aria-hidden="true">🔒</span>')+'</div><strong>W'+w.num+'</strong>'+
   '<span>'+(earned?"Top score":settled?"Not earned":"Locked")+'</span></div>';
 }).join("")+'</div>';
}
function achievementData(ctx){
 const me=currentUser(),lg=currentLeague(),userId=me?.id;
 const ownedChamps=champions("football",userId);
 const results=new Map(ctx.verified.map(x=>[x.id,x]));
 const state=window.SEC_BRIDGE?.state?.()||{};
 const allWeeks=window.SEC_BRIDGE?.weeks||[];
 const hasAccount=Boolean(ctx.signedIn&&lg?.id&&userId);
 let perfect=0,maxStreak=0,run=0;
 if(hasAccount){
  for(const w of allWeeks){
   const playable=w.games.filter(g=>results.get(g.id)?.game_status!=="canceled");
   if(playable.length&&confirmedWeek(w,results)&&playable.every(g=>state.picks?.[g.id]&&state.picks[g.id]===results.get(g.id)?.winner))perfect++;
  }
  const games=allWeeks.flatMap(w=>w.games).slice().sort((a,b)=>Date.parse(a.kickoff||a.date)-Date.parse(b.kickoff||b.date));
  for(const g of games){
   const r=results.get(g.id);
   if(r?.game_status!=="final"||!r.winner)continue;
   run=state.picks?.[g.id]===r.winner?run+1:0;maxStreak=Math.max(maxStreak,run);
  }
 }
 return [
  {symbol:"🎯",name:"Perfect Week",meta:perfect+" earned",earned:perfect>0},
  {symbol:"🔥",name:"Win Streak",meta:maxStreak+"/3 straight",earned:maxStreak>=3},
  {symbol:"📊",name:"Top 3 Finish",meta:"Awaiting final ranks",earned:false},
  {symbol:"👥",name:"League Founder",meta:hasAccount&&lg.owner_id===userId?"Earned":"Not earned",earned:hasAccount&&lg.owner_id===userId},
  {symbol:"👑",name:"Repeat Champion",meta:ownedChamps.length+"/2 titles",earned:ownedChamps.length>=2}
 ];
}
function render(ctx){
 if(!ctx?.root)return false;
 lastContext=ctx;lastRoot=ctx.root;
 const root=ctx.root,me=currentUser(),lg=currentLeague();
 const sports=selectedSport==="all"?["football","basketball","baseball"]:[selectedSport];
 root.classList.add("sds-museum");
 const current=selectedSport;
 root.innerHTML='<div class="museum-head"><div class="museum-brand"><div class="museum-seal" aria-hidden="true">SEC</div>'+
  '<div><h2>🏆 Trophy Case</h2><p>Your championships, rivalries, and achievements</p></div></div>'+
  '<select class="museum-filter" data-museum-select aria-label="Filter trophy case by sport">'+
  [["all","All Sports"],["football","Football"],["basketball","Basketball"],["baseball","Baseball"]].map(([id,title])=>'<option value="'+id+'"'+(current===id?" selected":"")+'>'+title+'</option>').join("")+
  '</select></div>'+
  '<nav class="museum-sports" aria-label="Trophy Case sports">'+
  [["all","🏆 Trophy Case"],["football","🏈 Football"],["basketball","🏀 Basketball"],["baseball","⚾ Baseball"]].map(([id,label])=>'<button type="button" data-museum-sport="'+id+'" aria-pressed="'+(current===id)+'" class="'+(current===id?"active":"")+'">'+label+'</button>').join("")+'</nav>'+
  '<section class="museum-section" aria-label="Pickem championships">'+
  sectionHead("👑","PICK’EM CHAMPIONSHIPS","Win your league to earn a championship trophy",
   '<button type="button" class="museum-section-cta" data-museum-history aria-expanded="'+historyOpen+'">View History ›</button>')+
  '<div class="museum-champ-grid">'+sports.map(x=>champCard(x,me?.id,lg)).join("")+'</div>'+
  (historyOpen?'<div class="museum-history">'+(lg?
    (window.SEC_SOCIAL?.renderChampionship?.()||'<p class="museum-muted">Loading verified league championships…</p>'):
    '<p class="museum-muted">Join a football league to view its official championship history.</p>')+
    '</div>':'')+'</section>'+
  '<section class="museum-section">'+sectionHead("🏅","WEEKLY AWARDS","Top weekly scores earn a medal")+
  (selectedSport==="all"||selectedSport==="football"?weeklyAwards(ctx):'<p class="museum-muted">Verified weekly award history is not yet available for '+esc(selectedSport)+'.</p>')+'</section>'+
  '<section class="museum-section">'+sectionHead("⭐","ACHIEVEMENTS","Special awards for big milestones")+
  '<div class="museum-achievements">'+achievementData(ctx).map(x=>'<div class="museum-achieve '+(x.earned?"earned":"locked")+'">'+
   (!x.earned?'<span class="mini-lock" aria-label="Locked">🔒</span>':'')+
   '<span class="symbol" aria-hidden="true">'+x.symbol+'</span><strong class="achieve-name">'+esc(x.name)+'</strong>'+
   '<small class="achieve-meta '+(x.earned?"earned-text":"")+'">'+(x.earned?"✓ ":"")+esc(x.meta)+'</small></div>').join("")+'</div></section>'+
  ((selectedSport==="all"||selectedSport==="football")?
   '<section class="museum-section"><div id="museum-rivalry-head">'+
   sectionHead("⚔️","RIVALRY TROPHIES","Classic SEC rivalries and named trophy contests",
    '<button type="button" class="museum-section-cta" data-museum-all-rivalries aria-expanded="'+showAllRivals+'">'+ctx.owned().length+' / '+ctx.trophies.length+' ›</button>')+
   '</div><div class="museum-rivalries" id="museum-rivalries"></div></section>'+
   '<section class="museum-section">'+sectionHead("🏅","SCHOOLS & THEIR TROPHIES","Expand a school to view its trophy collection",
     '<button type="button" class="museum-section-cta" data-museum-schools>'+ (expandedAllSchools?"Collapse All":"Expand All")+' ›</button>')+
   '<div class="museum-school-list" id="museum-school-list"></div></section>':'')+
  '<p class="museum-muted">Only verified results from your selected league unlock awards. Unfinished games and unearned trophies stay locked. Rivalry trophies are digital pick’em collectibles, not physical ownership.</p>';
 if(selectedSport==="all"||selectedSport==="football"){
  const featured=["tennessee-vanderbilt","iron-bowl","golden-boot","golden-egg"];
  const rival=showAllRivals?ctx.trophies:featured.map(id=>ctx.trophies.find(t=>t.id===id)).filter(Boolean);
  const collection=root.querySelector("#museum-rivalries");
  for(const t of rival){
   const unlocked=Boolean(ctx.lastWin(t.id));
   const tile=document.createElement("article");
   tile.className="museum-rivalry"+(unlocked?" earned":" locked");
   tile.append(ctx.trophyCard(t,ctx.version));
   if(!unlocked){const lock=document.createElement("span");lock.className="museum-lock";lock.textContent="🔒";lock.setAttribute("aria-label","Not earned");tile.append(lock);}
   const status=document.createElement("div");
   status.className="museum-rivalry-status"+(unlocked?" earned":"");
   const wins=ctx.records.filter(r=>r.trophyId===t.id&&r.correct).length;
   status.textContent=unlocked?"✓ Earned "+wins+" time"+(wins===1?"":"s"):"○ Not earned";
   tile.append(status);collection.append(tile);
  }
  const list=root.querySelector("#museum-school-list");
  for(const entry of ctx.schoolOverviewData()){
   const opened=expandedAllSchools||ctx.expandedSchool===entry.code;
   const outer=document.createElement("article");outer.className="museum-school";outer.setAttribute("aria-expanded",String(opened));
   const previews=ctx.schoolTrophies(entry.code).slice(0,4);
   const btn=document.createElement("button");btn.type="button";btn.className="museum-school-button";
   btn.dataset.museumSchool=entry.code;btn.setAttribute("aria-expanded",String(opened));btn.setAttribute("aria-label",(opened?"Collapse ":"Expand ")+entry.name+" trophy collection");
   btn.innerHTML='<span class="school-mark">'+esc(entry.monogram)+'</span>'+
    '<span class="school-name"><strong>'+esc(entry.name)+'</strong><small>'+entry.earned+' / '+entry.count+' earned</small></span>'+
    '<span class="school-preview" aria-hidden="true">'+previews.map(t=>'<span class="'+(ctx.lastWin(t.id)?"":"locked")+'">'+esc(t.symbol)+'</span>').join("")+'</span>'+
    '<span class="school-chevron" aria-hidden="true">⌄</span>';
   outer.append(btn);
   if(opened){
    const body=document.createElement("div");body.className="museum-school-expanded";
    const grid=document.createElement("div");grid.className="sds-trophy-grid";
    for(const t of ctx.schoolTrophies(entry.code))grid.append(ctx.trophyCard(t,ctx.version));
    body.append(grid);outer.append(body);
   }
   list.append(outer);
  }
 }
 loadWeekly(ctx);
 if(!root.dataset.museumWired){
  root.dataset.museumWired="true";
  root.addEventListener("click",e=>{
   const sport=e.target.closest?.("[data-museum-sport]");
   if(sport){selectedSport=sport.dataset.museumSport;refresh();return;}
   if(e.target.closest?.("[data-museum-history]")){historyOpen=!historyOpen;refresh();return;}
   if(e.target.closest?.("[data-museum-all-rivalries]")){showAllRivals=!showAllRivals;refresh();return;}
   if(e.target.closest?.("[data-museum-schools]")){expandedAllSchools=!expandedAllSchools;refresh();return;}
   const school=e.target.closest?.("[data-museum-school]");
   if(school){expandedAllSchools=false;lastContext?.toggleSchool(school.dataset.museumSchool);return;}
  });
  root.addEventListener("change",e=>{if(e.target.matches?.("[data-museum-select]")){selectedSport=e.target.value;refresh();}});
 }
 return true;
}
function refresh(){if(lastContext?.rerender&&lastRoot?.isConnected)lastContext.rerender();}
window.SEC_TROPHY_MUSEUM=Object.freeze({render,refresh});
})();
