/* League-independent reactions and source-only Game Center. No invented injuries or LLM output. */
(()=>{
"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const schools={ALA:"Alabama",ARK:"Arkansas",AUB:"Auburn",FLA:"Florida",UGA:"Georgia",UK:"Kentucky",LSU:"LSU",MISS:"Ole Miss",
 MSST:"Mississippi State",MIZ:"Missouri",OU:"Oklahoma",SC:"South Carolina",TENN:"Tennessee",TEX:"Texas",TAMU:"Texas A&M",VAN:"Vanderbilt"};
const emojis={fire:"🔥",upset:"⚡",hype:"🙌",wow:"😱"};
let articles=[],newsAt=0;
const cache=new Map(),pending=new Set(),games=new Map();
const db=()=>window.secOnline?.getClient?.();
const viewer=()=>window.secOnline?.getUser?.();
const data=()=>window.SEC_BRIDGE?.state?.();
function key(g,sport){return sport+":"+g.id;}
function panel(g,sport="football"){
 if(!g?.id)return "";
 const k=key(g,sport),stored=cache.get(k)||{};games.set(k,{g,sport});
 return '<section class="sec-game-community" data-community-game="'+esc(k)+'" aria-label="Fan Game Center extras">'+
  '<h4>🏟️ Fans &amp; matchup intel</h4>'+
  '<div class="sec-community-commentary">'+(stored.commentary||'Open Game Center for a source-grounded matchup preview.')+'</div>'+
  '<div class="sec-community-news">'+(stored.news||'<p class="fan-subtle">Loading team headlines and injury watch…</p>')+'</div>'+
  '<div class="sec-community-reactions">'+(stored.reactions||'<p class="fan-subtle">Loading fan reactions…</p>')+'</div></section>';
}
const safeUrl=u=>{
 try{const v=new URL(u);return v.protocol==="https:"&&["espn.com","www.espn.com","ncaa.com","www.ncaa.com"].includes(v.hostname)?v.href:"";}catch{return "";}
};
const name=c=>schools[c]||c||"";
function matching(g,item){
 const ts=Array.isArray(item.teams)?item.teams:[];
 return [g.away,g.home,g.away_code,g.home_code,g.away_name,g.home_name].filter(Boolean).some(c=>ts.includes(name(c)));
}
function analysis(g,sport){
 if(sport==="football"){
  const d=window.SEC_STATS?.getGame?.(g);
  const a=d?.away||{},h=d?.home||{},p=Number(d?.home_win_pct);
  const ranked=[a.rank?"#"+a.rank+" "+name(g.away):null,h.rank?"#"+h.rank+" "+name(g.home):null].filter(Boolean);
  const lines=[a.record?name(g.away)+" "+a.record:null,h.record?name(g.home)+" "+h.record:null].filter(Boolean);
  const headline=ranked.length?ranked.join(" faces "):name(g.away)+" visits "+name(g.home);
  const projection=d?.home_win_pct!=null&&Number.isFinite(p)&&p>=0&&p<=100?
   " ESPN's published model gives "+name(g.home)+" a "+p.toFixed(1)+"% chance; this is not a guarantee.":
   " No published ESPN win projection is available.";
  return '<p class="fan-subtle"><strong>Automated game guide:</strong> '+esc(headline)+
   (lines.length?" · "+esc(lines.join(" vs. ")):"")+'.'+esc(projection)+'</p>'+
   '<small>Rule-based recap using supplied match data; not generative AI or a reported injury assessment.</small>';
 }
 return '<p class="fan-subtle"><strong>Automated game guide:</strong> '+
  esc(name(g.away_code||g.away)+" vs "+name(g.home_code||g.home))+
  ' · '+esc(g.game_status||"Scheduled")+'. Verify published lineups and news before picks.</p>'+
  '<small>Rule-based summary, not live AI commentary.</small>';
}
async function loadNews(){
 if(Date.now()-newsAt<300000&&articles.length)return;
 try{
  const response=await fetch("./news.json?feed=1",{cache:"no-store"});
  if(!response.ok)throw Error("Headlines unavailable");
  const result=await response.json();
  articles=(result.articles||[]).filter(a=>a&&a.title&&safeUrl(a.url)&&Date.now()-Date.parse(a.published_at)<10*86400000);
  newsAt=Date.now();
 }catch(e){newsAt=Date.now();articles=[];}
}
function newsFor(g,sport){
 const hits=articles.filter(a=>(a.sport||"football")===sport&&matching(g,a)).slice(0,5);
 const injury=hits.filter(a=>/\binjur|ruled out|out for season|questionable|surgery|inactive|scratched/i.test(a.title+" "+(a.summary||"")));
 const cards=hits.slice(0,3).map(a=>'<li><a href="'+esc(safeUrl(a.url))+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a> <small>'+esc(a.source)+'</small></li>').join("");
 const alerts=injury.length?'<p class="fan-subtle">Injury-related reports from linked articles: '+injury.length+'. Check the original publisher for status.</p>':
  '<p class="fan-subtle">Injury watch: No verified injury-related headline found for these teams in the recent news feed. This does not mean no one is injured.</p>';
 return '<div class="sec-community-news-section"><h5>📰 Matchup headlines</h5>'+
  (cards?'<ul>'+cards+'</ul>':'<p class="fan-subtle">No recent source-linked team headlines in this feed.</p>')+
  alerts+'</div>';
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
function update(k){
 const root=[...document.querySelectorAll("[data-community-game]")].find(el=>el.dataset.communityGame===k);
 const state=cache.get(k);
 if(!root||!state)return;
 for(const [cls,value] of [[".sec-community-commentary",state.commentary],
  [".sec-community-news",state.news],[".sec-community-reactions",state.reactions]])
  if(value!=null){const node=root.querySelector(cls);if(node)node.innerHTML=value;}
}
async function load(g,sport="football",force=false){
 if(!g?.id)return;
 const k=key(g,sport);
 if(pending.has(k))return;
 const record=cache.get(k);
 if(!force&&record&&Date.now()-record.updated<60000){update(k);return;}
 pending.add(k);
 const next=record||{};
 next.commentary=analysis(g,sport);cache.set(k,next);update(k);
 try{
  await loadNews();next.news=newsFor(g,sport);update(k);
  if(db()){
   const result=await db().rpc("sec_game_reaction_totals",{p_game:k});
   if(result.error)throw result.error;
   next.reactions=reactionMarkup(result.data,k);
  }else next.reactions='<p class="fan-subtle">Site-wide reactions require online game services.</p>';
 }catch(e){next.reactions='<p class="fan-subtle">Fan reactions unavailable. '+esc(e.message||"Try again.")+'</p>';}
 finally{next.updated=Date.now();pending.delete(k);update(k);}
}
async function vote(k,reaction,button){
 if(!Object.hasOwn(emojis,reaction))return;
 if(!viewer()){window.SEC_BRIDGE?.setView?.("league");window.SEC_BRIDGE?.toast?.("Log in to react to games.");return;}
 if(!db())return;
 button.disabled=true;
 try{
  const result=await db().rpc("sec_vote_game_reaction",{p_game:k,p_reaction:reaction});
  if(result.error)throw result.error;
  const latest=await db().rpc("sec_game_reaction_totals",{p_game:k});
  if(latest.error)throw latest.error;
  const record=cache.get(k)||{};
  record.reactions=reactionMarkup(latest.data,k);record.updated=Date.now();
  cache.set(k,record);update(k);
 }catch(e){window.SEC_BRIDGE?.toast?.(e.message||"Reaction unavailable");}
 finally{button.disabled=false;}
}
document.addEventListener("click",e=>{
 const voteButton=e.target.closest?.("[data-game-reaction]");
 if(voteButton){e.preventDefault();void vote(voteButton.dataset.gameKey,voteButton.dataset.gameReaction,voteButton);return;}
 if(e.target.closest?.("[data-community-login]")){e.preventDefault();window.SEC_BRIDGE?.setView?.("league");}
});
window.SEC_GAME_COMMUNITY=Object.freeze({panel,load,loadKey:k=>{const v=games.get(k);if(v)return load(v.g,v.sport);}});
})();