/* Playful verified pick reactions and sourced SEC athlete honors.
   SEC monthly fan choices are YOUR picks, never represented as official SEC awards. */
(()=>{
"use strict";
const W=window,D=document,app=()=>W.SEC_BRIDGE,$=id=>D.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const scope=()=>[W.secOnline?.getUser?.()?.id||"device",W.SEC_LEAGUE_SETTINGS?.getSelected?.()?.id||"local",app()?.week?.()?.num||"none"].join("|");
const cardKey=()=> "sec-roast-card-v2:"+scope().split("|").slice(0,2).join("|");
const highlightKey=()=> "sec-fun-highlight-v1:"+scope();
const storage=(key)=>{try{return localStorage.getItem(key)}catch(_){return null}};
const put=(key,value)=>{try{localStorage.setItem(key,value)}catch(_){}};
const safeUrl=url=>{try{const x=new URL(url);return x.protocol==="https:"&&x.hostname==="www.secsports.com"}catch(_){return false}};
let awards=[],lastAwardLoad=0,loading=null,awardSport="football",awardPeriod="week",modal=null,openedScope="",awardsExpanded=false;
const terms={football:"Football",basketball:"Basketball",baseball:"Baseball"};

/* Each tier gets its own shuffled deck. A message cannot repeat until every
   message in that tier has appeared; crossing a deck boundary also never
   repeats the previous message. Selection history persists per signed-in
   account (or on this device when signed out). No private picks are read. */
const ROASTS=Object.freeze({
 fire:[
  ["THE SEC HAS BEEN WARNED","You are turning the pick sheet into a highlight reel. The group chat may need a timeout."],
  ["SOMEBODY CHECK THE CRYSTAL BALL","These picks are suspiciously good. Your friends are going to demand an investigation."],
  ["THE PICK'EM PROPHECY","Every time you choose a winner, a rival fan sheds a single tear."],
  ["WEEKEND MASTERCLASS","You picked winners like it was a multiple-choice test with the answer key."],
  ["HOTTER THAN A SEPTEMBER KICKOFF","Even the scoreboard is sweating. That's a dangerous percentage."],
  ["YOU OWN THE GROUP CHAT","Bring the receipts. Your league will pretend it never doubted you."],
  ["THE UPSET WHISPERER","Some people watch film. Apparently you just stare into the future."],
  ["UNREASONABLY LOCKED IN","Your pick sheet deserves its own postgame press conference."],
  ["THE SPORTSBOOK IS NOT INVITED","This is friendly pick'em, but that accuracy would scare a spreadsheet."],
  ["THE COMMISSIONER IS NERVOUS","Winning this much should come with an apology to the rest of the league."],
  ["STRAIGHT-UP SATURDAY LEGEND","You might have to start charging admission to see these selections."],
  ["THE TROPHY IS TAKING NOTES","Nobody has handed you a crown, but the picks are making a very strong argument."]
 ],
 great:[
  ["THE PICKS ARE PICKING","You're on a roll. The league is quietly checking your score again."],
  ["SATURDAY LOOKS GOOD ON YOU","These are confident picks, not random button presses. Mostly."],
  ["THE GROUP CHAT GOT QUIET","That's what happens when somebody starts getting the games right."],
  ["SCOUTING DEPARTMENT APPROVED","You saw things coming that everyone else called a bad idea."],
  ["A VERY RESPECTABLE FLEX","Your picks have earned exactly one dramatic victory lap."],
  ["THE SEC SUN IS SHINING","Keep this up and somebody will accuse you of knowing ball."],
  ["GOOD CALL UNIVERSITY","Your unofficial degree in picking winners is looking pretty legitimate."],
  ["YOUR BRACKET HAS SWAGGER","Not perfect, but there are some very loud receipts on this page."],
  ["SOMEONE GET A HIGHLIGHT CAMERA","Those picks deserve a little slow-motion replay."],
  ["THE SELECTION COMMITTEE AGREES","An excellent week for acting like you knew it all along."],
  ["YOUR RIVALS ARE SWEATING","Every correct pick makes that standings screen a little more awkward for them."],
  ["THE COMEBACK ARC IS REAL","If you weren't already leading, you're making people look over their shoulders."]
 ],
 okay:[
  ["RESPECTABLE CHAOS","Some genius picks, some mysterious decisions. That's college football."],
  ["A TRUE COIN-FLIP CONNOISSEUR","You are somehow both the hero and the villain of your own pick sheet."],
  ["STILL IN THE HUDDLE","Nothing to brag about too loudly. Nothing to delete the app over either."],
  ["THE MIDDLE OF THE PACK HAS WIFI","Congratulations, you have excellent company and very average receipts."],
  ["SATURDAY WAS A ROLLER COASTER","A few perfect calls and a couple where the TV deserved an apology."],
  ["YOU KNOW SOME BALL","Whether you know all the ball remains under active investigation."],
  ["A TALE OF TWO HALVES","Your good picks came ready. Your bad ones took the scenic route."],
  ["NOT A DISASTER. NOT A PARADE.","A serviceable week for someone with strong opinions about football."],
  ["THE STANDINGS ARE UNDECIDED","You have kept the competition interesting. Very generous of you."],
  ["GOOD ENOUGH FOR OVERTIME","Your picks can't decide whether they're cooking or getting cooked."],
  ["THE EXCITEMENT IS MANDATORY","Half of your calls aged beautifully. The rest have left the chat."],
  ["STAYING IN FIELD GOAL RANGE","You're still close enough to make next week interesting."]
 ],
 rough:[
  ["YOU'RE GETTING COOKED","The scoreboard has some notes. None of them are particularly encouraging."],
  ["THE GROUP CHAT SAW THAT","Your friends are already typing. You can hear the keyboard from here."],
  ["THAT PICK SHEET NEEDS A HUG","It looked great before kickoff. That was the high point."],
  ["SATURDAY CALLED IN SICK","Several of your picks apparently missed the team bus."],
  ["YOUR CRYSTAL BALL IS BUFFERING","Try unplugging it and plugging it back in before the next slate."],
  ["THE OPPOSITE DAY STRATEGY","If you'd clicked the other team a little more often, we'd be having a different conversation."],
  ["A LEARNING EXPERIENCE, APPARENTLY","The lessons were expensive. Luckily the points are imaginary."],
  ["THE PICKS TOOK A DETOUR","Destination: absolutely nowhere near the top of the standings."],
  ["THE FILM ROOM IS CLOSED","Nobody needs to watch those picks back in slow motion."],
  ["YOU GOT SCOUTED","The SEC showed up prepared. Your predictions absolutely did not."],
  ["THE COMEBACK BETTER BE CINEMATIC","Because this week's episode has been a rough watch."],
  ["SUNDAY MORNING DAMAGE REPORT","One wounded pick sheet. Several very happy opponents."]
 ],
 roast:[
  ["THE PICKS ARE IN SHAMBLES","Did you pick teams by throwing darts? The darts might deserve an apology."],
  ["CALL THE PICK'EM PARAMEDICS","This slate needs a full rebuild and possibly a pep talk."],
  ["THE SCOREBOARD HAS RECEIPTS","Unfortunately, every single receipt is against you."],
  ["YOU PICKED THE WRONG TIMELINE","Somewhere in a parallel universe, you're absolutely dominating."],
  ["YOUR CRYSTAL BALL IS A POTATO","It might be time to switch to an actual potato. Can't get much worse."],
  ["THE MASCOT COULD HAVE PICKED BETTER","And the mascot was busy doing push-ups on the sideline."],
  ["THE GROUP CHAT IS FEASTING","If laughter counted as points, your opponents would have set a record."],
  ["HISTORICALLY CONFIDENT. HISTORICALLY WRONG.","Respect the confidence. Question absolutely everything else."],
  ["THE SATURDAY DISASTER CLASS","This performance will be studied by future generations of rival fans."],
  ["THE PLAYBOOK IS ON FIRE","Not the fun kind of fire. The kind that requires an emergency exit."],
  ["YOU DECLARED WAR ON ACCURACY","Accuracy won by a fairly convincing margin."],
  ["THE RESET BUTTON LOOKS DELICIOUS","Good news: next week's slate has never heard of this one."]
 ]
});
const roastKey=()=> "sec-roast-deck-v1:"+(W.secOnline?.getUser?.()?.id||"device");
let latestVerdict=null;
function freshDeck(size,last){
 const deck=Array.from({length:size},(_,i)=>i);
 for(let i=deck.length-1;i>0;i--){
  const j=Math.floor(Math.random()*(i+1));
  [deck[i],deck[j]]=[deck[j],deck[i]];
 }
 // The last element is popped first. Ensure the new deck doesn't open with
 // the message that closed the previous one.
 if(deck.length>1&&deck[deck.length-1]===last){
  [deck[deck.length-1],deck[0]]=[deck[0],deck[deck.length-1]];
 }
 return deck;
}
function rotateRoast(kind){
 const options=ROASTS[kind];
 if(!options?.length)return null;
 const key=roastKey()+":"+kind;
 let previous=null;
 try{previous=JSON.parse(storage(key)||"null")}catch(_){}
 const last=Number.isInteger(previous?.last)&&previous.last>=0&&previous.last<options.length?previous.last:null;
 const remaining=Array.isArray(previous?.remaining)&&
  previous.remaining.every(i=>Number.isInteger(i)&&i>=0&&i<options.length)&&
  new Set(previous.remaining).size===previous.remaining.length&&
  !previous.remaining.includes(last)?
  previous.remaining.slice():[];
 const deck=remaining.length?remaining:freshDeck(options.length,last);
 const chosen=deck.pop();
 put(key,JSON.stringify({last:chosen,remaining:deck}));
 const [title,body]=options[chosen];
 return {kind,title,body};
}

function grade(wins,losses,pushes=0){
 const w=Number(wins)||0,l=Number(losses)||0,p=Number(pushes)||0;
 const judged=w+l;
 if(judged<3)return {ready:false,wins:w,losses:l,pushes:p,judged,percent:null,
  label:"Your roast report is still warming up",title:"Waiting for the scoreboard",
  body:"Once three of your picks have verified final results, your game-day verdict unlocks.",icon:"📋",kind:"pending"};
 const ratio=w/judged,percent=Math.round(ratio*100);
 let text;
 if(ratio>=.85)text={kind:"fire",icon:"🔥",title:"ABSOLUTE SEC MENACE",label:"You're cooking",body:"You didn't come to play. You came to embarrass the group chat. Screenshot these receipts."};
 else if(ratio>=.7)text={kind:"great",icon:"🏆",title:"THE PICKS ARE PICKING",label:"You're doing great",body:"Your picks are looking sharp. Someone should probably check your crystal ball."};
 else if(ratio>=.5)text={kind:"okay",icon:"😎",title:"RESPECTABLE CHAOS",label:"You're holding your own",body:"A few beauties, a few questionable decisions. You're still in the game."};
 else if(ratio>=.3)text={kind:"rough",icon:"🍳",title:"YOU'RE GETTING COOKED",label:"It's a rough week",body:"The scoreboard is talking trash. Lucky for you, next week is a fresh slate."};
 else text={kind:"roast",icon:"💀",title:"THE PICKS ARE IN SHAMBLES",label:"Oof. That was brutal.",body:"Did you pick teams by throwing darts? At least your confidence is undefeated."};
 return {...text,ready:true,wins:w,losses:l,pushes:p,judged,percent};
}
function current(){
 // Prefer a rolling window of REAL graded past picks, even in a newly started
 // week with no finals yet. Fall back only for older clients/test fixtures.
 const recent=W.SEC_NEXT?.recentStats?.();
 const s=recent||W.SEC_NEXT?.weekStats?.()||{wins:0,losses:0,pushes:0};
 return {...grade(s.wins,s.losses,s.pushes),
  source:s.source==="recent"?"recent":"week",
  fingerprint:s.fingerprint||[
   app()?.week?.()?.num||"none",s.wins||0,s.losses||0,s.pushes||0
  ].join("|"),limit:s.limit||10};
}
const disabled=()=>storage("sec-fun-disabled")==="true";
/* Keep the same roast through idle days and week changes. A newly verified
   final changes the pick fingerprint and selects the next unseen roast. */
function cardVerdict(force=false){
 const result=current();
 if(!result.ready)return result;
 const key=cardKey();
 let saved=null;
 try{saved=JSON.parse(storage(key)||"null")}catch(_){}
 const valid=saved?.kind===result.kind&&saved.fingerprint===result.fingerprint&&
  ROASTS[result.kind]?.some(([title,body])=>
   title===saved.title&&body===saved.body);
 const saying=valid&&!force?saved:rotateRoast(result.kind)||result;
 if(!valid||force)put(key,JSON.stringify({kind:result.kind,
  fingerprint:result.fingerprint,title:saying.title,body:saying.body}));
 latestVerdict={...result,title:saying.title,body:saying.body,account:roastKey(),
  week:app()?.week?.()?.num};
 return latestVerdict;
}
function resultUI(){
 const root=$("sec-fun-results");if(!root)return;
 const m=cardVerdict();
 const week=app()?.week?.()?.num;
 root.innerHTML='<section class="sec-fun-report sec-fun-report--'+esc(m.kind)+
  '" aria-label="Your recent SEC pick roast recap">'+
  '<div class="sec-fun-topline"><span class="sec-fun-kicker">🎙️ '+
  (m.source==='recent'?'RECENT PICKS · ':(week?'WEEK '+esc(week)+' · ':''))+
  'THE VERDICT</span>'+
  '<small>'+(m.ready?m.judged+' verified graded picks':'Awaiting three verified picks')+'</small></div>'+
  '<div class="sec-fun-story"><span class="sec-fun-card-emoji" aria-hidden="true">'+
  esc(m.icon)+'</span><div class="sec-fun-report-copy"><strong>'+esc(m.title)+
  '</strong><p>'+esc(m.body)+'</p></div></div>'+
  '<div class="sec-fun-scoreboard">'+[
    [m.ready?m.wins:'—','RIGHT'],
    [m.ready?m.losses:'—','WRONG'],
    [m.ready?m.percent+'%':'—','ACCURACY']
  ].map(([value,label])=>'<div><b>'+esc(value)+'</b><small>'+label+'</small></div>').join('')+'</div>'+
  '<div class="sec-fun-bottom"><div class="sec-fun-actions">'+
  '<button type="button" data-fun-next '+(!m.ready?'disabled':'')+'>↻ Another roast</button>'+
  '<button type="button" data-fun-share '+(!m.ready?'disabled':'')+'>↗ Share</button></div>'+
  '<label class="sec-fun-pref"><input type="checkbox" data-fun-opt-out '+
  (disabled()?'checked':'')+'> No surprise highlight pop-ups</label></div>'+
  (m.ready?'<p class="sec-fun-note">Your most recent '+esc(m.limit)+
  ' graded football picks are used when available. Results stay here between games and update after the next verified final. Only your own picks count.</p>':'')+
  '</section>';
}
function anotherRoast(){
 if(!current().ready)return;
 cardVerdict(true);
 resultUI();
 $("sec-fun-results")?.querySelector?.("[data-fun-next]")?.focus?.();
}
function ensureModal(){
 if(modal)return modal;
 modal=D.createElement("dialog");modal.className="sec-fun-dialog";modal.id="sec-fun-dialog";
 modal.setAttribute("aria-label","Special SEC Pick’em moment");
 modal.innerHTML='<div class="sec-fun-dialog-inner"><button type="button" class="sec-fun-close" data-fun-close aria-label="Close highlight">✕</button>'+
 '<div class="sec-fun-emoji" aria-hidden="true"></div><div class="sec-fun-kicker">SPECIAL GAME-DAY MOMENT</div>'+
 '<h2></h2><p></p><div class="sec-fun-stats"></div>'+
 '<div class="sec-fun-dialog-footer"><button type="button" data-fun-close>Back to results</button>'+
 '<button type="button" data-fun-again>↻ Another roast</button>'+
 '<button type="button" data-fun-share>Share your recap ↗</button></div></div>';
 D.body.appendChild(modal);
 return modal;
}
function close(){
 if(!modal)return;
 if(typeof modal.close==="function"&&modal.open)modal.close();
 else modal.removeAttribute("open");
}
function milestone(report=current()){
 if(!report.ready)return null;
 const stats=W.SEC_NEXT?.weekStats?.();
 const games=app()?.week?.()?.games||[];
 const finished=games.length>=3&&!!W.SEC_FEATURES?.finalData&&
  games.every(g=>Boolean(W.SEC_FEATURES.finalData(g)));
 // A perfect WEEK is announced only if every scheduled game has a source-
 // verified final, not merely because a few early picks were correct.
 if(finished&&report.judged>=3&&report.losses===0)
  return {id:"perfect-week",icon:"🏆",title:"PERFECT PICK SHEET!",
   body:"Every graded pick you made this week was right. The group chat is going to hear about this."};
 if(finished&&report.judged>=5&&report.percent<=20)
  return {id:"rough-week",icon:"💀",title:"THE PICK SHEET NEEDS A MEDIC",
   body:"That's an absolutely brutal week of confirmed picks. The comeback story starts next slate."};
 const upset=(stats?.items||[]).some(x=>x.kind==="won"&&
  W.SEC_LEAGUE_INSIGHTS?.upset?.(x.g,"football")?.label==="⚡ UNDERDOG WIN");
 if(upset)return {id:"called-upset",icon:"⚡",title:"YOU CALLED THE UPSET!",
  body:"You saw that one coming before the final whistle. That's a prediction worth bragging about."};
 return null;
}
function showMilestone(moment){
 if(!moment)return;
 const d=ensureModal(),m=current();
 d.classList.remove("fire","great","okay","rough","roast");
 d.classList.add(m.kind);
 d.querySelector(".sec-fun-emoji").textContent=moment.icon;
 d.querySelector("h2").textContent=moment.title;
 d.querySelector("p").textContent=moment.body;
 d.querySelector(".sec-fun-stats").textContent=m.wins+" right · "+m.losses+" wrong · "+m.percent+"% accuracy";
 if(typeof d.showModal==="function"&&!d.open)d.showModal();
 else d.setAttribute("open","");
}
async function share(){
 const m=cardVerdict();if(!m.ready)return;
 const content="SEC Pick’em · "+(m.source==="recent"?"Last "+m.judged+" graded football picks":
 "Week "+(app()?.week?.()?.num||"?"))+
 "\n"+m.title+"\n"+m.body+"\n"+m.wins+" right / "+m.losses+" wrong ("+m.percent+"%)"+
 "\nhttps://sablewolphen.github.io/SEC/#results";
 try{
  if(navigator.share)await navigator.share({title:"My SEC Pick’em verdict",text:content});
  else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(content);app()?.toast?.("Verdict copied.");}
  else app()?.toast?.("Sharing is unavailable on this device.");
 }catch(e){if(e?.name!=="AbortError")app()?.toast?.("Could not share this verdict.");}
}
function maybePopup(view){
 if(view!=="results"||disabled()||D.visibilityState==="hidden")return;
 const moment=milestone();
 if(!moment)return;
 const key=highlightKey();
 // Only one exceptional interruption per player, league and week.
 if(storage(key)==="shown"||openedScope===key)return;
 openedScope=key;
 showMilestone(moment);
 put(key,"shown");
}

function leagueUI(){
 const root=$("sec-next-league"),item=W.SEC_LEAGUE_SETTINGS?.getSelected?.();
 if(!root)return;
 root.querySelector(".sec-fun-league")?.remove();
 if(!item?.id||!W.secOnline?.getUser?.())return;
 const rows=W.SEC_POWER?.getRows?.(item)||[];
 const scored=rows.filter(row=>Number(row.weekly_graded)>0);
 const box=D.createElement("section");box.className="sec-fun-league";
 let main='<p>Weekly awards unlock when verified league picks have final scores.</p>';
 if(scored.length){
  const best=Math.max(...scored.map(r=>Number(r.weekly_points)||0));
  const winners=scored.filter(r=>Number(r.weekly_points)===best);
  main='<div class="sec-fun-mvp"><span aria-hidden="true">👑</span><div>'+
   '<small>'+ (winners.length>1?"TIED · PICK’EM MVP OF THE WEEK":"PICK’EM MVP OF THE WEEK")+'</small>'+
   '<strong>'+esc(winners.slice(0,3).map(r=>r.display_name||"Player").join(" & ")+(winners.length>3?" + others":""))+'</strong>'+
   '<span>'+best.toLocaleString("en-US")+' verified weekly league points</span></div></div>'+
   '<p class="sec-fun-muted">Your league’s weekly leader, not an official SEC athlete award. Rankings can change until games finish.</p>';
 }
 box.innerHTML='<h3>🏅 League awards <small>Verified picks only</small></h3>'+main;
 root.insertAdjacentElement("afterbegin",box);
}
function validAward(x){
 return x&&terms[x.sport]&&["week","year"].includes(x.period)&&safeUrl(x.url)&&
 /^\d{4}-\d\d-\d\d$/.test(String(x.date||""))&&typeof x.title==="string";
}
function officialNews(raw){
 const articles=Array.isArray(raw?.articles)?raw.articles:[];
 return articles.filter(a=>typeof a.title==="string"&&safeUrl(a.url)&&
 /players? of the week|postseason awards|basketball awards announced|baseball awards/i.test(a.title))
 .map(a=>{
  const sport=String(a.sport||"").toLowerCase();
  const derived=terms[sport]?sport:
   /baseball/i.test(a.title)?"baseball":/basketball/i.test(a.title)?"basketball":"football";
  const date=String(a.published_at||"").slice(0,10);
  return {sport:derived,period:/of the week/i.test(a.title)?"week":"year",date,
   year:Number(date.slice(0,4)),title:a.title,athlete:null,school:null,
   detail:"Source-linked official SEC coverage.",url:a.url};
 }).filter(validAward);
}
async function loadAwards(force=false){
 if(loading)return loading;
 if(!force&&awards.length&&Date.now()-lastAwardLoad<15*60000)return;
 loading=(async()=>{
  try{
   const [seed,news]=await Promise.allSettled([
    fetch("./sec-athlete-awards.json?awards=1",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Awards unavailable");return r.json();}),
    fetch("./news.json?awards=1",{cache:"no-store"}).then(r=>r.ok?r.json():null)
   ]);
   const verified=seed.status==="fulfilled"&&Array.isArray(seed.value?.official)?
    seed.value.official.filter(validAward):awards;
   const dynamic=news.status==="fulfilled"?officialNews(news.value):[];
   const keys=new Set(),list=[];
   for(const x of [...verified,...dynamic]){
    const k=[x.sport,x.period,x.url,x.athlete||""].join("|");
    if(keys.has(k))continue;keys.add(k);list.push(x);
   }
   awards=list.sort((a,b)=>b.date.localeCompare(a.date));
   lastAwardLoad=Date.now();
  }catch(_){}
  finally{loading=null;renderAwards();}
 })();
 return loading;
}
function record(x){
 const card=D.createElement("article");card.className="sec-fun-award";
 const badge=D.createElement("small");badge.textContent=(x.athlete?"SEC-ANNOUNCED HONOR":"OFFICIAL SEC ANNOUNCEMENT")+" · "+x.date;
 const title=D.createElement("strong");title.textContent=x.athlete||x.title;
 const desc=D.createElement("p");
 desc.textContent=(x.athlete?x.title+(x.school?" · "+x.school:"")+". ":"")+ (x.detail||"");
 const link=D.createElement("a");link.href=x.url;link.target="_blank";link.rel="noopener noreferrer";
 link.textContent="Read the SEC announcement ↗";
 card.append(badge,title,desc,link);return card;
}
function getMonthlyCandidates(sport){
 const latest=awards.filter(x=>x.sport===sport&&x.period==="week"&&x.athlete);
 const month=latest[0]?.date.slice(0,7);
 return {month,items:latest.filter(x=>x.date.startsWith(month))
  .filter((x,i,a)=>a.findIndex(y=>y.athlete===x.athlete)===i)};
}
function renderAwards(){
 const root=$("sec-athlete-awards-root");if(!root)return;
 const previous=D.activeElement?.dataset?.awardPeriod||null;
 root.replaceChildren();
 const section=D.createElement("section");section.className="sec-fun-awards";
 const top=D.createElement("div");top.className="sec-fun-awards-heading";
 const heading=D.createElement("div");heading.innerHTML='<small>🏅 ATHLETE HONORS</small><h2>SEC stars making history</h2>'+
  '<p>Official award announcements and your own fan picks, clearly labeled.</p>';
 const sport=D.createElement("div");sport.className="sec-fun-awards-switch";
 for(const s of Object.keys(terms)){
  const b=D.createElement("button");b.type="button";b.dataset.awardSport=s;b.textContent=terms[s];
  b.setAttribute("aria-pressed",String(awardSport===s));sport.append(b);
 }
 top.append(heading,sport);section.append(top);
 const filters=D.createElement("div");filters.className="sec-fun-awards-filters";
 for(const p of ["week","month","year"]){
  const b=D.createElement("button");b.type="button";b.dataset.awardPeriod=p;
  b.textContent=({week:"Player of the Week",month:"Month · Fan Choice",year:"Player of the Year"})[p];
  b.setAttribute("aria-pressed",String(awardPeriod===p));filters.append(b);
 }
 section.append(filters);
 const slot=D.createElement("div");slot.className="sec-fun-awards-list";
 const items=awards.filter(x=>x.sport===awardSport&&x.period===awardPeriod);
 if(awardPeriod==="month"){
  const d=getMonthlyCandidates(awardSport);
  const period=d.month?new Date(d.month+"-02T12:00:00Z").toLocaleDateString("en-US",{month:"long",year:"numeric",timeZone:"UTC"}):"latest month";
  const key="sec-month-fan-v1:"+awardSport+":"+(d.month||"none");
  const note=D.createElement("p");note.className="sec-fun-awards-note";
  note.textContent="Your "+period+" fan pick. Choose from sourced weekly honorees below. This is personal to this device — NOT an official SEC monthly award or public vote.";
  slot.append(note);
  if(d.items.length){
   for(const x of d.items){
    const card=record(x);const choice=D.createElement("button");choice.type="button";
    choice.dataset.awardVote=x.athlete;choice.dataset.awardMonth=d.month;
    choice.textContent=storage(key)===x.athlete?"✓ Your monthly pick":"Pick as my monthly standout";
    choice.setAttribute("aria-pressed",String(storage(key)===x.athlete));
    card.append(choice);slot.append(card);
   }
  }else{const p=D.createElement("p");p.textContent="No individual weekly honorees are available to pick from for this sport yet. Read the official weekly announcements.";slot.append(p);
   for(const x of awards.filter(x=>x.sport===awardSport&&x.period==="week").slice(0,2))slot.append(record(x));}
 }else if(items.length){
  for(const x of items.slice(0,awardPeriod==="week"?8:4))slot.append(record(x));
  if(awardPeriod==="year"&&awardSport==="football"){
   const n=D.createElement("p");n.className="sec-fun-awards-note";
   n.textContent="The current 2026 football season is still ongoing. Last completed season's official awards are shown.";
   slot.prepend(n);
  }
 }else{const p=D.createElement("p");p.textContent="No verified announcement available for this category yet. No winners will be invented.";slot.append(p);}
 const foot=D.createElement("small");foot.className="sec-fun-awards-source";
 foot.textContent="Official weekly/season award names and links are attributed to the Southeastern Conference; fan choices are unofficial. More announcements appear as sourced records are added.";
 section.append(slot,foot);
 const fold=D.createElement("details");fold.id="sec-fun-awards-fold";fold.className="sec-fun-awards-fold";
 fold.open=awardsExpanded;
 const summary=D.createElement("summary");summary.innerHTML='<strong>🏅 SEC Player Awards</strong><span>Week · Month · Year ⌄</span>';
 fold.append(summary,section);root.append(fold);
 if(previous)root.querySelector('[data-award-period="'+previous+'"]')?.focus?.();
}
function onView(view){
 if(view==="results"){resultUI();maybePopup(view);}
 if(view==="league")leagueUI();
 if(view==="news"){renderAwards();void loadAwards();}
}
D.addEventListener("click",e=>{
 const b=e.target.closest?.("button");if(!b)return;
 if(b.hasAttribute("data-fun-close")){close();return;}
 if(b.hasAttribute("data-fun-again")){anotherRoast();close();return;}
 if(b.hasAttribute("data-fun-next")){anotherRoast();return;}
 if(b.hasAttribute("data-fun-share")){void share();return;}
 if(b.dataset.awardSport){awardSport=b.dataset.awardSport;renderAwards();return;}
 if(b.dataset.awardPeriod){awardPeriod=b.dataset.awardPeriod;renderAwards();return;}
 if(b.dataset.awardVote){
  const d=getMonthlyCandidates(awardSport);
  if(!d.items.some(x=>x.athlete===b.dataset.awardVote)||b.dataset.awardMonth!==d.month)return;
  put("sec-month-fan-v1:"+awardSport+":"+d.month,b.dataset.awardVote);
  renderAwards();
 }
});
D.addEventListener("toggle",e=>{if(e.target?.id==="sec-fun-awards-fold")awardsExpanded=Boolean(e.target.open);},true);
D.addEventListener("change",e=>{
 if(!e.target.matches?.("[data-fun-opt-out]"))return;
 put("sec-fun-disabled",String(e.target.checked));
});
W.SEC_FAN_MOMENTS=Object.freeze({onView,grade,current,cardVerdict,anotherRoast,milestone,leagueUI,renderAwards,loadAwards,safeUrl,rotateRoast,roastCounts:()=>Object.fromEntries(Object.entries(ROASTS).map(([k,v])=>[k,v.length]))});
if(app()?.view?.())onView(app().view());
})();
