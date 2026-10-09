/* Trophy Case smoke tests: verified final games only; no DB writes and no forged awards. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const win={};
const harness={window:win,document:{head:{appendChild(){}},createElement(){return {setAttribute(){},append(){},replaceChildren(){}};},getElementById(){return null;}},console};
vm.runInNewContext(fs.readFileSync("rivalry-catalog.js","utf8"),harness,{filename:"rivalry-catalog.js"});
vm.runInNewContext(fs.readFileSync("trophy-case.js","utf8"),harness,{filename:"trophy-case.js"});
const trophy=win.SDSTrophyCase;
assert.equal(win.SDS_RIVALRIES.length,73,"full history registry is retained without deletion");
assert.equal(trophy.trophies.length,35,"35 named rivalry or trophy games are shown");
assert.equal(win.SDS_TROPHY_RIVALRIES.length,35,"titled rivalry export is stable");
assert.equal(win.SDS_RIVALRIES.filter(t=>!t.namedTrophy).length,38,"38 generic pairings stay preserved in the archive");
for(const t of trophy.trophies){
 assert.equal(t.namedTrophy,true,"Trophy Case must not include generic matchups: "+t.name);
}
assert.ok(!trophy.trophies.some(t=>t.id==="alabama-florida"),"generic pairings without named rivalry remain hidden");
assert.ok(trophy.trophies.some(t=>t.id==="beer-barrel"&&/Beer Barrel/.test(t.name)),"named Beer Barrel retained");
assert.ok(trophy.trophies.some(t=>t.id==="highway-82"&&/Highway 82/.test(t.name)),"named Highway 82 retained");

assert.equal(trophy.schools.length,16,"the 16 SEC schools each get a Trophy Case room");
assert.equal(trophy.getSelectedSchool(),"schools","Trophy Case opens on clean school directory");
const schoolNames=trophy.getSchoolOverview();
assert.equal(schoolNames.length,16,"school directory has one card per program");
const schoolLabels=Array.from(schoolNames,s=>s.name);
assert.deepEqual([...schoolLabels].sort(),schoolLabels,
 "school cards display alphabetically");
for(const school of schoolNames){
 assert.ok(school.count>0,"no SEC program omitted: "+school.name);
 assert.equal(school.count,trophy.getSchoolTrophies(school.code).length,"school count accurate");
 assert.equal(school.earned,0,"new accounts have no artificial achievements");
}
const ironBowl=trophy.trophies.find(t=>t.id==="iron-bowl");
assert.ok(trophy.getSchoolTrophies("ALA").some(t=>t.id===ironBowl.id),"Iron Bowl listed under Alabama");
assert.ok(trophy.getSchoolTrophies("AUB").some(t=>t.id===ironBowl.id),"Iron Bowl listed under Auburn");
assert.ok(trophy.getSchoolTrophies("ALA").some(t=>t.id==="highway-82"),"Highway 82 under Alabama");
assert.ok(trophy.getSchoolTrophies("MSST").some(t=>t.id==="highway-82"),"Highway 82 under Mississippi State");
assert.ok(trophy.getSchoolTrophies("SC").some(t=>t.id==="palmetto-showdown"),"Nonconference Palmetto included under South Carolina");
assert.ok(trophy.getSchoolTrophies("OU").some(t=>t.id==="bedlam"),"Historic Bedlam rivalry shown under Oklahoma");
assert.equal(trophy.getSchoolTrophies("all").length,35,"all titled rivalries accessible");
trophy.selectSchool("ALA");
assert.equal(trophy.getSelectedSchool(),"ALA","selected school persists in view");
assert.equal(trophy.getVisibleTrophies().length,trophy.getSchoolTrophies("ALA").length,"selected school filters cards");
assert.equal(trophy.getVisibleTrophies().some(t=>t.id==="iron-bowl"),true);
assert.equal(trophy.getVisibleTrophies().some(t=>t.id==="bedlam"),false,"another school's rivalry isn't shown");
trophy.selectSchool("AUB");
assert.equal(trophy.getVisibleTrophies().some(t=>t.id==="iron-bowl"),true,"both SEC rivals can see shared matchup");
trophy.selectSchool("all");
assert.equal(trophy.getVisibleTrophies().length,35,"full named collection shortcut preserves all 35");
trophy.selectSchool("schools");
assert.equal(trophy.getSelectedSchool(),"schools","back to school directory");
trophy.selectSchool("INVALID");
assert.equal(trophy.getSelectedSchool(),"schools","invalid school selection safely ignored");

assert.equal(new Set(trophy.trophies.map(t=>t.id)).size,35,"all named trophy IDs unique");
assert.equal(new Set(trophy.trophies.map(t=>[...t.codes].sort().join("/"))).size,35,"all named pairs are unique");
assert.equal(trophy.trophies.filter(t=>t.category==="SEC").length,19,"19 named intra-SEC rivalry games");
assert.equal(trophy.trophies.filter(t=>t.category==="Historic").length,1,"only titled historic non-FBS game shown");
const secSchools=new Set(["ALA","ARK","AUB","FLA","UGA","UK","LSU","MSST","MIZ","OU","MISS","SC","TENN","TEX","TAMU","VAN"]);
for(const t of trophy.trophies)for(const code of t.codes)secSchools.delete(code);
assert.equal(secSchools.size,0,"all 16 SEC schools covered by at least one rivalry");
const schedule={
 "2026-13-MSST-MISS":{id:"2026-13-MSST-MISS",away:"MSST",home:"MISS",date:"2026-11-28"},
 "2026-13-LSU-ARK":{id:"2026-13-LSU-ARK",away:"LSU",home:"ARK",date:"2026-11-28"},
 "2026-9-MIZ-ARK":{id:"2026-9-MIZ-ARK",away:"MIZ",home:"ARK",date:"2026-10-31"},
 "2026-13-LOU-UK":{id:"2026-13-LOU-UK",away:"LOU",home:"UK",date:"2026-11-28"}
};
const games=[
 {id:"2026-13-MSST-MISS",game_status:"final",winner:"MISS"},
 {id:"2026-13-LSU-ARK",game_status:"final",winner:"ARK"},
 {id:"2026-9-MIZ-ARK",game_status:"live",winner:"ARK"},
 {id:"2026-13-LOU-UK",game_status:"final",winner:null}
];
const picks={"2026-13-MSST-MISS":"MISS","2026-13-LSU-ARK":"LSU","2026-9-MIZ-ARK":"ARK","2026-13-LOU-UK":"UK"};
let result=trophy.deriveResults(games,picks,schedule,true,"league-a");
assert.equal(result.length,2,"only finished verified games that user picked");
assert.equal(result.filter(x=>x.correct).length,1,"correct award counted");
assert.equal(result.find(x=>x.trophyId==="golden-egg").correct,true);
assert.equal(result.find(x=>x.trophyId==="golden-boot").correct,false);
assert.equal(trophy.deriveResults(games,picks,schedule,false,"league-a").length,0,"signed-out picks never qualify");
assert.equal(trophy.deriveResults(games,picks,schedule,true,null).length,0,"picks without a league never qualify");
assert.equal(trophy.deriveResults(games,{},schedule,true,"league-a").length,0,"no picks gives no awards");
assert.equal(trophy.deriveResults([{id:"2026-13-MSST-MISS",game_status:"final",winner:"UK"}],picks,schedule,true,"league-a").length,0,"invalid winner cannot award");
trophy.sync({games,picks,schedule,authenticated:true,leagueId:"league-a",leagueName:"Testing Crew"});
assert.equal(trophy.getResults().length,2,"current league trophy results calculated");
trophy.sync({games,picks:{"2026-13-MSST-MISS":"MSST"},schedule,authenticated:true,leagueId:"league-b",leagueName:"Other Crew"});
assert.equal(trophy.getResults().length,1,"switch leagues clears previous results");
assert.equal(trophy.getResults()[0].correct,false,"second league result independent");
trophy.sync({authenticated:false});
assert.equal(trophy.getResults().length,0,"logout clears trophy results");
assert.throws(()=>trophy.setResults({wrong:true}),/Expected an array/);
// Each rivalry appears once regardless of who is designated as home or away.
for(const t of trophy.trophies){
 const id="2026-9-"+t.codes.join("-");
 const game={id,away:t.codes[0],home:t.codes[1],date:"2026-10-31",week:9};
 const fakeFinal={id,game_status:"final",winner:t.codes[1]};
 const one=trophy.deriveResults([fakeFinal],{[id]:t.codes[1]},{[id]:game},true,"test-league");
 assert.equal(one.length,1,"recognized rivalry pair: "+t.name);
 assert.equal(one[0].trophyId,t.id,"correct award identity: "+t.name);
 assert.equal(one[0].correct,true,"winning award: "+t.name);
 const reverse={...game,away:t.codes[1],home:t.codes[0]};
 const reverseResult=trophy.deriveResults([{...fakeFinal,winner:reverse.home}],{[id]:reverse.home},{[id]:reverse},true,"test-league");
 assert.equal(reverseResult[0].trophyId,t.id,"reversed teams recognized: "+t.name);
 assert.equal(trophy.deriveResults([{id,game_status:"live",winner:t.codes[1]}],{[id]:t.codes[1]},{[id]:game},true,"test-league").length,0,"cannot earn before final");
}
const pair=(a,b)=>trophy.trophies.find(t=>t.codes.includes(a)&&t.codes.includes(b));
assert.equal(pair("ALA","AUB").id,"iron-bowl");
assert.equal(pair("OU","TEX").id,"red-river");
assert.equal(pair("TEX","TAMU").id,"lone-star");
assert.equal(pair("SC","CLEM").nonconference,true);
assert.equal(pair("UK","LOU").nonconference,true);
assert.equal(pair("ALA","MSST").id,"highway-82");
assert.equal(pair("MIZ","KU").id,"border-war");
assert.equal(pair("OU","OKST").id,"bedlam");
assert.equal(pair("FLA","FSU").id,"sunshine-showdown");
assert.equal(pair("UGA","GT").id,"clean-old-fashioned-hate");
assert.equal(pair("TEX","TTU").id,"chancellors-spurs");
assert.equal(pair("TAMU","BAY").id,"battle-brazos");
assert.equal(pair("VAN","GT").id,"gold-cowbell");
assert.equal(pair("ALA","FLA"),undefined,"generic Alabama–Florida match hidden");
assert.equal(pair("TENN","VAN").id,"tennessee-vanderbilt","Volunteer State showdown restored");
assert.match(pair("TENN","VAN").name,/Battle for the Volunteer State/);
assert.equal(pair("FLA","TENN").id,"florida-tennessee","Third Saturday September restored");
assert.match(pair("FLA","TENN").name,/Third Saturday in September/);
assert.ok(trophy.getSchoolTrophies("VAN").some(t=>t.id==="tennessee-vanderbilt"),"Vanderbilt school shelf includes Volunteer State rivalry");
assert.ok(trophy.getSchoolTrophies("TENN").some(t=>t.id==="tennessee-vanderbilt"),"Tennessee school shelf includes Volunteer State rivalry");
assert.ok(trophy.getSchoolTrophies("FLA").some(t=>t.id==="florida-tennessee"),"Florida shelf includes September rivalry");
assert.equal(pair("TENN","VAN").model,"trophies/tennessee-vanderbilt.glb","retained existing real 3D model");
assert.equal(pair("TENN","VAN").physical,null,"does not claim an official physical trophy");
const source=fs.readFileSync("trophy-case.js","utf8");
const catalogSource=fs.readFileSync("rivalry-catalog.js","utf8");
assert.match(catalogSource,/trophies\/golden-egg\.glb/,"original 3D model paths remain in catalog");
assert.match(source,/Rivalry Week/,"rivalry quest tab exists");
assert.match(source,/sds-rivalry-search/,"archive is searchable");
assert.match(source,/SEC vs SEC/,"archive has conference filters");
assert.match(source,/if\(!t\.model\)return/,"new archive entries do not request nonexistent GLB assets");
assert.match(source,/Not scheduled this season/,"off-season rivals remain listed");
assert.match(source,/setPermanentResults/,"stored cross-season trophies are supported");
assert.match(source,/camera-controls/,"3D models can be rotated");
trophy.sync({games,picks,schedule,authenticated:true,leagueId:"league-a",leagueName:"Testing Crew",userId:"player-a"});
trophy.setPermanentResults([{trophy_id:"red-river",season:2025,correct:true,game_id:"2025-OU-TEX",pick_code:"TEX",winner_code:"TEX",league_id:"older-league"}]);
assert.equal(trophy.getResults().some(r=>r.trophyId==="red-river"&&r.year===2025&&r.correct),true,"past-season trophies persist");
assert.equal(trophy.getSchoolOverview().find(t=>t.code==="OU").earned,1,"school card earns count from permanent trophy history");
assert.equal(trophy.getSchoolOverview().find(t=>t.code==="TEX").earned,1,"shared Red River trophy correctly appears for Texas too");
trophy.selectSchool("OU");
assert.ok(trophy.getVisibleTrophies().find(t=>t.id==="red-river"),"historic earned trophy visible after selecting school");
trophy.selectSchool("schools");
trophy.sync({games,picks:{},schedule,authenticated:true,leagueId:"league-b",leagueName:"Other Crew",userId:"player-a"});
assert.equal(trophy.getResults().some(r=>r.trophyId==="red-river"&&r.year===2025),true,"earned trophies survive league switching");
trophy.sync({authenticated:false,userId:null});
assert.equal(trophy.getResults().length,0,"past-season trophies clear on sign out");

// Accordion UI regression: render actual faux DOM, not just string expectations.
assert.equal(trophy.getExpandedSchool(),"ALA","Alabama shelf opens by default, showing trophies immediately");
const alabamaPreviews=trophy.getSchoolPreview("ALA");
assert.equal(alabamaPreviews.length,3,"school cards show a row of three trophy previews");
assert.ok(alabamaPreviews.every(t=>typeof t.symbol==="string"&&t.symbol.length>0),"previews contain trophy artwork");
trophy.toggleSchool("UGA");
assert.equal(trophy.getExpandedSchool(),"UGA","another school can expand without leaving the directory");
trophy.toggleSchool("UGA");
assert.equal(trophy.getExpandedSchool(),null,"tapping expanded school collapses it");
trophy.toggleSchool("ALA");

function element(tag){
 return {tag,className:"",children:[],attrs:{},events:{},dataset:{},style:{setProperty(){}},isConnected:true,
 setAttribute(name,value){this.attrs[name]=String(value);},
 addEventListener(name,fn){this.events[name]=fn;},
 append(...items){items.forEach(item=>{if(item&&typeof item==="object")item.parent=this;});this.children.push(...items);},
 appendChild(item){if(item&&typeof item==="object")item.parent=this;this.children.push(item);},
 replaceChildren(...items){this.children=[];this.append(...items);},
 replaceWith(item){if(!this.parent)return;const at=this.parent.children.indexOf(this);if(at<0)return;item.parent=this.parent;this.parent.children.splice(at,1,item);},
 focus(){}};
}
const trophyRoot=element("section");
harness.document.createElement=element;
harness.document.getElementById=id=>id==="sds-trophy-case"?trophyRoot:descendants(trophyRoot,n=>n.id===id)[0]||null;
const descendants=(node,match)=>[...(match(node)?[node]:[]),...(node.children||[]).flatMap(child=>child&&typeof child==="object"?descendants(child,match):[])];

win.SEC_SOCIAL={renderChampionship:()=>'<div class="sec-championship-heading"><h3>League Championship</h3></div><button data-sec-social="crown" disabled>Crown 2026 Champion</button>'};
win.SEC_FEATURES={leagueAchievements:()=>'<section class="sec-honors-achievements"><h3>League Achievements</h3></section>'};
trophy.sync({games,picks,schedule,authenticated:true,leagueId:"league-a",leagueName:"Testing Crew",userId:"player-a"});
trophy.mount();
let honors=descendants(trophyRoot,n=>n.id==="sds-league-honors");
assert.equal(honors.length,1,"championship and achievements rendered once in Trophy Case");
let champ=descendants(trophyRoot,n=>n.id==="sec-championship-content");
let badges=descendants(trophyRoot,n=>n.id==="sec-achievements-content");
assert.equal(champ.length,1,"dedicated championship card near the top");
assert.equal(badges.length,1,"dedicated league achievements card near the top");
assert.match(champ[0].innerHTML,/League Championship/,"championship card displays");
assert.match(badges[0].innerHTML,/League Achievements/,"achievements card displays");
assert.ok(trophyRoot.children.indexOf(honors[0])<trophyRoot.children.findIndex(c=>c.className==="sds-school-directory"),"honors are above school collection");
const previewCount=descendants(trophyRoot,n=>n.className?.includes?.("sds-school-preview-icon")).length;
win.SEC_SOCIAL.renderChampionship=()=>'<div>Updated championship after standings refresh</div>';
trophy.refreshHonors();
champ=descendants(trophyRoot,n=>n.id==="sec-championship-content");
assert.match(champ[0].innerHTML,/Updated championship/,"async standings update refreshes honor cards");
assert.equal(descendants(trophyRoot,n=>n.className?.includes?.("sds-school-preview-icon")).length,previewCount,"honors refresh does not reset school dropdowns");
trophy.sync({authenticated:false,userId:null});
honors=descendants(trophyRoot,n=>n.id==="sds-league-honors");
assert.equal(honors.length,1,"Trophy Case keeps honor entry point for signed-out visitors");
assert.equal(descendants(honors[0],n=>n.className==="sds-honors-go-league").length,1,"sign-in call to action is available");

trophy.selectSchool("schools");
trophy.mount();
let controls=descendants(trophyRoot,n=>n.className==="sds-school-disclosure");
let previews=descendants(trophyRoot,n=>n.className.includes?.("sds-school-preview-icon"));
let panels=descendants(trophyRoot,n=>n.className==="sds-school-expanded");
assert.equal(controls.length,16,"all 16 school dropdowns render");
assert.ok(previews.length>=16,"trophy previews show without first clicking a school");
assert.equal(panels.length,1,"one full trophy shelf opens at a time");
assert.equal(controls.find(n=>n.dataset.schoolToggle==="ALA").attrs["aria-expanded"],"true","Alabama starts expanded");
assert.equal(descendants(panels[0],n=>n.className?.includes?.("sds-trophy-card")).length,trophy.getSchoolTrophies("ALA").length,"expanded inline shelf displays all of Alabama's trophies");
controls.find(n=>n.dataset.schoolToggle==="UGA").events.click();
controls=descendants(trophyRoot,n=>n.className==="sds-school-disclosure");
panels=descendants(trophyRoot,n=>n.className==="sds-school-expanded");
assert.equal(trophy.getSelectedSchool(),"schools","expanding a school does not navigate away");
assert.equal(trophy.getExpandedSchool(),"UGA");
assert.equal(panels.length,1,"only selected school is expanded");
assert.equal(descendants(panels[0],n=>n.className?.includes?.("sds-trophy-card")).length,trophy.getSchoolTrophies("UGA").length,"Georgia's trophies show inline");
controls.find(n=>n.dataset.schoolToggle==="UGA").events.click();
assert.equal(descendants(trophyRoot,n=>n.className==="sds-school-expanded").length,0,"dropdown collapses cleanly");
assert.equal(descendants(trophyRoot,n=>n.className==="sds-school-disclosure").length,16,"other schools stay visible when closed");
console.log("SEC Trophy Case: 35 named rivalry collectibles, 16 schools, preserved 73-row archive, Volunteer State and September names, verified awards and league isolation passed.");
