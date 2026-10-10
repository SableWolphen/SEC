"use strict";
/* Bragging Arena regression: scoped RPC, post-kickoff only, all 3 sports,
   safe HTML, rival wins, championship truth and click-to-share. */
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const now=Date.now(),past=new Date(now-3*86400000).toISOString(),future=new Date(now+86400000).toISOString();
let selected={kind:"club",id:"club-1",name:"Saturday Crew",sports:["football","basketball","baseball"]};
let viewer={id:"alice"},fetches=0,notice=[],copied=[],listeners={};
const html={innerHTML:"",replaceChildren(){this.innerHTML="";}};
const games=[
 {id:"fb1",sport:"football",season:"2026",week:3,kickoff_at:past,away_code:"ALA",home_code:"UGA",
  game_status:"final",away_score:24,home_score:17,winner:"ALA",spread_home:-3,spread_source:"ESPN"},
 {id:"bb1",sport:"basketball",season:"2027",week:4,kickoff_at:past,away_code:"333",home_code:"8",
  away_name:"Alabama",home_name:"Arkansas",game_status:"final",away_score:62,home_score:71,
  winner:"8",spread_home:null,spread_source:null},
 {id:"bs1",sport:"baseball",season:"2027",week:9,kickoff_at:past,away_code:"333",home_code:"57",
  away_name:"Alabama",home_name:"Auburn",game_status:"final",away_score:2,home_score:1,
  winner:"333",spread_home:null,spread_source:null},
 {id:"future1",sport:"football",season:"2026",week:4,kickoff_at:future,away_code:"ALA",home_code:"TENN",
  game_status:"scheduled",winner:null}
];
const players=[{user_id:"alice",display_name:"Alice <img src=x>",school:"ALA"},
 {user_id:"bob",display_name:"Bob",school:"UGA"},
 {user_id:"carol",display_name:"Carol",school:"ALA"}];
const picks=[
 {user_id:"alice",game_id:"fb1",pick_code:"ALA"},
 {user_id:"bob",game_id:"fb1",pick_code:"UGA"},
 {user_id:"carol",game_id:"fb1",pick_code:"ALA"},
 {user_id:"alice",game_id:"bb1",pick_code:"8"},
 {user_id:"bob",game_id:"bb1",pick_code:"8"},
 {user_id:"carol",game_id:"bb1",pick_code:"333"},
 {user_id:"alice",game_id:"bs1",pick_code:"333"},
 {user_id:"bob",game_id:"bs1",pick_code:"57"},
 {user_id:"carol",game_id:"bs1",pick_code:"57"},
 {user_id:"alice",game_id:"future1",pick_code:"ALA"} // Must not render even if backend misbehaves.
];
const client={rpc:async(name,args)=>{
 assert.equal(name,"sec_brags_locker_room");
 assert.equal(args.p_kind,selected.kind);assert.equal(args.p_league,selected.id);
 fetches++;return {data:{players,games,picks},error:null};
}};
const window={
 secOnline:{getClient:()=>client,getUser:()=>viewer},
 SEC_LEAGUE_SETTINGS:{getSelected:()=>selected},
 SEC_POWER:{getRows:()=>[{user_id:"alice",current_rank:1,season_graded:3},{user_id:"bob",current_rank:2,season_graded:3}]},
 SEC_BRIDGE:{toast:t=>notice.push(t),setView:t=>notice.push(t)},
 SEC_PRIDE:{badge:()=>""}
};
const document={
 getElementById:id=>id==="fan-brag-arena"?html:null,
 addEventListener:(kind,fn)=>listeners[kind]=fn,
 createElement:()=>({value:"",select(){},remove(){}}),
 body:{appendChild(){}},execCommand:()=>true
};
const navigator={clipboard:{async writeText(s){copied.push(s);}}};
vm.runInNewContext(fs.readFileSync("sec-bragging-arena.js","utf8"),
 {window,document,navigator,Date,Math,Number,String,Object,Map,Set,Promise,console},
 {filename:"sec-bragging-arena.js"});
