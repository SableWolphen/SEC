"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8");
const sport=fs.readFileSync("multi-sport.js","utf8");
const teamSource=html.slice(html.indexOf("  function validGameScore("),html.indexOf("  // Editorial fallback for weeks"));
assert.ok(teamSource.includes("function makeTeamButton"),"Football team renderer found");
const football={state:{picks:{},results:{}},window:{SEC_STATS:{pickContext:()=>""}},
 team:id=>({name:id==="TAMU"?"Texas A&M":"Missouri",nick:id==="TAMU"?"Aggies":"Tigers"}),
 logo:id=>`<b>${id}</b>`,esc:x=>String(x),selected:()=>false,isLocked:()=>true};
vm.runInNewContext(teamSource+"\nthis.showTeam=makeTeamButton;",football);
const game={id:"TAMU-MIZ",away:"TAMU",home:"MIZ",liveStatus:"live",awayScore:17,homeScore:24};
let a=football.showTeam(game,"TAMU"),b=football.showTeam(game,"MIZ");
assert.match(a,/pick-team-score[^>]*>17<\/span>/);
assert.match(b,/pick-team-score is-leading[^>]*>24<\/span>/);
assert.match(a,/select-mark/,"score does not remove pick indicator");
assert.match(football.showTeam(game,"TAMU",true),/pick-team-score[^>]*>17<\/span>/,"featured game has score");
assert.doesNotMatch(football.showTeam({...game,liveStatus:"scheduled",awayScore:0,homeScore:0},"TAMU"),/pick-team-score/,"no scheduled placeholder 0-0");
assert.match(football.showTeam({...game,liveStatus:"live",awayScore:0,homeScore:0},"TAMU"),/pick-team-score[^>]*>0<\/span>/,"genuine live 0-0 allowed");
assert.match(football.showTeam({...game,liveStatus:"final",awayScore:7,homeScore:28},"MIZ"),/pick-team-score is-leading[^>]*>28<\/span>/,"final results appear on cards");
assert.doesNotMatch(football.showTeam({...game,awayScore:null},"TAMU"),/pick-team-score/,"missing score not displayed");
assert.doesNotMatch(football.showTeam({...game,awayScore:-1},"TAMU"),/pick-team-score/,"invalid score not displayed");
const begin=sport.indexOf("const SEC_IDS="),end=sport.indexOf("function renderTiebreak(",begin);
assert.ok(begin>=0&&end>begin,"Sports team renderer found");
const other={window:{SEC_TEAM_RECORDS:{entry:()=>null},SEC_FAN:{sportCenter:()=>""}},
 Date,Number,Set,Math,esc:x=>String(x),user:()=>null,curWeek:()=>({games:[1]}),
 allGames:()=>[],timeLabel:()=> "Scheduled",prettyTime:()=> "Sat 7 PM"};
vm.runInNewContext(sport.slice(begin,end)+"\nthis.showSport=gameCard;",other);
const basketball={id:"basketball-one",week:1,away_code:"333",home_code:"8",away_name:"Alabama",home_name:"Arkansas",
 kickoff_at:"2026-10-10T23:00:00Z",game_status:"live",away_score:64,home_score:69,imported:true,source:"ESPN"};
const render=(s,g)=>other.showSport(s,g,null,{});
assert.match(render("basketball",basketball),/sport-team-score[^>]*>64<\/span>/);
assert.match(render("basketball",basketball),/sport-team-score is-leading[^>]*>69<\/span>/);
assert.doesNotMatch(render("basketball",{...basketball,game_status:"scheduled",away_score:0,home_score:0}),/sport-team-score/);
assert.match(render("baseball",{...basketball,game_status:"final",away_score:3,home_score:2}),/sport-team-score is-leading[^>]*>3<\/span>/);
assert.doesNotMatch(render("baseball",{...basketball,away_score:null}),/sport-team-score/);
assert.match(fs.readFileSync("multi-sport.css","utf8"),/\.pick-team-score\.is-leading/);
assert.match(html,/2026\.10\.10-team-scores\.1/);
console.log("Inline team scores passed: verified live/final, no placeholder scores, football hero plus basketball/baseball and compact card layout.");