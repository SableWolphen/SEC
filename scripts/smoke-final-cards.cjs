"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const g={id:"2026-6-TAMU-MIZ",away:"TAMU",home:"MIZ",date:"2026-10-10",
 network:"ABC"};
const d={winner:"MIZ",pick:"TAMU",points:0,mode:"straight",
 awayScore:6,homeScore:27,spread:-4.5,spreadSource:"ESPN",
 cover:"MIZ",push:false,eventId:"401856716",
 total:6,awayCount:4,homeCount:2,missed:4,majority:"TAMU",majorityCount:4,
 reveal:[{display_name:"A",pick_code:"TAMU"},{display_name:"B",pick_code:"MIZ"}]};
const win={SEC_BRIDGE:{view:()=>"league"},SEC_FEATURES:{finalData:()=>d},SEC_STATS:{pickContext:()=>""}};
vm.runInNewContext(fs.readFileSync("sec-final-cards.js","utf8"),{window:win});
const ctx={team:id=>({name:id==="TAMU"?"Texas A&M":"Missouri",nick:id==="TAMU"?"Aggies":"Tigers"}),
 logo:id=>'<span class="mini-logo">'+id+'</span>',
 displayDate:()=>"Oct 10",gameTime:()=>"11:00 AM CT",weekDate:"2026-10-10"};
const markup=win.SEC_FINAL_CARDS.render(g,0,ctx);
assert.match(markup,/class="game-card sec-final-card"/);
assert.match(markup,/Missouri/);
assert.match(markup,/class="sec-final-team is-winner"/,"winner receives highlight without a giant badge");
assert.match(markup,/scored 6/);
assert.match(markup,/scored 27/);
assert.match(markup,/✓ FINAL/);
assert.match(markup,/Texas A&amp;M/);
assert.match(markup,/0 pts/);
assert.match(markup,/<details class="sec-final-details" data-game-id="2026-6-TAMU-MIZ">\s*<summary>/,
 "final games display the score; all extra content starts collapsed");
assert.match(markup,/<summary><span>Game details<\/span>/,
 "one optional expander replaces tall postgame panels");
assert.ok(markup.indexOf('Game details')<markup.indexOf('YOUR PICK'),
 "personal pick is hidden inside game details");
assert.ok(markup.indexOf('Game details')<markup.indexOf('View Box Score'),
 "box score link is hidden inside game details");
assert.doesNotMatch(markup,/class="sec-final-scoreline"/,"no duplicate final score row");
assert.match(markup,/4 of 6 picked TAMU/);
assert.match(markup,/4 missed their pick/);
assert.doesNotMatch(markup,/5 lost their pick|0 leading picks|Watch ABC/);
assert.match(markup,/<details class="sec-final-reveal"><summary>/,
 "friends must be closed by default and expand natively");
assert.match(markup,/TAMU: 4 \(67%\)/);
assert.match(markup,/MIZ: 2 \(33%\)/);
assert.match(markup,/game\/_\/gameId\/401856716/);
assert.match(markup,/boxscore\/_\/gameId\/401856716/);
assert.match(markup,/rel="noopener noreferrer"/);
assert.match(markup,/View Box Score/);
win.SEC_FEATURES.finalData=()=>({...d,pick:"MIZ",points:1});
assert.match(win.SEC_FINAL_CARDS.render(g,1,ctx),/1 pts/,"points reflect game mode returned by official scoring");
win.SEC_FEATURES.finalData=()=>({...d,eventId:"javascript:alert(1)"});
const withoutUrl=win.SEC_FINAL_CARDS.render(g,1,ctx);
assert.doesNotMatch(withoutUrl,/href="javascript:/);
assert.match(withoutUrl,/aria-disabled="true"/);
win.SEC_FEATURES.finalData=()=>null;
assert.equal(win.SEC_FINAL_CARDS.render(g,1,ctx),"","unverified results keep existing score UI");
const main=fs.readFileSync("index.html","utf8");
assert.match(main,/SEC_FINAL_CARDS\?\.render/);
assert.match(main,/sec-final-cards.css\?v=/);
assert.match(main,/sec-final-cards.js\?v=/);
const features=fs.readFileSync("league-features.js","utf8");
assert.match(features,/function finalData/);
assert.match(features,/Date\.now\(\)>=kickoff/,"revealed picks only after kickoff");
assert.match(features,/winner===g\.away&&Number\(away\)<=Number\(home\)/,
 "winner badge requires score agreeing with result");
const live=fs.readFileSync("sec-live-scores.js","utf8");
assert.match(live,/espn_event_id/,"recap actions require verified ESPN event IDs");
// Rebuilding the picks list while scores refresh keeps intentionally-open details open.
const oldCard={dataset:{gameId:g.id},querySelector:q=>q===".sec-final-details"?{open:true}:null};
const doc={querySelectorAll:()=>[oldCard]};
const alternate={SEC_BRIDGE:{view:()=>"league"},SEC_FEATURES:{finalData:()=>d},SEC_STATS:{pickContext:()=>""}};
vm.runInNewContext(fs.readFileSync("sec-final-cards.js","utf8"),{window:alternate,document:doc});
assert.match(alternate.SEC_FINAL_CARDS.render(g,0,ctx),/data-game-id="2026-6-TAMU-MIZ" open>/,
 "expanded game details stay open across score re-renders");
console.log("Final matchup design passed: score-only closed games, optional results, real winners/points, ESPN links and safe rerenders.");