const arena=window.SEC_BRAG_ARENA;
(async()=>{
 await arena.load(selected);
 assert.equal(fetches,1);
 assert.match(html.innerHTML,/All-time grudge match records/);
 assert.match(html.innerHTML,/WEEKLY HEAD-TO-HEAD/);
 assert.match(html.innerHTML,/New matchups every Monday CT/);
 assert.match(html.innerHTML,/CORRECT/,"weekly score uses correct picks, not season totals");
 assert.match(html.innerHTML,/PICK RECEIPTS/);
 assert.match(html.innerHTML,/League bulletin/);
 assert.match(html.innerHTML,/<section class="brag-showcase-section brag-featured-rival"/,"Featured rivalry is visible");
 assert.match(html.innerHTML,/BRAGGING <em>RIGHTS<\/em>/,"Bragging Rights hero is present");
 assert.match(html.innerHTML,/LEAGUE KING/,"Leader highlight rendered");
 assert.equal((html.innerHTML.match(/<article class="brag-showcase-receipt /g)||[]).length,3,
  "show distinct final games, not three copies of one game's picks");
 assert.match(html.innerHTML,/data-brag-receipt="fb1"/,"football receipt can be shared");
 assert.match(html.innerHTML,/data-brag-receipt="bb1"/,"basketball receipt can be shared");
 assert.match(html.innerHTML,/data-brag-receipt="bs1"/,"baseball receipt can be shared");
 assert.match(html.innerHTML,/HOT STREAK/,"Streak highlight rendered");
 assert.match(html.innerHTML,/MOST ACCURATE/,"Accuracy highlight rendered");
 assert.match(html.innerHTML,/<details class="brag-showcase-more" data-brag-panel="rivals"/,"Rivalry history tucked into details");
 assert.match(html.innerHTML,/data-brag-panel="receipts"/,"Receipts collapsed by default");
 assert.match(html.innerHTML,/data-brag-panel="honors"/,"Awards collapsed by default");
 assert.match(html.innerHTML,/LEAGUE BULLETIN/,"League bulletin available");
 assert.match(html.innerHTML,/BELT CHASE/);
 assert.match(html.innerHTML,/SEC SCHOOL PRIDE/);
 assert.match(html.innerHTML,/Against the crowd/);
 assert.match(html.innerHTML,/Alice &lt;img src=x&gt;/);
 assert.doesNotMatch(html.innerHTML,/<img src=x>/);
 assert.doesNotMatch(html.innerHTML,/future1/,"future picks must not appear");
 assert.match(html.innerHTML,/Alabama vs Arkansas/);
 assert.match(html.innerHTML,/Alabama vs Auburn/);
 const m=arena.model({players,games,picks});
 assert.equal(m.games.has("future1"),false,"future game removed");
 const h=arena.rivalry(m,"alice","bob");
 assert.equal(h.both,3);
 assert.equal(h.wins,2);
 assert.equal(h.losses,0);
 assert.equal(h.draws,1);
 assert.match(html.innerHTML,/shared verified games/,"all-time record in expandable history");
 const week1=arena.weeklyPairing(players,"alice","2026-10-05T17:00:00Z");
 const week2=arena.weeklyPairing(players,"alice","2026-10-12T17:00:00Z");
 const week3=arena.weeklyPairing(players,"alice","2026-10-19T17:00:00Z");
 assert.equal(week1.label,"Week of Oct 5");
 assert.equal(week2.label,"Week of Oct 12");
 assert.equal(week3.label,"Week of Oct 19");
 const threeWeeks=[week1,week2,week3];
 assert.equal(new Set(threeWeeks.map(w=>w.opponent||"bye")).size,3,
  "three-person league cycles two different rivals and a fair bye");
 for(const w of threeWeeks){
  for(const pair of w.pairings){
   assert.ok(pair.every(id=>players.some(p=>p.user_id===id)));
   assert.equal(pair.length,2);
   assert.notEqual(pair[0],pair[1]);
  }
  assert.equal(w.pairings.length,1);
 }
 const beforeSunday=arena.texasWeek("2026-10-11T23:58:00Z"),
  onMonday=arena.texasWeek("2026-10-12T05:00:00Z");
 assert.equal(beforeSunday.label,"Week of Oct 5","Sunday CT remains in previous matchup");
 assert.equal(onMonday.label,"Week of Oct 12","exact Monday midnight CT resets rivalry");
 const midweek=arena.weeklyMatch(m,"alice","bob","2026-10-10T17:00:00Z");
 assert.equal(midweek.finals,3,"weekly matchup counts verified football, basketball and baseball finals");
 assert.equal(midweek.my,3);
 assert.equal(midweek.their,1);
 const newWeek=arena.weeklyMatch(m,"alice","bob","2026-10-12T17:00:00Z");
 assert.equal(newWeek.my,0,"new weekly scores reset before final games");
 assert.equal(newWeek.their,0);
 const twoPeople=[players[0],players[1]];
 assert.equal(arena.weeklyPairing(twoPeople,"alice","2026-10-05T17:00:00Z").opponent,"bob");
 assert.equal(arena.weeklyPairing(twoPeople,"alice","2026-10-12T17:00:00Z").opponent,"bob",
  "two-person leagues keep the only available opponent");
 const fourPeople=[...players,{user_id:"dave",display_name:"Dave"}];
 for(const date of ["2026-10-05T17:00:00Z","2026-10-12T17:00:00Z","2026-10-19T17:00:00Z"]){
  const pairs=arena.weeklyPairing(fourPeople,"alice",date).pairings;
  assert.equal(pairs.length,2,"four people yield two balanced one-on-one matches");
  assert.equal(new Set(pairs.flat()).size,4,"no duplicated players in a weekly round");
 }

 assert.equal(arena.verified(games[0]),true);
 assert.equal(arena.verified({...games[0],winner:"UGA"}),false,"mismatched winner rejected");
 const bullets=arena.bulletin(m);
 assert.ok(bullets.length>=1,"verified results yield bulletin");
 assert.ok(bullets.some(b=>/Upset receipts/.test(b.text)),"sourced underdog upset is in recent bulletins");
 const futureOnly=arena.model({players,games:[games[3]],picks:picks.slice(-1)});
 assert.equal(futureOnly.picks.size,0,"future-only pick is not disclosed");
 const badScore=arena.model({players,games:[{...games[0],away_score:10,home_score:17,winner:"ALA"}],picks});
 assert.equal(badScore.finals.length,0,"conflicting final not trusted");
 // Direct click sharing requires active user action and never posts to a chat API.
 const receiptButton={dataset:{bragReceipt:"fb1",bragPlayer:"alice"},
   hasAttribute:x=>x==="data-brag-receipt",matches:()=>false};
 listeners.click({target:{closest:()=>receiptButton},preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(copied.length,1);
 assert.match(copied[0],/PICK RECEIPT|UPSET RECEIPT/);
 assert.match(copied[0],/24–17/);
 const challenger={dataset:{bragShare:"challenge"},
  hasAttribute:x=>x==="data-brag-share",matches:()=>false};
 const presentPair=arena.weeklyPairing(players,"alice");
 listeners.click({target:{closest:()=>challenger},preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));
 if(presentPair.opponent){
  assert.equal(copied.length,2);
  assert.match(copied[1],/challenges /);
  assert.match(copied[1],/this week/);
  assert.match(copied[1],/Verified picks:/);
 }else{
  assert.equal(copied.length,1,"bye weeks cannot issue a false weekly rival challenge");
 }
 await arena.load(selected);
 assert.equal(fetches,1,"cached data scoped to selected league");
 selected={kind:"football",id:"different-league",name:"Other",sports:["football"]};
 viewer={id:"alice"};
 assert.notEqual(html.innerHTML,"");
 await arena.load(selected);
 assert.equal(fetches,2,"new league requires independent authorized RPC");
 viewer=null;await arena.load(selected);
 assert.equal(html.innerHTML,"","logged out state clears private content");
 const migration=fs.readFileSync("supabase/migrations/20261010_brags_locker_room.sql","utf8");
 for(const text of ["sec_club_is_member(p_league)","sec_is_member(p_league)",
   "sec_sport_is_member(p_league)","g.kickoff_at<=now()",
   "revoke all on function public.sec_brags_locker_room"]){
  assert.ok(migration.includes(text),"SQL missing privacy gate: "+text);
 }
 assert.doesNotMatch(fs.readFileSync("sec-bragging-arena.js","utf8"),/functions\.invoke|api\.openai\.com|OPENAI_API_KEY/);
 console.log("Bragging Arena passed: scoped members-only RPC, post-lock receipts, three-sport rivalries, escaped output and share-on-click.");
})().catch(e=>{console.error(e);process.exitCode=1;});