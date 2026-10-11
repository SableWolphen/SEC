/* SEC Pick'Em Trophy Room — additive, read-only award presentation.
 * Never modifies games, picks, leagues, or championship history.
 */
(()=>{
 "use strict";
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const SPORTS=["football","basketball","baseball"];
 const TITLES={football:"Football",basketball:"Basketball",baseball:"Baseball"};
 const ICONS={football:"🏈",basketball:"🏀",baseball:"⚾"};
 const LEVELS=[{label:"Bronze",icon:"🥉"},{label:"Silver",icon:"🥈"},{label:"Gold",icon:"🥇"},{label:"Diamond",icon:"💎"}];
 let activeCase="league",compareId="",lastScope="",pendingCelebration=null,clickBound=false;
 function league(){return window.secOnline?.getLeague?.()||null;}
 function user(){return window.secOnline?.getUser?.()||null;}
 function standings(){return window.secOnline?.getStandings?.()||[];}
 function champions(){
  const id=league()?.id;
  return id?(window.SEC_SOCIAL?.getChampions?.()||[]).filter(c=>String(c.league_id)===String(id)):[];
 }
 function prefKey(suffix){return "sds:trophy:v2:"+String(user()?.id||"guest")+":"+String(league()?.id||"none")+":"+suffix;}
 function read(key){try{return localStorage.getItem(key);}catch{return null;}}
 function write(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}
 function validFinal(row){return row?.game_status==="final"&&Boolean(row.winner_code||row.winner);}
 function scorePick(g,p,mode,sport){
  const pick=sport==="football"?p:p?.pick_code;
  const winner=sport==="football"?g.winner:g.winner_code;
  if(!pick||!validFinal(g)||!winner)return null;
  if(mode==="spread"&&sport!=="football"){
   if(g.spread_home==null||g.home_score==null||g.away_score==null)return null;
   const m=Number(g.home_score)-Number(g.away_score)+Number(g.spread_home);
   if(!Number.isFinite(m)||m===0)return null;
   return (m>0?g.home_code:g.away_code)===pick;
  }
  return pick===winner;
 }
 function sportFacts(ctx,sport){
  const signed=Boolean(ctx.signedIn&&user()?.id);
  let games=[],picks={},mode="straight",available=false;
  if(sport==="football"){
   available=signed&&Boolean(ctx.leagueId);
   games=Object.values(ctx.schedule||{}).map(g=>{
    const result=ctx.verified.find(r=>r.id===g.id);
    return {...g,game_status:result?.game_status||"scheduled",winner:result?.winner||null};
   });
   picks=ctx.myPicks||{};
  }else{
   const state=window.SEC_SPORTS?.getState?.(sport)||{};
   const group=(state.leagues||[]).find(l=>String(l.id)===String(state.active));
   available=signed&&Boolean(group&&state.active);
   games=state.games||[];picks=state.picks||{};mode=group?.mode||"straight";
  }
  if(!available)return {sport,available:false,picks:0,correct:0,graded:0,streak:0,perfect:0,activeWeeks:0,winPct:null};
  const ordered=games.slice().sort((a,b)=>Date.parse(a.kickoff_at||a.kickoff||a.date||"")-Date.parse(b.kickoff_at||b.kickoff||b.date||""));
  let graded=0,correct=0,streak=0,current=0,pickCount=0;
  for(const g of ordered){
   const p=picks[g.id],chosen=sport==="football"?p:p?.pick_code;
   if(chosen)pickCount++;
   const isRight=scorePick(g,p,mode,sport);
   if(isRight==null)continue;
   graded++;if(isRight){correct++;current++;}else current=0;
   streak=Math.max(streak,current);
  }
  const byWeek=new Map();
  for(const g of games){
   const week=Number(g.week);
   if(!Number.isInteger(week))continue;
   if(!byWeek.has(week))byWeek.set(week,[]);
   byWeek.get(week).push(g);
  }
  let perfect=0,activeWeeks=0;
  for(const set of byWeek.values()){
   const playable=set.filter(g=>g.game_status!=="canceled");
   if(playable.some(g=>Boolean(sport==="football"?picks[g.id]:picks[g.id]?.pick_code)))activeWeeks++;
   if(!playable.length||!playable.every(validFinal))continue;
   if(playable.every(g=>scorePick(g,picks[g.id],mode,sport)===true))perfect++;
  }
  return {sport,available,picks:pickCount,correct,graded,streak,perfect,activeWeeks,winPct:graded?Math.round(correct*100/graded):null};
 }
 function catalog(ctx){
  const fs=SPORTS.map(s=>sportFacts(ctx,s)),fb=fs[0];
  const ownedRivalries=new Set((ctx.records||[]).filter(r=>r.correct===true).map(r=>r.trophyId)).size;
  const titleCount=champions().filter(c=>String(c.champion_user_id)===String(user()?.id)).length;
  const awards=[];
  function add(id,name,icon,desc,metric,thresholds,sport="all",secret=false){
   const tier=thresholds.reduce((x,v,i)=>metric>=v?i+1:x,0);
   awards.push({id,name,icon,desc,metric,thresholds,sport,secret,tier,earned:tier>0});
  }
  add("first-call","First Call","🎟️","Submit your first football prediction",fb.picks,[1,10,50,100],"football");
  add("sharp-shooter","Sharpshooter","🎯","Correctly predict verified football games",fb.correct,[1,10,50,100],"football");
  add("on-fire","On Fire","🔥","Consecutive correct verified football picks",fb.streak,[3,5,10,20],"football");
  add("perfect-week","Perfect Week","✨","Correctly pick a full finalized football week",fb.perfect,[1,2,3,5],"football",true);
  add("ironman","Ironman","🛡️","Football weeks with at least one submitted pick",fb.activeWeeks,[2,5,10,13],"football");
  add("rivalry-hunter","Rivalry Hunter","⚔️","Different named rivalry trophies earned",ownedRivalries,[1,3,8,15],"football");
  add("league-royalty","League Royalty","👑","Archived league season championship titles",titleCount,[1,2,3,5],"football",true);
  for(const fact of fs.slice(1)){
   const title=TITLES[fact.sport],icon=ICONS[fact.sport];
   add(fact.sport+"-first",title+" Starter",icon,"Make verified correct "+title.toLowerCase()+" predictions",fact.correct,[1,5,25,100],fact.sport);
   add(fact.sport+"-streak",title+" Hot Streak","🔥","Consecutive correct "+title.toLowerCase()+" picks",fact.streak,[3,5,10,20],fact.sport);
   add(fact.sport+"-perfect",title+" Perfect Week","⭐","Pick every game right in a finalized week",fact.perfect,[1,2,3,5],fact.sport,true);
  }
  return {awards,fs,titleCount,ownedRivalries};
 }
 function head(title,desc,emoji){
  return '<div class="legacy-heading"><span aria-hidden="true">'+emoji+'</span><div><h3>'+esc(title)+'</h3><p>'+esc(desc)+'</p></div></div>';
 }
 function ringRows(champs,rows){
  const mine=champs.filter(c=>String(c.champion_user_id)===String(user()?.id));
  const sorted=mine.slice().sort((a,b)=>Number(b.season)-Number(a.season));
  const rings=sorted.map(c=>'<article class="legacy-ring earned"><span class="legacy-ring-icon" aria-hidden="true">💍</span><div><strong>'+esc(c.season)+' Football Ring</strong><small>'+esc(league()?.name||"Your league")+' · Verified league title</small></div></article>').join("");
  return '<section class="legacy-panel">'+head("Championship rings","Every archived title gets its own ring.","💍")+
   '<div class="legacy-rings">'+(rings||'<p class="legacy-empty">Win a completed football league season to collect your first ring.</p>')+
   ['basketball','baseball'].map(s=>'<article class="legacy-ring locked"><span class="legacy-ring-icon" aria-hidden="true">'+ICONS[s]+'</span><div><strong>'+TITLES[s]+' Ring</strong><small>Locked until verified season champions are archived</small></div></article>').join("")+
   '</div></section>';
 }
 function banners(champs,rows){
  const name=id=>rows.find(r=>String(r.user_id)===String(id))?.display_name||"Archived champion";
  return '<section class="legacy-panel">'+head("Championship banners","A banner for every official season title — no history overwritten.","🚩")+
   (champs.length?'<div class="legacy-banners">'+champs.slice().sort((a,b)=>Number(b.season)-Number(a.season)).map(c=>
    '<div class="legacy-banner"><span>🏈 '+esc(c.season)+'</span><strong>'+esc(name(c.champion_user_id))+'</strong><small>'+esc(c.mode||"League")+' champion</small></div>').join("")+'</div>':
    '<p class="legacy-empty">Banners appear after the season is finalized. Current leaders are not champions yet.</p>')+'</section>';
 }
 function hall(champs,rows,ctx){
  const leaders=new Map();
  for(const c of champs){const k=String(c.champion_user_id);leaders.set(k,(leaders.get(k)||0)+1);}
  const all=[...leaders].sort((a,b)=>b[1]-a[1]).slice(0,8);
  const name=id=>rows.find(r=>String(r.user_id)===id)?.display_name||"Past champion";
  const finalCount=(ctx.verified||[]).filter(validFinal).length;
  const sorted=rows.slice().sort((a,b)=>Number(b.season_points||0)-Number(a.season_points||0));
  const best=Number(sorted[0]?.season_points||0);
  const tied=sorted.filter(r=>Number(r.season_points||0)===best);
  const current=finalCount&&best>0&&tied.length?
   '<div class="legacy-leader"><strong>🏆 Traveling trophy — current leader'+(tied.length>1?"s":"")+'</strong><span>'+
   tied.map(r=>esc(r.display_name||"League member")).join(" · ")+
   ' · '+esc(best)+' points</span><small>Moves as verified results change. Not a season championship.</small></div>':
   '<div class="legacy-leader"><strong>🏆 Traveling trophy</strong><small>No scored league leader yet. The trophy stays unassigned.</small></div>';
  const ownTitles=champs.filter(c=>String(c.champion_user_id)===String(user()?.id)).length;
  const distinct=rows.length;
  const members=new Set(rows.map(r=>String(r.user_id)));
  const winners=new Set(champs.filter(c=>members.has(String(c.champion_user_id))).map(c=>String(c.champion_user_id)));
  const rarity=distinct&&ownTitles?" · "+(100*winners.size/distinct).toFixed(0)+"% of members in current standings have an archived title":"";
  return '<section class="legacy-panel">'+head("League Hall of Fame","Archived champions and the verified current leader.","🏛️")+
   current+
   '<div class="legacy-hall">'+(all.length?all.map(([id,n],i)=>
     '<div class="legacy-hall-row"><span>'+(i===0?"🥇":i===1?"🥈":i===2?"🥉":"🏅")+'</span><strong>'+esc(name(id))+'</strong><small>'+n+' title'+(n===1?"":"s")+'</small></div>').join(""):
    '<p class="legacy-empty">The Hall of Fame opens when your league crowns its first champion.</p>')+'</div>'+
   (rarity?'<p class="legacy-hint">Championship rarity'+rarity+'. Calculated from archived champions and current standings, not all historical members.</p>':'')+
   '</section>';
 }
 function compare(champs,rows){
  const me=user();if(!me||!league())return "";
  const other=rows.find(x=>String(x.user_id)===compareId&&compareId!==String(me.id));
  const mine=rows.find(x=>String(x.user_id)===String(me.id));
  const wins=id=>champs.filter(c=>String(c.champion_user_id)===String(id)).length;
  const metric=(r,id)=>'<div class="legacy-compare-col"><strong>'+esc(r?.display_name||"League member")+'</strong><span>'+esc(Number(r?.season_points||0))+' current season points</span><span>'+esc(Number(r?.correct_picks||0))+' correct picks</span><span>'+wins(id)+' archived football titles</span></div>';
  return '<section class="legacy-panel">'+head("Compare with a friend","Only shared standings and archived titles — never private picks.","🆚")+
   '<label class="legacy-compare-label" for="legacy-compare">Choose a league member</label>'+
   '<select id="legacy-compare" data-legacy-compare><option value="">Select a player</option>'+
   rows.filter(r=>String(r.user_id)!==String(me.id)).map(r=>'<option value="'+esc(r.user_id)+'"'+(String(r.user_id)===compareId?" selected":"")+'>'+esc(r.display_name||"League member")+'</option>').join("")+'</select>'+
   (other?'<div class="legacy-compare-grid">'+metric(mine,me.id)+metric(other,other.user_id)+'</div>':
    '<p class="legacy-empty">Select someone to compare your league records.</p>')+'</section>';
 }
 function perks(data,ctx){
  const {awards,fs}=data;
  const filter=(window.SEC_TROPHY_MUSEUM_FILTER?.()||"all");
  const own=awards.filter(a=>a.earned);
  const featuredId=read(prefKey("featured"))||"";
  const featured=own.find(a=>a.id===featuredId);
  const trophyTiles=awards.map(a=>{
   const current=LEVELS[Math.max(0,a.tier-1)];
   const next=a.thresholds[a.tier]||null;
   const locked=a.secret&&!a.earned;
   return '<article class="legacy-achievement '+(a.earned?"earned":"locked")+'">'+
    '<div class="legacy-achievement-top"><span aria-hidden="true">'+(locked?"❔":a.icon)+'</span><small>'+(a.earned?esc(current.icon+" "+current.label):"🔒 Locked")+'</small></div>'+
    '<strong>'+esc(locked?"Secret achievement":a.name)+'</strong><p>'+esc(locked?"Hidden until you unlock it":a.desc)+'</p>'+
    '<div class="legacy-progress"><span style="width:'+Math.min(100,100*a.metric/(next||a.thresholds[3]||1))+'%"></span></div>'+
    '<small>'+esc(a.metric)+" / "+esc(next||a.thresholds[3])+(a.tier===4?" · max tier":"")+'</small>'+
    (a.earned?'<button type="button" data-legacy-feature="'+esc(a.id)+'" aria-pressed="'+(featuredId===a.id)+'">'+(featuredId===a.id?"★ Featured":"☆ Feature")+'</button>':'')+'</article>';
  }).join("");
  const sports=fs.map(f=>'<div class="legacy-sport-stat"><strong>'+ICONS[f.sport]+' '+TITLES[f.sport]+'</strong><span>'+
    (f.available?f.correct+' correct · '+f.graded+' graded · '+f.perfect+' perfect week'+(f.perfect===1?"":"s"):"No verified league picks loaded — open "+TITLES[f.sport].toLowerCase()+" picks")+'</span></div>').join("");
  const tiers=LEVELS.map((t,i)=>'<div class="legacy-tier"><strong>'+t.icon+" "+t.label+'</strong><span>'+awards.filter(a=>a.tier>=i+1).length+' / '+awards.length+'</span></div>').join("");
  const achievements='<section class="legacy-panel">'+head("Upgradeable trophies","Earn Bronze, then keep playing toward Diamond.","💎")+
   '<div class="legacy-tiers">'+tiers+'</div>'+
   '<div class="legacy-sports-graded">'+sports+'</div>'+
   '<p class="legacy-hint">Only saved picks and verified final scores count. In spread leagues, confirmed lines determine correct picks. Awards for unverified brackets, upsets, and seasons remain locked.</p>'+
   '<div class="legacy-achievement-grid">'+trophyTiles+'</div></section>';
  const specials='<section class="legacy-panel">'+head("Secret & season awards","Challenge trophies unlock only with trustworthy data.","🔐")+
   '<div class="legacy-locked-list">'+[
    ["⚡ Upset King","Waiting for archived pregame underdog odds"],
    ["🏀 Bracket Buster","Waiting for verified tournament bracket results"],
    ["⚾ Walk-Off Wizard","Waiting for verified walk-off game classifications"],
    ["🌟 Season MVP","Awarded after a completed season, not from live standings"],
    ["🧩 Triple Crown","Requires three independently finalized sport championships"]
   ].map(([name,why])=>'<div><strong>'+esc(name)+'</strong><small>🔒 '+esc(why)+'</small></div>').join("")+'</div></section>';
  const chosen='<section class="legacy-featured">'+
   '<span aria-hidden="true">'+(featured?.icon||"🏅")+'</span><div><strong>Featured trophy</strong><p>'+
   (featured?esc(featured.name+" · "+LEVELS[featured.tier-1].label):"Earn an achievement and choose one to display on this device.")+
   '</p></div></section>';
  return chosen+achievements+specials;
 }
 function wrap(root,ctx,data){
  const existing=[...root.children].filter(n=>n.classList.contains("museum-section"));
  if(existing.length<3)return;
  const [champ,week,achievement,rival,schools]=existing;
  const champRows=champions(),rows=standings();
  const sections=[
   {id:"league",icon:"👑",title:"League Championships",subtitle:"Rings, banners, Hall of Fame and the traveling trophy",nodes:[champ,week],extra:ringRows(champRows,rows)+banners(champRows,rows)+hall(champRows,rows,ctx)+compare(champRows,rows)},
   {id:"player",icon:"🏅",title:"My Achievements",subtitle:"Upgradeable awards, sport challenges and secret trophies",nodes:[achievement],extra:perks(data,ctx)},
   {id:"school",icon:"🏛️",title:"SEC School & Rivalry Trophies",subtitle:"Named rivalry prizes, school shelves and history",nodes:[rival,schools].filter(Boolean),extra:(!rival&&!schools?'<p class="legacy-empty">Switch to Football to explore the named school rivalry trophy collection.</p>':"")}
  ];
  const content=document.createElement("div");content.className="legacy-cases";
  for(const part of sections){
   const details=document.createElement("details");details.className="legacy-case";
   details.dataset.legacyCase=part.id;
   details.open=activeCase===part.id;
   const summary=document.createElement("summary");
   summary.innerHTML='<span class="legacy-case-icon" aria-hidden="true">'+part.icon+'</span><span><strong>'+part.title+'</strong><small>'+part.subtitle+'</small></span><span class="legacy-case-arrow" aria-hidden="true">⌄</span>';
   details.append(summary);
   const inside=document.createElement("div");inside.className="legacy-case-content";
   for(const node of part.nodes)inside.append(node);
   if(part.extra){const host=document.createElement("div");host.className="legacy-extras";host.innerHTML=part.extra;inside.append(host);}
   details.append(inside);
   details.addEventListener("toggle",()=>{
    if(!details.open||!details.isConnected)return;
    activeCase=part.id;
    for(const other of content.querySelectorAll("details.legacy-case"))if(other!==details)other.open=false;
   });
   content.append(details);
  }
  const sportsNav=root.querySelector(".museum-sports");
  if(sportsNav)sportsNav.insertAdjacentElement("afterend",content);else root.append(content);
 }
 function maybeCelebrate(data,ctx){
  if(!ctx.signedIn||!ctx.leagueId)return;
  const key=prefKey("unlocked"),owned=data.awards.filter(a=>a.earned).map(a=>a.id+"="+a.tier).sort();
  const old=read(key);
  if(old!==null){
   try{
    const before=new Set(JSON.parse(old));
    const added=owned.filter(x=>!before.has(x));
    if(added.length&&read(prefKey("initialized"))==="1"){
     const root=ctx.root;
     if(root){root.classList.remove("legacy-celebrate");void root.offsetWidth;root.classList.add("legacy-celebrate");}
     window.SEC_BRIDGE?.toast?.("🏆 Trophy unlocked! Your achievement collection grew.");
    }
   }catch{}
  }
  write(key,JSON.stringify(owned));write(prefKey("initialized"),"1");
 }
 function render(ctx,root){
  if(!ctx?.root||!root)return;
  const scope=String(user()?.id||"guest")+"|"+String(league()?.id||"none");
  if(scope!==lastScope){activeCase="league";compareId="";lastScope=scope;}
  const data=catalog(ctx);
  wrap(root,ctx,data);
  maybeCelebrate(data,ctx);
  if(!clickBound){
   clickBound=true;
   document.addEventListener("click",e=>{
    const feature=e.target.closest?.("[data-legacy-feature]");
    if(!feature||!feature.closest("#sds-trophy-case"))return;
    const id=feature.dataset.legacyFeature;
    const current=read(prefKey("featured"));
    write(prefKey("featured"),current===id?"":id);
    window.SEC_TROPHY_MUSEUM?.refresh?.();
   });
   document.addEventListener("change",e=>{
    if(e.target?.matches?.("[data-legacy-compare]")){
     compareId=e.target.value||"";
     window.SEC_TROPHY_MUSEUM?.refresh?.();
    }
   });
  }
 }
 window.SEC_TROPHY_LEGACY=Object.freeze({render,sportFacts,catalog});
})();