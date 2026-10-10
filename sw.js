/* Network-first: fresh schedules and online features should not be frozen by old caches. */
const CACHE="sec-pickem-v51";
const CORE=["./","./index.html","./config.js","./rivalry-catalog.js?v=20261009-named-35","./trophy-case.js?v=20261009-volunteer-state-v1","./league-features.js?v=20261009-isolation-v2","./league-social.js?v=20261010-community-v1","./multiplayer.js?v=20261010-pride-fix-v1","./sec-recaps.js?v=20261010-recaps-v1","./sec-news.js?v=20261010-recaps-v1","./news.json","./matchup-stats.js?v=20261010-community-v1","./team-records.js?v=20261009-officialsources-v8","./team-records.json","./fan-experience.js?v=20261010-shockwave-v1","./sec-live-scores.js?v=20261010-shockwave-v1","./sec-brackets.js?v=20261009-perleague-bracket-v3","./league-settings.js?v=20261010-pride-fix-v1","./league-tabs.js?v=20261010-pride-fix-v1","./sec-pride.js?v=20261010-pride-fix-v1","./sec-brags.js?v=20261010-community-v1","./sec-league-insights.js?v=20261010-shockwave-v1","./sec-game-community.js?v=20261010-shockwave-v1","./sec-power-rankings.js?v=20261010-shockwave-v1","./stats.json","./multi-sport.js?v=20261010-pride-fix-v1","./multi-sport.css?v=20261010-community-v2","./sports-schedules.json","./baseball-2027-series.json","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.all(CORE.map(async url=>{try{await cache.add(url);}catch(e){console.warn("Could not pre-cache",url,e);}}));
  await self.skipWaiting();
 })());
});
self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(n=>n!==CACHE&&n.startsWith("sec-pickem-")).map(n=>caches.delete(n)));
  await self.clients.claim();
 })());
});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const res=await fetch(req);if(res.ok&&new URL(req.url).pathname.startsWith(new URL(self.registration.scope).pathname))await cache.put(req,res.clone());return res;}
  catch(e){return (await cache.match(req))||Response.error();}
 })());
});