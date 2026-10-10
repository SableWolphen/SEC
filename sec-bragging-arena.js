/* SEC Bragging Arena — factual, post-lock league rivalries and shareable receipts.
 * Members-only data from sec_brags_locker_room; never reads unexpired picks directly. */
(()=>{
"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const root=()=>document.getElementById("fan-brag-arena");
const db=()=>window.secOnline?.getClient?.();
const user=()=>window.secOnline?.getUser?.();
const item=()=>window.SEC_LEAGUE_SETTINGS?.getSelected?.();
const codes={ALA:"Alabama",ARK:"Arkansas",AUB:"Auburn",FLA:"Florida",UGA:"Georgia",UK:"Kentucky",LSU:"LSU",MISS:"Ole Miss",MSST:"Mississippi State",MIZ:"Missouri",OU:"Oklahoma",SC:"South Carolina",TENN:"Tennessee",TEX:"Texas",TAMU:"Texas A&M",VAN:"Vanderbilt"};
const name=c=>codes[c]||String(c||"Team");
const sportIcon={football:"🏈",basketball:"🏀",baseball:"⚾"};
const scoped=i=>i&&["club","football","basketball","baseball"].includes(i.kind)&&i.id;
const ref=i=>user()?.id+":"+i.kind+":"+i.id;
const cache=new Map(),inflight=new Map();
let chosenOpponent="",chosenReceipt="",lastScope="";
const isNumber=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x));
const score=x=>isNumber(x)?Number(x):null;
function scopeOk(i,u,k){return u?.id===user()?.id&&ref(i)===k&&ref(item()||{})===k;}
function validate(raw){
 const players=Array.isArray(raw?.players)?raw.players.filter(p=>p?.user_id):[];
 const games=(Array.isArray(raw?.games)?raw.games:[]).filter(g=>g?.id&&g?.sport&&
  Number.isFinite(Date.parse(g.kickoff_at))&&Date.parse(g.kickoff_at)<=Date.now());
 const permitted=new Set(games.map(g=>String(g.id)));
 const ids=new Set(players.map(p=>p.user_id));
 const picks=(Array.isArray(raw?.picks)?raw.picks:[]).filter(p=>
  ids.has(p?.user_id)&&permitted.has(String(p?.game_id))&&typeof p.pick_code==="string");
 return {players,games,picks,limited:raw?.limited===true};
}
function verified(g){
 if(g.game_status!=="final"||!g.winner||![g.home_code,g.away_code].includes(g.winner))return false;
 const a=score(g.away_score),h=score(g.home_score);
 return a!==null&&h!==null&&a!==h&&((g.winner===g.away_code&&a>h)||(g.winner===g.home_code&&h>a));
}
function matchup(g){
 const away=g.away_name||name(g.away_code),home=g.home_name||name(g.home_code);
 return away+" vs "+home;
}
function lineUnderdog(g){
 // Numeric line = points added to home. Football must have a trusted spread source.
 if(!isNumber(g.spread_home)||Number(g.spread_home)===0||!g.spread_source)return null;
 return Number(g.spread_home)<0?g.away_code:g.home_code;
}
function take(g,p){return p?.pick_code===g.away_code||p?.pick_code===g.home_code?p.pick_code:null;}
function result(g,p){
 if(!verified(g)||!take(g,p))return null;
 return take(g,p)===g.winner;
}
function model(raw){
 const data=validate(raw),players=new Map(data.players.map(p=>[p.user_id,p]));
 const games=new Map(data.games.map(g=>[g.id,g]));
 const picks=new Map();
 for(const p of data.picks){
  const g=games.get(p.game_id);
  if(g&&take(g,p))picks.set(p.user_id+"|"+p.game_id,p);
 }
 const byGame=new Map();
 for(const g of data.games)byGame.set(g.id,data.players.map(p=>({
  player:p,pick:picks.get(p.user_id+"|"+g.id)
 })).filter(x=>x.pick));
 const get=(uid,g)=>picks.get(uid+"|"+g.id);
 const finals=data.games.filter(verified).sort((a,b)=>Date.parse(b.kickoff_at)-Date.parse(a.kickoff_at));
 const graded=uid=>finals.filter(g=>result(g,get(uid,g))!==null);
 return {...data,players,games,picks,byGame,get,finals,graded};
}
function rivalry(m,myId,otherId){
 const both=m.finals.filter(g=>m.get(myId,g)&&m.get(otherId,g));
 let wins=0,losses=0,draws=0;
 const byWeek=new Map();
 for(const g of both){
  const a=result(g,m.get(myId,g)),b=result(g,m.get(otherId,g));
  if(a&&!b)wins++;else if(b&&!a)losses++;else draws++;
  const wk=g.sport+"|"+g.season+"|"+g.week;
  if(!byWeek.has(wk))byWeek.set(wk,{sport:g.sport,week:g.week,my:0,their:0,games:0,latest:0});
  const r=byWeek.get(wk);r.my+=Number(a);r.their+=Number(b);r.games++;
  r.latest=Math.max(r.latest,Date.parse(g.kickoff_at));
 }
 return {wins,losses,draws,both:both.length,rounds:[...byWeek.values()].sort((a,b)=>b.latest-a.latest)};
}
function awards(m){
 const known=m.players.size,eligible=m.finals;
 const byPlayer=[...m.players.values()].map(p=>{
  const mine=m.graded(p.user_id).sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at));
  let active=0,maximum=0,upsets=0,crowd=0,hit=0;
  for(const g of mine){
   const good=result(g,m.get(p.user_id,g));
   hit+=Number(good);active=good?active+1:0;maximum=Math.max(maximum,active);
   if(good&&lineUnderdog(g)===m.get(p.user_id,g)?.pick_code)upsets++;
   const picks=m.byGame.get(g.id)||[];
   if(good&&picks.length>=3&&picks.filter(x=>result(g,x.pick)).length===1)crowd++;
  }
  return {...p,graded:mine.length,correct:hit,streak:maximum,upsets,crowd};
 });
 const schools=new Map();
 for(const p of byPlayer)if(codes[p.school]&&p.graded){
  const row=schools.get(p.school)||{code:p.school,correct:0,graded:0,fans:0};
  row.correct+=p.correct;row.graded+=p.graded;row.fans++;schools.set(p.school,row);
 }
 const top=[...schools.values()].filter(r=>r.graded>=3)
  .sort((a,b)=>b.correct/b.graded-a.correct/a.graded||b.graded-a.graded).slice(0,5);
 return {byPlayer,schools:top,hasEnough:known>1};
}
function bulletin(m){
 const finals=m.finals.slice(0,24),stories=[];
 for(const g of finals){
  const picks=m.byGame.get(g.id)||[];
  if(picks.length<2)continue;
  const winners=picks.filter(p=>result(g,p.pick)).length,tot=picks.length;
  const underdog=lineUnderdog(g);
  const game=matchup(g);
  if(underdog&&g.winner===underdog&&winners>0&&winners<tot){
   stories.push({id:g.id,text:"⚡ Upset receipts: "+winners+" of "+tot+" league picks called "+game+" correctly. The underdog delivered."});
  }else if(winners===1&&tot>=3){
   stories.push({id:g.id,text:"🎯 Lone genius: just one of "+tot+" picks got "+game+" right."});
  }else if(winners===0&&tot>=2){
   stories.push({id:g.id,text:"😬 Nobody in the league called "+game+" correctly. A collective cold streak."});
  }else if(winners===tot&&tot>=3){
   stories.push({id:g.id,text:"🧠 Smart crowd: all "+tot+" league picks correctly called "+game+"."});
  }
  if(stories.length>=3)break;
 }
 return stories;
}
const tag=p=>window.SEC_PRIDE?.badge?.(p.user_id)||(codes[p.school]?'<span class="sec-school-badge">★ '+esc(p.school)+'</span>':"");
function bestName(p){return esc(p?.display_name||"Player")+(p?tag(p):"");}
function renderDuel(m,me,other){
 if(!other)return '<p class="fan-subtle">Choose another member to start tracking your rivalry. No extra picks or bets needed.</p>';
 const match=rivalry(m,me.user_id,other.user_id);
 const rec=match.rounds.slice(0,4).map(r=>
  '<div class="brag-round"><span>'+esc(sportIcon[r.sport]||"")+" Week "+esc(r.week)+
  '</span><strong>'+r.my+"–"+r.their+'</strong><small>'+r.games+' shared finals</small></div>').join("");
 return '<div class="brag-versus"><div><small>YOU</small><strong>'+bestName(me)+'</strong></div>'+
  '<span>VS</span><div><small>RIVAL</small><strong>'+bestName(other)+'</strong></div></div>'+
  '<div class="brag-headline-score"><strong>'+match.wins+'</strong><span>WINS · '+match.draws+' TIES · '+match.losses+' LOSSES</span><strong>'+match.losses+'</strong></div>'+
  '<p class="fan-subtle">'+match.both+' shared verified finals compared. A win means you called the winner and your rival missed; matching calls are ties.</p>'+
  (rec?'<div class="brag-rounds">'+rec+'</div>':'<p class="fan-subtle">No shared confirmed results yet. Your first face-off begins after a final score.</p>')+
  '<button type="button" class="fan-small fan-primary" data-brag-share="challenge">⚔️ Call out rival ↗</button>';
}
function receiptText(g,p,m){
 const pick=take(g,p),selected=pick===g.home_code?(g.home_name||name(g.home_code)):(g.away_name||name(g.away_code));
 const winner=g.winner===g.home_code?(g.home_name||name(g.home_code)):(g.away_name||name(g.away_code));
 const correct=result(g,p)===true;
 const line=lineUnderdog(g)===pick&&correct;
 return (line?"⚡ UPSET RECEIPT":correct?"🎯 PICK RECEIPT":"😬 COLD TAKE")+" · "+
  (m.players.get(p.user_id)?.display_name||"Player")+" picked "+selected+" in "+matchup(g)+
  ". Final: "+g.away_score+"–"+g.home_score+". Winner: "+winner+". "+(correct?"CALLED IT.":"MISS.")+
  " · SEC Pick’em";
}
function receipts(m,me,who){
 const player=m.players.get(who)||me;
 const found=m.finals.filter(g=>m.get(player.user_id,g)).slice(0,5);
 return '<section class="brag-block" aria-label="Pick Receipts"><div class="brag-block-head"><div>'+
  '<div class="card-kicker">🎯 PICK RECEIPTS</div><h3>The picks are permanent.</h3></div>'+
  '<label class="brag-label">Player<select aria-label="Receipt player" data-brag-receipts>'+
  [...m.players.values()].map(p=>'<option value="'+esc(p.user_id)+'" '+(p.user_id===player.user_id?"selected":"")+'>'+
   esc(p.display_name||"Player")+'</option>').join("")+'</select></label></div>'+
  '<p class="fan-subtle">Only after kickoff. These receipts use verified outright winners, not betting or spread-league grading.</p>'+
  (found.length?'<div class="brag-receipt-list">'+found.map(g=>{
   const p=m.get(player.user_id,g),good=result(g,p),shocker=good&&lineUnderdog(g)===p.pick_code;
   const text=receiptText(g,p,m);
   return '<article class="brag-receipt '+(good?"is-win":"is-loss")+'">'+
    '<span class="brag-receipt-status">'+(shocker?"⚡ Upset called":good?"✓ Called it":"✕ Missed it")+'</span>'+
    '<strong>'+esc(matchup(g))+'</strong><small>'+esc(sportIcon[g.sport]||"")+" "+esc(g.sport)+
     " · Final "+g.away_score+"–"+g.home_score+'</small>'+
    '<button type="button" class="fan-small" data-brag-receipt="'+esc(g.id)+'" data-brag-player="'+esc(player.user_id)+'">↗ Copy receipt</button>'+
    '</article>';
  }).join("")+'</div>':'<p class="fan-subtle">No confirmed final-game receipts for this player yet.</p>')+'</section>';
}
function accolade(m,me){
 const a=awards(m),top=a.byPlayer.slice().sort((a,b)=>b.streak-a.streak)[0];
 const upset=a.byPlayer.slice().sort((a,b)=>b.upsets-a.upsets)[0];
 const crowd=a.byPlayer.slice().sort((a,b)=>b.crowd-a.crowd)[0];
 const topOne=a.byPlayer.slice().sort((a,b)=>b.correct-a.correct)[0];
 const rank=window.SEC_POWER?.getRows?.(item())||[];
 const leaders=rank.filter(r=>Number(r.current_rank)===1&&Number(r.season_graded)>0);
 const leader=leaders.length?leaders.map(p=>m.players.get(p.user_id)||p):[];
 const honor=(icon,label,p,desc)=>
  '<div class="brag-honor"><span>'+icon+'</span><small>'+label+'</small><strong>'+
   (p?bestName(p):"Unclaimed")+'</strong><em>'+esc(desc)+'</em></div>';
 const pride=a.schools.map((s,i)=>
  '<div class="brag-school"><span>'+(i+1)+'. ★ '+esc(codes[s.code])+'</span>'+
   '<strong>'+Math.round(100*s.correct/s.graded)+'%</strong><small>'+
    s.correct+'/'+s.graded+' picks · '+s.fans+' fan'+(s.fans===1?"":"s")+'</small></div>').join("");
 return '<section class="brag-block" aria-label="Championships and awards">'+
  '<div class="card-kicker">👑 BELT CHASE</div><h3>Who owns the league?</h3>'+
  '<div class="brag-belt">'+
   '<span class="brag-belt-icon">🏆</span><div><small>VERIFIED SEASON POINTS LEADER · BELT IN PLAY</small>'+
    '<strong>'+(leader.length?leader.map(bestName).join(" &amp; "):"Season crown is unclaimed")+'</strong>'+
    '<p>Current leaderboard leader, not a finalized season championship. Official titles live in the Trophy Case.</p></div>'+
    '<button type="button" class="fan-small" data-brag-trophies>View trophies ↗</button></div>'+
  '<div class="card-kicker">🏅 EARNED RECEIPTS</div><div class="brag-honors">'+
    honor("🔥","Hot streak",top?.streak>=3?top:null,top?.streak>=3?top.streak+" consecutive correct calls":"Need 3 consecutive calls")+
    honor("⚡","Upset hunter",upset?.upsets>0?upset:null,upset?.upsets>0?upset.upsets+" sourced upsets":"No verified upset picks")+
    honor("🧠","Against the crowd",crowd?.crowd>0?crowd:null,crowd?.crowd>0?crowd.crowd+" lone correct calls":"Need a lone correct call")+
    honor("🎯","Most correct",topOne?.correct>0?topOne:null,topOne?.correct>0?topOne.correct+" correct final picks":"Awaiting finals")+
  '</div>'+
  '<div class="brag-school-head"><div class="card-kicker">🏫 SEC SCHOOL PRIDE</div><small>Accuracy of fans’ verified picks</small></div>'+
  (pride?'<div class="brag-schools">'+pride+'</div>':'<p class="fan-subtle">School pride standings appear after fans with a chosen favorite school have at least three graded picks.</p>')+
  '<p class="fan-subtle">These informal honors compare outright game winners only and never award additional league points.</p></section>';
}
function render(data,itemInfo){
 const el=root();if(!el)return;
 const m=model(data),me=m.players.get(user()?.id);
 if(!me){el.innerHTML='<p class="fan-subtle">Join this league to unlock its Bragging Arena.</p>';return;}
 const roster=[...m.players.values()].filter(p=>p.user_id!==me.user_id);
 if(!roster.some(p=>p.user_id===chosenOpponent))chosenOpponent=roster[0]?.user_id||"";
 if(!m.players.has(chosenReceipt))chosenReceipt=me.user_id;
 const opponent=m.players.get(chosenOpponent);
 const news=bulletin(m);
 el.innerHTML='<div class="brag-arena" aria-label="League Bragging Arena">'+
  '<div class="brag-arena-intro"><div><div class="card-kicker">🔥 THE LOCKER ROOM</div>'+
  '<h2>Talk big. Keep receipts.</h2><p>'+esc(itemInfo.name||"Your league")+
  ' · All sports, one rivalry hub. Verified final results only.</p></div>'+
  '<button type="button" class="fan-small" data-brag-refresh>↻ Refresh</button></div>'+
  '<section class="brag-block" aria-label="Head-to-head grudge matches">'+
   '<div class="brag-block-head"><div><div class="card-kicker">⚔️ HEAD TO HEAD</div><h3>Grudge Match</h3></div>'+
   (roster.length?'<label class="brag-label">Your rival<select data-brag-rival aria-label="Choose a league rival">'+
    roster.map(p=>'<option value="'+esc(p.user_id)+'" '+(p.user_id===chosenOpponent?"selected":"")+'>'+
     esc(p.display_name||"Player")+'</option>').join("")+'</select></label>':"")+'</div>'+
   (roster.length?renderDuel(m,me,opponent):'<p class="fan-subtle">Invite another member to unlock head-to-head rivalry tracking.</p>')+
  '</section>'+
  '<section class="brag-block" aria-label="Automatic league bulletin"><div class="card-kicker">📣 LEAGUE BULLETIN</div>'+
  '<h3>The automatic trash-talk desk</h3>'+
  '<p class="fan-subtle">Verified results write the story. Copy a bulletin to share; nothing posts without your action.</p>'+
  (news.length?news.map((n,i)=>'<div class="brag-bulletin"><p>'+esc(n.text)+'</p>'+
   '<button type="button" class="fan-small" data-brag-bulletin="'+i+'">↗ Share this</button></div>').join(""):
   '<p class="fan-subtle">No spicy outcomes in this league yet. First confirmed surprises will show up here.</p>')+
  '</section>'+
  receipts(m,me,chosenReceipt)+accolade(m,me)+
  (m.limited?'<p class="fan-subtle">Only the 2,000 most recent post-lock picks are included in these comparisons.</p>':"")+
  '</div>';
}
function updateUI(selected=item()){
 const el=root();if(!el)return;
 if(!selected||!user()){el.replaceChildren();return;}
 const k=ref(selected),cached=cache.get(k);
 if(cached){render(cached.data,selected);return;}
 el.innerHTML='<div class="brag-block"><div class="card-kicker">🔥 THE LOCKER ROOM</div>'+
  '<p class="fan-subtle" role="status">Loading league rivalries and verified receipts…</p></div>';
}
async function load(selected=item(),force=false){
 const el=root(),u=user(),c=db();
 if(!el||!scoped(selected)||!u||!c){updateUI(null);return;}
 const k=ref(selected),old=cache.get(k);
 if(lastScope!==k){chosenOpponent="";chosenReceipt="";lastScope=k;}
 if(!force&&old&&Date.now()-old.at<120000){updateUI(selected);return;}
 if(inflight.has(k))return inflight.get(k);
 updateUI(selected);
 const task=(async()=>{
  try{
   const response=await c.rpc("sec_brags_locker_room",{p_kind:selected.kind,p_league:selected.id});
   if(response.error)throw response.error;
   if(!scopeOk(selected,u,k))return;
   cache.set(k,{data:validate(response.data),at:Date.now()});
   render(cache.get(k).data,selected);
  }catch(e){
   if(scopeOk(selected,u,k))el.innerHTML='<section class="brag-block"><h3>Locker room unavailable</h3>'+
    '<p class="fan-subtle">The secure league recap could not load. Try refreshing.</p>'+
    '<button type="button" class="fan-small" data-brag-refresh>Try again</button></section>';
   console.info("Bragging Arena unavailable:",e.message||e);
  }finally{inflight.delete(k);}
 })();
 inflight.set(k,task);return task;
}
const copy=async t=>{
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(t);window.SEC_BRIDGE?.toast?.("Copied. Send it to your league!");return;}}
 catch(_){}
 const input=document.createElement("textarea");input.value=t;
 document.body.appendChild(input);input.select();
 try{document.execCommand("copy");window.SEC_BRIDGE?.toast?.("Copied for sharing.");}
 catch(_){window.SEC_BRIDGE?.toast?.("Copy is unavailable. Try your browser's share menu.");}
 finally{input.remove();}
};
function currentModel(){
 const i=item();if(!i||!user())return null;
 const found=cache.get(ref(i));return found?model(found.data):null;
}
document.addEventListener("change",e=>{
 if(e.target?.matches?.("[data-brag-rival]")){
  chosenOpponent=e.target.value;updateUI();return;
 }
 if(e.target?.matches?.("[data-brag-receipts]")){
  chosenReceipt=e.target.value;updateUI();
 }
});
document.addEventListener("click",e=>{
 const b=e.target.closest?.("[data-brag-refresh],[data-brag-receipt],[data-brag-bulletin],[data-brag-share],[data-brag-trophies]");
 if(!b)return;e.preventDefault();
 if(b.matches("[data-brag-refresh]")){void load(item(),true);return;}
 if(b.matches("[data-brag-trophies]")){window.SEC_BRIDGE?.setView?.("trophies");return;}
 const m=currentModel(),me=user();if(!m||!me)return;
 if(b.hasAttribute("data-brag-receipt")){
  const g=m.games.get(b.dataset.bragReceipt),p=g&&m.get(b.dataset.bragPlayer,g);
  if(g&&p&&verified(g))void copy(receiptText(g,p,m));
 }else if(b.hasAttribute("data-brag-bulletin")){
  const n=bulletin(m)[Number(b.dataset.bragBulletin)];
  if(n)void copy(n.text+"\nSEC Pick’em · "+(item()?.name||"League"));
 }else if(b.hasAttribute("data-brag-share")){
  const rival=m.players.get(chosenOpponent);
  if(!rival)return;
  const h=rivalry(m,me.id,rival.user_id);
  void copy("⚔️ "+(m.players.get(me.id)?.display_name||"Player")+" challenges "+
    (rival.display_name||"Player")+"! Our rivalry: "+h.wins+"–"+h.losses+
    " ("+h.draws+" ties) on "+h.both+" shared final picks. Let's see who calls the next SEC game! "+
    "· "+(item()?.name||"League"));
 }
});
window.SEC_BRAG_ARENA=Object.freeze({load,render:updateUI,model,rivalry,bulletin,awards,verified});
})();