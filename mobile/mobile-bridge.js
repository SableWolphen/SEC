/* Runs only in native Capacitor builds, never on GitHub Pages. */
(()=>{
 "use strict";
 const isNative=()=>window.Capacitor?.isNativePlatform?.()===true;
 let initialized=false;
 function start(){
  if(initialized||!isNative())return;
  initialized=true;
  document.documentElement.classList.add("sec-native-app");
  // Native snapshots ship as offline fallbacks. Refresh current schedules,
  // score feeds and news JSON from the same trusted public SEC website.
  // No JS/HTML is remotely executed: store releases update executable code.
  const dynamic=new Set(["news.json","sports-schedules.json","stats.json",
   "team-records.json","baseball-2027-series.json"]);
  const firstParty=new URL("https://sablewolphen.github.io/SEC/");
  const localFetch=window.fetch.bind(window);
  window.fetch=(resource,init)=>{
   const raw=typeof resource==="string"||resource instanceof URL?
    String(resource):resource?.url;
   if(!raw||init?.method&&init.method.toUpperCase()!=="GET")return localFetch(resource,init);
   let url;try{url=new URL(raw,location.href);}catch{return localFetch(resource,init);}
   const parts=url.pathname.split("/");
   const filename=parts[parts.length-1];
   if(url.origin!==location.origin||!dynamic.has(filename))return localFetch(resource,init);
   const remote=new URL(filename,firstParty);
   remote.search=url.search;
   return localFetch(remote.toString(),{...init,mode:"cors",credentials:"omit"})
    .then(r=>{if(!r.ok)throw Error("Live data HTTP "+r.status);return r;})
    .catch(()=>localFetch(resource,init));
  };
  document.addEventListener("click",event=>{
   if(!event.target?.closest?.("[data-pick],[data-team],[data-sport-tab]"))return;
   try{window.Capacitor?.Plugins?.Haptics?.impact?.({style:"Light"})?.catch?.(()=>{});}catch{}
  },{passive:true});
 }
 if(isNative())start();
 else document.addEventListener("DOMContentLoaded",start,{once:true});
})();
