/* SEC Game Center — free, data-driven sports commentary.
 * Never calls an LLM. Never invents plays, injury statuses, results or predictions.
 * Verified scores/records/news are inputs; fan voting stays independent. */
(()=>{
"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const schools={ALA:"Alabama",ARK:"Arkansas",AUB:"Auburn",FLA:"Florida",UGA:"Georgia",UK:"Kentucky",LSU:"LSU",MISS:"Ole Miss",
 MSST:"Mississippi State",MIZ:"Missouri",OU:"Oklahoma",SC:"South Carolina",TENN:"Tennessee",TEX:"Texas",TAMU:"Texas A&M",VAN:"Vanderbilt"};
const emojis={fire:"🔥",upset:"⚡",hype:"🙌",wow:"😱"};
const SPORTS=new Set(["football","basketball","baseball"]);
const cache=new Map(),pending=new Set(),games=new Map();
let articles=[],newsAt=0;
const db=()=>window.secOnline?.getClient?.();
const viewer=()=>window.secOnline?.getUser?.();
const name=c=>schools[c]||String(c||"Team");
const score=n=>Number.isInteger(n)&&n>=0&&n<=999?n:null;
const choice=(id,n)=>{const str=String(id||"");let code=0;for(const ch of str)code=(Math.imul(code,31)+ch.charCodeAt(0))|0;return (code>>>0)%n;};
const key=(g,sport)=>sport+":"+g.id;
const safeUrl=u=>{
 try{const v=new URL(u);return v.protocol==="https:"&&["espn.com","www.espn.com","ncaa.com","www.ncaa.com"].includes(v.hostname)?v.href:"";}catch{return "";}
};
const validRecord=x=>typeof x==="string"&&/^\d{1,3}-\d{1,3}(?:-\d{1,3})?$/.test(x)?x:null;
const validRank=x=>{
 const n=Number(x);return x!==null&&x!==undefined&&Number.isInteger(n)&&n>=1&&n<=25?n:null;
};
function context(g,sport){
 const awayCode=String(g.away_code||g.away||""),homeCode=String(g.home_code||g.home||"");
 const away=String(g.away_name||name(awayCode)),home=String(g.home_name||name(homeCode));
 const isFootball=sport==="football";
 const stats=isFootball?window.SEC_STATS?.getGame?.(g)||{}:{};
 const ar=validRecord(stats.away?.record),hr=validRecord(stats.home?.record);
 const rankA=validRank(stats.away?.rank),rankH=validRank(stats.home?.rank);
 const status=String(g.game_status||g.liveStatus||"scheduled").toLowerCase();
 const pointsA=score(g.away_score??g.awayScore),pointsH=score(g.home_score??g.homeScore);
 const scoreReady=pointsA!==null&&pointsH!==null;
 const model=stats.home_win_pct;
 const projection=model!==null&&model!==undefined&&Number.isFinite(Number(model))&&
   Number(model)>=0&&Number(model)<=100?Number(model):null;
 const publishedLine=g.spread_home!==null&&g.spread_home!==undefined&&g.spread_home!==""&&
   Number.isFinite(Number(g.spread_home))&&(!isFootball||Boolean(g.spread_source))?Number(g.spread_home):null;
 return {away,home,awayCode,homeCode,ar,hr,rankA,rankH,status,pointsA,pointsH,scoreReady,
  projection,publishedLine,stats};
}
function narrative(g,sport="football"){
 if(!SPORTS.has(sport))return {label:"MATCHUP",text:"Matchup data is not available yet.",context:null};
 const v=context(g,sport),{away,home,status,pointsA,pointsH}=v;
 const variants=choice(g.id,3);
 const match=away+" at "+home;
 if(["canceled","postponed"].includes(status))
  return {label:"SCHEDULE UPDATE",context:v,text:match+" is listed as "+status+". There is no confirmed final result to recap."};
 if(status==="final"){
  if(!v.scoreReady)
   return {label:"FINAL · AWAITING SCORE",context:v,text:match+" is marked final, but the verified score is not available yet. Check the official game summary for details."};
  const tie=pointsA===pointsH;
  const winner=pointsA>pointsH?away:home,loser=pointsA>pointsH?home:away;
  const wc=pointsA>pointsH?v.awayCode:v.homeCode;
  const supplied=g.winner||g.winner_code||null;
  const scoreline=away+" "+pointsA+" – "+home+" "+pointsH;
  if(tie||supplied&&String(supplied)!==wc)
   return {label:"FINAL · VERIFYING",context:v,text:"The score feed lists "+scoreline+", but the winner cannot yet be verified consistently. The result needs a source check before a recap."};
  const high=Math.max(pointsA,pointsH),low=Math.min(pointsA,pointsH),margin=high-low;
  const unit=sport==="baseball"?"run":"point",tight=sport==="football"?margin<=8:sport==="basketball"?margin<=3:margin===1;
  const openers=[
   winner+" finished ahead of "+loser+", "+high+"–"+low+".",
   "It's final: "+winner+" "+high+", "+loser+" "+low+".",
   winner+" takes the result over "+loser+" with a "+high+"–"+low+" final score."
  ];
  const finish=tight?
   (sport==="football"?"One score separated the teams at the finish.":sport==="basketball"?"The teams finished within one possession.":"A single run separated the teams.") :
   "The final margin was "+margin+" "+unit+(margin===1?"":"s")+".";
  return {label:tight?"FINAL · CLOSE FINISH":"FINAL · RECAP",context:v,
    text:openers[variants]+" "+finish};
 }
 if(status==="live"){
  if(!v.scoreReady)return {label:"LIVE · SCORE PENDING",context:v,
    text:match+" is listed as live, but a verified in-game score is not available yet. The commentary will update when the score feed does."};
  const difference=Math.abs(pointsA-pointsH);
  const tied=pointsA===pointsH;
  const leader=pointsA>pointsH?away:home;
  const scoreline=away+" "+pointsA+" – "+home+" "+pointsH;
  const tight=sport==="football"?difference<=8:sport==="basketball"?difference<=3:difference<=1;
  const first=tied?
   [ "They're level right now: ","Neither side leads: ","It's tied on the verified scoreboard: "][variants]+scoreline+".":
   [leader+" leads, "+scoreline+".", "The verified scoreboard has "+leader+" in front: "+scoreline+".",
     "Live check: "+scoreline+", with "+leader+" ahead."][variants];
  const last=tied?"There's no winner yet.":tight?
   "It's a close game on the published scoreboard, with no final result yet.":
   "The lead is "+difference+(sport==="baseball"?" run":" point")+(difference===1?"":"s")+", and play is still in progress.";
  return {label:tied?"LIVE · TIED":tight?"LIVE · CLOSE GAME":"LIVE · SCOREBOARD",context:v,text:first+" "+last};
 }
 const open=[
  match+" is on the slate. Here's what the verified matchup data tells us.",
  away+" and "+home+" are set to meet. The numbers offer the best starting point.",
  "Up next: "+away+" against "+home+". Let's look at what's confirmed before the game."
 ][variants];
 const notes=[];
 if(v.rankA!==null&&v.rankH!==null)notes.push("It's a ranked matchup: #"+v.rankA+" "+away+" meets #"+v.rankH+" "+home+".");
 else if(v.rankA!==null||v.rankH!==null){
  const ranked=v.rankA!==null?away:home,r=v.rankA??v.rankH;
  notes.push(ranked+" enters listed at #"+r+" in the published rankings.");
 }
 if(v.ar&&v.hr)notes.push(away+" is "+v.ar+" and "+home+" is "+v.hr+" in the available season records.");
 else if(v.ar||v.hr)notes.push("The published record for "+(v.ar?away:home)+" is "+(v.ar||v.hr)+".");
 if(v.publishedLine!==null&&v.publishedLine!==0){
  const fav=v.publishedLine<0?home:away;
  notes.push("The listed point spread favors "+fav+" by "+Math.abs(v.publishedLine).toFixed(1)+". A line isn't a guaranteed outcome.");
 }else if(v.projection!==null){
  notes.push("ESPN's published model lists "+home+" at "+v.projection.toFixed(1)+"% to win. Projections aren't guarantees.");
 }
 if(!notes.length)notes.push("Records, rankings and win projections haven't been verified for this game, so there's no evidence-based favorite to call.");
 return {label:"PREGAME · WHAT TO WATCH",context:v,text:open+" "+notes.slice(0,3).join(" ")};
}
function matching(g,item){
 const teams=Array.isArray(item.teams)?item.teams:[];
 const candidates=[g.away,g.home,g.away_code,g.home_code,g.away_name,g.home_name]
  .filter(Boolean).map(c=>name(c).toLowerCase());
 return teams.some(t=>candidates.includes(String(t).toLowerCase()));
}
async function loadNews(){
 if(Date.now()-newsAt<300000)return;
 newsAt=Date.now();
 try{
  const res=await fetch("./news.json?feed=1",{cache:"no-store"});
  if(!res.ok)throw Error("News feed unavailable");
  const doc=await res.json();
  articles=(Array.isArray(doc.articles)?doc.articles:[]).filter(a=>
   a?.title&&safeUrl(a.url)&&Number.isFinite(Date.parse(a.published_at))&&
   Date.now()-Date.parse(a.published_at)>=-3600000&&
   Date.now()-Date.parse(a.published_at)<10*86400000);
 }catch(e){console.info("Related reporting unavailable:",e?.message||e);}
}
function related(g,sport){
 return articles.filter(a=>(a.sport||"football")===sport&&matching(g,a)).slice(0,4);
}
function commentary(g,sport){
 const report=narrative(g,sport),hits=related(g,sport);
 const source=hits.find(a=>safeUrl(a.url)),famous=report.context?.stats?.source_url;
 const trustedStats=safeUrl(famous)?famous:null;
 const links=[...hits.slice(0,2).map(a=>({url:safeUrl(a.url),title:a.source||"Original coverage"})),
   ...(trustedStats?[{url:trustedStats,title:"ESPN game center"}]:[])]
   .filter(x=>x.url).filter((x,i,list)=>list.findIndex(y=>y.url===x.url)===i);
 const selected=source?'Recent '+source.source+" coverage: “"+String(source.title).slice(0,145)+"”":"";
 const caution=hits.some(a=>/\binjur|ruled out|questionable|inactive|scratched|surgery/i.test(a.title+" "+(a.summary||"")));
 return '<div class="sec-ai-panel" data-commentary-state="'+esc(report.label)+'">'+
  '<div class="sec-ai-top"><h5>🎙️ SEC Smart Commentary</h5>'+
  '<span class="sec-ai-status">'+esc(report.label)+'</span></div>'+
  '<div class="sec-ai-narrative"><p>'+esc(report.text)+'</p>'+
  (selected?'<p class="sec-ai-coverage">'+esc(selected)+'</p>':"")+
  '</div>'+
  (caution?'<p class="sec-ai-injury">Injury-related coverage exists. Check the linked original reporting for current status.</p>':"")+
  '<div class="sec-ai-attribution"><small>Automatically written from published game data. No paid AI API, simulated plays or invented injuries.</small>'+
  (links.length?'<div class="sec-ai-links">'+links.map(x=>
   '<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.title)+" ↗</a>").join("")+'</div>':"")+
  '</div></div>';
}
function reactionMarkup(rows,gameKey){
 const authenticated=!!viewer();
 const buttons=Object.entries(emojis).map(([value,emoji])=>{
  const r=(rows||[]).find(v=>v.reaction===value)||{};
  return '<button type="button" data-game-reaction="'+value+'" data-game-key="'+esc(gameKey)+
   '" class="sec-community-reaction'+(r.mine?" chosen":"")+'" aria-pressed="'+(r.mine?"true":"false")+'" '+
   (!authenticated?'title="Log in to react" ':'')+'>'+emoji+' '+Number(r.votes||0)+'</button>';
 }).join("");
 return '<div class="sec-community-reaction-group"><h5>Fan reactions · entire site</h5>'+
  '<div class="sec-community-votes">'+buttons+'</div>'+
  '<p class="fan-subtle">One reaction per signed-in fan per game; tap again to undo. No public text or anonymous posting.'+
  (!authenticated?' <button type="button" data-community-login class="fan-small">Log in to react</button>':'')+
  '</p></div>';
}
function panel(g,sport="football"){
 if(!g?.id)return "";
 const k=key(g,sport),stored=cache.get(k)||{};
 games.set(k,{g,sport});
 return '<section class="sec-game-community" data-community-game="'+esc(k)+'" aria-label="SEC game commentary and fan reactions">'+
  '<h4>🏟️ Game Center · fan zone</h4>'+
  '<div class="sec-community-news">'+commentary(g,sport)+'</div>'+
  '<div class="sec-community-reactions">'+(stored.reactions||'<p class="fan-subtle">Checking fan reactions…</p>')+'</div></section>';
}
function update(k){
 const state=games.get(k),stored=cache.get(k);
 if(!state)return;
 for(const root of document.querySelectorAll("[data-community-game]")){
  if(root.dataset.communityGame!==k)continue;
  const news=root.querySelector(".sec-community-news");
  if(news)news.innerHTML=commentary(state.g,state.sport);
  const reactions=root.querySelector(".sec-community-reactions");
  if(reactions&&stored?.reactions)reactions.innerHTML=stored.reactions;
 }
}
async function load(g,sport="football",force=false){
 if(!g?.id||!SPORTS.has(sport))return;
 const k=key(g,sport);
 games.set(k,{g,sport});
 const record=cache.get(k);
 if(!force&&record&&Date.now()-record.updated<(String(g.game_status||g.liveStatus)==="live"?30000:60000)){
  update(k);return;
 }
 if(pending.has(k)){update(k);return;}
 pending.add(k);
 const state=record||{};
 cache.set(k,state);
 try{
  await loadNews();
  update(k);
  if(db()){
   const res=await db().rpc("sec_game_reaction_totals",{p_game:k});
   if(res.error)throw res.error;
   state.reactions=reactionMarkup(res.data,k);
  }else state.reactions='<p class="fan-subtle">Fan reactions require an online connection.</p>';
 }catch(e){
  console.info("Fan reactions unavailable:",e?.message||e);
  state.reactions='<p class="fan-subtle">Fan reactions unavailable right now. Matchup commentary still works.</p>';
 }finally{
  state.updated=Date.now();pending.delete(k);update(k);
 }
}
async function vote(k,reaction,button){
 if(!Object.hasOwn(emojis,reaction))return;
 if(!viewer()){
  window.SEC_BRIDGE?.setView?.("league");
  window.SEC_BRIDGE?.toast?.("Log in to react to games.");return;
 }
 if(!db())return;
 button.disabled=true;
 try{
  const result=await db().rpc("sec_vote_game_reaction",{p_game:k,p_reaction:reaction});
  if(result.error)throw result.error;
  const latest=await db().rpc("sec_game_reaction_totals",{p_game:k});
  if(latest.error)throw latest.error;
  const stored=cache.get(k)||{};
  stored.reactions=reactionMarkup(latest.data,k);stored.updated=Date.now();
  cache.set(k,stored);update(k);
 }catch(e){window.SEC_BRIDGE?.toast?.(e.message||"Reaction unavailable");}
 finally{button.disabled=false;}
}
document.addEventListener("click",e=>{
 const b=e.target.closest?.("[data-game-reaction]");
 if(b){e.preventDefault();void vote(b.dataset.gameKey,b.dataset.gameReaction,b);return;}
 if(e.target.closest?.("[data-community-login]")){
  e.preventDefault();window.SEC_BRIDGE?.setView?.("league");
 }
});
window.SEC_GAME_COMMUNITY=Object.freeze({panel,load,
 loadKey:k=>{const item=games.get(k);if(item)return load(item.g,item.sport);},
 commentary,narrative});
})();