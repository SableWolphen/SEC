/* Fast startup: install only the offline shell, not dozens of concurrent resources.
   Navigation and dynamic data remain network-first; versioned static assets are
   served from cache immediately and fetched once on first use. */
const CACHE="sec-pickem-v118";
const CORE=["./index.html","./manifest.webmanifest","./icon.svg"];
const scopePath=new URL(self.registration.scope).pathname;
self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.allSettled(CORE.map(url=>cache.add(url)));
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
 if(req.method!=="GET")return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(scopePath))return;
 const isPage=req.mode==="navigate"||url.pathname.endsWith("/index.html")||url.pathname===scopePath;
 const isData=/\.(json)$/i.test(url.pathname);
 const isStatic=/\.(js|css|svg|png|jpg|jpeg|webp|woff2?|webmanifest)$/i.test(url.pathname);
 if(!isPage&&!isData&&!isStatic)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(isPage||isData){
   try{
    const response=await fetch(req);
    if(response.ok)void cache.put(req,response.clone()).catch(()=>{});
    return response;
   }catch(_){return (await cache.match(req))||(isPage?await cache.match("./index.html"):null)||Response.error();}
  }
  const cached=await cache.match(req);
  if(cached)return cached;
  try{
   const response=await fetch(req);
   if(response.ok)void cache.put(req,response.clone()).catch(()=>{});
   return response;
  }catch(_){return Response.error();}
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
