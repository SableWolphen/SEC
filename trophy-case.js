/*
 SATURDAYS DOWN SOUTH — TROPHY CASE
 Standalone front-end feature. No writes to league, game or pick tables.
 Only verified final games with the currently signed-in user's league picks count.
*/
(() => {
 "use strict";
 const TROPHIES=Object.freeze([
  {id:"golden-egg",name:"The Golden Egg",teams:"Mississippi State vs Ole Miss",codes:["MSST","MISS"],model:"trophies/golden-egg.glb",symbol:"🥚",short:"EGG BOWL"},
  {id:"golden-boot",name:"The Golden Boot",teams:"LSU vs Arkansas",codes:["LSU","ARK"],model:"trophies/golden-boot.glb",symbol:"🥾",short:"GOLDEN BOOT"},
  {id:"battle-line",name:"Battle Line Rivalry",teams:"Arkansas vs Missouri",codes:["ARK","MIZ"],model:"trophies/battle-line.glb",symbol:"⚔️",short:"BATTLE LINE"},
  {id:"governors-cup",name:"Governor’s Cup",teams:"Kentucky vs Louisville",codes:["UK","LOU"],model:"trophies/governors-cup.glb",symbol:"🏆",short:"GOVERNOR’S CUP"}
 ]);
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
 "#sds-trophy-case .sds-trophy-disclaimer{margin-top:20px;color:#93a7b9;font-size:11px;line-height:1.5}",
 "@media(min-width:890px){#sds-trophy-case .sds-trophy-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}",
 "@media(max-width:365px){#sds-trophy-case{padding:18px 10px 85px}#sds-trophy-case .sds-trophy-display{height:145px}#sds-trophy-case .sds-trophy-placeholder strong{font-size:44px}}"
 ];
 const style=document.createElement("style");style.textContent=rules.join("\n");document.head.appendChild(style);
 let verified=[],myPicks={},schedule={},records=[],signedIn=false,leagueId=null,leagueName="",tab="all",rootId="sds-trophy-case",renderId=0,viewerLoading=false;
 function last(id){return records.filter(r=>r.trophyId===id).sort((a,b)=>b.year-a.year)[0];}
 function owned(){return TROPHIES.filter(t=>last(t.id)?.correct===true);}
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
  div.append(art,title);return div;
 }
 // Model loads only once its .glb file actually exists. Until then keep attractive placeholders.
 async function attachModel(display,t,version){
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
  const result=last(t.id),earned=result?.correct===true;
  const card=document.createElement("article");card.className="sds-trophy-card"+(earned?" earned":"");
  const display=document.createElement("div");display.className="sds-trophy-display";display.append(placeholder(t));
  const info=document.createElement("div");info.className="sds-trophy-info";
  const title=document.createElement("div");title.className="sds-trophy-name";title.textContent=t.name;
  const teams=document.createElement("div");teams.className="sds-trophy-teams";teams.textContent=t.teams;
  const year=document.createElement("div");year.className="sds-trophy-year"+(earned?" sds-trophy-owned":"");
  year.textContent=earned?"🏆 "+result.year+" · EARNED":result?"Last picked: "+result.year:"Not yet earned";
  info.append(title,teams,year);card.append(display,info);attachModel(display,t,version);return card;
 }
 function render(next=tab){
  const root=document.getElementById(rootId);if(!root)return;
  tab=["all","mine","history"].includes(next)?next:"all";
  const version=++renderId;root.replaceChildren();
  const h=document.createElement("h2");h.className="sds-trophy-heading";h.innerHTML="Trophy <span>Case</span>";
  const subtitle=document.createElement("p");subtitle.className="sds-trophy-subtitle";
  subtitle.textContent="Win it. Keep it. Brag about it."+(leagueName?" · "+leagueName:"");
  const summary=document.createElement("div");summary.className="sds-trophy-stats";
  const big=document.createElement("strong");big.textContent=owned().length+" / "+TROPHIES.length;
  const small=document.createElement("span");small.textContent="Rivalry picks correctly called from verified finals";
  summary.append(big,small);
  const tabs=document.createElement("div");tabs.className="sds-trophy-tabs";
  tabs.setAttribute("role","group");tabs.setAttribute("aria-label","Trophy Case views");
  for(const [id,label] of [["all","All Trophies"],["mine","My Trophies"],["history","History"]]){
   const btn=document.createElement("button");btn.type="button";btn.className="sds-trophy-tab"+(tab===id?" active":"");
   btn.textContent=label;btn.setAttribute("aria-pressed",String(tab===id));btn.addEventListener("click",()=>render(id));
   tabs.append(btn);
  }
  root.append(h,subtitle,summary,tabs);
  if(tab==="history"){
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
   const items=tab==="mine"?owned():TROPHIES;
   if(!items.length)grid.append(empty(signedIn?"You haven't earned a rivalry trophy yet.":"Sign in to earn your first rivalry trophy.",!signedIn));
   else items.forEach(t=>grid.append(trophyCard(t,version)));
   root.append(grid);
  }
  const note=document.createElement("p");note.className="sds-trophy-disclaimer";
  note.textContent="Trophy achievements represent picking the straight-up winner of a rivalry game (even when your league plays Spread). They are not ownership of the physical rivalry trophy. Only verified final scores and your signed-in league picks count. 3D models appear when supplied.";
  root.append(note);
 }
 function sync(payload={}){
  verified=Array.isArray(payload.games)?payload.games:[];
  myPicks=payload.picks&&typeof payload.picks==="object"?payload.picks:{};
  schedule=payload.schedule&&typeof payload.schedule==="object"?payload.schedule:{};
  signedIn=Boolean(payload.authenticated);
  leagueId=signedIn&&payload.leagueId?String(payload.leagueId):null;
  leagueName=leagueId?String(payload.leagueName||"Your league"):"";
  records=deriveResults(verified,myPicks,schedule,signedIn,leagueId);
  render();
 }
 window.SDSTrophyCase=Object.freeze({
  mount(elementId="sds-trophy-case"){if(!document.getElementById(elementId))return;rootId=elementId;render();},
  show(next="all"){render(next);},
  setResults(verifiedResults){
   if(!Array.isArray(verifiedResults))throw new Error("Expected an array of results.");
   records=verifiedResults.filter(r=>byId.has(r?.trophyId)&&Number.isInteger(r.year)&&typeof r.correct==="boolean");
   render();
  },
  sync,deriveResults,getResults:()=>records.map(r=>({...r})),trophies:TROPHIES
 });
 if(window.location?.hash==="#trophies")window.SDSTrophyCase.mount();
})();