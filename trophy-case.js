/*
 SATURDAYS DOWN SOUTH — TROPHY CASE
 Standalone front-end feature. No writes to league, game or pick tables.
 Only verified final games with the currently signed-in user's league picks count.
*/
(() => {
 "use strict";
 const TROPHIES=window.SDS_RIVALRIES;
 if(!Array.isArray(TROPHIES)||TROPHIES.length<15)throw Error("Rivalry catalog missing");
 const byId=new Map(TROPHIES.map(t=>[t.id,t]));
 function deriveResults(games,picks,schedule,authenticated=false,leagueId=null){
  if(!authenticated||!leagueId||!Array.isArray(games)||!picks||!schedule)return [];
  const found=[];
  for(const row of games){
   if(!row||row.game_status!=="final"||!row.winner||typeof row.id!=="string")continue;
   const game=schedule[row.id];if(!game||!Number.isInteger(Number(game.date?.slice(0,4))))continue;
   const picked=picks[row.id];
   if(![game.home,game.away].includes(picked)||![game.home,game.away].includes(row.winner))continue;
   const trophy=TROPHIES.find(t=>t.codes.includes(game.away)&&t.codes.includes(game.home));
   if(!trophy)continue;
   const year=Number(game.date.slice(0,4));
   if(year<2000||year>2100)continue;
   found.push({trophyId:trophy.id,year,correct:picked===row.winner,gameId:row.id,pick:picked,winner:row.winner});
  }
  return found.sort((a,b)=>b.year-a.year||a.trophyId.localeCompare(b.trophyId));
 }
 const rules=[
 "#sds-trophy-case{background:linear-gradient(150deg,#09121e,#102334 65%,#09121e);color:#f6f8fb;padding:24px 16px 95px;min-height:70vh;border:1px solid #314359;border-radius:19px}",
 "#sds-trophy-case *{box-sizing:border-box}",
 "#sds-trophy-case .sds-trophy-heading{font-size:clamp(30px,7vw,46px);letter-spacing:-1.5px;font-weight:900;margin:0;line-height:1.12}",
 "#sds-trophy-case .sds-trophy-heading span{color:#d5ff65}",
 "#sds-trophy-case .sds-trophy-subtitle{color:#9baabd;font-size:13px;line-height:1.5;margin:10px 0 19px}",
 "#sds-trophy-case .sds-trophy-stats{display:flex;align-items:center;gap:12px;background:#15283a;border:1px solid #334759;border-radius:12px;padding:13px;margin-bottom:18px}",
 "#sds-trophy-case .sds-trophy-stats strong{font-size:27px;color:#d5ff65}",
 "#sds-trophy-case .sds-trophy-stats span{font-size:11px;color:#a8bfd0}",
 "#sds-trophy-case .sds-trophy-tabs{display:flex;gap:8px;margin-bottom:19px}",
 "#sds-trophy-case .sds-trophy-tab{flex:1;min-width:0;background:#142334;color:#aab8c9;border:1px solid #314359;min-height:45px;padding:11px 7px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer}",
 "#sds-trophy-case .sds-trophy-tab.active{background:#d5ff65;color:#09121e;border-color:#d5ff65}",
 "#sds-trophy-case .sds-trophy-tab:focus-visible{outline:3px solid #d5ff65;outline-offset:3px}",
 "#sds-trophy-case .sds-trophy-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}",
 "#sds-trophy-case .sds-trophy-card{background:#101e2d;border:1px solid #314359;border-radius:16px;overflow:hidden;min-width:0}",
 "#sds-trophy-case .sds-trophy-card.earned{border-color:#718b52}",
 "#sds-trophy-case .sds-trophy-display{height:183px;background:radial-gradient(circle at 50% 35%,#293c48,#08111c 75%);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}",
 "#sds-trophy-case .sds-trophy-display model-viewer{height:100%;width:100%}",
 "#sds-trophy-case .sds-trophy-placeholder{text-align:center;padding:10px;color:#96aec0;font-size:11px}",
 "#sds-trophy-case .sds-trophy-placeholder strong{display:block;font-size:60px;filter:drop-shadow(0 9px 15px #0008);line-height:1.2}",
 "#sds-trophy-case .sds-trophy-placeholder span{color:#d5ff65;font-size:9px;font-weight:900;letter-spacing:1.2px}",
 "#sds-trophy-case .sds-trophy-info{padding:12px}",
 "#sds-trophy-case .sds-trophy-name{font-size:15px;font-weight:850;margin-bottom:6px}",
 "#sds-trophy-case .sds-trophy-teams{color:#a5b5c8;font-size:12px;line-height:1.5;min-height:33px}",
 "#sds-trophy-case .sds-trophy-year{display:inline-block;background:#233447;color:#f5f7fb;border-radius:20px;padding:7px 11px;font-size:11px;font-weight:800;margin-top:10px}",
 "#sds-trophy-case .sds-trophy-owned{background:#d5ff65;color:#09121e}",
 "#sds-trophy-case .sds-trophy-history{display:grid;gap:9px}",
 "#sds-trophy-case .sds-trophy-history-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px;background:#142334;border:1px solid #314359;border-radius:12px}",
 "#sds-trophy-case .sds-trophy-history-row strong{font-size:13px}",
 "#sds-trophy-case .sds-trophy-history-row small{display:block;color:#a5b5c8;font-size:11px;margin-top:5px}",
 "#sds-trophy-case .sds-trophy-status{font-size:11px;font-weight:800;padding:7px 11px;border-radius:20px;white-space:nowrap}",
 "#sds-trophy-case .sds-trophy-win{background:#155f39;color:#c8ffdc}",
 "#sds-trophy-case .sds-trophy-loss{background:#73243b;color:#ffd1da}",
 "#sds-trophy-case .sds-trophy-empty{text-align:center;padding:35px 12px;border:1px dashed #3d556b;border-radius:14px;color:#9baabd;grid-column:1/-1}",
 "#sds-trophy-case .sds-trophy-empty strong{display:block;color:#f7f9fb;margin-bottom:7px}",
 "#sds-trophy-case .sds-trophy-action{border:1px solid #668448;background:#273b2c;color:#d5ff65;border-radius:11px;padding:11px 13px;margin-top:13px;font-weight:850;cursor:pointer}",
 "#sds-trophy-case .sds-trophy-card{--sds-trophy-accent:#d4bb65}",
 "#sds-trophy-case .sds-trophy-display{background:radial-gradient(circle at 53% 33%,color-mix(in srgb,var(--sds-trophy-accent) 28%,#142232),#08111c 77%)}",
 "#sds-trophy-case .sds-trophy-placeholder strong{filter:drop-shadow(0 5px 15px var(--sds-trophy-accent));transform:rotate(-6deg)}",
 "#sds-trophy-case .sds-trophy-placeholder span{display:block;margin-top:6px;color:var(--sds-trophy-accent);letter-spacing:.8px}",
 "#sds-trophy-case .sds-trophy-category{color:#d5ff65;font-size:10px;font-weight:800;margin-top:9px}",
 "#sds-trophy-case .sds-trophy-schedule{color:#7e9aae;font-size:10px;margin-top:5px}",
  "#sds-trophy-case .sds-rivalry-filters{margin-bottom:16px;display:grid;gap:10px}",
 "#sds-trophy-case .sds-rivalry-chips{display:flex;flex-wrap:wrap;gap:6px}",
 "#sds-trophy-case .sds-rivalry-chip{border:1px solid #3d5865;background:#182c37;color:#abc4ca;font-size:11px;font-weight:800;padding:8px 10px;border-radius:999px;min-height:36px;cursor:pointer}",
 "#sds-trophy-case .sds-rivalry-chip.active{background:#d5ff65;color:#10221b;border-color:#d5ff65}",
 "#sds-trophy-case .sds-rivalry-search{border:1px solid #3b5364;background:#091b27;border-radius:12px;padding:12px 13px;color:#f5fbff;font:inherit;font-size:13px;width:100%;min-height:45px}",
 "#sds-trophy-case .sds-rivalry-search::placeholder{color:#879eac}",
 "#sds-trophy-case .sds-trophy-tabs{flex-wrap:wrap}",
 "#sds-trophy-case .sds-trophy-tab{flex:1 1 calc(50% - 8px)}",
 "#sds-trophy-case .sds-rivalry-lead{padding:17px;border:1px solid #5f7544;background:linear-gradient(130deg,#1f3930,#122834);border-radius:13px}",
 "#sds-trophy-case .sds-rivalry-kicker{font-size:10px;letter-spacing:1.7px;font-weight:900;color:#d5ff65}",
 "#sds-trophy-case .sds-rivalry-lead h3{font-size:24px;margin:7px 0}",
 "#sds-trophy-case .sds-rivalry-lead p{font-size:12px;color:#b1c4d0;line-height:1.5;margin:0 0 11px}",
 "#sds-trophy-case .sds-rivalry-progress{color:#d5ff65;font-size:12px}",
 "#sds-trophy-case .sds-rivalry-badges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0 18px}",
 "#sds-trophy-case .sds-rivalry-badge{border:1px solid #41546a;background:#1c2e3a;padding:12px;border-radius:11px;opacity:.78}",
 "#sds-trophy-case .sds-rivalry-badge.earned{border-color:#77944f;background:#293d30;opacity:1}",
 "#sds-trophy-case .sds-rivalry-badge strong{display:block;color:#d5ff65;font-size:12px;margin-bottom:5px}",
 "#sds-trophy-case .sds-rivalry-badge small{font-size:10px;color:#b6c8d1;line-height:1.5}",
 "#sds-trophy-case .sds-rivalry-list-heading{font-size:16px;margin:15px 0 11px}",
 "#sds-trophy-case .sds-rivalry-entries{display:grid;gap:8px}",
 "#sds-trophy-case .sds-rivalry-entry{display:flex;gap:12px;align-items:center;padding:12px;background:#142637;border:1px solid #34495b;border-radius:12px}",
 "#sds-trophy-case .sds-rivalry-emblem{font-size:27px;min-width:35px}",
 "#sds-trophy-case .sds-rivalry-entry-detail{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}",
 "#sds-trophy-case .sds-rivalry-entry-detail strong{font-size:12px}",
 "#sds-trophy-case .sds-rivalry-entry-detail small{color:#a7b8c7;font-size:10px}",
 "#sds-trophy-case .sds-rivalry-entry-status{color:#d5ff65;font-size:10px}",
 "#sds-trophy-case .sds-rivalry-go{background:#d5ff65;color:#13211e;border:0;border-radius:9px;min-height:38px;padding:8px 11px;font-size:11px;font-weight:900}",
 "#sds-trophy-case .sds-trophy-disclaimer{margin-top:20px;color:#93a7b9;font-size:11px;line-height:1.5}",
 "@media(min-width:890px){#sds-trophy-case .sds-trophy-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}",
 "@media(max-width:365px){#sds-trophy-case{padding:18px 10px 85px}#sds-trophy-case .sds-trophy-display{height:145px}#sds-trophy-case .sds-trophy-placeholder strong{font-size:44px}}"
 ];
 const style=document.createElement("style");style.textContent=rules.join("\n");document.head.appendChild(style);
 let verified=[],myPicks={},schedule={},records=[],permanent=[],derived=[],historyUser=null,signedIn=false,leagueId=null,leagueName="",tab="all",category="all",searchTerm="",rootId="sds-trophy-case",renderId=0,viewerLoading=false;
 function last(id){return records.filter(r=>r.trophyId===id).sort((a,b)=>b.year-a.year)[0];}
 function lastWin(id){return records.filter(r=>r.trophyId===id&&r.correct).sort((a,b)=>b.year-a.year)[0];}
 function owned(){return TROPHIES.filter(t=>Boolean(lastWin(t.id)));}
 function empty(message,withButton=false){
  const el=document.createElement("div");el.className="sds-trophy-empty";
  const strong=document.createElement("strong");strong.textContent=message;el.append(strong);
  if(withButton){const btn=document.createElement("button");btn.type="button";btn.className="sds-trophy-action";btn.textContent=signedIn?"Choose a league":"Sign in";btn.addEventListener("click",()=>window.SEC_BRIDGE?.setView?.("league"));el.append(btn);}
  return el;
 }
 function placeholder(t){
  const div=document.createElement("div");div.className="sds-trophy-placeholder";
  const art=document.createElement("strong");art.textContent=t.symbol;art.setAttribute("aria-hidden","true");
  const title=document.createElement("span");title.textContent=t.short;
  div.style.setProperty("--sds-trophy-accent",t.tone);
  div.append(art,title);return div;
 }
 // Model loads only once its .glb file actually exists. Until then keep attractive placeholders.
 async function attachModel(display,t,version){
  // Only probe known uploaded assets; do not make 15 guaranteed 404 requests every render.
  if(!t.model)return; // Original 15 have real GLBs, newer entries have archival emblems. // All 15 original .glb files are committed.
  if(typeof fetch!=="function"||!window.customElements)return;
  try{
   const response=await fetch(t.model,{method:"HEAD",cache:"force-cache"});
   if(!response.ok||version!==renderId||!display.isConnected)return;
   if(!viewerLoading&&!customElements.get("model-viewer")){
    viewerLoading=true;const script=document.createElement("script");script.type="module";
    script.src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js";
    document.head.append(script);
   }
   const model=document.createElement("model-viewer");
   model.setAttribute("src",t.model);model.setAttribute("alt",t.name+" 3D model");
   for(const flag of ["camera-controls","auto-rotate","loading"])model.setAttribute(flag,flag==="loading"?"lazy":"");
   model.setAttribute("shadow-intensity","1");
   model.addEventListener("error",()=>display.replaceChildren(placeholder(t)),{once:true});
   display.replaceChildren(model);
  }catch(err){/* Missing model: keep placeholder. */}
 }
 function trophyCard(t,version){
  const result=last(t.id),won=lastWin(t.id),earned=Boolean(won);
  const card=document.createElement("article");card.className="sds-trophy-card"+(earned?" earned":"");
  card.style.setProperty("--sds-trophy-accent",t.tone);
  const display=document.createElement("div");display.className="sds-trophy-display";display.append(placeholder(t));
  const info=document.createElement("div");info.className="sds-trophy-info";
  const title=document.createElement("div");title.className="sds-trophy-name";title.textContent=t.name;
  const teams=document.createElement("div");teams.className="sds-trophy-teams";teams.textContent=t.teams;
  const year=document.createElement("div");year.className="sds-trophy-year"+(earned?" sds-trophy-owned":"");
  year.textContent=earned?"🏆 "+won.year+" · EARNED":result?"Last picked: "+result.year:"Not yet earned";
  const category=document.createElement("div");category.className="sds-trophy-category";
  category.textContent=t.category==="SEC"?(t.kind==="trophy"?"SEC · Trophy game":"SEC · Traditional rivalry"):
    t.category==="Historic"?"Historic rivalry":(t.kind==="trophy"?"Nonconference · Trophy game":"Nonconference rivalry");
  const matching=Object.values(schedule).filter(g=>g&&t.codes.includes(g.home)&&t.codes.includes(g.away));
  if(matching.length){
    const next=matching.sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
    const matchNote=document.createElement("div");matchNote.className="sds-trophy-schedule";
    matchNote.textContent="On the "+String(next.date?.slice(0,4)||"2026")+" SEC slate · Week "+next.week;
    info.append(title,teams,category,matchNote,year);
  }else{
    const unscheduled=document.createElement('div');unscheduled.className='sds-trophy-schedule';
    unscheduled.textContent='Not on the current season slate · stays in your collection';
    info.append(title,teams,category,unscheduled,year);
  }
  card.append(display,info);attachModel(display,t,version);return card;
 }
 function rivalryChallenges(){
  const wrap=document.createElement("section");wrap.className="sds-rivalry-challenge";
  const lead=document.createElement("div");lead.className="sds-rivalry-lead";
  const fullSlate=TROPHIES.map(t=>{
   const games=Object.values(schedule).filter(g=>g&&t.codes.includes(g.away)&&t.codes.includes(g.home));
   const game=games.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]||null;
   const result=game?verified.find(g=>g.id===game.id):null;
   return {t,game,result,pick:game?myPicks[game.id]:null};
  });
  const onSlate=fullSlate.filter(({t})=>
    (category==="all"||t.category===category)&&
    (!searchTerm||(t.name+" "+t.teams).toLowerCase().includes(searchTerm))
  );
  const allScheduled=fullSlate.filter(item=>Boolean(item.game));
  const allPicked=allScheduled.filter(item=>Boolean(item.pick));
  const allComplete=allScheduled.filter(item=>item.result?.game_status==="final");
  const allCorrect=allComplete.filter(item=>item.pick===item.result?.winner).length;
  const scheduled=onSlate.filter(item=>Boolean(item.game));
  const picked=scheduled.filter(item=>Boolean(item.pick));
  const complete=scheduled.filter(item=>item.result?.game_status==="final");
  const correct=complete.filter(item=>item.pick===item.result?.winner).length;
  lead.innerHTML='<div class="sds-rivalry-kicker">RIVALRY WEEK QUESTS</div>'+
   '<h3>Every rivalry. Every year.</h3>'+
   '<p>Make your rivalry predictions before kickoff, then earn collectibles from verified finals. Classics not played this season still stay in the collection.</p>'+
   '<div class="sds-rivalry-progress"><b>'+picked.length+' / '+scheduled.length+'</b> scheduled rivalry games picked · <b>'+correct+'</b> correct finals</div>';
  wrap.append(lead);
  const badges=document.createElement("div");badges.className="sds-rivalry-badges";
  const ownedCount=owned().length;
  const completeSweep=allScheduled.length>=2&&allComplete.length===allScheduled.length&&allCorrect===allScheduled.length;
  const goals=[
   ["🏈 Rivalry Starter",allPicked.length>=1,"Pick a scheduled rivalry game"],
   ["⚡ Rivalry Specialist",ownedCount>=3,"Collect 3 different rivalry trophies"],
   ["👑 Rivalry Sweep",completeSweep,"Correctly predict every scheduled rivalry this season"],
   ["🏆 Archive Legend",ownedCount===TROPHIES.length,"Collect every rivalry across seasons"]
  ];
  for(const [name,earned,info] of goals){
   const card=document.createElement("div");card.className="sds-rivalry-badge"+(earned?" earned":"");
   const title=document.createElement("strong");title.textContent=(earned?"✓ ":"◯ ")+name;
   const desc=document.createElement("small");desc.textContent=info;
   card.append(title,desc);badges.append(card);
  }
  wrap.append(badges);
  const heading=document.createElement("h3");heading.className="sds-rivalry-list-heading";
  heading.textContent="All "+TROPHIES.length+" rivalry matchups";wrap.append(heading);
  const entries=document.createElement("div");entries.className="sds-rivalry-entries";
  for(const {t,game,result,pick} of onSlate.sort((a,b)=>Number(Boolean(b.game))-Number(Boolean(a.game)))){
   const row=document.createElement("article");row.className="sds-rivalry-entry";
   const emblem=document.createElement("span");emblem.className="sds-rivalry-emblem";emblem.textContent=t.symbol;
   const detail=document.createElement("div");detail.className="sds-rivalry-entry-detail";
   const title=document.createElement("strong");title.textContent=t.name;
   const teams=document.createElement("small");teams.textContent=t.teams;
   const status=document.createElement("span");status.className="sds-rivalry-entry-status";
   if(!game)status.textContent="Not scheduled this season · stays collectible";
   else if(result?.game_status==="final")status.textContent=pick===result.winner?"🏆 Correct rivalry call":pick?"Missed this rivalry":"No pick saved before kickoff";
   else if(pick)status.textContent="✓ Your pick: "+pick+" · Week "+game.week;
   else status.textContent="Scheduled · Week "+game.week+" · Pick a team";
   detail.append(title,teams,status);
   row.append(emblem,detail);
   if(game && result?.game_status!=="final"){
    const button=document.createElement("button");button.type="button";button.className="sds-rivalry-go";
    button.textContent="Pick ↗";
    button.setAttribute("aria-label","Go to "+t.name+" picks");
    button.addEventListener("click",()=>{
     window.SEC_BRIDGE?.setView?.("picks");
     document.querySelector('[data-week="'+game.week+'"]')?.click();
    });
    row.append(button);
   }
   entries.append(row);
  }
  wrap.append(entries);
  return wrap;
 }
 function updateFiltered(){
  const root=document.getElementById(rootId);if(!root)return;
  if(tab==="rivalries"){
   const prior=root.querySelector(".sds-rivalry-challenge");
   if(prior)prior.replaceWith(rivalryChallenges());
  }else if(tab==="all"||tab==="mine"){
   const grid=root.querySelector(".sds-trophy-grid");if(!grid)return;
   const entries=(tab==="mine"?owned():TROPHIES).filter(t=>
      (category==="all"||t.category===category)&&
      (!searchTerm||(t.name+" "+t.teams+" "+(t.physical||"")).toLowerCase().includes(searchTerm))
   );
   grid.replaceChildren();
   if(!entries.length)grid.append(empty("No rivalries match this search."));
   else entries.forEach(t=>grid.append(trophyCard(t,renderId)));
  }
 }
 function render(next=tab){
  const root=document.getElementById(rootId);if(!root)return;
  tab=["all","mine","history","rivalries"].includes(next)?next:"all";
  const version=++renderId;root.replaceChildren();
  const h=document.createElement("h2");h.className="sds-trophy-heading";h.innerHTML="Trophy <span>Case</span>";
  const subtitle=document.createElement("p");subtitle.className="sds-trophy-subtitle";
  subtitle.textContent="Win it. Keep it. Brag about it."+(leagueName?" · "+leagueName:"");
  const rivalryNotice=document.createElement("p");rivalryNotice.className="sds-trophy-subtitle";
  rivalryNotice.textContent="All "+TROPHIES.length+" SEC, nonconference and historic rivalries stay here—even when they are not played this season.";
   const summary=document.createElement("div");summary.className="sds-trophy-stats";
  const big=document.createElement("strong");big.textContent=owned().length+" / "+TROPHIES.length;
  const small=document.createElement("span");small.textContent="Rivalry picks correctly called from verified finals";
  summary.append(big,small);
  const tabs=document.createElement("div");tabs.className="sds-trophy-tabs";
  tabs.setAttribute("role","group");tabs.setAttribute("aria-label","Trophy Case views");
  for(const [id,label] of [["all","All Trophies"],["mine","My Trophies"],["history","History"],["rivalries","Rivalry Week"]]){
   const btn=document.createElement("button");btn.type="button";btn.className="sds-trophy-tab"+(tab===id?" active":"");
   btn.textContent=label;btn.setAttribute("aria-pressed",String(tab===id));btn.addEventListener("click",()=>render(id));
   tabs.append(btn);
  }
  const filterBar=document.createElement("div");filterBar.className="sds-rivalry-filters";
  const chips=document.createElement("div");chips.className="sds-rivalry-chips";
  for(const [key,label] of [["all","All "+TROPHIES.length],["SEC","SEC vs SEC"],["Nonconference","Nonconference"],["Historic","Historic"]]){
   const button=document.createElement("button");button.type="button";
   button.className="sds-rivalry-chip"+(category===key?" active":"");
   button.textContent=label;button.setAttribute("aria-pressed",String(category===key));
   button.addEventListener("click",()=>{category=key;render();});
   chips.append(button);
  }
  const search=document.createElement("input");search.type="search";search.className="sds-rivalry-search";
  search.setAttribute("aria-label","Search rivalries and opponents");
  search.placeholder="Search Highway 82, Bedlam, Alabama…";search.value=searchTerm;
  search.addEventListener("input",ev=>{searchTerm=String(ev.target.value).toLowerCase();updateFiltered();});
  filterBar.append(chips,search);
  root.append(h,subtitle,rivalryNotice,summary,tabs,filterBar);
  if(tab==="rivalries"){root.append(rivalryChallenges());}
  else if(tab==="history"){
   const history=document.createElement("div");history.className="sds-trophy-history";
   if(!records.length)history.append(empty(signedIn?"No verified rivalry predictions yet.":"Log in to track your rivalry predictions.",!signedIn));
   for(const result of records.slice().sort((a,b)=>b.year-a.year)){
    const trophy=byId.get(result.trophyId);if(!trophy)continue;
    const row=document.createElement("div");row.className="sds-trophy-history-row";
    const label=document.createElement("div"),title=document.createElement("strong"),detail=document.createElement("small");
    title.textContent=trophy.name;detail.textContent=result.year+" · Picked "+result.pick+" · Winner "+result.winner;
    label.append(title,detail);
    const status=document.createElement("span");status.className="sds-trophy-status "+(result.correct?"sds-trophy-win":"sds-trophy-loss");
    status.textContent=result.correct?"CORRECT":"MISSED";row.append(label,status);history.append(row);
   }root.append(history);
  }else{
   const grid=document.createElement("div");grid.className="sds-trophy-grid";
   const items=(tab==="mine"?owned():TROPHIES).filter(t=>
      (category==="all"||t.category===category)&&
      (!searchTerm||(t.name+" "+t.teams+" "+(t.physical||"")).toLowerCase().includes(searchTerm))
   );
   if(!items.length)grid.append(empty(signedIn?"You haven't earned a rivalry trophy yet.":"Sign in to earn your first rivalry trophy.",!signedIn));
   else items.forEach(t=>grid.append(trophyCard(t,version)));
   root.append(grid);
  }
  const note=document.createElement("p");note.className="sds-trophy-disclaimer";
  note.textContent="Trophy achievements represent picking the straight-up winner of a rivalry game (even when your league plays Spread). They are not ownership of the physical rivalry trophy. Every named rivalry remains available in this catalog, even if it is not scheduled this season. Only verified final scores and your signed-in league picks count. Awards remain collected across seasons. The original 15 collectibles use interactive 3D sculptures; archive additions use distinct emblems until new models are created. Not every traditional rivalry has an official physical trophy.";
  root.append(note);
 }
 function reconcile(){
  const byKey=new Map();
  for(const item of [...permanent,...derived]){
   if(!byId.has(item.trophyId)||!Number.isInteger(item.year))continue;
   const key=[item.trophyId,item.year,item.gameId,item.leagueId||leagueId||""].join("|");
   if(!byKey.has(key))byKey.set(key,item);
  }
  records=[...byKey.values()].sort((a,b)=>b.year-a.year);
 }
 function sync(payload={}){
  verified=Array.isArray(payload.games)?payload.games:[];
  myPicks=payload.picks&&typeof payload.picks==="object"?payload.picks:{};
  schedule=payload.schedule&&typeof payload.schedule==="object"?payload.schedule:{};
  signedIn=Boolean(payload.authenticated);
  leagueId=signedIn&&payload.leagueId?String(payload.leagueId):null;
  leagueName=leagueId?String(payload.leagueName||"Your league"):"";
  const nextUser=payload.userId||null;
  if(!signedIn || (historyUser&&nextUser!==historyUser)){
    permanent=[];
  }
  historyUser=signedIn?nextUser:null;
  derived=deriveResults(verified,myPicks,schedule,signedIn,leagueId);
  reconcile();
  render();
 }
 window.SDSTrophyCase=Object.freeze({
  mount(elementId="sds-trophy-case"){if(!document.getElementById(elementId))return;rootId=elementId;render();},
  show(next="all"){render(next);},
  setResults(verifiedResults){
   if(!Array.isArray(verifiedResults))throw new Error("Expected an array of results.");
   permanent=verifiedResults.filter(r=>byId.has(r?.trophyId)&&Number.isInteger(r.year)&&typeof r.correct==="boolean");
   reconcile();render();
  },
  setPermanentResults(rows){
   if(!Array.isArray(rows))throw new Error("Expected a saved trophy history array.");
   permanent=rows.filter(r=>byId.has(r?.trophy_id)&&Number.isInteger(Number(r.season))&&typeof r.correct==="boolean")
    .map(r=>({trophyId:r.trophy_id,year:Number(r.season),correct:r.correct,
      gameId:r.game_id,pick:r.pick_code,winner:r.winner_code,leagueId:r.league_id}));
   reconcile();render();
  },
  sync,deriveResults,getResults:()=>records.map(r=>({...r})),trophies:TROPHIES
 });
 if(window.location?.hash==="#trophies")window.SDSTrophyCase.mount();
})();