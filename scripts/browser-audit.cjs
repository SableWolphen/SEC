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
 let total=0,problems=[];
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
      navFits:nr.left>=-2&&nr.right<=width+2,
      navRect:{left:nr.left,right:nr.right,width:nr.width},
      overflow:[...document.querySelectorAll("body *")].filter(el=>{
        const st=getComputedStyle(el),r=el.getBoundingClientRect();
        return st.display!=="none"&&r.width>0&&r.right>width+2&&st.position!=="fixed";
      }).slice(0,7).map(el=>({tag:el.tagName,class:el.className?.baseVal||el.className||"",
        width:Math.round(el.getBoundingClientRect().width),right:Math.round(el.getBoundingClientRect().right)}))
    };
    },route);
    const prefix=viewport.width+"px "+route;
    if(!audit.active)problems.push(prefix+" selected section invisible");
    if(!audit.heading)problems.push(prefix+" missing heading");
    if(audit.pageWidth>audit.width+2)problems.push(prefix+" overflow: "+JSON.stringify(audit));
    if(audit.navCount!==6)problems.push(prefix+" missing mobile nav tabs");
    if(audit.isMobile&&!audit.navVisible)problems.push(prefix+" mobile nav hidden");
    if(audit.isMobile&&(!audit.navFits||!audit.navWithin))problems.push(prefix+" clipped nav: "+JSON.stringify(audit.navRect));
    if(!audit.isMobile&&audit.navVisible)problems.push(prefix+" mobile nav on desktop");
    await page.screenshot({path:path.join(output,viewport.width+"-"+route+".png")});
    total++;
   }
   // Confirm the *real rendered* live strip and compressed matchup layout on
   // narrow phones. This is a local browser-only fixture; no real score is
   // submitted or modified in the production database.
   await page.evaluate(()=>{
     window.SEC_BRIDGE.setView("picks");
     const a=window.SEC_BRIDGE,w=a.week();
     if(w.games[1]){w.games[1].kickoff=new Date(Date.now()+3600000).toISOString();delete a.state().picks[w.games[1].id];}
     const g=w.games[0];g.liveStatus="live";g.awayScore=14;g.homeScore=10;
     g.statusDetail="Q2 · 8:04";g.scoreUpdatedAt=new Date().toISOString();
     g.kickoff=new Date(Date.now()-4*60000).toISOString();
     window.SEC_LIVE_SCORES?.renderStatus?.();
   });
   const live=await page.evaluate(()=>{
     const strip=document.querySelector("#sec-live-score-strip"),r=strip.getBoundingClientRect();
     return {visible:!strip.hidden&&r.width>0,score:strip.textContent.includes("14"),
       next:!!strip.querySelector("[data-slate-next]"),
       compressed:document.body.classList.contains("sec-game-day-active"),
       width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
   });
   if(!live.visible||!live.score||!live.compressed||live.width>live.viewport+2)
     problems.push(viewport.width+"px live strip clipped: "+JSON.stringify(live));
   if(viewport.width<=390&&!live.next)
     problems.push(viewport.width+"px missing mobile shortcut to remaining football picks");
   await page.screenshot({path:path.join(output,viewport.width+"-gameday.png")});
   if(viewport.width<=390){
    await page.evaluate(()=>window.SEC_BRIDGE.setView("league"));
    const input=page.locator("#online-email");
    if(await input.count()){
     await input.focus();
     assert.ok(await page.evaluate(()=>getComputedStyle(document.querySelector(".bottom-nav")).display==="none"),
      viewport.width+" bottom nav must hide during keyboard entry");
    }
   }
   // Signed-in DOM fixture: no real account, no mutations, no server requests.
   // Verify league tabs separate chat and manager tools while keeping the full roster.
   await page.evaluate(()=>{
     document.activeElement?.blur?.();
     window.SEC_BRIDGE.setView("league");
     const real=window.secOnline||{},settings=window.SEC_LEAGUE_SETTINGS||{};
     window.secOnline={...real,getUser:()=>({id:"fixture-user"}),getLeague:()=>({id:"fixture-football"})};
     window.SEC_LEAGUE_SETTINGS={...settings,getSelected:()=>({kind:"football",id:"fixture-football",name:"Fixture Fans"})};
     const host=document.getElementById("league-content");
     const rows=Array.from({length:9},(_,i)=>'<div class="standing-row"><span>'+String(i+1)+
       '</span><span>Fan '+String(i+1)+'</span></div>').join("");
     host.innerHTML='<div class="fan-football-scoreboard"><div class="content-card"><h2>League scoreboard</h2>'+
       '<div class="leaderboard"><div class="standing-row head">Player</div>'+rows+'</div>'+
       '<div class="sec-scoreboard-chat"><div class="sec-chat-card"><label for="fixture-message">League chat</label>'+
       '<textarea id="fixture-message" class="field"></textarea></div></div></div>'+
       '<details class="fan-football-management"><summary>Commissioner tools</summary><button type="button">Settings</button></details>'+
       '</div><div class="fan-football-advanced"><details><summary>Account options</summary></details></div>';
     window.SEC_LEAGUE_TABS?.synchronize();
   });
   const tabChecks=await page.evaluate(()=>{
     const d=id=>document.getElementById(id);
     const board=d("league-content").querySelector(".leaderboard");
     return {tabs:!d("fan-league-tabs").hidden,scores:!d("fan-pane-scores").hidden,
       visibleRows:board.querySelectorAll(".standing-row").length,
       expander:!!d("league-content").querySelector(".fan-player-expander"),
       movedChat:!!d("fan-league-chat-content").querySelector("#fixture-message"),
       movedRules:!!d("fan-league-football-manager").querySelector(".fan-football-management"),
       movedAccount:!!d("fan-league-football-manager").querySelector(".fan-football-advanced")};
   });
   if(!tabChecks.tabs||!tabChecks.scores||tabChecks.visibleRows!==10||
      tabChecks.expander||!tabChecks.movedChat||!tabChecks.movedRules||!tabChecks.movedAccount)
     problems.push(viewport.width+"px signed-in league tabs: "+JSON.stringify(tabChecks));
   await page.locator("#fan-tab-chat").click();
   const chatOkay=await page.evaluate(()=>document.getElementById("fan-pane-scores").hidden&&
     !document.getElementById("fan-pane-chat").hidden&&!!document.getElementById("fixture-message"));
   if(!chatOkay)problems.push(viewport.width+"px cannot reach private chat tab");
   await page.locator("#fan-tab-more").click();
   const moreOkay=await page.evaluate(()=>document.getElementById("fan-pane-scores").hidden&&
     !document.getElementById("fan-pane-more").hidden&&
     !!document.getElementById("fan-league-football-manager").querySelector(".fan-football-management"));
   if(!moreOkay)problems.push(viewport.width+"px commissioner controls missing from More tab");
   await page.locator("#fan-tab-scores").click();
   const tabWidth=await page.evaluate(()=>({document:document.documentElement.scrollWidth,
     viewport:document.documentElement.clientWidth}));
   if(tabWidth.document>tabWidth.viewport+2)problems.push(viewport.width+"px signed-in league overflow "+JSON.stringify(tabWidth));
   await page.screenshot({path:path.join(output,viewport.width+"-league-tabs-fixture.png")});
   if(errors.length)console.log(viewport.width+"px nonfatal client errors:",errors.slice(0,3));
   await context.close();
  }
  console.log("Chromium SEC responsive audit completed:",total,"screens at five sizes.");
  if(problems.length)throw Error("Real viewport issues ("+problems.length+"):\n"+problems.join("\n"));
  console.log("No page overflow or navigation clipping detected.");
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});