/* Network-first: fresh schedules and online features should not be frozen by old caches. */
const CACHE="sec-pickem-v91";
const CORE=["./","./index.html","./config.js","./rivalry-catalog.js?v=20261009-named-35","./trophy-museum.js?v=20261011-engraved-v1","./sec-champion-3d.js?v=20261011-engraved-v1","./sec-champion-3d.css?v=20261011-cinematic-v1","./sec-trophy-legacy.js?v=20261011-trophy-room-v2","./sec-trophy-legacy.css?v=20261011-trophy-room-v2","./trophy-museum.css?v=20261010-museum-v1","./trophy-case.js?v=20261011-stable-v2","./league-features.js?v=20261010-final-v1","./league-social.js?v=20261010-museum-v1","./multiplayer.js?v=20261011-school-v2","./sec-recaps.js?v=20261010-recaps-v1","./sec-news.js?v=20261011-school-v2","./news.json","./matchup-stats.js?v=20261010-community-v1","./team-records.js?v=20261009-officialsources-v8","./team-records.json","./sec-live-drive.js?v=20261010-field-visible-v2","./fan-experience.js?v=20261010-field-visible-v2","./sec-live-scores.js?v=20261011-hq-v1","./sec-brackets.js?v=20261009-perleague-bracket-v3","./league-settings.js?v=20261010-competition-v1","./league-tabs.js?v=20261010-standings-only-v1","./sec-competitive-tools.js?v=20261010-path-fixed-v4","./sec-pride.js?v=20261011-school-v2","./sec-brags.js?v=20261010-showcase-v1","./sec-bragging-arena.js?v=20261010-gameday-v1","./sec-gameday.js?v=20261010-standings-only-v1","./sec-league-insights.js?v=20261010-showcase-v1","./sec-game-community.js?v=20261010-calm-v2","./sec-power-rankings.js?v=20261010-standings-only-v1","./stats.json","./multi-sport.js?v=20261010-compact-score-v1","./multi-sport.css?v=20261011-hq-v1","./sec-final-cards.css?v=20261010-pick-result-v5","./sec-final-cards.js?v=20261010-pick-result-v4","./sports-schedules.json","./baseball-2027-series.json","./manifest.webmanifest","./icon.svg","./home-stadium.svg","./sec-home.js?v=20261011-mobile-calm-v4","./sec-home.css?v=20261011-mobile-calm-v4"];
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