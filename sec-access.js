/* Saturdays Down South — Find Anything and the compact destination directory.
 * Navigation-only: no score, pick, membership or trophy data is stored or changed.
 */
(()=>{
"use strict";
const app=()=>window.SEC_BRIDGE;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;":"&#39;"}[c]));
const entries=Object.freeze([
 {id:"quick",title:"Quick Pick",sub:"Finish remaining football picks",icon:"✓",group:"Play",terms:"one tap fast swipe picks remaining",view:"picks"},
 {id:"football",title:"Football Picks",sub:"Current SEC football week",icon:"🏈",group:"Play",terms:"matchups games schedule",view:"picks"},
 {id:"basketball",title:"Basketball Picks",sub:"Tipoffs and basketball games",icon:"🏀",group:"Play",terms:"hoops courts",view:"basketball"},
 {id:"baseball",title:"Baseball Picks",sub:"Daily games and series",icon:"⚾",group:"Play",terms:"diamond series",view:"baseball"},
 {id:"scores",title:"Live Scores",sub:"Game Center and verified finals",icon:"◉",group:"Game Day",terms:"football match score field gamecast",view:"game-center"},
 {id:"results",title:"My Results & Career",sub:"Wins, accuracy and victory cards",icon:"▥",group:"Game Day",terms:"career statistics history wins losses share recap",view:"results"},
 {id:"league",title:"League Standings",sub:"See your position in the race",icon:"▤",group:"Leagues",terms:"leaderboard rankings points",view:"league",pane:"scores"},
 {id:"league-chat",title:"League Chat",sub:"Talk with league members",icon:"💬",group:"Leagues",terms:"messages conversation",view:"league",pane:"chat"},
 {id:"league-brags",title:"League Brags & Rivals",sub:"Rivalries, receipts and honors",icon:"⚔",group:"Leagues",terms:"challenge rivals weekly receipts",view:"league",pane:"brags"},
 {id:"friend",title:"Friend Challenges",sub:"Send and accept head-to-head invites",icon:"⇄",group:"Leagues",terms:"friend head to head invite",view:"league",extra:"friend"},
 {id:"trends",title:"League Pick Trends",sub:"Revealed choices after kickoff",icon:"▥",group:"Leagues",terms:"percentages voting",view:"league",extra:"trends"},
 {id:"race",title:"Championship Race",sub:"Points behind and what-if scenarios",icon:"🏁",group:"Leagues",terms:"projected leader race",view:"league",extra:"race"},
 {id:"league-tools",title:"Manage Leagues",sub:"Invites, sports and tournaments",icon:"⚙",group:"Leagues",terms:"manage invite create join bracket",view:"league",pane:"more"},
 {id:"team",title:"My Team Hub",sub:"Your school's overview",icon:"★",group:"Schools & News",terms:"favorite university",view:"team-hub"},
 {id:"schedule",title:"My Team Schedule",sub:"Games for your favorite school",icon:"▦",group:"Schools & News",terms:"football fixtures calendar",view:"team-hub",teamTab:"schedule"},
 {id:"team-news",title:"Team News",sub:"Your school's headlines",icon:"📰",group:"Schools & News",terms:"favorite latest articles",view:"team-news"},
 {id:"news",title:"SEC News",sub:"Breaking conference headlines",icon:"▤",group:"Schools & News",terms:"articles updates",view:"news"},
 {id:"teams",title:"All 16 Teams",sub:"School profiles and records",icon:"🏟",group:"Schools & News",terms:"directory schools",view:"teams"},
 {id:"trophies",title:"Trophy Case",sub:"Championships and rivalry collectibles",icon:"🏆",group:"Collection",terms:"museum rewards achievements",view:"trophies"},
 {id:"settings",title:"Account & Settings",sub:"Privacy, alerts and profile",icon:"⚙",group:"Account",terms:"profile password sign in log in notifications",view:"settings"},
 {id:"notifications",title:"Notification Settings",sub:"Kickoff and final score alerts",icon:"🔔",group:"Account",terms:"push phone subscription reminder",view:"settings",extra:"notifications"}
]);
const item=id=>entries.find(x=>x.id===id);
const groups=["Play","Game Day","Leagues","Schools & News","Collection","Account"];
const defaults=["quick","scores","results","league"];
const recent=[];
let renderedScope="",pins=[],modalOpen=false,trigger=null;
const scope=()=>window.secOnline?.configured===true?String(window.secOnline?.getUser?.()?.id||"guest"):"offline";
const pinKey=()=>"sds-destinations:"+scope();
function loadPins(){
 const who=scope();if(who===renderedScope)return;
 renderedScope=who;let data=null;
 try{data=JSON.parse(localStorage.getItem(pinKey())||"null");}catch(_){}
 pins=Array.isArray(data)?data.filter(x=>typeof x==="string"&&item(x)).slice(0,8):defaults.slice();
 recent.length=0;
}
function savePins(){
 try{localStorage.setItem(pinKey(),JSON.stringify(pins));}catch(_){}
}
function isPinned(id){return pins.includes(id);}
function makeRow(x,withPin=true,inMore=false){
 const pin=isPinned(x.id);
 const destination=inMore&&x.id==="news"?" data-nav=\"news\"":
  inMore&&x.id==="teams"?" data-nav=\"teams\"":
  inMore&&x.id==="settings"?" data-nav=\"settings\"":
  ' data-sec-jump="'+esc(x.id)+'"';
 const btn='<button type="button" class="sec-access-link"'+destination+' aria-label="Open '+esc(x.title)+'">'+
 '<span class="sec-access-icon" aria-hidden="true">'+esc(x.icon)+'</span>'+
 '<span class="sec-access-copy"><strong>'+esc(x.title)+'</strong><small>'+esc(x.sub)+'</small></span>'+
 '<span class="sec-access-chevron" aria-hidden="true">›</span></button>';
 return '<div class="sec-access-row">'+btn+(withPin?
 '<button type="button" class="sec-access-pin'+(pin?" is-pinned":"")+
 '" data-sec-pin="'+esc(x.id)+'" aria-pressed="'+String(pin)+'" aria-label="'+
 (pin?"Unpin ":"Pin ")+esc(x.title)+'" title="'+(pin?"Remove from shortcuts":"Add to shortcuts")+'">'+
 (pin?"★":"☆")+'</button>':"")+'</div>';
}
function findMatches(query){
 const q=String(query||"").trim().toLocaleLowerCase("en-US");
 if(!q)return entries;
 const words=q.split(/\s+/).filter(Boolean);
 return entries.filter(x=>words.every(w=>(x.title+" "+x.sub+" "+x.terms+" "+x.group).toLocaleLowerCase("en-US").includes(w)));
}
function chosenOrder(xs){return xs.slice().sort((a,b)=>{
 const pa=isPinned(a.id)?0:1,pb=isPinned(b.id)?0:1;
 if(pa!==pb)return pa-pb;
 const ra=recent.indexOf(a.id),rb=recent.indexOf(b.id);
 return (ra<0?99:ra)-(rb<0?99:rb);
});}
function renderFind(){
 const holder=$("sec-access-results");if(!holder)return;
 loadPins();
 const query=$("sec-access-search")?.value||"";
 const matches=findMatches(query);
 const chosen=query.trim()?chosenOrder(matches):[
  ...pins.map(item).filter(Boolean),...recent.filter(id=>!isPinned(id)).map(item).filter(Boolean),
  ...entries.filter(x=>!isPinned(x.id)&&!recent.includes(x.id))
 ];
 if(!chosen.length){holder.innerHTML='<p class="sec-access-empty">No matches. Try “scores”, “team”, “chat”, or “picks”.</p>';const count=$("sec-access-count");if(count)count.textContent="0 destinations";return;}
 let last="";
 holder.innerHTML=chosen.map(x=>{
  const section=query.trim()?"Results":isPinned(x.id)?"Pinned":recent.includes(x.id)?"Recently used":x.group;
  const heading=section!==last?'<h3 class="sec-access-section-title">'+esc(section)+'</h3>':"";
  last=section;
  return heading+makeRow(x);
 }).join("");
 const count=$("sec-access-count");
 if(count)count.textContent=matches.length+" destination"+(matches.length===1?"":"s");
}
function openFind(source){
 const d=$("sec-access-dialog");if(!d)return;
 trigger=source||document.activeElement;
 loadPins();modalOpen=true;
 if(typeof d.showModal==="function"&&!d.open)d.showModal();
 else d.setAttribute("open","");
 const input=$("sec-access-search");if(input){input.value="";renderFind();input.focus();}
}
function closeFind(){
 const d=$("sec-access-dialog");modalOpen=false;
 if(d?.open&&typeof d.close==="function")d.close();
 else d?.removeAttribute("open");
 if(trigger?.isConnected)trigger.focus({preventScroll:true});
 trigger=null;
}
function announce(message){app()?.toast?.(message);}
function focusRegion(el){
 if(!el)return;
 el.scrollIntoView?.({behavior:"smooth",block:"start"});
}
function showExtra(type){
 const league=$("sec-next-league");
 if(type==="notifications"){
  const details=$("sec-next-push")?.querySelector("details");if(details){details.open=true;focusRegion(details);}
  return;
 }
 if(!league)return;
 const outer=league.querySelector("details");if(!outer)return;
 outer.open=true;
 const child=outer.querySelectorAll("details");
 const index=type==="trends"?0:type==="race"?1:type==="friend"?2:-1;
 if(index<0||!child[index])return;
 child[index].open=true;focusRegion(child[index]);
 if(type==="friend"){
  const button=child[index].querySelector("[data-next-load-challenges]");
  // The user can choose to load secure member-only invites.
  button?.focus?.({preventScroll:true});
 }
}
function navigate(id){
 const x=item(id);if(!x)return;
 loadPins();closeFind();
 app()?.setView?.(x.view);
 if(recent.includes(id))recent.splice(recent.indexOf(id),1);
 recent.unshift(id);if(recent.length>6)recent.length=6;
 if(x.pane)window.SEC_LEAGUE_TABS?.switchPane?.(x.pane);
 if(x.teamTab){
  const tab=document.querySelector('#team-hub-view [data-sdsx-team-tab="'+x.teamTab+'"]');
  tab?.click?.();
 }
 if(x.extra)showExtra(x.extra);
 if(id==="quick"){
  if(window.SEC_NEXT?.pending?.()?.length>0&&typeof window.SEC_NEXT.openQuick==="function")
   window.SEC_NEXT.openQuick();
  else if(!window.SEC_NEXT?.pending?.()?.length)
   announce("Your current football week has no available unpicked games.");
  else announce("Open Quick Pick from the Picks page.");
 }
 if(app()?.view?.()==="more")renderMore();
}
function renderMore(){
 const root=$("sec-access-more");if(!root)return;
 loadPins();
 root.innerHTML='<div class="sec-access-more-top">'+
  '<div><strong>Find anything, faster.</strong><p>One-tap access to every part of the app.</p></div>'+
  '<button class="sec-access-more-search" type="button" data-sec-find>⌕ Find a page or feature</button></div>'+
  '<section class="sec-access-shortcuts" aria-label="Pinned shortcuts"><div class="sec-access-heading"><h2>Your shortcuts</h2>'+
  '<small>Use ☆ to customize</small></div>'+
  '<div class="sec-access-pin-grid">'+pins.map(item).filter(Boolean).map(x=>
  '<button type="button" data-sec-jump="'+esc(x.id)+'"><span aria-hidden="true">'+esc(x.icon)+
  '</span><strong>'+esc(x.title)+'</strong></button>').join("")+'</div></section>'+
  groups.map(group=>'<section class="sec-access-group" aria-label="'+esc(group)+'">'+
  '<h2>'+esc(group)+'</h2><div class="sec-access-more-grid">'+entries.filter(x=>x.group===group).map(x=>
  makeRow(x,true,true)).join("")+'</div></section>').join("");
}
function togglePin(id){
 if(!item(id))return;loadPins();
 if(isPinned(id))pins=pins.filter(x=>x!==id);
 else{pins=[...pins,id].slice(-8);}
 savePins();renderFind();renderMore();
 const active=$("sec-access-dialog")?.querySelector('[data-sec-pin="'+id+'"]');
 if(modalOpen&&active)active.focus({preventScroll:true});
}
function sync(v){
 loadPins();
 if(v==="more")renderMore();
 const btn=$("sec-access-trigger");if(btn)btn.setAttribute("aria-label","Find any SEC page or feature");
}
function setup(){
 const dialog=$("sec-access-dialog");
 if(dialog)dialog.addEventListener("close",()=>{modalOpen=false;trigger=null;});
 sync(app()?.view?.()||"home");
}
document.addEventListener("click",e=>{
 const find=e.target.closest?.("[data-sec-find]");
 if(find){e.preventDefault();openFind(find);return;}
 const close=e.target.closest?.("[data-sec-close]");
 if(close){e.preventDefault();closeFind();return;}
 const pin=e.target.closest?.("[data-sec-pin]");
 if(pin){e.preventDefault();togglePin(pin.dataset.secPin);return;}
 const jump=e.target.closest?.("[data-sec-jump]");
 if(jump){e.preventDefault();navigate(jump.dataset.secJump);return;}
});
document.addEventListener("input",e=>{
 if(e.target?.id==="sec-access-search")renderFind();
});
document.addEventListener("keydown",e=>{
 if(modalOpen&&e.key==="Enter"&&e.target?.id==="sec-access-search"){
  const first=$("sec-access-results")?.querySelector("[data-sec-jump],[data-nav]");
  if(first){e.preventDefault();first.click();}return;
 }
 if(modalOpen&&e.key==="ArrowDown"&&e.target?.id==="sec-access-search"){
  const first=$("sec-access-results")?.querySelector("[data-sec-jump],[data-nav]");
  if(first){e.preventDefault();first.focus();}return;
 }
 if(e.key==="Escape"&&modalOpen){e.preventDefault();closeFind();return;}
 if(e.key==="/"||e.key.toLowerCase()==="k"&&(e.ctrlKey||e.metaKey)){
  if(e.altKey||e.shiftKey)return;
  const tag=document.activeElement?.tagName||"";
  if(!modalOpen&&/^(INPUT|TEXTAREA|SELECT)$/.test(tag))return;
  if(!modalOpen&&!document.activeElement?.isContentEditable){
   e.preventDefault();openFind($("sec-access-trigger"));
  }
 }
});
window.SEC_ACCESS=Object.freeze({openFind,closeFind,navigate,sync,renderMore,findMatches,entries,scope});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});
else setup();
})();