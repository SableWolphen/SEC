/* Network-first: fresh schedules and online features should not be frozen by old caches. */
const CACHE="sec-pickem-v16";
const CORE=["./","./index.html","./config.js","./rivalry-catalog.js?v=20261009-named-33","./trophy-case.js?v=20261009-accordion-preview-v1","./league-features.js?v=20261009-picks-tiebreaker","./league-social.js?v=20261009-social-v2","./multiplayer.js?v=20261009-picks-tiebreaker","./matchup-stats.js","./stats.json","./manifest.webmanifest","./icon.svg"];
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