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
const routes=["home","team-hub","game-center","results","team-news","picks","basketball","baseball","league","trophies","news","teams","settings","more"];
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
      designToken:getComputedStyle(document.documentElement).getPropertyValue("--sds-gold").trim(),
      brandColor:getComputedStyle(document.querySelector(".brand-title>span")).color,
      sectionHeader:(()=>{
       const intro=el.querySelector(":scope > .page-intro");
       return intro?{visible:getComputedStyle(intro).display!=="none",
        border:getComputedStyle(intro).borderTopColor,
        height:Math.round(intro.getBoundingClientRect().height)}:null;
      })(),
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
    if(audit.navCount!==5)problems.push(prefix+" missing mobile nav tabs");
    if(audit.isMobile&&!audit.navVisible)problems.push(prefix+" mobile nav hidden");
    if(audit.isMobile&&(!audit.navFits||!audit.navWithin))problems.push(prefix+" clipped nav: "+JSON.stringify(audit.navRect));
    if(!audit.isMobile&&audit.navVisible)problems.push(prefix+" mobile nav on desktop");
    if(audit.designToken!=="#f0c775")
     problems.push(prefix+" wrong shared broadcast color token: "+audit.designToken);
    if(audit.brandColor!=="rgb(246, 203, 121)")
     problems.push(prefix+" mismatched Saturdays Down South header accent: "+audit.brandColor);
    if(!["home","trophies","team-hub","game-center","results","team-news"].includes(route)&&
       (!audit.sectionHeader?.visible||audit.sectionHeader.height<60))
     problems.push(prefix+" missing redesigned section masthead: "+JSON.stringify(audit.sectionHeader));

    if(route==="team-hub"){
     const styled=await page.evaluate(()=>{
      window.SEC_PREMIUM?.openTeam?.("TENN");
      const tabs=[...document.querySelectorAll("#sdsx-team-root [data-sdsx-team-tab]")];
      document.querySelector('#sdsx-team-root [data-sdsx-team-tab="schedule"]')?.click();
      const schedule=!!document.querySelector('#sdsx-team-root [data-sdsx-team-tab="schedule"][aria-selected="true"]');
      const visible=!!document.querySelector('#sdsx-team-root [data-sdsx-team-panel="schedule"]:not([hidden])');
      document.querySelector('#sdsx-team-root [data-sdsx-team-tab="overview"]')?.click();
      const badge=document.querySelector('#sdsx-team-root .sds-team-brand[data-sds-school="TENN"] .sds-team-fallback')?.textContent==="TENN";
      return {count:tabs.length,schedule,visible,badge,overflow:document.documentElement.scrollWidth>innerWidth+2};
     });
     if(styled.count!==4||!styled.schedule||!styled.visible||!styled.badge||styled.overflow)
      problems.push(viewport.width+"px Team Hub approved four-tab layout issue: "+JSON.stringify(styled));
    }
    if(route==="settings"){
     const settings=await page.evaluate(()=>({
      exists:!!document.querySelector("#sds-settings-notifications .sds-notice-card"),
      optIn:!!document.querySelector("#sds-settings-notifications [data-sds-alert-master]"),
      toggles:document.querySelectorAll("#sds-settings-notifications [data-day-alert]").length,
      overflow:document.documentElement.scrollWidth>innerWidth+2
     }));
     if(!settings.exists||!settings.optIn||settings.toggles!==4||settings.overflow)
      problems.push(viewport.width+"px notification Settings issue: "+JSON.stringify(settings));
    }
    if(route==="teams"){
     const branding=await page.evaluate(()=>({
      cards:document.querySelectorAll('#teams-view .team-card').length,
      badge:document.querySelectorAll('#teams-view .team-card .sds-team-brand .sds-team-fallback').length,
      labels:[...document.querySelectorAll('#teams-view .team-card .sds-team-brand .sds-team-fallback')]
        .map(el=>el.textContent?.trim()||""),
      approved:["ALA","ARK","AUB","FLA","UGA","UK","LSU","MISS","MSST","MIZ","OU","SC","TENN","TEX","TAMU","VAN"],
      externalImages:document.querySelectorAll('img[src*="espncdn.com/i/teamlogos"]').length,
      overflow:document.documentElement.scrollWidth>innerWidth+2
     }));
     if(branding.cards!==16||branding.badge!==16||
        branding.labels.some(label=>!branding.approved.includes(label))||
        new Set(branding.labels).size!==16||
        branding.externalImages||branding.overflow)
      problems.push(viewport.width+"px 16-team plain abbreviation directory issue: "+JSON.stringify(branding));
    }
    if(["team-hub","game-center","results","team-news"].includes(route)){
     const premium=await page.evaluate(id=>{
      const root=document.getElementById("sdsx-"+(id==="team-hub"?"team":id==="game-center"?"game":id==="team-news"?"news":"results")+"-root");
      const text=root?.textContent||"";
      const cards=root?.querySelectorAll(".sdsx-section,.sdsx-team-hero,.sdsx-score-hero,.sdsx-results-hero")||[];
      const gameCenter=id==="game-center"?!!root?.querySelector(".sdsx-score-hero"):true;
      const results=id==="results"?!!root?.querySelector(".sdsx-results-list"):true;
      const alerts=id==="team-news"?!!root?.querySelector(".sdsx-alert-tiles"):true;
      const teamHub=id==="team-hub"?!!root?.querySelector(".sdsx-team-hero")||
       text.includes("Choose your SEC school"):true;
      return {exists:!!root,cardCount:cards.length,text:text.slice(0,120),
       gameCenter,results,alerts,teamHub,
       horizontal:document.documentElement.scrollWidth>innerWidth+2};
     },route);
     if(!premium.exists||!premium.gameCenter||!premium.results||!premium.alerts||
        !premium.teamHub||premium.horizontal)
      problems.push(viewport.width+"px "+route+" premium design issue: "+JSON.stringify(premium));
     if(route==="game-center"){
      const tabs=await page.evaluate(()=>{
       const tabs=[...document.querySelectorAll("#sdsx-game-root [data-sdsx-tab]")];
       const stats=tabs.find(x=>x.dataset.sdsxTab==="stats");
       stats?.click();const statsActive=!!document.querySelector('#sdsx-game-root [data-sdsx-tab="stats"][aria-selected="true"]');
       // Re-query after Game Center's intentional tab-content rerender.
       document.querySelector('#sdsx-game-root [data-sdsx-tab="plays"]')?.click();
       const playsActive=!!document.querySelector('#sdsx-game-root [data-sdsx-tab="plays"][aria-selected="true"]');
       return {count:tabs.length,statsActive,playsActive};
      });
      if(tabs.count!==4||!tabs.statsActive||!tabs.playsActive)
       problems.push(viewport.width+"px premium Game Center tabs broken: "+JSON.stringify(tabs));
     }
    }
    if(route==="home"){
     const hq=await page.evaluate(()=>{
      const root=document.getElementById("sec-home-root");
      const cards=root?.querySelectorAll(".hq-panel")||[];
      const progress=root?.querySelector(".hq-progress[role=progressbar]");
      const fake=!!root?.querySelector(".hq-demo,.hq-sample");
      const missing=!!root?.querySelector('[data-hq-route="picks"][data-hq-focus="next"]');
      return {cards:cards.length,hasProgress:!!progress,hasLeague:!!root?.querySelector(".hq-league"),
       hasSports:root?.querySelectorAll("[data-hq-route=football],[data-hq-route=basketball],[data-hq-route=baseball],[data-hq-route=picks]").length,
       fake,missing};
     });
     if(hq.cards!==4||!hq.hasProgress||!hq.hasLeague||hq.fake||hq.hasSports<3)
      problems.push(viewport.width+"px Game Day HQ missing data-backed cards: "+JSON.stringify(hq));
     const openPicks=await page.evaluate(()=>{
      document.querySelector('#sec-home-root [data-hq-route="picks"]')?.click();
      const visible=window.SEC_BRIDGE?.view?.()==="picks";
      window.SEC_BRIDGE?.setView?.("home");
      return visible;
     });
     if(!openPicks)problems.push(viewport.width+"px home pick button fails to navigate");
     const stadium=await page.evaluate(()=>{
      const hero=document.querySelector('#sec-home-root .hq-stadium-hero');
      const shortcut=[...document.querySelectorAll('#sec-home-root .hq-action')];
      const rival=document.querySelector('#sec-home-root .hq-rival-card');
      const extra=document.querySelector('#sec-home-root .hq-around-news');
      const name=hero?.textContent||'';
      return {hero:!!hero&&hero.getBoundingClientRect().height>0,
       brand:name.includes('SATURDAYS DOWN SOUTH'),
       shortcuts:shortcut.length,rival:!!rival,around:!!extra,
       bleed:document.documentElement.scrollWidth>innerWidth+2};
     });
     if(!stadium.hero||!stadium.brand||stadium.shortcuts!==7||!stadium.rival||
        !stadium.around||stadium.bleed)
      problems.push(viewport.width+"px stadium homepage regression: "+JSON.stringify(stadium));
     const discovery=await page.evaluate(()=>{
      const root=document.querySelector("#sec-home-root"),promos=root?.querySelectorAll(".hq-feature-card")||[];
      const links=[...root?.querySelectorAll(".hq-headline[href]")||[]];
      const safe=links.every(a=>a.protocol==="https:"&&
       ["www.espn.com","espn.com","www.ncaa.com","ncaa.com"].includes(a.hostname));
      const school=!!root?.querySelector('.sds-home-favorite-actions [data-hq-route="teams"], .hq-hero-alt.school-picker');
      const duplicate=!!root?.querySelector(".hq-school-spotlight");
      const picks=root?.querySelector(".hq-picks");
      const newsPanel=root?.querySelector(".hq-news-spotlight");
      const news=!!newsPanel?.querySelector('[data-hq-route="news"]');
      const picksFirst=!!picks&&!!newsPanel&&picks.getBoundingClientRect().top<=newsPanel.getBoundingClientRect().top;
      return {count:promos.length,school,duplicate,news,safe,picksFirst,headlines:links.length};
     });
     if(discovery.count!==2||!discovery.school||discovery.duplicate||!discovery.news||!discovery.safe||!discovery.picksFirst)
      problems.push(viewport.width+"px Home news/team discovery issue: "+JSON.stringify(discovery));
     if(viewport.width<=790){
      const compact=await page.evaluate(()=>{
       const root=document.getElementById("sec-home-root");
       const shown=selector=>!!document.querySelector(selector)&&
        getComputedStyle(document.querySelector(selector)).display!=="none";
       const shortcuts=[...root.querySelectorAll(".hq-action")]
        .filter(el=>getComputedStyle(el).display!=="none");
       const first=document.querySelector(".hq-stadium-hero");
       const oldScroll=scrollY;
       window.SEC_HOME.refresh();
       window.SEC_HOME.refresh();
       const stable=first===document.querySelector(".hq-stadium-hero")&&scrollY===oldScroll;
       const toggle=root.querySelector("[data-hq-expand]");
       const hidden=!shown(".hq-rival-card")&&!shown(".hq-around-news")&&!shown(".hq-quick");
       toggle?.click();
       const expanded=shown(".hq-rival-card")&&shown(".hq-around-news")&&
        toggle?.getAttribute("aria-expanded")==="true";
       toggle?.click();
       const closed=!shown(".hq-rival-card")&&toggle?.getAttribute("aria-expanded")==="false";
       const ordered=shortcuts.slice().sort((x,y)=>Number(getComputedStyle(x).order)-Number(getComputedStyle(y).order));
       const shortcutTitles=ordered.map(x=>x.querySelector("strong")?.textContent.trim()||"");
       const leagueTile=ordered[1];
       leagueTile?.click();
       const leagueLinkWorks=window.SEC_BRIDGE?.view?.()==="league";
       window.SEC_BRIDGE?.setView?.("home");
       return {shortcuts:shortcutTitles,leagueLinkWorks,
        stable,hidden,expanded,closed,toggle:!!toggle,
        horizontal:root.querySelector(".hq-actions")?.scrollWidth>
         root.querySelector(".hq-actions")?.clientWidth+3};
      });
      if(compact.shortcuts.join("|")!=="MAKE PICKS|LEAGUE RACE|LIVE SCORES|SEC NEWS"||
         !compact.leagueLinkWorks||!compact.stable||!compact.hidden||
         !compact.expanded||!compact.closed||compact.horizontal)
       problems.push(viewport.width+"px compact mobile homepage regression: "+JSON.stringify(compact));
     }

     const navSpotlights=await page.evaluate(()=>{
      const a=window.SEC_BRIDGE;
      document.querySelector('.hq-news-spotlight [data-hq-route="news"]')?.click();
      const news=a.view()==="news";
      a.setView("home");
      document.querySelector('.sds-home-favorite-actions [data-hq-route="teams"], .hq-hero-alt.school-picker')?.click();
      const teams=a.view()==="teams";
      a.setView("home");
      return {news,teams};
     });
     if(!navSpotlights.news||!navSpotlights.teams)
      problems.push(viewport.width+"px Home News/Teams shortcuts broken: "+JSON.stringify(navSpotlights));
    }
    if(route==="more"){
     const secondary=await page.evaluate(()=>[
      ...document.querySelectorAll("#more-view [data-nav]")
     ].map(e=>e.dataset.nav));
     if(secondary.join(",")!=="news,teams,settings")
      problems.push(viewport.width+"px More menu lost news, teams or settings");
     // Search, pins, accessibility and deep navigation must work on real phones,
     // not just in a Node DOM fixture. Leave account data and saved picks alone.
     const access=await page.evaluate(()=>{
      const main=window.SEC_BRIDGE,btn=document.getElementById("sec-access-trigger");
      const initial=main.view();
      btn?.click();
      const dialog=document.getElementById("sec-access-dialog"),input=document.getElementById("sec-access-search");
      const opened=Boolean(dialog?.open)&&document.activeElement===input;
      const within=dialog?.getBoundingClientRect().width<=innerWidth;
      input.value="friend challenges";
      input.dispatchEvent(new Event("input",{bubbles:true}));
      const found=Boolean(dialog.querySelector('[data-sec-jump="friend"]'));
      dialog.querySelector('[data-sec-pin="friend"]')?.click();
      const pinned=dialog.querySelector('[data-sec-pin="friend"]')?.getAttribute("aria-pressed")==="true";
      input.value="SEC news";input.dispatchEvent(new Event("input",{bubbles:true}));
      dialog.querySelector('[data-sec-jump="news"]')?.click();
      const toNews=main.view()==="news"&&!dialog.open;
      main.setView("more");
      return {initial,opened,within,found,pinned,toNews,
       directory:document.querySelectorAll("#sec-access-more .sec-access-row").length,
       mainNav:document.querySelectorAll(".bottom-nav .mobile-nav-btn").length};
     });
     if(!access.opened||!access.within||!access.found||!access.pinned||
        !access.toNews||access.directory<20||access.mainNav!==5)
      problems.push(viewport.width+"px global finder navigation issue: "+JSON.stringify(access));
    }
    if(route==="league"){
     const simple=await page.evaluate(()=>({
      duplicate:!!document.querySelector("#sec-day-league,.sec-day-league"),
      scoreboard:!!document.getElementById("league-content"),
      tabs:!!document.getElementById("fan-league-tabs")
     }));
     if(simple.duplicate||!simple.scoreboard||!simple.tabs)
      problems.push(viewport.width+"px unexpected duplicate league leaderboard: "+JSON.stringify(simple));
     const favoriteSignup=await page.evaluate(()=>{
      if(window.secOnline?.isSignedIn?.())return {skipped:true};
      const button=document.querySelector('#league-content [data-online="mode-signup"]');
      if(!button)return {skipped:true,reason:"Login not available"};
      button.click();
      const select=document.getElementById("online-signup-school");
      const schools=select?[...select.options].filter(o=>o.value).length:0;
      const skip=!!select?.querySelector('option[value=""]');
      document.querySelector('#league-content [data-online="mode-login"]')?.click();
      return {skipped:false,schools,skip};
     });
     if(!favoriteSignup.skipped&&(favoriteSignup.schools!==16||!favoriteSignup.skip))
      problems.push(viewport.width+"px signup favorite-school picker: "+JSON.stringify(favoriteSignup));
    }
    if(route==="picks"){
     const unified=await page.evaluate(()=>{
      const a=window.SEC_BRIDGE,heading=document.getElementById("picks-heading");
      const nav=document.querySelector('.bottom-nav [data-nav="current-sport"] span');
      const filters=[...document.querySelectorAll("#picks-view [data-slate-filter]")].map(x=>x.dataset.slateFilter);
      const dup=document.getElementById("hero-slot"),gameCards=document.querySelectorAll("#games-list .game-card");
      document.querySelector('[data-slate-filter="upcoming"]')?.click();
      const upcoming=[...document.querySelectorAll("#games-list .game-card")];
      document.querySelector('[data-slate-filter="all"]')?.click();
      return {title:heading?.textContent||"",nav:nav?.textContent||"",filters,
       hiddenHero:!dup?.children?.length,gameCards:gameCards.length,upcoming:upcoming.length,
       noDouble:document.getElementById("hero-slot")?.getBoundingClientRect().height===0,
       unchangedRoute:a.view()==="picks"};
     });
     if(!unified.title.includes("games.")||unified.nav!=="Games"||
       !["all","unpicked","upcoming","live","final"].every(k=>unified.filters.includes(k))||
       !unified.hiddenHero||!unified.noDouble||!unified.unchangedRoute)
      problems.push(viewport.width+"px Games unified navigation/filter issue: "+JSON.stringify(unified));
     const tidy=await page.evaluate(()=>{
      const top=document.querySelector("#weekly-score-strip .weekly-score-strip");
      const repeated=["summary-slot","fan-recap","sec-gameday-picks","sec-day-recap","fan-rivalries"]
       .map(id=>document.getElementById(id)).filter(Boolean)
       .filter(el=>getComputedStyle(el).display!=="none").map(el=>el.id);
      return {topVisible:!!top&&top.getBoundingClientRect().height>0,repeated};
     });
     if(!tidy.topVisible||tidy.repeated.length)
      problems.push(viewport.width+"px duplicate football summaries: "+JSON.stringify(tidy));

     // A future slate should be available by choice, not auto-selected.
     const manual=await page.evaluate(()=>{
      const a=window.SEC_BRIDGE,selected=a.week().num;
      const next=a.weeks.find(w=>w.num>selected);
      if(!next)return {tested:false};
      document.querySelector('#week-picker [data-week="'+next.num+'"]')?.click();
      const canChooseFuture=a.week().num===next.num;
      a.setView("league");a.setView("picks");
      const staysChosen=a.week().num===next.num;
      document.querySelector('#week-picker [data-week="'+selected+'"]')?.click();
      return {tested:true,selected,next:next.num,canChooseFuture,staysChosen,
       canReturn:a.week().num===selected};
     });
     if(manual.tested&&(!manual.canChooseFuture||!manual.staysChosen||!manual.canReturn))
      problems.push(viewport.width+"px manual early-week navigation regression: "+JSON.stringify(manual));

    }
    if(route==="trophies"){
     const museum=await page.evaluate(()=>{
      const root=document.querySelector("#sds-trophy-case");
      return {rendered:root?.classList.contains("sds-museum"),
       championships:root?.querySelectorAll(".museum-champ").length||0,
       locked:root?.querySelectorAll(".museum-champ .museum-lock").length||0,
       schools:root?.querySelectorAll("[data-museum-school]").length||0,
       medallist:!!root?.querySelector(".museum-medals"),
       openByDefault:root?.querySelectorAll('.museum-school[aria-expanded="true"]').length||0,
       cases:root?.querySelectorAll("details.legacy-case").length||0,
       summary:!!root?.querySelector(".legacy-overview"),
       achievements:root?.querySelectorAll(".legacy-achievement").length||0,
       has3DModule:typeof window.SEC_CHAMPION_3D?.enhance==="function",
       threeStages:[...root?.querySelectorAll(".museum-art[data-champion-sport]")||[]].map(el=>el.dataset.championSport),
       svgFallbacks:root?.querySelectorAll(".museum-art .museum-trophy-svg").length||0,
       duplicateBadges:root?.querySelectorAll(".museum-achieve").length||0,
       rings:root?.querySelectorAll(".legacy-ring,.legacy-rings").length||0,
       banners:root?.querySelectorAll(".legacy-banner,.legacy-banners").length||0};
     });
     if(!museum.rendered||museum.championships!==3||museum.locked!==3||
        museum.schools!==16||!museum.medallist||museum.openByDefault!==0)
      problems.push(viewport.width+"px trophy museum failed: "+JSON.stringify(museum));
     if(!museum.has3DModule||museum.threeStages.join(",")!=="football,basketball,baseball"||museum.svgFallbacks!==3)
      problems.push(viewport.width+"px 3D championship fallback/mount regression: "+JSON.stringify(museum));
     const stability=await page.evaluate(()=>{
      const view=()=>[...document.querySelectorAll('#sds-trophy-case .museum-art[data-champion-sport]')];
      const first=view();
      // Mimic server snapshots, tab visits and league refreshes without touching player data.
      for(let i=0;i<4;i++)window.SEC_TROPHY_MUSEUM.refresh();
      const next=view();
      const copied=first.length===next.length&&first.every((el,i)=>el===next[i]);
      return {before:first.map(s=>s.dataset.championSport),after:next.map(s=>s.dataset.championSport),
       sameNodes:copied,canvases:next.filter(el=>el.querySelector('.museum-champion-canvas')).length};
     });
     if(!stability.sameNodes||stability.before.length!==3)
      problems.push(viewport.width+"px trophy 3D canvas recreation on refresh: "+JSON.stringify(stability));
     if(museum.cases!==3||!museum.summary||museum.achievements<5||museum.duplicateBadges!==0||museum.rings!==0||museum.banners!==0)
      problems.push(viewport.width+"px trophy room duplicate or missing UI: "+JSON.stringify(museum));
     const archivedYears=await page.evaluate(()=>{
      const social=window.SEC_SOCIAL;
      const view=window.SEC_TROPHY_MUSEUM;
      if(!social||!view?.championshipCards)return {missing:true};
      const real=social.getChampions;
      social.getChampions=()=>[
       {league_id:"archive-test",champion_user_id:"owner-test",season:2026},
       {league_id:"archive-test",champion_user_id:"owner-test",season:2024},
       {league_id:"archive-test",champion_user_id:"owner-test",season:2026},
       {league_id:"other",champion_user_id:"owner-test",season:2025}
      ];
      try{
       const host=document.createElement("div");
       host.innerHTML=view.championshipCards(["football","basketball","baseball"],
        "owner-test",{id:"archive-test",name:"Champions Test"});
       const earned=[...host.querySelectorAll(".museum-champ.earned")];
       const locked=[...host.querySelectorAll(".museum-champ.locked")];
       return {years:earned.map(el=>el.dataset.championYear).join(","),
        keys:earned.map(el=>el.querySelector("[data-champion-key]")?.dataset.championKey).join(","),
        plaque:earned.every(el=>el.querySelector(".museum-trophy-svg")?.textContent.includes(el.dataset.championYear)),
        lockedWithoutYears:locked.every(el=>!el.querySelector("[data-champion-season]")),
        total:host.querySelectorAll(".museum-champ").length};
      }finally{social.getChampions=real;}
     });
     if(archivedYears.years!=="2026,2024"||archivedYears.keys!=="football:2026,football:2024"||
        archivedYears.plaque!==true||archivedYears.lockedWithoutYears!==true||archivedYears.total!==4)
      problems.push(viewport.width+"px engraved championship archive regression: "+JSON.stringify(archivedYears));
     const playerCase=page.locator('details[data-legacy-case="player"]');
     await playerCase.locator("summary").click();
     await page.locator('[data-legacy-achievements="earned"]').click();
     const lockedShowing=await page.locator('.legacy-case[open] .legacy-achievement.locked').count();
     if(lockedShowing)problems.push(viewport.width+"px unlocked trophy filter shows locked awards");
     await page.locator('[data-legacy-achievements="all"]').click();
     if(museum.schools===16){
      // The School case is intentionally collapsible in the new Trophy Room.
      const schoolCase=page.locator('details[data-legacy-case="school"]');
      if(await schoolCase.count())await schoolCase.locator("summary").click();
      await page.locator('[data-museum-school="ALA"]').click();
      const opened=await page.locator('#sds-trophy-case .museum-school-expanded .sds-trophy-card').count();
      if(opened<1)problems.push(viewport.width+"px Alabama trophies cannot expand");
      await page.locator('[data-museum-school="ALA"]').click();
      const closed=await page.locator('#sds-trophy-case .museum-school-expanded').count();
      if(closed)problems.push(viewport.width+"px Alabama trophies cannot collapse");
     }
    }
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
     // A published confirmed final cannot become a live match merely because
     // the visual fixture overrides the local score; opt that fixture out.
     window.__AUDIT_FINAL_DATA=window.SEC_FEATURES.finalData;
     window.SEC_FEATURES.finalData=x=>x.liveStatus==="live"?null:window.__AUDIT_FINAL_DATA(x);
     const g=w.games[0];g.liveStatus="live";g.awayScore=14;g.homeScore=10;
     g.statusDetail="Q2 · 8:04";g.scoreUpdatedAt=new Date().toISOString();
     g.kickoff=new Date(Date.now()-4*60000).toISOString();
     g.livePossessionCode=g.away;g.liveDown=2;g.liveDistance=7;
     g.liveFieldPercent=37;g.liveDriveSummary="5 plays, 24 yards";
     g.liveLastPlay="Pass for 12 yards";g.liveSituationUpdatedAt=new Date().toISOString();
     window.SEC_LIVE_SCORES?.renderStatus?.();
     window.SEC_BRIDGE.renderPicks();
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

   const oneLive=await page.evaluate(()=>{
     const id=window.SEC_BRIDGE.week().games[0].id;
     const card=[...document.querySelectorAll("#games-list .game-card")].find(el=>el.dataset.gameId===id);
     const row=card?.querySelector(".fan-center > summary");
     return {
       rendered:!!card,liveBadges:card?.querySelectorAll(".fan-center > summary .fan-live").length||0,
       phase:row?.textContent.includes("Q2 · 8:04")||false,
       score:row?.textContent.includes("14 – 10")||false,
       duplicateStatus:!!card?.querySelector(".sec-live,.sec-score-phase"),
       hasDetail:!!card?.querySelector(".fan-center-detail"),
       compactFieldVisible:(()=>{const el=card?.querySelector(".fan-center > summary .fan-field-mini");return !!el&&el.getBoundingClientRect().height>0;})(),
       compactMarker:!!card?.querySelector(".fan-center > summary .fan-football-marker"),
       hasLiveDrive:!!card?.querySelector(".fan-drive"),
       hasBall:!!card?.querySelector(".fan-drive .fan-football-marker"),
       liveText:card?.querySelector(".fan-drive")?.textContent.includes("2nd & 7")||false
     };
   });
   if(!oneLive.rendered||oneLive.liveBadges!==1||!oneLive.phase||
      !oneLive.score||oneLive.duplicateStatus||!oneLive.hasDetail||
      !oneLive.compactFieldVisible||!oneLive.compactMarker||
      !oneLive.hasLiveDrive||!oneLive.hasBall||!oneLive.liveText)
     problems.push(viewport.width+"px duplicate live game status: "+JSON.stringify(oneLive));
   await page.screenshot({path:path.join(output,viewport.width+"-gameday.png")});

   // Independently audit final-game layout (offline fixture; no private data
   // is requested from the actual database or any user's picks modified).
   await page.evaluate(()=>{
     const w=window.SEC_BRIDGE.week(),g=w.games[0];
     g.liveStatus="final";g.awayScore=6;g.homeScore=27;
     const second=w.games[1];
     if(second){second.liveStatus="final";second.awayScore=38;second.homeScore=19;}
     window.SEC_FEATURES.finalData=x=>{
      if(x.id===g.id)return {
       winner:g.home,pick:g.away,points:0,mode:"straight",
       awayScore:6,homeScore:27,spread:-4.5,cover:g.home,push:false,
       eventId:"401856716",majority:g.away,majorityCount:4,
       missed:4,total:6,awayCount:4,homeCount:2,
       reveal:Array.from({length:6},(_,i)=>({display_name:"Fan "+(i+1),
        pick_code:i<4?g.away:g.home}))
      };
      if(second&&x.id===second.id)return {
       winner:second.away,pick:second.away,points:1,mode:"straight",
       awayScore:38,homeScore:19,spread:-10.5,cover:second.away,push:false,
       eventId:"401856714",majority:second.home,majorityCount:5,
       missed:5,total:6,awayCount:1,homeCount:5,reveal:[]
      };
      return null;
     };
     window.SEC_BRIDGE.renderPicks();
   });
   const post=await page.evaluate(()=>{
     const card=document.querySelector("#games-list .sec-final-card");
     const friends=card?.querySelector(".sec-final-reveal");
     const details=card?.querySelector(".sec-final-details");
     const visible=el=>!!el&&el.getBoundingClientRect().height>0&&getComputedStyle(el).visibility!=="hidden";
     return {hasCard:!!card,winner:!!card?.querySelector(".sec-final-team.is-winner"),
      result:card?.textContent.includes("0 pts"),
      recap:!!card?.querySelector('.sec-final-recap-link[href^="https://www.espn.com/"]'),
      box:!!card?.querySelector('.sec-final-box-link[href^="https://www.espn.com/"]'),
      leagueImpact:card?.textContent.includes("4 missed their pick"),
      friendsClosed:!!friends&&!friends.open,
      detailsClosed:!!details&&!details.open,
      detailsPrompt:details?.querySelector("summary")?.textContent.includes("Game details")||false,
      visibleLost:!!card?.querySelector(".sec-final-details > summary .sec-final-pick-badge.lost"),
      visibleWon:!!document.querySelector("#games-list .sec-final-details > summary .sec-final-pick-badge.won"),
      resultHidden:!visible(card?.querySelector(".sec-final-grade")),
      linksHidden:!visible(card?.querySelector(".sec-final-actions")),
      noDuplicateScore:!card?.querySelector(".sec-final-scoreline"),
      compactHeight:Math.round(card?.getBoundingClientRect().height||0),
      width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
   });
   if(!post.hasCard||!post.winner||!post.result||!post.recap||!post.box||
      !post.leagueImpact||!post.friendsClosed||!post.detailsClosed||
      !post.detailsPrompt||!post.visibleLost||!post.visibleWon||
      !post.resultHidden||!post.linksHidden||!post.noDuplicateScore||
      post.compactHeight>210||post.width>post.viewport+2)
     problems.push(viewport.width+"px final game not compact/collapsed: "+JSON.stringify(post));

   const teamNames=await page.evaluate(()=>{
    const all=[...document.querySelectorAll("#games-list .sec-final-team-copy > strong")];
    const context=document.createElement("canvas").getContext("2d");
    return all.map(el=>{
     const style=getComputedStyle(el);
     context.font=style.font;
     const words=el.textContent.trim().split(/\s+/);
     const widest=Math.max(...words.map(word=>context.measureText(word).width));
     return {name:el.textContent,available:el.getBoundingClientRect().width,
      widest:Math.round(widest*10)/10,wrap:style.overflowWrap,break:style.wordBreak,
      scroll:el.scrollWidth,client:el.clientWidth};
    });
   });
   for(const t of teamNames){
    if(t.wrap!=="normal"||t.break!=="normal"||t.available+2<t.widest||
       t.scroll>t.client+2){
     problems.push(viewport.width+"px broken team name: "+JSON.stringify(t));
    }
   }
   // The default week rolls forward during the season. Check its current
   // actual teams rather than hard-coding two teams from a past week.
   if(teamNames.length<4||teamNames.some(x=>!x.name.trim()))
      problems.push(viewport.width+"px current-week team names missing: "+JSON.stringify(teamNames));

   // The user can choose to see everything, and score refreshes must not
   // unexpectedly collapse the game they've just opened.
   const detailToggle=page.locator("#games-list .sec-final-card .sec-final-details > summary").first();
   await detailToggle.click();
   const opened=await page.evaluate(()=>{
    const box=document.querySelector("#games-list .sec-final-card .sec-final-details");
    const grade=box?.querySelector(".sec-final-grade");
    return {open:!!box?.open,gradeHeight:Math.round(grade?.getBoundingClientRect().height||0)};
   });
   if(!opened.open||opened.gradeHeight===0)
      problems.push(viewport.width+"px final Game details do not open: "+JSON.stringify(opened));
   await page.evaluate(()=>window.SEC_BRIDGE.renderPicks());
   const keptOpen=await page.evaluate(()=>document.querySelector(
     "#games-list .sec-final-card .sec-final-details")?.open);
   if(!keptOpen)
      problems.push(viewport.width+"px score rerender unexpectedly collapsed opened final details");

   const friendToggle=page.locator("#games-list .sec-final-card .sec-final-reveal > summary").first();
   if(await friendToggle.count()){
     await friendToggle.click();
     const expanded=await page.evaluate(()=>document.querySelector(
       "#games-list .sec-final-card .sec-final-reveal")?.open);
     if(!expanded)problems.push(viewport.width+"px cannot reveal post-kickoff friend picks");
   }
   await page.screenshot({path:path.join(output,viewport.width+"-final-game.png")});
   await page.evaluate(()=>{
    window.SEC_FEATURES.finalData=window.__AUDIT_FINAL_DATA;
    delete window.__AUDIT_FINAL_DATA;
   });

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