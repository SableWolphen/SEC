/*
 SATURDAYS DOWN SOUTH — TROPHY CASE
 Standalone front-end feature. No writes to league, game or pick tables.
 Only verified final games with the currently signed-in user's league picks count.
*/
(() => {
 "use strict";
 const TROPHIES=window.SDS_TROPHY_RIVALRIES;
 if(!Array.isArray(TROPHIES)||TROPHIES.length<15)throw Error("Named Rivalry catalog missing");
 const byId=new Map(TROPHIES.map(t=>[t.id,t]));

 // Each school gets a room. An SEC-vs-SEC matchup is listed under BOTH schools,
 // while the underlying trophy and saved award remain one unique record.
 const SEC_SCHOOLS=Object.freeze([
  {code:"ALA",name:"Alabama",monogram:"A"},
  {code:"ARK",name:"Arkansas",monogram:"AR"},
  {code:"AUB",name:"Auburn",monogram:"AU"},
  {code:"FLA",name:"Florida",monogram:"UF"},
  {code:"UGA",name:"Georgia",monogram:"G"},
  {code:"UK",name:"Kentucky",monogram:"UK"},
  {code:"LSU",name:"LSU",monogram:"LSU"},
  {code:"MSST",name:"Mississippi State",monogram:"MS"},
  {code:"MIZ",name:"Missouri",monogram:"MU"},
  {code:"OU",name:"Oklahoma",monogram:"OU"},
  {code:"MISS",name:"Ole Miss",monogram:"OM"},
  {code:"SC",name:"South Carolina",monogram:"SC"},
  {code:"TENN",name:"Tennessee",monogram:"T"},
  {code:"TEX",name:"Texas",monogram:"TX"},
  {code:"TAMU",name:"Texas A&M",monogram:"ATM"},
  {code:"VAN",name:"Vanderbilt",monogram:"V"}
 ]);
 const SCHOOL_BY_CODE=new Map(SEC_SCHOOLS.map(s=>[s.code,s]));
 function inSchool(t,code){return code==="all"||t.codes.includes(code);}
 function schoolTrophies(code){return TROPHIES.filter(t=>inSchool(t,code));}
 function schoolOverviewData(){return SEC_SCHOOLS.map(s=>({
  ...s,count:schoolTrophies(s.code).length,
  earned:schoolTrophies(s.code).filter(t=>Boolean(lastWin(t.id))).length
 }));}
 function visibleTrophies(list){
  return list.filter(t=>inSchool(t,school)&&
   (category==="all"||t.category===category)&&
   (!searchTerm||(t.name+" "+t.teams+" "+(t.physical||"")).toLowerCase().includes(searchTerm))
  );
 }
 function changeSchool(code){
  if(code!=="all"&&code!=="schools"&&!SCHOOL_BY_CODE.has(code))return;
  school=code;category="all";searchTerm="";tab="all";render();
 }
 function schoolPreview(code){
  const all=schoolTrophies(code);
  // Show recognisable trophy silhouettes directly on the closed school row.
  return all.slice(0,3).map(t=>({id:t.id,symbol:t.symbol,name:t.name,earned:Boolean(lastWin(t.id))}));
 }
 function toggleSchool(code){
  if(!SCHOOL_BY_CODE.has(code))return;
  expandedSchool=expandedSchool===code?null:code;
  render();
  // Return keyboard focus to the same school disclosure button after rendering.
  const button=document.querySelector?.('[data-school-toggle="'+code+'"]');
  button?.focus?.({preventScroll:true});
 }
 function schoolPicker(version){
  const section=document.createElement("section");section.className="sds-school-directory";
  const top=document.createElement("div");top.className="sds-school-directory-heading";
  const heading=document.createElement("h3");heading.textContent="Rivalry trophy shelves";
  const help=document.createElement("p");
  help.textContent="See each school's trophy previews below. Tap the arrow to expand the full collection right here—no extra page. Named rivals stay listed even in seasons they don't meet.";
  top.append(heading,help);
  const list=document.createElement("div");list.className="sds-school-accordion-list";
  for(const entry of schoolOverviewData()){
   const opened=expandedSchool===entry.code;
   const wrapper=document.createElement("div");
   wrapper.className="sds-school-accordion"+(opened?" is-open":"");
   const card=document.createElement("button");card.type="button";
   card.className="sds-school-disclosure";
   card.dataset.schoolToggle=entry.code;
   card.setAttribute("aria-expanded",String(opened));
   card.setAttribute("aria-controls","sds-school-panel-"+entry.code);
   card.setAttribute("aria-label",(opened?"Collapse ":"Expand ")+entry.name+" trophy collection, "+entry.count+" named rivalries");
   const emblem=document.createElement("span");emblem.className="sds-school-emblem";
   emblem.textContent=entry.monogram;
   const info=document.createElement("span");info.className="sds-school-info";
   const name=document.createElement("strong");name.textContent=entry.name;
   const count=document.createElement("small");count.textContent=entry.count+" named rivalries · "+entry.earned+" earned";
   info.append(name,count);
   const preview=document.createElement("span");preview.className="sds-school-preview";
   preview.setAttribute("aria-hidden","true");
   for(const trophy of schoolPreview(entry.code)){
    const icon=document.createElement("span");
    icon.className="sds-school-preview-icon"+(trophy.earned?" earned":"");
    icon.textContent=trophy.symbol;icon.title=trophy.name;
    preview.append(icon);
   }
   const chevron=document.createElement("span");chevron.className="sds-school-chevron";
   chevron.textContent="⌄";chevron.setAttribute("aria-hidden","true");
   card.append(emblem,info,preview,chevron);
   card.addEventListener("click",()=>toggleSchool(entry.code));
   wrapper.append(card);
   if(opened){
    const panel=document.createElement("div");panel.className="sds-school-expanded";
    panel.id="sds-school-panel-"+entry.code;
    const line=document.createElement("p");line.className="sds-school-panel-label";
    line.textContent=entry.name+" · "+entry.count+" rivalry collectibles";
    const grid=document.createElement("div");grid.className="sds-trophy-grid";
    schoolTrophies(entry.code).forEach(t=>grid.append(trophyCard(t,version)));
    panel.append(line,grid);
    wrapper.append(panel);
   }
   list.append(wrapper);
  }
  const footer=document.createElement("button");footer.type="button";footer.className="sds-school-all";
  footer.textContent="Browse all "+TROPHIES.length+" named rivalry trophies →";
  footer.addEventListener("click",()=>changeSchool("all"));
  section.append(top,list,footer);
  return section;
 }
 function schoolBreadcrumb(){
  const row=document.createElement("div");row.className="sds-school-breadcrumb";
  const back=document.createElement("button");back.type="button";back.className="sds-school-back";
  back.textContent="← All SEC schools";
  back.addEventListener("click",()=>changeSchool("schools"));
  const heading=document.createElement("strong");
  const list=schoolTrophies(school);
  const total=list.length,earned=list.filter(t=>Boolean(lastWin(t.id))).length;
  heading.textContent=school==="all"?"Complete Rivalry Archive":SCHOOL_BY_CODE.get(school).name+" Rivalries";
  const stats=document.createElement("span");stats.textContent=total+" rivalries · "+earned+" earned";
  row.append(back,heading,stats);return row;
 }
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
 
 "#sds-trophy-case .sds-school-directory-heading{margin:6px 0 18px}",
 "#sds-trophy-case .sds-school-directory-heading h3{font-size:22px;font-weight:900;letter-spacing:-.5px;margin:0 0 5px;color:#f5fbf9}",
 "#sds-trophy-case .sds-school-directory-heading p{font-size:12px;color:#aabbc8;line-height:1.5;margin:0}",
 "#sds-trophy-case .sds-school-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}",
 "#sds-trophy-case .sds-school-card{display:flex;align-items:center;gap:10px;min-width:0;min-height:83px;padding:12px 10px;background:#142839;border:1px solid #344e5e;border-radius:14px;text-align:left;color:#f4faf8;cursor:pointer;transition:border-color .15s,background .15s}",
 "#sds-trophy-case .sds-school-card:hover{border-color:#d5ff65;background:#1e3840}",
 "#sds-trophy-case .sds-school-card:focus-visible,#sds-trophy-case .sds-school-back:focus-visible,#sds-trophy-case .sds-school-all:focus-visible{outline:3px solid #d5ff65;outline-offset:3px}",
 "#sds-trophy-case .sds-school-emblem{min-width:37px;width:37px;height:37px;background:#233c43;border:1px solid #668658;border-radius:10px;display:grid;place-items:center;color:#d5ff65;font-weight:950;font-size:12px;letter-spacing:-.5px}",
 "#sds-trophy-case .sds-school-info{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}",
 "#sds-trophy-case .sds-school-info strong{font-size:13px;font-weight:850;overflow-wrap:anywhere}",
 "#sds-trophy-case .sds-school-info small{font-size:10px;color:#a7bac8}",
 "#sds-trophy-case .sds-school-arrow{color:#d5ff65;font-size:23px;line-height:1;flex:none}",
 "#sds-trophy-case .sds-school-all{display:block;width:100%;margin-top:15px;background:#213b30;color:#d5ff65;border:1px solid #668658;border-radius:12px;padding:13px 12px;font-size:12px;font-weight:850;cursor:pointer;min-height:45px}",
 "#sds-trophy-case .sds-school-breadcrumb{display:flex;align-items:center;gap:8px 13px;flex-wrap:wrap;padding:13px;margin-bottom:14px;border:1px solid #39545b;border-radius:12px;background:#152f34}",
 "#sds-trophy-case .sds-school-back{border:1px solid #668658;background:#284234;color:#d5ff65;border-radius:9px;padding:9px 12px;min-height:39px;font-size:11px;font-weight:800;cursor:pointer}",
 "#sds-trophy-case .sds-school-breadcrumb strong{font-size:13px;font-weight:850;color:#f4faf9}",
 "#sds-trophy-case .sds-school-breadcrumb>span{font-size:11px;color:#a9bec8;margin-left:auto}",
 "@media(min-width:850px){#sds-trophy-case .sds-school-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}",
 "@media(max-width:410px){#sds-trophy-case .sds-school-card{gap:7px;min-height:79px;padding:9px 7px}#sds-trophy-case .sds-school-emblem{min-width:31px;width:31px;height:34px;font-size:10px}#sds-trophy-case .sds-school-info strong{font-size:11px}#sds-trophy-case .sds-school-info small{font-size:9px}}",

 "#sds-trophy-case .sds-league-honors{margin:12px 0 25px;padding:17px;border-radius:17px;background:linear-gradient(130deg,#16332f,#112833 75%);border:1px solid #476c5b}",
 "#sds-trophy-case .sds-honors-head{margin-bottom:14px}",
 "#sds-trophy-case .sds-honors-kicker{font-weight:950;letter-spacing:1.9px;font-size:10px;color:#d5ff65;margin-bottom:6px}",
 "#sds-trophy-case .sds-honors-head h3{font-size:clamp(21px,4.8vw,27px);font-weight:950;letter-spacing:-.6px;line-height:1.17;color:#f2f9f7;margin:0 0 8px}",
 "#sds-trophy-case .sds-honors-head p{margin:0;color:#a9bec3;font-size:12px}",
 "#sds-trophy-case .sds-honors-grid{display:grid;gap:12px;grid-template-columns:minmax(0,1fr)}",
 "#sds-trophy-case .sds-honors-grid .sec-championship-card,#sds-trophy-case .sds-honors-achievements-card{padding:15px;background:#142632;border:1px solid #355563;border-radius:14px;min-width:0}",
 "#sds-trophy-case .sec-championship-heading{gap:9px}",
 "#sds-trophy-case .sec-championship-heading h3,#sds-trophy-case .sec-honors-achievement-heading h3{font-size:17px;letter-spacing:-.2px;margin:0 0 5px;font-weight:900;color:#f1f8f8}",
 "#sds-trophy-case .sec-championship-heading p,#sds-trophy-case .sec-honors-achievement-heading p{font-size:11px;line-height:1.45;color:#9fb4c2;margin:0}",
 "#sds-trophy-case .sec-championship-cup,#sds-trophy-case .sec-honors-achievement-heading>span{font-size:28px;line-height:1}",
 "#sds-trophy-case .sec-championship-pending{margin-top:12px;padding:12px;border-radius:11px}",
 "#sds-trophy-case .sec-championship-pending strong{font-size:13px}",
 "#sds-trophy-case .sec-championship-pending p{font-size:11px;line-height:1.5}",
 "#sds-trophy-case .sec-championship-action{font-size:11px;min-height:39px;padding:10px 13px;margin-top:12px}",
 "#sds-trophy-case .sec-championship-action:disabled{background:#354841;color:#b8c5bf;opacity:1;cursor:not-allowed}",
 "#sds-trophy-case .sec-championship-card>.helper{font-size:10px;line-height:1.5;margin:9px 0 0}",
 "#sds-trophy-case .sec-honors-achievement-heading{display:flex;gap:10px;align-items:center}",
 "#sds-trophy-case .sec-honors-empty{border:1px dashed #45616a;padding:15px;border-radius:11px;margin-top:12px}",
 "#sds-trophy-case .sec-honors-empty strong{font-size:12px;color:#d5ff65}",
 "#sds-trophy-case .sec-honors-empty p{margin:6px 0 0;font-size:11px;line-height:1.5;color:#a8bdc6}",
 "#sds-trophy-case .sec-honors-achievements-list{display:grid;gap:8px;margin-top:12px}",
 "#sds-trophy-case .sec-honors-member{padding:10px 11px;border-radius:10px;background:#1b3438;border:1px solid #49634f}",
 "#sds-trophy-case .sec-honors-member>strong{display:block;font-size:12px;margin-bottom:7px}",
 "#sds-trophy-case .sec-honors-member .sec-achievements{display:flex;flex-wrap:wrap;gap:5px}",
 "#sds-trophy-case .sec-honors-member .sec-achievements span{font-size:10px;padding:5px 7px}",
 "#sds-trophy-case .sds-honors-connect{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#10262b;border-radius:12px;border:1px solid #37594d;padding:12px}",
 "#sds-trophy-case .sds-honors-connect p{margin:0;max-width:370px;flex:1;font-size:12px;color:#bbced2;line-height:1.5}",
 "#sds-trophy-case .sds-honors-go-league{border:1px solid #91aa62;border-radius:10px;background:#d5ff65;color:#102218;font-size:11px;font-weight:900;min-height:40px;padding:10px 13px;cursor:pointer}",
 "@media(min-width:750px){#sds-trophy-case .sds-honors-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}",
 "@media(max-width:430px){#sds-trophy-case .sds-league-honors{padding:12px;margin-bottom:20px}#sds-trophy-case .sds-honors-grid .sec-championship-card,#sds-trophy-case .sds-honors-achievements-card{padding:12px}#sds-trophy-case .sds-honors-head h3{font-size:20px}}",
 "#sds-trophy-case .sds-nickname-note{color:#9fb2be;font-size:10px;line-height:1.5;margin:8px 0 0}",
 "#sds-trophy-case .sds-school-accordion-list{display:grid;gap:11px}",
 "#sds-trophy-case .sds-school-accordion{background:linear-gradient(110deg,#152d34,#112331);border:1px solid #35545b;border-radius:15px;overflow:hidden;box-shadow:0 6px 20px #050c1433}",
 "#sds-trophy-case .sds-school-accordion.is-open{border-color:#83a957;background:linear-gradient(120deg,#1b3935,#132d35 65%,#112532)}",
 "#sds-trophy-case .sds-school-disclosure{width:100%;display:flex;align-items:center;gap:12px;text-align:left;min-height:89px;background:none;color:#f4faf8;border:0;padding:12px 15px;cursor:pointer}",
 "#sds-trophy-case .sds-school-disclosure:focus-visible{outline:3px solid #d5ff65;outline-offset:-4px}",
 "#sds-trophy-case .sds-school-accordion.is-open .sds-school-disclosure{border-bottom:1px solid #466555}",
 "#sds-trophy-case .sds-school-disclosure .sds-school-info strong{font-size:15px;line-height:1.25}",
 "#sds-trophy-case .sds-school-disclosure .sds-school-info small{font-size:11px;margin-top:3px}",
 "#sds-trophy-case .sds-school-preview{display:flex;gap:5px;flex:none;align-items:center;justify-content:flex-end}",
 "#sds-trophy-case .sds-school-preview-icon{width:34px;height:39px;display:grid;place-items:center;border:1px solid #5c7362;border-radius:9px;background:radial-gradient(circle at 55% 20%,#40564c,#152830);font-size:21px;filter:drop-shadow(0 3px 4px #0004)}",
 "#sds-trophy-case .sds-school-preview-icon.earned{border-color:#d5ff65;box-shadow:0 0 11px #d5ff6533}",
 "#sds-trophy-case .sds-school-chevron{font-size:27px;color:#d5ff65;line-height:1;transform:rotate(0deg);transition:transform .18s;flex:none;margin-left:4px}",
 "#sds-trophy-case .sds-school-accordion.is-open .sds-school-chevron{transform:rotate(180deg)}",
 "#sds-trophy-case .sds-school-expanded{padding:15px 13px 19px;background:#0e202a}",
 "#sds-trophy-case .sds-school-panel-label{color:#d5ff65;font-size:12px;font-weight:900;margin:0 0 12px;letter-spacing:.3px}",
 "#sds-trophy-case .sds-school-expanded .sds-trophy-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}",
 "#sds-trophy-case .sds-school-expanded .sds-trophy-card{min-width:0}",
 "@media(min-width:860px){#sds-trophy-case .sds-school-expanded .sds-trophy-grid{grid-template-columns:repeat(3,minmax(0,1fr))}#sds-trophy-case .sds-school-preview-icon{width:43px;height:49px;font-size:25px}}",
 "@media(max-width:480px){#sds-trophy-case .sds-school-disclosure{padding:11px 10px;gap:8px;min-height:84px}#sds-trophy-case .sds-school-disclosure .sds-school-info strong{font-size:13px}#sds-trophy-case .sds-school-disclosure .sds-school-info small{font-size:10px}#sds-trophy-case .sds-school-preview-icon{width:27px;height:32px;font-size:17px}#sds-trophy-case .sds-school-preview{gap:3px}#sds-trophy-case .sds-school-expanded{padding:12px 9px 16px}}",
 "@media(max-width:355px){#sds-trophy-case .sds-school-preview-icon{width:25px;height:29px;font-size:16px}#sds-trophy-case .sds-school-preview-icon:nth-child(3){display:none}#sds-trophy-case .sds-school-disclosure .sds-school-emblem{min-width:28px;width:28px}}",
 "@media(prefers-reduced-motion:reduce){#sds-trophy-case .sds-school-chevron{transition:none}}",
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
 let verified=[],myPicks={},schedule={},records=[],permanent=[],derived=[],historyUser=null,signedIn=false,leagueId=null,leagueName="",tab="all",school="schools",expandedSchool="ALA",category="all",searchTerm="",rootId="sds-trophy-case",renderId=0,viewerLoading=false;
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
  if(t.nicknameNote){
    const context=document.createElement("p");context.className="sds-nickname-note";
    context.textContent=t.nicknameNote;
    info.append(context);
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
  const onSlate=fullSlate.filter(({t})=>visibleTrophies([t]).length>0);
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
  heading.textContent="All "+TROPHIES.length+" named rivalry matchups";wrap.append(heading);
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
   const entries=visibleTrophies(tab==="mine"?owned():TROPHIES);
   grid.replaceChildren();
   if(!entries.length)grid.append(empty("No rivalries match this search."));
   else entries.forEach(t=>grid.append(trophyCard(t,renderId)));
  }
 }
 // Trophy Case owns the trophy/achievement displays; League keeps chat and management.
 // Render the honors independently so standings updates do not collapse school dropdowns.
 function leagueHonors(){
  const section=document.createElement("section");section.id="sds-league-honors";
  section.className="sds-league-honors";section.setAttribute("aria-label","League championship and achievements");
  const head=document.createElement("div");head.className="sds-honors-head";
  const label=document.createElement("div");label.className="sds-honors-kicker";
  label.textContent="🏆 LEAGUE HONORS";
  const heading=document.createElement("h3");heading.textContent="Championships & Achievements";
  const detail=document.createElement("p");
  detail.textContent=leagueId?"Your league: "+leagueName+" · Awards from official results":"Compete with friends. Earn your place in the trophy room.";
  head.append(label,heading,detail);section.append(head);
  if(!signedIn||!leagueId){
   const empty=document.createElement("div");empty.className="sds-honors-connect";
   const message=document.createElement("p");message.textContent="Join a league to see its season champion and earned player badges.";
   const link=document.createElement("button");link.type="button";link.className="sds-honors-go-league";
   link.textContent="Go to My League →";
   link.addEventListener("click",()=>window.SEC_BRIDGE?.setView?.("league"));
   empty.append(message,link);section.append(empty);
   return section;
  }
  const grid=document.createElement("div");grid.className="sds-honors-grid";
  const championship=document.createElement("div");championship.className="sec-championship-card";
  championship.id="sec-championship-content";
  championship.innerHTML=window.SEC_SOCIAL?.renderChampionship?.()||
   '<p class="helper">Loading championship history…</p>';
  const achievements=document.createElement("div");achievements.className="sds-honors-achievements-card";
  achievements.id="sec-achievements-content";
  achievements.innerHTML=window.SEC_FEATURES?.leagueAchievements?.()||
   '<p class="helper">Loading league achievements…</p>';
  grid.append(championship,achievements);section.append(grid);
  return section;
 }
 function refreshHonors(){
  const old=document.getElementById("sds-league-honors");
  if(old)old.replaceWith(leagueHonors());
 }
 function render(next=tab){
  const root=document.getElementById(rootId);if(!root)return;
  tab=["all","mine","history","rivalries"].includes(next)?next:"all";
  const version=++renderId;root.replaceChildren();
  const h=document.createElement("h2");h.className="sds-trophy-heading";h.innerHTML="Trophy <span>Case</span>";
  const subtitle=document.createElement("p");subtitle.className="sds-trophy-subtitle";
  subtitle.textContent="Win it. Keep it. Brag about it."+(leagueName?" · "+leagueName:"");
  const rivalryNotice=document.createElement("p");rivalryNotice.className="sds-trophy-subtitle";
  rivalryNotice.textContent="Only named rivalries and trophy games are shown. All "+TROPHIES.length+" stay here, even off-season.";
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
  if(school==="schools"){
   root.append(h,subtitle,leagueHonors(),rivalryNotice,summary,schoolPicker(version));
   return;
  }
  root.append(h,subtitle,leagueHonors(),rivalryNotice,summary,schoolBreadcrumb(),tabs,filterBar);
  if(tab==="rivalries"){root.append(rivalryChallenges());}
  else if(tab==="history"){
   const history=document.createElement("div");history.className="sds-trophy-history";
   const schoolRecords=records.filter(result=>school==="all"||byId.get(result.trophyId)?.codes.includes(school));
   if(!schoolRecords.length)history.append(empty(signedIn?"No verified rivalry predictions for this school yet.":"Log in to track your rivalry predictions.",!signedIn));
   for(const result of schoolRecords.slice().sort((a,b)=>b.year-a.year)){
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
   const items=visibleTrophies(tab==="mine"?owned():TROPHIES);
   if(!items.length)grid.append(empty(signedIn?"You haven't earned a rivalry trophy yet.":"Sign in to earn your first rivalry trophy.",!signedIn));
   else items.forEach(t=>grid.append(trophyCard(t,version)));
   root.append(grid);
  }
  const note=document.createElement("p");note.className="sds-trophy-disclaimer";
  note.textContent="This case includes named rivalry games and named trophy contests—not generic team matchups. Off-season rivalries stay available. Correct straight-up predictions earn digital fan awards from verified finals only, and are not physical-trophy ownership. Earned history is retained. Some original collectibles have interactive 3D sculptures; other entries use emblems.";
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
  sync,deriveResults,getResults:()=>records.map(r=>({...r})),trophies:TROPHIES,
  schools:SEC_SCHOOLS,getSchoolOverview:schoolOverviewData,getSchoolTrophies:schoolTrophies,
  selectSchool:changeSchool,getSelectedSchool:()=>school,getVisibleTrophies:()=>visibleTrophies(TROPHIES),
  refreshHonors,
  toggleSchool,getExpandedSchool:()=>expandedSchool,getSchoolPreview:schoolPreview
 });
 if(window.location?.hash==="#trophies")window.SDSTrophyCase.mount();
})();