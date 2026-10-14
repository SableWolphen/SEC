/* Playful verified pick reactions and sourced SEC athlete honors.
   SEC monthly fan choices are YOUR picks, never represented as official SEC awards. */
(()=>{
"use strict";
const W=window,D=document,app=()=>W.SEC_BRIDGE,$=id=>D.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const scope=()=>[W.secOnline?.getUser?.()?.id||"device",W.SEC_LEAGUE_SETTINGS?.getSelected?.()?.id||"local",app()?.week?.()?.num||"none"].join("|");
const sessionKey=()=> "sec-fun-v1:"+scope();
const storage=(key)=>{try{return localStorage.getItem(key)}catch(_){return null}};
const put=(key,value)=>{try{localStorage.setItem(key,value)}catch(_){}};
const safeUrl=url=>{try{const x=new URL(url);return x.protocol==="https:"&&x.hostname==="www.secsports.com"}catch(_){return false}};
let awards=[],lastAwardLoad=0,loading=null,awardSport="football",awardPeriod="week",modal=null,openedScope="",manualOpened=false;
const terms={football:"Football",basketball:"Basketball",baseball:"Baseball"};
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
 const s=W.SEC_NEXT?.weekStats?.()||{wins:0,losses:0,pushes:0};
 return grade(s.wins,s.losses,s.pushes);
}
const disabled=()=>storage("sec-fun-disabled")==="true";
function resultUI(){
 const root=$("sec-fun-results");if(!root)return;
 const m=current();
 root.innerHTML='<section class="sec-fun-report" aria-label="Your weekly SEC pick verdict">'+
  '<div class="sec-fun-report-copy"><span class="sec-fun-kicker">🎙️ THE VERDICT</span>'+
  '<strong>'+esc(m.label)+'</strong><small>'+(m.ready?
  m.wins+' correct · '+m.losses+' missed · '+m.percent+'% of graded picks':
  '3 verified final picks unlock your first verdict')+'</small></div>'+
  '<div class="sec-fun-actions"><button type="button" data-fun-show '+(!m.ready?'disabled':'')+'>How am I doing? →</button>'+
  '<label><input type="checkbox" data-fun-opt-out '+(disabled()?'checked':'')+'> No surprise pop-ups</label></div></section>';
}
function ensureModal(){
 if(modal)return modal;
 modal=D.createElement("dialog");modal.className="sec-fun-dialog";modal.id="sec-fun-dialog";
 modal.setAttribute("aria-label","SEC weekly pick verdict");
 modal.innerHTML='<div class="sec-fun-dialog-inner"><button type="button" class="sec-fun-close" data-fun-close aria-label="Close verdict">✕</button>'+
 '<div class="sec-fun-emoji" aria-hidden="true"></div><div class="sec-fun-kicker">SEC PICK’EM SCOREBOARD</div>'+
 '<h2></h2><p></p><div class="sec-fun-stats"></div>'+
 '<div class="sec-fun-dialog-footer"><button type="button" data-fun-close>Back to the game</button>'+
 '<button type="button" data-fun-share>Share the receipts ↗</button></div></div>';
 D.body.appendChild(modal);
 modal.addEventListener("close",()=>{manualOpened=false});
 return modal;
}
function show(manual=false){
 const m=current();
 if(!m.ready)return;
 const d=ensureModal();
 d.classList.remove("fire","great","okay","rough","roast");
 d.classList.add(m.kind);
 d.querySelector(".sec-fun-emoji").textContent=m.icon;
 d.querySelector("h2").textContent=m.title;
 d.querySelector("p").textContent=m.body;
 d.querySelector(".sec-fun-stats").textContent=m.wins+" correct · "+m.losses+" missed · "+m.percent+"% accuracy";
 manualOpened=manual;
 if(typeof d.showModal==="function"&&!d.open)d.showModal();
 else d.setAttribute("open","");
}
function close(){
 if(!modal)return;
 if(typeof modal.close==="function"&&modal.open)modal.close();
 else modal.removeAttribute("open");
}
async function share(){
 const m=current();if(!m.ready)return;
 const content="SEC Pick’em · Week "+(app()?.week?.()?.num||"?")+
 "\n"+m.title+"\n"+m.wins+" right / "+m.losses+" wrong ("+m.percent+"%)"+
 "\nhttps://sablewolphen.github.io/SEC/#results";
 try{
  if(navigator.share)await navigator.share({title:"My SEC Pick’em verdict",text:content});
  else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(content);app()?.toast?.("Verdict copied.");}
  else app()?.toast?.("Sharing is unavailable on this device.");
 }catch(e){if(e?.name!=="AbortError")app()?.toast?.("Could not share this verdict.");}
}
function maybePopup(view){
 if(view!=="results"||disabled()||D.visibilityState==="hidden")return;
 const report=current();
 if(!report.ready)return;
 const key=sessionKey();
 if(storage(key)==="shown"||openedScope===key)return;
 openedScope=key;put(key,"shown");show(false);
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
 section.append(slot,foot);root.append(section);
 if(previous)root.querySelector('[data-award-period="'+previous+'"]')?.focus?.();
}
function onView(view){
 if(view==="results"){resultUI();maybePopup(view);}
 if(view==="league")leagueUI();
 if(view==="news"){renderAwards();void loadAwards();}
}
D.addEventListener("click",e=>{
 const b=e.target.closest?.("button");if(!b)return;
 if(b.hasAttribute("data-fun-show")){show(true);return;}
 if(b.hasAttribute("data-fun-close")){close();return;}
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
D.addEventListener("change",e=>{
 if(!e.target.matches?.("[data-fun-opt-out]"))return;
 put("sec-fun-disabled",String(e.target.checked));
});
W.SEC_FAN_MOMENTS=Object.freeze({onView,grade,current,leagueUI,renderAwards,loadAwards,safeUrl});
if(app()?.view?.())onView(app().view());
})();
