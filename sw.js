/* Network-first: fresh schedules and online features should not be frozen by old caches. */
const CACHE="sec-pickem-v114";
const CORE=["./","./index.html","./config.js","./sec-game-impact.js?v=20261013-impact-v1","./sec-game-impact.css?v=20261013-impact-v1","./sec-fan-moments.js?v=20261015-savage-v1","./sec-fan-moments.css?v=20261014-fun-v2","./sec-screen-consistency.css?v=20261014-ui-continuity-v3","./sec-athlete-awards.json","./rivalry-catalog.js?v=20261009-named-35","./trophy-museum.js?v=20261011-neutral-v1","./sec-champion-3d.js?v=20261011-engraved-v1","./sec-champion-3d.css?v=20261011-cinematic-v1","./sec-trophy-legacy.js?v=20261011-trophy-room-v2","./sec-trophy-legacy.css?v=20261011-trophy-room-v2","./trophy-museum.css?v=20261010-museum-v1","./trophy-case.js?v=20261011-neutral-v1","./league-features.js?v=20261010-final-v1","./league-social.js?v=20261010-museum-v1","./multiplayer.js?v=20261014-auth-v3","./sec-recaps.js?v=20261010-recaps-v1","./sec-news.js?v=20261011-premium-v3","./news.json","./sec-rankings.js?v=20261011-premium-v2","./rankings.json","./sec-rankings.css?v=20261011-national-polls-v1","./matchup-stats.js?v=20261011-national-polls-v1","./team-records.js?v=20261011-premium-v2","./team-records.json","./sec-live-drive.js?v=20261010-field-visible-v2","./fan-experience.js?v=20261010-field-visible-v2","./sec-live-scores.js?v=20261011-premium-v2","./sec-brackets.js?v=20261009-perleague-bracket-v3","./league-settings.js?v=20261010-competition-v1","./league-tabs.js?v=20261010-standings-only-v1","./sec-competitive-tools.js?v=20261010-path-fixed-v4","./sec-pride.js?v=20261011-team-colors-v2","./sec-brags.js?v=20261010-showcase-v1","./sec-bragging-arena.js?v=20261010-gameday-v1","./sec-gameday.js?v=20261010-standings-only-v1","./sec-league-insights.js?v=20261010-showcase-v1","./sec-game-community.js?v=20261010-calm-v2","./sec-power-rankings.js?v=20261010-standings-only-v1","./stats.json","./multi-sport.js?v=20261011-team-colors-v2","./multi-sport.css?v=20261011-broadcast-v1","./sec-final-cards.css?v=20261011-broadcast-v1","./sec-final-cards.js?v=20261010-pick-result-v4","./sports-schedules.json","./baseball-2027-series.json","./manifest.webmanifest","./icon.svg","./sec-design-system.css?v=20261011-broadcast-v1","./home-stadium.svg","./sec-premium.js?v=20261011-unified-v2","./sec-premium.css?v=20261011-mockups-v1","./sec-home.js?v=20261011-unified-v2","./sds-showcase.css?v=20261011-unified-v2","./sds-showcase-visuals.js?v=20261011-team-colors-v2","./sds-showcase-preferences.js?v=20261011-ten-screens-v1","./sec-home.css?v=20261011-single-school-v1","./sec-next.js?v=20261014-recent-v1","./sec-next.css?v=20261012-advanced-v1","./sec-access.js?v=20261012-access-v1","./sec-access.css?v=20261012-access-v1","./sec-games.css?v=20261012-unified-v1","./sec-play-by-play.css?v=20261012-plays-v1","./sec-play-by-play.js?v=20261012-plays-v1","./sec-feel.css?v=20261012-feel-v1","./sec-app-v2.css?v=20261012-app-v2","./sec-mobile-fix.css?v=20261012-mobile-v1","./sec-ux-v3.css?v=20261012-context-v1","./sec-broadcast-finish.css?v=20261012-studio-v1"];
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
/* Real Web Push: displays only source-verified, generic data supplied by the
   authenticated push service. No other member's picks or scores are inferred. */
self.addEventListener("push",event=>{
 event.waitUntil((async()=>{
  let p={};try{p=event.data?.json()||{}}catch(_){p={};}
  const title=typeof p.title==="string"?p.title.slice(0,70):"SEC Pick’em update";
  const body=typeof p.body==="string"?p.body.slice(0,160):"Open Saturdays Down South for the latest verified update.";
  const valid=new Set(["home","picks","league","results","game-center","team-hub"]);
  const route=valid.has(p.route)?p.route:"home";
  await self.registration.showNotification(title,{
   body,icon:"./icon.svg",badge:"./icon.svg",tag:typeof p.tag==="string"?p.tag.slice(0,70):"sec-event",
   data:{route},renotify:false
  });
 })());
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const route=event.notification.data?.route||"home";
 event.waitUntil((async()=>{
  const path=new URL("./index.html#"+route,self.registration.scope).href;
  const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const page=windows.find(w=>w.url.startsWith(self.registration.scope));
  if(page){await page.navigate(path);return page.focus();}
  return self.clients.openWindow(path);
 })());
});
