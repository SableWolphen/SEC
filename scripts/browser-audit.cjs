"use strict";
/* Real Chromium browser audit at desktop and phone sizes, for anonymous visitors.
   Never creates accounts, submits picks or writes player data. */
const {chromium}=require("playwright");
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const base=process.env.SEC_BROWSER_URL||"http://127.0.0.1:8765/";
const sizes=[{width:320,height:690},{width:360,height:780},{width:390,height:844},
 {width:768,height:1024},{width:1280,height:850}];
const routes=["picks","basketball","baseball","league","trophies","news","teams","settings"];
const output=path.resolve("artifacts/sec-browser-audit");
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 let total=0;
 try{
  for(const viewport of sizes){
   const context=await browser.newContext({viewport,deviceScaleFactor:1,
    reducedMotion:"reduce",serviceWorkers:"block",isMobile:viewport.width<=390,
    hasTouch:viewport.width<=390});
   const page=await context.newPage(),errors=[];
   page.on("pageerror",err=>errors.push(err.message));
   await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});
   await page.waitForFunction(()=>Boolean(window.SEC_BRIDGE&&window.SEC_BRIDGE.setView),{timeout:15000});
   for(const route of routes){
    await page.evaluate(id=>window.SEC_BRIDGE.setView(id),route);
    await page.waitForTimeout(160);
    const audit=await page.evaluate(id=>{
     const el=document.getElementById(id+"-view");
     const buttons=[...document.querySelectorAll(".bottom-nav .mobile-nav-btn")];
     const nav=document.querySelector(".bottom-nav");
     const width=document.documentElement.clientWidth,isMobile=width<=790;
     const nr=nav.getBoundingClientRect();
     return {route:id,width,pageWidth:document.documentElement.scrollWidth,
      active:!el.classList.contains("hidden")&&el.getBoundingClientRect().width>0,
      heading:!!el.querySelector("h1"),navCount:buttons.length,
      navVisible:getComputedStyle(nav).display!=="none",isMobile,
      navWithin:buttons.every(x=>{const r=x.getBoundingClientRect();return r.left>=-2&&r.right<=width+2&&r.width>16}),
      navFits:nr.left>=-2&&nr.right<=width+2};
    },route);
    const prefix=viewport.width+"px "+route;
    assert.ok(audit.active,prefix+" selected section is invisible");
    assert.ok(audit.heading,prefix+" missing a heading");
    assert.ok(audit.pageWidth<=audit.width+3,prefix+" horizontal page overflow: "+JSON.stringify(audit));
    assert.equal(audit.navCount,6,prefix+" all navigation tabs present");
    if(audit.isMobile)assert.ok(audit.navVisible&&audit.navFits&&audit.navWithin,
      prefix+" mobile navigation clipped: "+JSON.stringify(audit));
    else assert.equal(audit.navVisible,false,prefix+" desktop should not have mobile nav");
    await page.screenshot({path:path.join(output,viewport.width+"-"+route+".png")});
    total++;
   }
   if(viewport.width<=390){
    await page.evaluate(()=>window.SEC_BRIDGE.setView("league"));
    const input=page.locator("#online-email");
    if(await input.count()){
     await input.focus();
     assert.ok(await page.evaluate(()=>getComputedStyle(document.querySelector(".bottom-nav")).display==="none"),
      viewport.width+" bottom nav must hide during keyboard entry");
    }
   }
   if(errors.length)console.log(viewport.width+"px nonfatal client errors:",errors.slice(0,3));
   await context.close();
  }
  console.log("Chromium SEC responsive audit passed:",total,"screens across eight pages, 320–1280px.");
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});