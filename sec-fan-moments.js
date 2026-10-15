/* Playful verified pick reactions and sourced SEC athlete honors.
   SEC monthly fan choices are YOUR picks, never represented as official SEC awards. */
(()=>{
"use strict";
const W=window,D=document,app=()=>W.SEC_BRIDGE,$=id=>D.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const scope=()=>[W.secOnline?.getUser?.()?.id||"device",W.SEC_LEAGUE_SETTINGS?.getSelected?.()?.id||"local",app()?.week?.()?.num||"none"].join("|");
// The connected account can temporarily read as null while Supabase refreshes
// its session. Reuse ONLY the identity already confirmed in this app instance,
// never a different user's data or a saved user ID from an old session.
// An explicit sign-out clears it immediately (see onAuthSignOut below).
let lastConfirmedUserId=null;
function owner(){
 const userId=W.secOnline?.getUser?.()?.id;
 if(userId){
  lastConfirmedUserId=String(userId);
  return lastConfirmedUserId;
 }
 return lastConfirmedUserId||"device";
}
const cardKey=()=> "sec-roast-card-v3:"+owner();
function savedCard(key){
 let raw=storage(key);
 if(!raw){
  // Migrate existing pinned sayings without mixing different accounts.
  const id=owner(),league=W.SEC_LEAGUE_SETTINGS?.getSelected?.()?.id;
  const candidates=[league,"local"].filter(Boolean).map(suffix=>
   "sec-roast-card-v2:"+id+"|"+suffix);
  for(const oldKey of new Set(candidates)){
   const original=storage(oldKey);
   if(original){raw=original;put(key,original);break;}
  }
 }
 try{return JSON.parse(raw||"null")}catch(_){return null}
}
const highlightKey=()=> "sec-fun-highlight-v1:"+scope();
const storage=(key)=>{try{return localStorage.getItem(key)}catch(_){return null}};
const put=(key,value)=>{try{localStorage.setItem(key,value)}catch(_){}};
const safeUrl=url=>{try{const x=new URL(url);return x.protocol==="https:"&&x.hostname==="www.secsports.com"}catch(_){return false}};
let awards=[],lastAwardLoad=0,loading=null,awardSport="football",awardPeriod="week",modal=null,openedScope="",awardsExpanded=false;
let displayedFingerprint=null,displayedAccountKey=null,lastRenderedView=null;
const terms={football:"Football",basketball:"Basketball",baseball:"Baseball"};

/* Each tier gets its own shuffled deck. A message cannot repeat until every
   message in that tier has appeared; crossing a deck boundary also never
   repeats the previous message. Selection history persists per signed-in
   account (or on this device when signed out). No private picks are read. */
const ROASTS=Object.freeze({
 "fire": [
  [
   "THE LEAGUE IS GETTING EMBARRASSED",
   "You didn't join Pick'em to compete. You joined to make your league question its basic understanding of football."
  ],
  [
   "SOMEBODY CHECK THE OTHER PLAYERS",
   "Your picks are so far ahead that everyone else's strategy looks like throwing a phone down the stairs."
  ],
  [
   "THE GROUP CHAT NEEDS WITNESS PROTECTION",
   "You have enough receipts to ruin Thanksgiving for half your league."
  ],
  [
   "YOU JUST STOLE THEIR SATURDAY",
   "Somebody spent all week studying matchups just to get publicly outpicked by you. Tragic."
  ],
  [
   "THEY CALLED IT LUCK. THAT'S CUTE.",
   "At this point the other players are inventing excuses faster than they're scoring points."
  ],
  [
   "THE TROPHY SHOULD CHANGE ITS ADDRESS",
   "Everyone else can keep fighting for second. You're already bullying the standings."
  ],
  [
   "THE SEC HAS A NEW PROBLEM",
   "Your opponents need a new hobby. They clearly weren't built for this one."
  ],
  [
   "THEY BROUGHT PICKS TO A MASSACRE",
   "Every correct call is another reason the league chat has gone suspiciously silent."
  ],
  [
   "YOUR RIVALS OWE YOU AN APOLOGY",
   "That wasn't a good week. That was an organized demolition of other people's confidence."
  ],
  [
   "SOMEONE CALL THE COMMISSIONER",
   "Your performance is making the rest of the league look like the preseason prediction department."
  ],
  [
   "THIS ISN'T A COMPETITION ANYMORE",
   "It's a weekly reminder that everyone else apparently picked with their eyes closed."
  ],
  [
   "THE STANDINGS HAVE A VILLAIN",
   "You are the reason the other players are suddenly claiming they don't care about Pick'em."
  ]
 ],
 "great": [
  [
   "THE PICKS ARE PICKING",
   "You keep getting games right and your opponents keep explaining how they would've picked differently. Nobody asked."
  ],
  [
   "YOU'RE RUINING THE GROUP CHAT",
   "Every right pick is another message your league will wish it never sent."
  ],
  [
   "A DANGEROUS AMOUNT OF FOOTBALL KNOWLEDGE",
   "Your rivals spent all week talking. You spent Saturday collecting evidence against them."
  ],
  [
   "THE REST OF THE LEAGUE LOOKS NERVOUS",
   "You're winning enough that the loudest trash talkers suddenly have very important errands."
  ],
  [
   "YOUR RECEIPTS HAVE RECEIPTS",
   "Somebody's going to call this luck, and they're going to be wrong again next week."
  ],
  [
   "YOU CAME FOR POINTS, NOT FRIENDS",
   "Keep this up and your league will vote to stop inviting you to things."
  ],
  [
   "THE UPSET PICKS HIT DIFFERENT",
   "Every time you get one right, somebody else has to pretend they totally saw it coming."
  ],
  [
   "THE OPPOSITION HAS ENTERED COPING MODE",
   "They're not losing because of your picks, apparently. It's the weather. And the refs. And Mercury."
  ],
  [
   "YOU'RE THE PROBLEM IN THIS LEAGUE",
   "Not perfect, just good enough to make everybody else's confidence look ridiculous."
  ],
  [
   "YOUR RIVALS ARE RUNNING OUT OF EXCUSES",
   "They said you'd crash. Instead they're the ones reading the standings in silence."
  ],
  [
   "THEY BET AGAINST YOUR BRAIN",
   "You made the picks. They made speeches. Only one of those earned points."
  ],
  [
   "THAT'S A LOT OF TALK FOR SECOND PLACE",
   "Your league can keep the trash talk. You've got the correct answers."
  ]
 ],
 "okay": [
  [
   "RESPECTABLE CHAOS",
   "You know just enough football to be dangerous, and just little enough to keep your rivals entertained."
  ],
  [
   "THE EXCITEMENT IS MANDATORY",
   "Your right picks are arguing with your wrong picks, and somehow neither side is winning the argument."
  ],
  [
   "YOU'RE THE DEFINITION OF MID",
   "The good news: you're not last. The bad news: this is the part of your season you're bragging about."
  ],
  [
   "YOUR PICKS NEED ADULT SUPERVISION",
   "You hit a few impressive calls, then apparently let the stadium parking attendant finish the sheet."
  ],
  [
   "CONFIDENCE: ELITE. ACCURACY: QUESTIONABLE.",
   "You talk like an analyst and pick like somebody who learned football from the scoreboard."
  ],
  [
   "THE STANDINGS CALLED YOU A PARTICIPANT",
   "Not a contender. Not a disaster. Just a name somebody has to scroll past."
  ],
  [
   "YOU'RE PLAYING .500 FOOTBALL WITH YOUR EGO",
   "Every right pick boosts your confidence. Every wrong pick proves it was a clerical error."
  ],
  [
   "YOUR HOT TAKES NEED A COLD SHOWER",
   "Your best calls were excellent. Your worst calls should be kept away from children learning football."
  ],
  [
   "DANGEROUSLY AVERAGE",
   "The league isn't scared of you. It's not particularly impressed either."
  ],
  [
   "THE PICK SHEET IS FIGHTING ITSELF",
   "Half your choices belong in a highlight reel. The rest belong in a sealed evidence locker."
  ],
  [
   "YOU BROUGHT VIBES TO A STATS FIGHT",
   "The vibes are immaculate. Your accuracy is filing a formal complaint."
  ],
  [
   "YOUR BRAGGING RIGHTS ARE ON PROBATION",
   "Please submit three more correct picks before returning to the group chat with that confidence."
  ]
 ],
 "rough": [
  [
   "YOU'RE GETTING COOKED",
   "That pick sheet isn't struggling. It's being dragged through the SEC schedule behind a pickup truck."
  ],
  [
   "DELETE THE GROUP CHAT HISTORY",
   "Not because your friends are being mean. Because they have screenshots, and those screenshots are devastating."
  ],
  [
   "YOUR PICKS HAVE BEEN DECLARED A DISASTER AREA",
   "The commissioner has asked everyone to stop pointing and laughing. Nobody listened."
  ],
  [
   "SOMEONE TAKE AWAY YOUR PREVIEW SHOWS",
   "Whatever you're watching before kickoff is actively making your picks worse."
  ],
  [
   "YOU WERE BETTER OFF GUESSING MASCOTS",
   "At least then you could blame the giant foam heads for this mess."
  ],
  [
   "THE STANDINGS ARE ROASTING YOU FOR FREE",
   "This app barely needs to add anything. Your score already did all the work."
  ],
  [
   "THE LEAGUE THANKS YOU FOR YOUR SERVICE",
   "Every bad pick is another charitable donation to somebody else's ranking."
  ],
  [
   "YOU PICK LIKE IT'S OPPOSITE DAY",
   "Your selections are so reliably bad that the group chat is using them as a scouting report."
  ],
  [
   "THE FILM ROOM DOESN'T WANT YOU BACK",
   "The analysts watched your picks and politely suggested you try a different sport."
  ],
  [
   "THE COMEBACK NEEDS A MIRACLE",
   "Not a rally speech. Not a motivational poster. An actual football miracle."
  ],
  [
   "YOU'VE LOST CONTROL OF THE NARRATIVE",
   "Your opponents are writing the recap, and you are absolutely not the hero."
  ],
  [
   "THAT PICK SHEET HAS NEGATIVE AURA",
   "Your best chance next week might be letting your phone pick teams from your pocket."
  ],
  [
   "YOU'RE THE LEAGUE'S BYE WEEK",
   "Everybody circles your name because the standings apparently give out free points."
  ],
  [
   "A COIN FLIP HAS BETTER FILM STUDY",
   "You spent all week researching just to lose an argument to pocket change."
  ],
  [
   "THE PICK SHEET NEEDS A PARENTAL LOCK",
   "The app should ask if a responsible adult approved these selections."
  ],
  [
   "YOUR UPSET SPECIAL IS EVERYONE ELSE'S LOCK",
   "When you call it a sleeper, the group chat knows to pick the other team."
  ],
  [
   "YOUR STRATEGY IS A CRIME SCENE",
   "There's yellow tape around your pick sheet and even the investigators refuse to explain it."
  ],
  [
   "YOU ARE THE QUALITY LOSS",
   "Your rivals are padding their resumes by sharing a league with you. That's how easy this has gotten."
  ]
 ],
 "roast": [
  [
   "THE PICKS ARE IN SHAMBLES",
   "This wasn't a bad week. This was a public service announcement about what happens when confidence replaces knowledge."
  ],
  [
   "THE LEAGUE HAS FOUND ITS CLOWN",
   "Everybody needed a laugh this Saturday. Unfortunately, your picks volunteered."
  ],
  [
   "YOUR FOOTBALL LICENSE HAS BEEN REVOKED",
   "Please surrender your pick sheet to the nearest mascot. They can't do worse."
  ],
  [
   "YOU COULDN'T PICK A WINNER IN A ONE-TEAM GAME",
   "The scoreboard is asking if you're doing this on purpose, because that would honestly be less embarrassing."
  ],
  [
   "THERE ARE NO WORDS. JUST SCREENSHOTS.",
   "Your league is saving this performance like a historic rivalry blowout."
  ],
  [
   "YOU'RE A FREE WIN FOR THE GROUP CHAT",
   "Your opponents don't even need to make picks. They just need to wait for yours to come in."
  ],
  [
   "THE DARTBOARD HAS REQUESTED A LAWYER",
   "It refuses to be associated with decisions this consistently awful."
  ],
  [
   "CONGRATULATIONS ON YOUR REBUILD YEAR",
   "Unfortunately, this is a Pick'em app. You don't get draft picks for finishing this badly."
  ],
  [
   "THE MASCOT WOULD LIKE TO SUB IN",
   "It has a giant costume head and limited peripheral vision. Still an upgrade."
  ],
  [
   "YOUR CRYSTAL BALL IS A BRICK",
   "Not broken. Not cloudy. Just a literal brick with better football instincts than you."
  ],
  [
   "THE COMMITTEE HAS REVIEWED YOUR PICKS",
   "Their unanimous recommendation: let somebody who has watched a game try next week."
  ],
  [
   "SOMEONE HIDE THIS FROM YOUR RIVALS",
   "Too late. They've screenshotted it, framed it, and made it the league's new profile picture."
  ],
  [
   "LAST PLACE HAS A RESERVED PARKING SPACE",
   "They didn't put your name on the trophy. They put it on the warning sign outside the league."
  ],
  [
   "YOUR PICKS SHOULD COME WITH A LAUGH TRACK",
   "Every time you submit a prediction, the group chat gets a new episode of its favorite comedy."
  ],
  [
   "THE COIN FLIP IS DEMANDING AN APOLOGY",
   "Fifty-fifty odds looked at your record and said, 'Don't drag me into this.'"
  ],
  [
   "YOU ARE ACTIVELY HELPING THE OTHER TEAMS",
   "Your picks aren't predictions anymore. They're complimentary scouting reports for everyone else."
  ],
  [
   "THE LEAGUE SHOULD CHARGE ADMISSION",
   "Watching you confidently destroy your own record is the only undefeated attraction left."
  ],
  [
   "THIS IS PUBLIC PICK'EM HUMILIATION",
   "Your record isn't rock bottom. It's drilling for oil beneath the stadium."
  ],
  [
   "EVEN THE MASCOT IS DISAPPOINTED",
   "A person dressed as a giant chicken just looked at your picks and asked whether you've ever seen a sport."
  ],
  [
   "YOU'VE BEEN ELIMINATED BY COMMON SENSE",
   "Your season highlight reel is just the submit button followed by immediate regret."
  ],
  [
   "THE SCOREBOARD HAS STOPPED BEING POLITE",
   "It isn't showing your record anymore. It's displaying a cautionary tale for first-time players."
  ],
  [
   "YOU'RE A WALKING TIEBREAKER DISASTER",
   "If the correct answer was written on the stadium, you'd still pick the parking lot."
  ]
 ]
} );
const roastKey=()=> "sec-roast-deck-v1:"+owner();
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
function rotateRoast(kind,excludeTitle=null){
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
 let deck=remaining.length?remaining:freshDeck(options.length,last);
 // A pinned recap can come from an older release or a restored device.
 // Never let tapping Another roast immediately return the visible quote.
 if(excludeTitle&&options[deck[deck.length-1]]?.[0]===excludeTitle){
  const alternate=deck.findIndex(index=>options[index][0]!==excludeTitle);
  if(alternate!==-1){
   [deck[alternate],deck[deck.length-1]]=[deck[deck.length-1],deck[alternate]];
  }else{
   // The final unshown entry equals an externally restored pinned quote:
   // skip it rather than repeating, and begin the next shuffled deck.
   const skipped=deck.pop();
   deck=freshDeck(options.length,skipped);
  }
 }
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
  body:"Give the scoreboard three real picks. Then we can decide whether you know ball or just own a phone.",icon:"📋",kind:"pending"};
 const ratio=w/judged,percent=Math.round(ratio*100);
 let text;
 if(ratio>=.85)text={kind:"fire",icon:"🔥",title:"ABSOLUTE SEC MENACE",label:"You're cooking",body:"Your opponents showed up with opinions. You showed up with a demolition permit."};
 else if(ratio>=.7)text={kind:"great",icon:"🏆",title:"THE PICKS ARE PICKING",label:"You're doing great",body:"You're stacking wins and your rivals are stacking excuses. Pathetic showing from them."};
 else if(ratio>=.5)text={kind:"okay",icon:"😎",title:"RESPECTABLE CHAOS",label:"You're holding your own",body:"Some of these picks are impressive. The rest look like you handed the phone to your rival."};
 else if(ratio>=.3)text={kind:"rough",icon:"🍳",title:"YOU'RE GETTING COOKED",label:"It's a rough week",body:"Your pick sheet needs a transfer portal. Everybody on it is underperforming."};
 else text={kind:"roast",icon:"💀",title:"THE PICKS ARE IN SHAMBLES",label:"Oof. That was brutal.",body:"If your picks were a football program, they'd be paying you to transfer."};
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
 const fresh=current(),key=cardKey(),saved=savedCard(key);
 const validQuote=ROASTS[saved?.kind]?.some(([title,body])=>
  title===saved.title&&body===saved.body);
 const cached=saved?.stats;
 const hasCached=validQuote&&cached&&
  [cached.wins,cached.losses,cached.pushes].every(x=>Number.isInteger(x)&&x>=0)&&
  cached.wins+cached.losses>=3&&cached.wins+cached.losses<=20;
 // An incomplete data refresh must never wipe 7 verified picks down to 0
 // or 2, nor rotate the user's saying while the League tab initializes.
 const incomplete=hasCached&&(!fresh.ready||
  fresh.judged<cached.wins+cached.losses);
 if(!fresh.ready&&!hasCached)return fresh;
 const report=incomplete?{
  ...grade(cached.wins,cached.losses,cached.pushes),
  fingerprint:saved.fingerprint,source:"saved",
  limit:Number(cached.limit)||10,carried:true
 }:fresh;
 const sameScores=hasCached&&
  cached.wins===report.wins&&cached.losses===report.losses&&
  cached.pushes===report.pushes;
 // The feed may re-order, replay or re-key the same completed games while
 // navigating. Only an actual change in verified score totals should
 // automatically select a different roast.
 const valid=validQuote&&saved.kind===report.kind&&
  (incomplete||saved.fingerprint===report.fingerprint||sameScores);
 const saying=valid&&!force?saved:rotateRoast(report.kind,saved?.title)||report;
 const stats={wins:report.wins,losses:report.losses,
  pushes:report.pushes,limit:report.limit};
 if(!valid||force||(!incomplete&&saved?.fingerprint!==report.fingerprint)||
    !hasCached){
  put(key,JSON.stringify({kind:report.kind,fingerprint:report.fingerprint,
   title:saying.title,body:saying.body,stats}));
 }
 latestVerdict={...report,title:saying.title,body:saying.body,account:roastKey(),
  week:app()?.week?.()?.num};
 return latestVerdict;
}
/* Compact persistent quote sits outside all routed .view elements; the full
   scorecard stays on Results. This is not another interruption or modal. */
function globalUI(view=app()?.view?.()){
 const root=$("sec-fun-global");if(!root)return;
 const m=cardVerdict(),visible=view!=="results";
 root.hidden=!visible;
 if(!visible){root.removeAttribute("data-signature");return;}
 const signature=[roastKey(),m.fingerprint,m.title,m.judged,view].join("|");
 displayedFingerprint=m.fingerprint;displayedAccountKey=cardKey();
 if(root.dataset.signature===signature)return;
 root.dataset.signature=signature;
 if(!m.ready){
  root.innerHTML='<aside class="sec-fun-ribbon sec-fun-ribbon--waiting" aria-label="Pick’em roast awaiting verified picks">'+
   '<span class="sec-fun-ribbon-emoji" aria-hidden="true">🎙️</span>'+
   '<div class="sec-fun-ribbon-copy"><small>YOUR PICK’EM ROAST</small>'+
   '<strong>Roast warming up</strong><span>Waiting for three verified picks.</span></div>'+
   '<div class="sec-fun-ribbon-actions"><button type="button" data-fun-open-results>Full recap ↗</button></div>'+
   '</aside>';
  return;
 }
 root.innerHTML='<aside class="sec-fun-ribbon" aria-label="Your persistent Pick’em verdict">'+
  '<span class="sec-fun-ribbon-emoji" aria-hidden="true">'+esc(m.icon)+'</span>'+
  '<div class="sec-fun-ribbon-copy"><small>🎙️ YOUR PICK’EM ROAST · '+
  (m.source==="saved"?"LAST VERIFIED":"RECENT PICKS")+'</small>'+
  '<strong>'+esc(m.title)+'</strong>'+
  '<span>'+esc(m.judged)+' graded picks · '+esc(m.percent)+'% correct</span></div>'+
  '<div class="sec-fun-ribbon-actions">'+
  '<button type="button" data-fun-next>↻ Another roast</button>'+
  '<button type="button" data-fun-open-results>Full recap ↗</button>'+
  '</div></aside>';
}
function resultUI(){
 const root=$("sec-fun-results");if(!root)return;
 const m=cardVerdict();
 displayedFingerprint=m.fingerprint;displayedAccountKey=cardKey();
 const week=app()?.week?.()?.num;
 root.innerHTML='<section class="sec-fun-report sec-fun-report--'+esc(m.kind)+
  '" aria-label="Your recent SEC pick roast recap">'+
  '<div class="sec-fun-topline"><span class="sec-fun-kicker">🎙️ '+
  (m.source==='recent'?'RECENT PICKS · ':m.source==='saved'?'LAST VERIFIED PICKS · ':(week?'WEEK '+esc(week)+' · ':''))+
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
  (m.ready?'<p class="sec-fun-note">'+(m.carried?'Showing your saved, verified recap while results load. ':'')+'Your most recent '+esc(m.limit)+
  ' graded football picks are used when available. Results stay here between games and update after the next verified final. Only your own picks count.</p>':'')+
  '</section>';
}
function anotherRoast(){
 if(!cardVerdict().ready)return;
 cardVerdict(true);
 const view=app()?.view?.();
 if(view==="results"){
  resultUI();
  $("sec-fun-results")?.querySelector?.("[data-fun-next]")?.focus?.();
 }else{
  globalUI(view);
  $("sec-fun-global")?.querySelector?.("[data-fun-next]")?.focus?.();
 }
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
function milestone(){
 // Highlights judge THIS completed week, never the carried-forward history.
 const stats=W.SEC_NEXT?.weekStats?.();
 const report=grade(stats?.wins||0,stats?.losses||0,stats?.pushes||0);
 if(!report.ready)return null;
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
   body:"The season has seen some ugly scoreboards. Your pick sheet just volunteered for the museum."};
 const upset=(stats?.items||[]).some(x=>x.kind==="won"&&
  W.SEC_LEAGUE_INSIGHTS?.upset?.(x.g,"football")?.label==="⚡ UNDERDOG WIN");
 if(upset)return {id:"called-upset",icon:"⚡",title:"YOU CALLED THE UPSET!",
  body:"You saw that one coming before the final whistle. That's a prediction worth bragging about."};
 return null;
}
function showMilestone(moment){
 if(!moment)return;
 const stats=W.SEC_NEXT?.weekStats?.()||{};
 const m=grade(stats.wins,stats.losses,stats.pushes);
 const d=ensureModal();
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
 const content="SEC Pick’em · "+(["recent","saved"].includes(m.source)?"Last "+m.judged+" graded football picks":
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
function onAuthSignOut(){
 // Explicit logout must immediately stop showing any account-specific quote.
 lastConfirmedUserId=null;
 displayedFingerprint=null;
 displayedAccountKey=null;
 lastRenderedView=null;
 const ribbon=$("sec-fun-global");
 if(ribbon){ribbon.removeAttribute("data-signature");ribbon.innerHTML="";ribbon.hidden=true;}
 const card=$("sec-fun-results");
 if(card)card.innerHTML="";
 onView(app()?.view?.()||"home");
}
function onView(view){
 lastRenderedView=view;
 globalUI(view);
 if(view==="results"){resultUI();maybePopup(view);}
 if(view==="league")leagueUI();
 if(view==="news"){renderAwards();void loadAwards();}
}
D.addEventListener("click",e=>{
 const b=e.target.closest?.("button");if(!b)return;
 if(b.hasAttribute("data-fun-close")){close();return;}
 if(b.hasAttribute("data-fun-again")){anotherRoast();close();return;}
 if(b.hasAttribute("data-fun-next")){anotherRoast();return;}
 if(b.hasAttribute("data-fun-open-results")){app()?.setView?.("results");return;}
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
// Refresh the visible card if a new final is loaded while the user stays on
// Results. Account score fetching still happens through the existing flow.
function refreshIfChanged(){
 if(D.visibilityState!=="visible")return;
 const view=app()?.view?.();if(!view)return;
 const m=cardVerdict();
 const changed=m.fingerprint!==displayedFingerprint||cardKey()!==displayedAccountKey||view!==lastRenderedView;
 if(changed){
  lastRenderedView=view;
  globalUI(view);
  if(view==="results"){
   resultUI();
   W.SEC_NEXT?.onResults?.();
   maybePopup("results");
  }
 }
}
D.addEventListener("visibilitychange",refreshIfChanged);
D.addEventListener("sec:results-updated",refreshIfChanged);
if(typeof W.setInterval==="function")W.setInterval(refreshIfChanged,60000);
W.SEC_FAN_MOMENTS=Object.freeze({onView,onAuthSignOut,grade,current,cardVerdict,anotherRoast,globalUI,milestone,leagueUI,renderAwards,loadAwards,safeUrl,rotateRoast,roastCounts:()=>Object.fromEntries(Object.entries(ROASTS).map(([k,v])=>[k,v.length]))});
if(app()?.view?.())onView(app().view());
})();
