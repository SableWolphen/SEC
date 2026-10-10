/* SEC News — Final Whistle recaps from confirmed server-side scores only.
 * Zero predictions, no fake plays/injuries, no need to sign in. */
(()=>{
"use strict";
const LABELS={football:"football",basketball:"basketball",baseball:"baseball"};
const NAMES={ALA:"Alabama",ARK:"Arkansas",AUB:"Auburn",FLA:"Florida",UGA:"Georgia",UK:"Kentucky",
 LSU:"LSU",MISS:"Ole Miss",MSST:"Mississippi State",MIZ:"Missouri",OU:"Oklahoma",SC:"South Carolina",
 TENN:"Tennessee",TEX:"Texas",TAMU:"Texas A&M",VAN:"Vanderbilt"};
const ESPN_PATHS={football:"college-football",basketball:"mens-college-basketball",baseball:"college-baseball"};
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(text!==undefined)node.textContent=String(text);return node;
};
const validScore=x=>Number.isInteger(x)&&x>=0&&x<=999;
const label=(code,fallback)=>String(fallback||NAMES[code]||code||"Team");
const asDate=x=>{const t=Date.parse(x);return Number.isFinite(t)?t:null;};
const stamp=t=>new Date(t).toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"America/Chicago"});
const db=()=>window.secOnline?.getClient?.();
const scope={sport:"football",school:"all",mine:false,expanded:false};
const saved={},inflight={};
function normalize(g,sport,now=Date.now()){
 if(!g||g.game_status!=="final"||!validScore(g.away_score)||!validScore(g.home_score))return null;
 const time=asDate(g.kickoff_at);
 if(time===null||time>now||time<now-370*86400000)return null;
 const aw=String(g.away_code||""),hm=String(g.home_code||"");
 const winner=String(sport==="football"?g.winner:g.winner_code);
 if(!aw||!hm||aw===hm||winner!==aw&&winner!==hm||g.away_score===g.home_score)return null;
 if(winner===aw&&g.away_score<=g.home_score||winner===hm&&g.home_score<=g.away_score)return null;
 return {...g,sport,time,away_code:aw,home_code:hm,
  away_name:label(aw,g.away_name),home_name:label(hm,g.home_name),margin:Math.abs(g.away_score-g.home_score)};
}
function gameLink(g){
 const id=String(g.espn_event_id||"");
 if(!/^\d{7,12}$/.test(id))return null;
 return "https://www.espn.com/"+ESPN_PATHS[g.sport]+"/game/_/gameId/"+id;
}
function sourceStory(g){
 const items=window.SEC_NEWS?.getArticles?.()||[];
 const a=g.away_name.toLowerCase(),h=g.home_name.toLowerCase();
 const hit=items.find(item=>{
  if((item.sport||"football")!==g.sport)return false;
  if(!Array.isArray(item.teams))return false;
  if(!item.teams.some(t=>String(t).toLowerCase()===a)||!item.teams.some(t=>String(t).toLowerCase()===h))return false;
  const at=asDate(item.published_at);
  if(at===null||at<g.time||at>g.time+72*3600000)return false;
  if(!/\b(?:beat|beats|win|wins|defeat|defeats|edge|edges|upset|rout|recap|highlight|topples|tops|game recap)\b/i.test(item.title||""))return false;
  try{
   const url=new URL(item.url);
   return url.protocol==="https:"&&["www.espn.com","espn.com","ncaa.com","www.ncaa.com"].includes(url.hostname);
  }catch{return false;}
 });
 return hit?{url:hit.url,title:hit.title,source:hit.source}:null;
}
function finalist(g,winner){
 const row=make("div","sec-recap-team"+(winner?" is-winner":""));
 const nm=make("strong","",winner?"🏆 "+label(g.code,g.name):label(g.code,g.name));
 const pts=make("b","sec-recap-score",String(g.score));
 row.append(nm,pts);return row;
}
function card(g,index){
 const lead=index===0;
 const el=make("article","sec-recap-card"+(lead?" is-featured":""));
 const info=make("div","sec-recap-card-top");
 info.append(make("span","sec-recap-state","✓ FINAL"),make("time","sec-recap-date",stamp(g.time)));
 el.append(info);
 const names=make("div","sec-recap-match");
 names.append(
  finalist({code:g.away_code,name:g.away_name,score:g.away_score},g.winner===g.away_code),
  finalist({code:g.home_code,name:g.home_name,score:g.home_score},g.winner===g.home_code)
 );
 el.append(names);
 const champ=g.winner===g.home_code?g.home_name:g.away_name;
 const runner=g.winner===g.home_code?g.away_name:g.home_name;
 const won=g.winner===g.home_code?g.home_score:g.away_score;
 const lost=g.winner===g.home_code?g.away_score:g.home_score;
 const winLabel=g.sport==="baseball"?"run":"point";
 const short=g.sport==="football"?g.margin<=8:
  g.sport==="basketball"?g.margin<=3:g.margin===1;
 const eyebrow=short?
  (g.sport==="football"?"ONE-SCORE FINISH":g.sport==="basketball"?"ONE-POSSESSION FINAL":"ONE-RUN FINAL"):
  (g.margin>=21&&g.sport!=="baseball"?"BIG WIN":"THE FINAL WORD");
 const recap=make("p","sec-recap-tldr");
 recap.append(make("span","sec-recap-flag",eyebrow),
  make("span","",champ+" defeated "+runner+" "+won+"–"+lost+", winning by "+g.margin+" "+winLabel+(g.margin===1?"":"s")+"."));
 el.append(recap);
 const story=sourceStory(g),url=story?.url||gameLink(g);
 const footer=make("div","sec-recap-footer");
 footer.append(make("small","","Verified final score · "+(story?"Related "+story.source+" recap":"Game results")));
 if(url){
  const a=make("a","sec-recap-link",story?"Read game recap ↗":"ESPN game summary ↗");
  a.href=url;a.target="_blank";a.rel="noopener noreferrer";
  footer.append(a);
 }
 el.append(footer);
 return el;
}
function filtered(sport){
 const rows=saved[sport]?.rows||[];
 const favorite=scope.mine?window.SEC_BRIDGE?.state?.()?.favorite:null;
 const chosen=scope.school!=="all"?scope.school:favorite?NAMES[favorite]:null;
 if(!chosen)return rows;
 return rows.filter(g=>[g.away_name,g.home_name].some(x=>x.toLowerCase()===chosen.toLowerCase()));
}
function draw(){
 const slot=$("sec-recap-root");if(!slot)return;
 slot.replaceChildren();
 const bar=make("div","sec-recap-heading");
 const intro=make("div","");
 intro.append(make("div","sec-recap-kicker","THE FINAL WHISTLE · "+scope.sport.toUpperCase()),
  make("h3","","Game recaps"),make("p","","Confirmed scores. The story in 10 seconds."));
 bar.append(intro);
 const favorite=window.SEC_BRIDGE?.state?.()?.favorite;
 if(favorite&&NAMES[favorite]&&scope.school==="all"){
  const mine=make("button","sec-recap-mine"+(scope.mine?" active":""),scope.mine?"★ My team ✓":"☆ My team");
  mine.type="button";mine.setAttribute("aria-pressed",String(scope.mine));
  mine.addEventListener("click",()=>{scope.mine=!scope.mine;scope.expanded=false;draw();});
  bar.append(mine);
 }
 slot.append(bar);
 const state=saved[scope.sport];
 if(inflight[scope.sport]&&!state){slot.append(make("p","sec-recap-placeholder","Checking verified final scores…"));return;}
 if(!state){
  slot.append(make("p","sec-recap-placeholder","Recaps will appear when the confirmed score feed is available."));
  return;
 }
 const rows=filtered(scope.sport),cut=scope.expanded?12:3;
 if(!rows.length){
  const box=make("div","sec-recap-placeholder","");
  box.append(make("strong","",scope.school!=="all"||scope.mine?"No finals for this school yet.":"No confirmed "+scope.sport+" finals yet."));
  box.append(make("span","","Recaps appear here automatically after the score provider confirms a result."));
  slot.append(box);return;
 }
 const grid=make("div","sec-recap-grid");
 rows.slice(0,cut).forEach((g,i)=>grid.append(card(g,i)));
 slot.append(grid);
 if(rows.length>3){
  const actions=make("div","sec-recap-actions");
  const more=make("button","sec-recap-more",scope.expanded?"Show fewer recaps ↑":"See all "+Math.min(rows.length,12)+" recent finals ↓");
  more.type="button";more.addEventListener("click",()=>{scope.expanded=!scope.expanded;draw();});
  actions.append(more);slot.append(actions);
 }
 if(state.issue)slot.append(make("small","sec-recap-caution","Score feed could not refresh; showing previously loaded finals."));
}
async function load(sport,force=false){
 if(!LABELS[sport]||inflight[sport])return;
 const cached=saved[sport];
 if(!force&&cached&&Date.now()-cached.at<3*60000){draw();return;}
 const c=db();
 if(!c){saved[sport]={rows:[],at:Date.now(),issue:true};draw();return;}
 const task=(async()=>{
  try{
   const table=sport==="football"?"sec_games":"sec_sport_games";
   const fields=sport==="football"?
    "id,away_code,home_code,game_status,kickoff_at,away_score,home_score,winner,espn_event_id":
    "id,sport,away_code,home_code,away_name,home_name,game_status,kickoff_at,away_score,home_score,winner_code,espn_event_id";
   let q=c.from(table).select(fields).eq("game_status","final");
   if(sport!=="football")q=q.eq("sport",sport);
   const result=await q.order("kickoff_at",{ascending:false}).limit(80);
   if(result.error)throw result.error;
   if(!Array.isArray(result.data))throw Error("Score feed missing games");
   const rows=result.data.map(g=>normalize(g,sport)).filter(Boolean).sort((a,b)=>b.time-a.time).slice(0,24);
   saved[sport]={rows,at:Date.now(),issue:false};
  }catch(e){
   console.info("Game recaps:",e?.message||e);
   saved[sport]={rows:cached?.rows||[],at:Date.now()-150000,issue:true};
  }finally{delete inflight[sport];if(scope.sport===sport)draw();}
 })();
 inflight[sport]=task;draw();
 await task;
}
function mount(sport="football",school="all"){
 if(!LABELS[sport])sport="football";
 if(scope.sport!==sport||scope.school!==school)scope.expanded=false;
 scope.sport=sport;scope.school=school;
 draw();void load(sport);
}
window.SEC_RECAPS=Object.freeze({mount,refresh:()=>load(scope.sport,true),normalize,gameLink,filtered});
})();
