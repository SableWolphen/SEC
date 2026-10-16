"use strict";
/* Read-only browser audit. Account and league scenarios use in-memory fixtures;
   no user accounts, picks, messages or championships are written to a server. */
const {chromium}=require("playwright"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const base=process.env.SEC_BROWSER_URL||"http://127.0.0.1:8765/";
const output=path.resolve("artifacts/clean-connected");fs.mkdirSync(output,{recursive:true});
const routes=["home","picks","basketball","baseball","league","game-center","news","trophies","more","settings"];
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SEC_BROWSER_CHANNEL?{channel:process.env.SEC_BROWSER_CHANNEL}:{})});
 let checked=0;
 try{
  for(const width of [320,390,768,1024,1280]){
   const context=await browser.newContext({viewport:{width,height:988},serviceWorkers:"block",reducedMotion:"reduce"});
   const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(base);await page.waitForFunction(()=>window.SEC_CLEAN&&window.SEC_LEAGUE_TABS);
   for(const route of routes){
    await page.evaluate(v=>window.SEC_BRIDGE.setView(v),route);
    await page.waitForTimeout(100);
    const layout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,
     visible:[...document.querySelectorAll('main>.view')].filter(e=>getComputedStyle(e).display!=="none").map(e=>e.id)}));
    assert.deepEqual(layout.visible,[route+"-view"],width+"px visible route "+route);
    assert.ok(layout.width<=layout.viewport+1,width+"px "+route+" overflows: "+layout.width);
    if([390,1280].includes(width))await page.screenshot({path:path.join(output,width+"-"+route+".png")});
    checked++;
   }
   const nav=width<=790?".bottom-nav":".desktop-nav";
   await page.locator(nav+' [data-nav="more"]').click();
   assert.equal(await page.evaluate(()=>window.SEC_BRIDGE.view()),"more");
   assert.equal(await page.locator("#more-view .v3-shortcut-grid button").count(),6);
   await page.locator("#more-view .v3-shortcut-grid [data-sec-jump=trophies]").click();
   await page.waitForFunction(()=>document.querySelector('.v3-collection-filters'));
   await page.getByRole("navigation",{name:"Browse trophy collection"}).getByRole("button",{name:"Badges",exact:true}).click();
   assert.equal(await page.locator('[data-legacy-case=school]').isVisible(),false);
   await page.getByRole("navigation",{name:"Browse trophy collection"}).getByRole("button",{name:"Rivalries",exact:true}).click();
   assert.equal(await page.locator('[data-legacy-case=school]').isVisible(),true);
   await page.locator("#trophies-view .v3-back").click();
   await page.locator("#sec-access-trigger").click();
   await page.locator("#sec-access-search").fill("scores");
   await page.locator('#sec-access-results [data-sec-jump="scores"]').click();
   assert.equal(await page.evaluate(()=>window.SEC_BRIDGE.view()),"game-center");
   assert.equal(await page.locator("#sec-access-dialog").evaluate(e=>e.open),false);
   await page.locator('[data-v3-score-filter="live"]').click();
   assert.equal(await page.locator('[data-v3-score-filter="live"]').getAttribute("aria-pressed"),"true");
   await page.locator('[data-v3-score-filter="all"]').click();
   const game=page.locator('[data-v3-game]').first();
   if(await game.count()){await game.click();assert.equal(await page.locator('#v3-score-detail').evaluate(e=>e.open),true);}
   // Sport selection stays reachable on every pick screen and the Picks tab
   // returns to the last selected sport rather than silently selecting football.
   await page.evaluate(()=>window.SEC_BRIDGE.setView("basketball"));
   await page.locator('#global-sport-switch [data-sport-tab="baseball"]').click();
   await page.locator(nav+' [data-nav="home"]').click();
   await page.locator(nav+' [data-nav="current-sport"]').click();
   assert.equal(await page.evaluate(()=>window.SEC_BRIDGE.view()),"baseball");
   // Fixture league switch: actual tab/relocation code, mocked account services.
   await page.evaluate(async()=>{window.SEC_BRIDGE.setView("league");await window.SEC_LEAGUE_SETTINGS.onView();});
   await page.evaluate(()=>{
    const leagues=[{id:"fixture-a",kind:"football",name:"Saturday Crew"},{id:"fixture-b",kind:"football",name:"Work League"},{id:"club-c",kind:"club",name:"All Sports",sports:["football","basketball"],detail:{football_league:"fixture-c"}}];
    let selected=leagues[0];
    window.__V3_WRITES=0;
    window.secOnline={configured:true,getUser:()=>({id:"fixture-user"}),getLeague:()=>({id:selected.detail?.football_league||selected.id}),getLeagues:()=>[...leagues,{id:"fixture-c",name:"All Sports"}],
     getStandings:()=>[],getClient:()=>null,renderLeague:()=>render()};
    window.SEC_LEAGUE_SETTINGS={getSelected:()=>selected,getLeagues:()=>leagues,getStandings:()=>[],load:async()=>{},onView:async()=>{},
     choose:async key=>{selected=leagues.find(l=>key===l.kind+':'+l.id);render();}};
    function render(){
     document.getElementById('fan-league-choice').innerHTML='<section class="fan-league-summary"><label for="v3-fixture-select">Current league</label><select id="v3-fixture-select">'+leagues.map(l=>'<option value="'+l.id+'" '+(l.id===selected.id?'selected':'')+'>'+l.name+'</option>').join('')+'</select></section>';
     document.getElementById('league-content').innerHTML='<div class="content-card"><h2>'+selected.name+' standings</h2><div class="sec-scoreboard-chat"><div class="sec-chat-card"><h3>'+selected.name+' · League Chat</h3><p id="v3-fixture-message">Private message for '+selected.id+'</p><label for="v3-fixture-input">Message '+selected.name+'</label><textarea class="sec-chat-input" id="v3-fixture-input"></textarea></div></div></div>';
     window.SEC_LEAGUE_TABS.synchronize();
    }
    document.addEventListener('change',e=>{if(e.target.id==='v3-fixture-select')void window.SEC_LEAGUE_SETTINGS.choose('football:'+e.target.value);});
    render();
   });
   await page.locator('#fan-tab-chat').click();
   await page.locator('#v3-fixture-select').selectOption('fixture-b');
   await page.waitForFunction(()=>document.querySelector('#fan-tab-chat').getAttribute('aria-selected')==='true');
   assert.match(await page.locator('#fan-league-chat-content').innerText(),/fixture-b/);
   assert.doesNotMatch(await page.locator('#fan-league-chat-content').innerText(),/fixture-a/);
   await page.evaluate(()=>window.SEC_LEAGUE_TABS.openChat('fixture-a'));
   assert.equal(await page.locator('#fan-tab-chat').getAttribute('aria-selected'),"true");
   assert.match(await page.locator('#fan-league-chat-content').innerText(),/fixture-a/);
   await page.evaluate(()=>window.SEC_LEAGUE_TABS.openChat("fixture-c"));
   assert.equal(await page.locator("#fan-tab-chat").getAttribute("aria-selected"),"true");
   assert.match(await page.locator("#fan-league-chat-content").innerText(),/club-c/);
   assert.equal(await page.evaluate(()=>window.__V3_WRITES),0);
   if([390,1280].includes(width))await page.screenshot({path:path.join(output,width+"-league-member.png")});
   assert.deepEqual(errors,[],width+"px browser errors");
   await context.close();
  }
  console.log("PASS: "+checked+" responsive screens; five-tab navigation, Find, sport switching, score filters/details, trophy filters, private chat switching and Home chat deep link.");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

