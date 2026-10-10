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
let chosenOpponent="",chosenReceipt="",lastScope="",renderedWeek=null;
const expanded=new Set();
const fold=id=>expanded.has(id)?" open":"";
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

/* Rotating weekly pairings, fixed to Monday 12 a.m. America/Chicago.
 * Circle-method round-robin. With odd membership each participant gets a
 * fair bye during the cycle; with only two members the same pair repeats. */
function texasWeek(when=new Date()){
 const dt=new Date(when);
 if(!Number.isFinite(dt.getTime()))throw Error("Invalid weekly rivalry date");
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",
  year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(dt);
 const fields=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,Number(x.value)]));
 const today=Math.floor(Date.UTC(fields.year,fields.month-1,fields.day)/86400000);
 const weekday=new Date(today*86400000).getUTCDay();
 const monday=today-(weekday+6)%7;
 const label=new Date(monday*86400000).toLocaleDateString("en-US",
  {month:"short",day:"numeric",timeZone:"UTC"});
 return {start:monday,label:"Week of "+label,round:Math.floor((monday-Math.floor(Date.UTC(2026,7,31)/86400000))/7)};
}
function weeklyPairing(players,viewerId,date=new Date()){
 const week=texasWeek(date);
 const roster=[...new Set(players.map(p=>typeof p==="string"?p:p?.user_id).filter(Boolean))]
  .sort((a,b)=>a.localeCompare(b));
 if(!roster.includes(viewerId)||roster.length<2)return {...week,opponent:null,bye:true,pairings:[]};
 const slots=roster.slice();
 if(slots.length%2)slots.push(null);
 const count=slots.length,rounds=count-1;
 const index=((week.round%rounds)+rounds)%rounds;
 let circle=slots.slice();
 for(let step=0;step<index;step++)circle=[circle[0],circle[count-1],...circle.slice(1,count-1)];
 const pairings=[];
 for(let i=0;i<count/2;i++){
  if(circle[i]&&circle[count-1-i])pairings.push([circle[i],circle[count-1-i]]);
 }
 const matching=pairings.find(pair=>pair.includes(viewerId));
 return {...week,opponent:matching?.find(id=>id!==viewerId)||null,
  bye:!matching,pairings};
}
function weeklyMatch(m,viewerId,otherId,date=new Date()){
 const week=texasWeek(date);
 const games=m.finals.filter(g=>texasWeek(g.kickoff_at).start===week.start);
 const scoreFor=id=>games.reduce((a,g)=>a+Number(result(g,m.get(id,g))===true),0);
 const gradedFor=id=>games.filter(g=>result(g,m.get(id,g))!==null).length;
 return {...week,my:scoreFor(viewerId),their:otherId?scoreFor(otherId):0,
  myGraded:gradedFor(viewerId),theirGraded:otherId?gradedFor(otherId):0,
  finals:games.length};
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
 return '<div class="brag-receipts-full"><div class="brag-block-head"><div>'+
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
  }).join("")+'</div>':'<p class="fan-subtle">No confirmed final-game receipts for this player yet.</p>')+'</div>';
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
 return '<div class="brag-honors-full">'+
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
  '<p class="fan-subtle">These informal honors compare outright game winners only and never award additional league points.</p></div>';
}
function highlightCards(m){
 const scoreRows=window.SEC_POWER?.getRows?.(item())||[];
 const leader=scoreRows.find(p=>Number(p.current_rank)===1&&Number(p.season_graded)>0);
 const ranks=awards(m).byPlayer;
 const streak=ranks.slice().sort((a,b)=>b.streak-a.streak)[0];
 const upset=ranks.slice().sort((a,b)=>b.upsets-a.upsets)[0];
 const accurate=ranks.filter(p=>p.graded>=5).sort((a,b)=>b.correct/b.graded-a.correct/a.graded||b.graded-a.graded)[0];
 const point=leader&&Number.isFinite(Number(leader.season_points))?
  Number(leader.season_points).toLocaleString("en-US",{maximumFractionDigits:1})+" pts":"Verified points leader";
 const cards=[
  {icon:"👑",cls:"king",label:"LEAGUE KING",value:leader?.display_name||"Unclaimed",note:leader?point:"Awaiting final games",target:"honors"},
  {icon:"🔥",cls:"streak",label:"HOT STREAK",value:streak?.streak>0?String(streak.streak):"—",
   note:streak?.streak>0?"Best correct-pick streak":"No verified streak yet",target:"honors"},
  {icon:"⚡",cls:"upset",label:"UPSET HUNTER",value:upset?.upsets>0?String(upset.upsets):"—",
   note:upset?.upsets>0?esc(upset.display_name||"Player")+" · sourced upsets":"No verified upsets",target:"honors"},
  {icon:"🎯",cls:"accuracy",label:"MOST ACCURATE",value:accurate?Math.round(100*accurate.correct/accurate.graded)+"%":"—",
   note:accurate?esc(accurate.display_name||"Player")+" · "+accurate.graded+" graded":"Requires 5 graded picks",target:"honors"}
 ];
 return '<div class="brag-showcase-stats" aria-label="Current bragging highlights">'+
  cards.map(c=>'<div class="brag-showcase-stat is-'+c.cls+'">'+
   '<span class="brag-stat-icon" aria-hidden="true">'+c.icon+'</span>'+
   '<div class="brag-stat-copy"><span>'+c.label+'</span><strong>'+esc(c.value)+'</strong>'+
   '<small>'+c.note+'</small></div></div>').join("")+'</div>';
}
function featuredRivalry(m,me,roster,opponent){
 const week=weeklyPairing([...m.players.values()],me.user_id);
 const weekly=weeklyMatch(m,me.user_id,opponent?.user_id);
 const series=opponent?rivalry(m,me.user_id,opponent.user_id):null;
 const selected=m.players.get(chosenOpponent)||opponent;
 const archived=selected?rivalry(m,me.user_id,selected.user_id):null;
 const sel=roster.length?'<label class="brag-showcase-select">Explore all-time rivalries '+
  '<select data-brag-rival aria-label="Compare all-time league rivals">'+
  roster.map(p=>'<option value="'+esc(p.user_id)+'"'+(p.user_id===selected?.user_id?' selected':'')+'>'+
   esc(p.display_name||"Player")+'</option>').join("")+'</select></label>':"";
 const brief=opponent?
  weekly.finals?weekly.my+"–"+weekly.their+" correct picks so far":"Waiting for verified final games":
  week.bye&&roster.length?"Bye week · next matchup rotates Monday":"Invite friends to start weekly matchups";
 return '<section class="brag-showcase-section brag-featured-rival" aria-label="Weekly head-to-head rivalry">'+
  '<div class="brag-showcase-heading"><h3>⚔️ WEEKLY HEAD-TO-HEAD</h3>'+
   '<span>'+esc(week.label)+' · New matchups every Monday CT</span></div>'+
  (opponent?'<div class="brag-showcase-duel">'+
    '<div class="brag-showcase-duelist"><span class="brag-duelist-symbol">'+
    esc(me.school||"★")+'</span><strong>'+bestName(me)+
    '</strong><small>You</small></div>'+
    '<div class="brag-showcase-count"><strong>'+weekly.my+'</strong><small>CORRECT</small></div>'+
    '<div class="brag-duel-vs">VS</div>'+
    '<div class="brag-showcase-count"><strong>'+weekly.their+'</strong><small>CORRECT</small></div>'+
    '<div class="brag-showcase-duelist"><span class="brag-duelist-symbol is-rival">'+
    esc(opponent.school||"★")+'</span><strong>'+bestName(opponent)+'</strong><small>This week</small></div>'+
    '<button type="button" class="brag-showcase-cta" data-brag-share="challenge">⚔️ Call out rival</button>'+
   '</div>':
   '<div class="brag-showcase-empty">'+
    (week.bye&&roster.length?'🏖️ You have a bye this week. The next round of rivals starts Monday (Central Time).':
    'Invite another league member to start rotating weekly rivalries.')+'</div>')+
  '<div class="brag-weekly-note">'+esc(brief)+(opponent?
    ' · '+weekly.myGraded+' and '+weekly.theirGraded+' graded picks · No bonus league points.':'')+'</div>'+
  '<details class="brag-showcase-more" data-brag-panel="rivals"'+fold("rivals")+'>'+
   '<summary>All-time grudge match records <span>View history</span></summary>'+
   '<div class="brag-showcase-more-body">'+sel+
   (selected?renderDuel(m,me,selected):'<p class="fan-subtle">Choose a member to view past rivalries.</p>')+
   (archived?'<p class="fan-subtle">All-time: '+archived.wins+'–'+archived.losses+
    ' ('+archived.draws+' ties), across '+archived.both+' shared verified games.</p>':"")+
   '</div></details>'+
  '</section>';
}
function featuredBulletin(m){
 const stories=bulletin(m);
 return '<section class="brag-showcase-section" aria-label="League bulletin">'+
  '<div class="brag-showcase-heading"><h3>📣 LEAGUE BULLETIN</h3>'+
  (item()?.kind==="football"?'<button type="button" class="brag-showcase-link" data-brag-chat>Talk trash in chat ↗</button>':
   '<span>Share the best calls and biggest misses</span>')+'</div>'+
  (stories.length?'<div class="brag-showcase-stories">'+stories.slice(0,2).map((n,i)=>
   '<article class="brag-showcase-story"><span class="brag-story-mark">📣</span>'+
   '<p>'+esc(n.text)+'</p><button type="button" class="fan-small" data-brag-bulletin="'+i+
   '">↗ Copy brag</button></article>').join("")+'</div>':
   '<div class="brag-showcase-empty">The league bulletin comes alive after verified results. Be ready to claim that first upset.</div>')+
  (stories.length>2?'<details class="brag-showcase-more" data-brag-panel="bulletins"'+fold("bulletins")+
   '><summary>More league stories <span>View all</span></summary><div class="brag-showcase-more-body">'+
   stories.slice(2).map((n,j)=>'<div class="brag-bulletin"><p>'+esc(n.text)+
   '</p><button type="button" class="fan-small" data-brag-bulletin="'+(j+2)+
   '">↗ Copy brag</button></div>').join("")+'</div></details>':"")+
  '</section>';
}
function featuredReceipts(m,me){
 // Prefer the current fan's own receipts, then different verified games.
 // Avoid a carousel of three copies of the same final result.
 const pool=[...m.finals.flatMap(g=>{
  const p=m.get(me.user_id,g);
  return p?[{g,p:{player:me,pick:p},win:result(g,p)}]:[];
 }),...m.finals.flatMap(g=>(m.byGame.get(g.id)||[]).map(p=>({g,p,win:result(g,p.pick)})))];
 const usedGames=new Set(),featured=[];
 for(const row of pool){
  if(row.win===null||usedGames.has(row.g.id))continue;
  usedGames.add(row.g.id);featured.push(row);
  if(featured.length>=3)break;
 }
 const icons={football:"🏈",basketball:"🏀",baseball:"⚾"};
 return '<section class="brag-showcase-section" aria-label="Pick Receipts">'+
 '<div class="brag-showcase-heading"><h3>🎯 PICK RECEIPTS</h3><span>Proof after the final whistle</span></div>'+
 (featured.length?'<div class="brag-showcase-receipts">'+featured.map(({g,p,win})=>{
   const upset=win&&lineUnderdog(g)===p.pick.pick_code;
   const team=p.pick.pick_code===g.away_code?(g.away_name||name(g.away_code)):(g.home_name||name(g.home_code));
   return '<article class="brag-showcase-receipt '+(upset?"is-upset":win?"is-correct":"is-miss")+'">'+
    '<span class="brag-receipt-pill">'+(upset?"⚡ UPSET CALLED":win?"✓ CALLED IT":"✕ COLD TAKE")+'</span>'+
    '<strong>'+esc(team)+' pick</strong><small>'+esc(p.player.display_name||"Player")+
    ' · '+esc(icons[g.sport]||"")+" Final "+score(g.away_score)+"–"+score(g.home_score)+'</small>'+
    '<button type="button" class="fan-small" data-brag-receipt="'+esc(g.id)+
    '" data-brag-player="'+esc(p.player.user_id)+'">↗ Share receipt</button></article>';
 }).join("")+'</div>':
 '<div class="brag-showcase-empty">Receipts unlock when your league has confirmed final games.</div>')+
 // Keep player selection and historical receipts available without another large default card.
 '<details class="brag-showcase-more" data-brag-panel="receipts"'+fold("receipts")+
 '><summary>All pick receipts <span>Choose a player &amp; explore</span></summary>'+
 '<div class="brag-showcase-more-body">'+receipts(m,me,chosenReceipt)+'</div></details></section>';
}
function featuredHonors(m){
 const a=awards(m),best=a.byPlayer.slice().sort((x,y)=>y.streak-x.streak)[0],
  upset=a.byPlayer.slice().sort((x,y)=>y.upsets-x.upsets)[0],
  crowd=a.byPlayer.slice().sort((x,y)=>y.crowd-x.crowd)[0],
  schools=a.schools[0];
 const awardsPreview=[
  {icon:"🔥",title:"STREAK KING",value:best?.streak>=3?best.streak+" straight":"Unclaimed"},
  {icon:"⚡",title:"UPSET MASTER",value:upset?.upsets>0?upset.upsets+" correct":"Unclaimed"},
  {icon:"🧠",title:"CROWD BEATER",value:crowd?.crowd>0?crowd.crowd+" lone picks":"Unclaimed"},
  {icon:"🏫",title:"SCHOOL PRIDE",value:schools?name(schools.code)+" · "+Math.round(100*schools.correct/schools.graded)+"%":"Awaiting results"}
 ];
 return '<section class="brag-showcase-section" aria-label="Trophies and school pride">'+
 '<div class="brag-showcase-heading"><h3>🏆 TROPHIES &amp; SCHOOL PRIDE</h3>'+
 '<button type="button" class="brag-showcase-link" data-brag-trophies>Open trophy case ↗</button></div>'+
 '<div class="brag-showcase-honors">'+awardsPreview.map(a=>
  '<div class="brag-showcase-honor"><span>'+a.icon+'</span><div><strong>'+a.title+'</strong><small>'+
  esc(a.value)+'</small></div></div>').join("")+'</div>'+
 '<details class="brag-showcase-more" data-brag-panel="honors"'+fold("honors")+
 '><summary>Championship belt &amp; detailed honors <span>View all</span></summary>'+
 '<div class="brag-showcase-more-body">'+accolade(m,m.players.get(user()?.id))+'</div></details></section>';
}
function render(data,itemInfo){
 const el=root();if(!el)return;
 const m=model(data),me=m.players.get(user()?.id);
 if(!me){el.innerHTML='<p class="fan-subtle">Join this league to unlock its Bragging Arena.</p>';return;}
 const roster=[...m.players.values()].filter(p=>p.user_id!==me.user_id);
 if(!roster.some(p=>p.user_id===chosenOpponent))chosenOpponent=roster[0]?.user_id||"";
 if(!m.players.has(chosenReceipt))chosenReceipt=me.user_id;
 const pairing=weeklyPairing([...m.players.values()],me.user_id);
 const opponent=m.players.get(pairing.opponent);
 renderedWeek=pairing.start;
 el.innerHTML='<div class="brag-arena brag-showcase" aria-label="League Bragging Arena">'+
  '<header class="brag-showcase-hero"><span class="brag-hero-crown" aria-hidden="true">👑</span>'+
   '<div class="brag-hero-copy"><span class="brag-hero-kicker">THE LOCKER ROOM · '+esc(itemInfo.name||"My league")+'</span>'+
    '<h2>BRAGGING <em>RIGHTS</em></h2><p>Rivalries. Receipts. League honors. <b>Talk big. Back it up.</b></p></div>'+
   '<button type="button" class="fan-small brag-hero-refresh" data-brag-refresh>↻ Refresh</button>'+
  '</header>'+
  highlightCards(m)+
  featuredRivalry(m,me,roster,opponent)+
  featuredBulletin(m)+
  featuredReceipts(m,me)+
  featuredHonors(m)+
  (m.limited?'<p class="fan-subtle">These comparisons cover only the 2,000 most recent post-kickoff league picks.</p>':"")+
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
 if(lastScope!==k){chosenOpponent="";chosenReceipt="";expanded.clear();lastScope=k;}
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
document.addEventListener("toggle",e=>{
 const node=e.target;
 if(!node?.matches?.("[data-brag-panel]"))return;
 if(node.open)expanded.add(node.dataset.bragPanel);
 else expanded.delete(node.dataset.bragPanel);
},true);
document.addEventListener("change",e=>{
 if(e.target?.matches?.("[data-brag-rival]")){
  chosenOpponent=e.target.value;updateUI();return;
 }
 if(e.target?.matches?.("[data-brag-receipts]")){
  chosenReceipt=e.target.value;updateUI();
 }
});
document.addEventListener("click",e=>{
 const b=e.target.closest?.("[data-brag-refresh],[data-brag-receipt],[data-brag-bulletin],[data-brag-share],[data-brag-trophies],[data-brag-chat]");
 if(!b)return;e.preventDefault();
 if(b.matches("[data-brag-refresh]")){void load(item(),true);return;}
 if(b.matches("[data-brag-trophies]")){window.SEC_BRIDGE?.setView?.("trophies");return;}
 if(b.matches("[data-brag-chat]")){if(item()?.kind==="football")window.SEC_LEAGUE_TABS?.switchPane?.("chat");return;}
 const m=currentModel(),me=user();if(!m||!me)return;
 if(b.hasAttribute("data-brag-receipt")){
  const g=m.games.get(b.dataset.bragReceipt),p=g&&m.get(b.dataset.bragPlayer,g);
  if(g&&p&&verified(g))void copy(receiptText(g,p,m));
 }else if(b.hasAttribute("data-brag-bulletin")){
  const n=bulletin(m)[Number(b.dataset.bragBulletin)];
  if(n)void copy(n.text+"\nSEC Pick’em · "+(item()?.name||"League"));
 }else if(b.hasAttribute("data-brag-share")){
  const pairing=weeklyPairing([...m.players.values()],me.id);
  const rival=m.players.get(pairing.opponent);
  if(!rival)return;
  const week=weeklyMatch(m,me.id,rival.user_id);
  void copy("⚔️ "+(m.players.get(me.id)?.display_name||"Player")+" challenges "+
    (rival.display_name||"Player")+" this week ("+pairing.label+")! "+
    "Verified picks: "+week.my+"–"+week.their+" so far. "+
    "New SEC rivalry opponents every Monday CT. · "+(item()?.name||"League"));
 }
});
// Recompute automatically at the Central-Time weekly rollover even if the
// site stays open. The timer does no network work unless the week changes.
if(typeof setInterval==="function")setInterval(()=>{
 if(renderedWeek!==null&&user()&&root()&&texasWeek().start!==renderedWeek){
  renderedWeek=null;
  void load(item(),true);
 }
},10*60*1000);
window.addEventListener?.("focus",()=>{
 if(renderedWeek!==null&&user()&&texasWeek().start!==renderedWeek)void load(item(),true);
});
window.SEC_BRAG_ARENA=Object.freeze({load,render:updateUI,model,rivalry,bulletin,awards,verified,texasWeek,weeklyPairing,weeklyMatch});
})();