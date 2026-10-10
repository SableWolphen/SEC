/* Saturdays Down South — source-attributed SEC News.
 * Headlines are real feed metadata, never generated. TL;DR shows a short original
 * provider excerpt and always links to its complete article.
 */
(()=>{
 "use strict";
 const SEC=["Alabama","Arkansas","Auburn","Florida","Georgia","Kentucky","LSU",
  "Mississippi State","Missouri","Oklahoma","Ole Miss","South Carolina","Tennessee",
  "Texas","Texas A&M","Vanderbilt"];
 let entries=[],updated=null,checked=null,warning="",error="",loading=false,lastFetch=0;
 let team="all",breakingOnly=false,search="",sourceNames=[],sport=null;
 const SPORTS={
  football:{label:"Football",emoji:"🏈"},
  baseball:{label:"Baseball",emoji:"⚾"},
  basketball:{label:"Basketball",emoji:"🏀"}
 };
 function selectedSport(){
  if(sport&&SPORTS[sport])return sport;
  const picks=window.SEC_BRIDGE?.selectedSport?.();
  sport=picks==="picks"?"football":SPORTS[picks]?picks:
   (window.SEC_SPORTS?.recommended?.()||"football");
  if(!SPORTS[sport])sport="football";
  return sport;
 }
 const articleSport=item=>SPORTS[item.sport]?item.sport:!item.sport?"football":null;
 const $=id=>document.getElementById(id);
 const make=(tag,cls,content)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(content!==undefined)el.textContent=String(content);
  return el;
 };
 const date=x=>{const n=new Date(x);return Number.isFinite(n.getTime())?n:null;};
 const safeUrl=value=>{
  try{const url=new URL(value);return url.protocol==="https:"&&
   ["www.ncaa.com","ncaa.com","www.espn.com","espn.com"].includes(url.hostname)?
   url.href:null;}catch(e){return null;}
 };
 const elapsed=time=>{
  const then=date(time);if(!then)return "Undated";
  const minutes=Math.max(0,Math.floor((Date.now()-then.getTime())/60000));
  if(minutes<1)return "Just now";
  if(minutes<60)return minutes+"m ago";
  const hours=Math.floor(minutes/60);
  if(hours<24)return hours+"h ago";
  const days=Math.floor(hours/24);
  return days+"d ago";
 };
 const hoursOld=item=>{const d=date(item.published_at);return d?(Date.now()-d.getTime())/3600000:Infinity;};
 const isBreaking=item=>Boolean(item.breaking)&&hoursOld(item)<=6&&hoursOld(item)>=-0.5;
 const isFresh=item=>hoursOld(item)<=24&&hoursOld(item)>=-0.5;
 function link(item,text){
  const url=safeUrl(item.url);if(!url)return null;
  const el=make("a","sec-news-open",text||"Read full story ↗");
  el.href=url;el.target="_blank";el.rel="noopener noreferrer";
  el.setAttribute("aria-label","Read original article at "+item.source+": "+item.title);
  return el;
 }
 function card(item,feature=false){
  const article=make("article","sec-news-card"+(feature?" sec-news-feature":""));
  const badges=make("div","sec-news-card-labels");
  if(isBreaking(item))badges.append(make("span","sec-news-breaking","● BREAKING"));
  else if(isFresh(item))badges.append(make("span","sec-news-new","NEW"));
  badges.append(make("span","sec-news-source",item.source||"Publisher"));
  badges.append(make("span","sec-news-sport-tag",SPORTS[articleSport(item)]?.label||"SEC"));
  badges.append(make("time","sec-news-time",elapsed(item.published_at)));
  if(date(item.published_at))badges.lastElementChild.dateTime=date(item.published_at).toISOString();
  const title=make(feature?"h2":"h3","sec-news-card-title",item.title);
  const blurb=make("p","sec-news-card-summary");
  const kicker=make("strong","","TL;DR  ");
  blurb.append(kicker,document.createTextNode(item.summary||"Summary not provided. Open the original article for details."));
  const tags=make("div","sec-news-tags");
  const teams=Array.isArray(item.teams)?item.teams:[];
  for(const name of teams.slice(0,3))tags.append(make("span","sec-news-team",name));
  const button=link(item);
  article.append(badges,title,blurb,tags);
  if(button)article.append(button);
  return article;
 }
 function sportFilters(root){
  const chooser=make("div","sec-news-sports");
  chooser.setAttribute("role","group");
  chooser.setAttribute("aria-label","Choose sport for SEC news");
  for(const [key,meta] of Object.entries(SPORTS)){
   const button=make("button","sec-news-sport-choice"+(selectedSport()===key?" active":""),meta.emoji+" "+meta.label);
   button.type="button";
   button.setAttribute("data-news-sport",key);
   button.setAttribute("aria-pressed",String(selectedSport()===key));
   button.setAttribute("aria-label","Show "+meta.label+" news");
   button.addEventListener("click",()=>{sport=key;render();});
   chooser.append(button);
  }
  root.append(chooser);
 }
 function filters(root){
  const area=make("div","sec-news-controls");
  const left=make("div","sec-news-toggle");
  for(const [key,label] of [["all","All news"],["breaking","Breaking"]]){
   const selected=breakingOnly?(key==="breaking"):(key==="all");
   const button=make("button","sec-news-filter"+(selected?" active":""),label);
   button.type="button";button.setAttribute("aria-pressed",String(selected));
   button.addEventListener("click",()=>{breakingOnly=key==="breaking";render();});
   left.append(button);
  }
  const select=document.createElement("select");select.className="sec-news-school";
  select.setAttribute("aria-label","Filter SEC news by school");
  select.append(new Option("All SEC schools","all"));
  for(const name of SEC)select.append(new Option(name,name));
  select.value=team;select.addEventListener("change",()=>{team=select.value;render();});
  const input=make("input","sec-news-search");input.type="search";
  input.placeholder="Find a player, coach, or school…";
  input.setAttribute("aria-label","Search SEC headlines");
  input.value=search;
  input.addEventListener("input",()=>{
   search=input.value.toLowerCase().trim();
   drawResults();
  });
  area.append(left,select,input);root.append(area);
 }
 function matchingArticles(){
  return entries.filter(i=>{
   if(articleSport(i)!==selectedSport())return false;
   if(team!=="all"&&!(Array.isArray(i.teams)&&i.teams.includes(team)))return false;
   return !search||(i.title+" "+i.summary+" "+(i.teams||[]).join(" ")).toLowerCase().includes(search);
  });
 }
 function filtered(){
  const candidates=matchingArticles();
  if(!breakingOnly)return candidates;
  const breaking=candidates.filter(isBreaking);
  return breaking.length?breaking:candidates.slice(0,12);
 }
 function drawResults(){
  const host=$("sec-news-results");if(!host)return;
  host.replaceChildren();
  const items=filtered();
  const count=$("sec-news-count");
  if(count)count.textContent=items.length+" "+SPORTS[selectedSport()].label.toLowerCase()+
   " "+(items.length===1?"story":"stories")+" · source-linked";
  if(!items.length){
   const state=make("div","sec-news-empty");
   const sportCount=entries.filter(i=>articleSport(i)===selectedSport()).length;
   state.append(make("strong","",sportCount?
     "No "+SPORTS[selectedSport()].label.toLowerCase()+" stories match your filters.":
     "No recent SEC "+SPORTS[selectedSport()].label.toLowerCase()+" headlines yet."));
   state.append(make("p","",sportCount?
     "Try another school, clear your search, or choose All news.":
     "This sport may be between seasons. The feed updates from original publishers; try Refresh or check again later."));
   host.append(state);return;
  }
  if(breakingOnly&&!matchingArticles().some(isBreaking))
   host.append(make("p","sec-news-no-breaking","No verified breaking headlines in the last 6 hours. Showing the latest "+SPORTS[selectedSport()].label.toLowerCase()+" articles instead."));
  const grid=make("div","sec-news-grid");
  items.forEach((item,index)=>grid.append(card(item,index===0&&!breakingOnly&&!search&&team==="all")));
  host.append(grid);
 }
 function render(){
  const root=$("sec-news-root");if(!root)return;
  root.replaceChildren();
  const heading=make("section","sec-news-head");
  const top=make("div","sec-news-eyebrow","THE LATEST · SEC "+SPORTS[selectedSport()].label.toUpperCase());
  const title=make("h2","","News in a nutshell.");
  const intro=make("p","","Short summaries. Real sources. Tap any story to read the full article.");
  const status=make("div","sec-news-status");
  status.append(make("span","",updated?"Updated "+elapsed(updated):"Waiting for first automatic update"));
  const refresh=make("button","sec-news-refresh",loading?"Refreshing…":"↻ Refresh");
  refresh.type="button";refresh.disabled=loading;
  refresh.addEventListener("click",()=>{void reload(true);});
  status.append(refresh);heading.append(top,title,intro,status);
  root.append(heading);
  if(error)root.append(make("p","sec-news-alert",error));
  if(warning)root.append(make("p","sec-news-warning",warning));
  const details=make("p","sec-news-byline","Source excerpts, not independent reporting. Published times are from the original outlets. Feed checks run approximately hourly; alerts aren't instantaneous.");
  root.append(details);
  sportFilters(root);
  filters(root);
  const count=make("p","sec-news-result-count");count.id="sec-news-count";root.append(count);
  const feed=make("div","");feed.id="sec-news-results";root.append(feed);
  drawResults();
 }
 async function reload(force=false){
  if(loading)return;
  if(!force&&Date.now()-lastFetch<4*60000){render();return;}
  loading=true;error="";render();
  try{
   const response=await fetch("./news.json?feed=1",{cache:"no-store"});
   if(!response.ok)throw new Error("News is not published yet");
   const payload=await response.json();
   if(!payload||!Array.isArray(payload.articles))throw new Error("Invalid news feed");
   const recent=payload.articles.filter(item=>item&&typeof item.title==="string"&&
    typeof item.source==="string"&&safeUrl(item.url)&&date(item.published_at)&&
    articleSport(item)&&hoursOld(item)>=-3&&hoursOld(item)<=216);
   // Preserve up to 50 recent stories per sport; football must not crowd out baseball.
   const perSport={football:0,baseball:0,basketball:0};
   entries=recent.sort((a,b)=>date(b.published_at)-date(a.published_at)).filter(item=>{
    const key=articleSport(item);
    if(perSport[key]>=50)return false;
    perSport[key]++;return true;
   });
   updated=payload.updated_at||null;checked=payload.checked_at||null;
   sourceNames=Array.isArray(payload.sources)?payload.sources:[];
   warning=typeof payload.warning==="string"?payload.warning:"";
   if(updated&&date(updated)&&(Date.now()-date(updated).getTime())>8*3600000){
    warning="News hasn't refreshed recently. Headlines below may be delayed; check the source for the latest updates.";
   }
   lastFetch=Date.now();
  }catch(e){
   error="Live news is temporarily unavailable. "+(entries.length?
     "Previously loaded headlines are shown below.":"Try again later or visit the SEC's official news page.");
  }finally{loading=false;render();}
 }
 function showSchool(name,newsSport){
   if(!SEC.includes(name))return;
   team=name;
   search="";breakingOnly=false;
   if(SPORTS[newsSport])sport=newsSport;
   window.SEC_BRIDGE?.setView?.("news");
   render();void reload();
 }
 function mount(){render();void reload();}
 setInterval(()=>{if(!document.hidden&&window.SEC_BRIDGE?.view?.()==="news")void reload(true);},5*60000);
 window.SEC_NEWS=Object.freeze({mount,reload,getArticles:()=>entries.slice(),getSport:()=>selectedSport(),showSchool,safeUrl});
 if(window.location?.hash==="#news")mount();
})();
