/* Advanced play UI smoke test: private data is never requested by a guest. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8"),html=read("index.html"),css=read("sec-next.css"),sw=read("sw.js");
new vm.Script(read("sec-next.js"),{filename:"sec-next.js"});
const week={num:5,games:[
 {id:"2026-UGA-ALA",away:"UGA",home:"ALA",kickoff:"2026-12-01T20:00:00Z"},
 {id:"2026-UK-TENN",away:"UK",home:"TENN",kickoff:"2026-09-01T20:00:00Z",liveStatus:"final",awayScore:27,homeScore:24},
 {id:"2026-ARK-LSU",away:"ARK",home:"LSU",kickoff:"2026-12-01T20:00:00Z"}
]};
const roots=new Map(),listeners={},state={picks:{"2026-UK-TENN":"UK","2026-ARK-LSU":"LSU"}};
for(const id of ["sec-next-picks","sec-next-results","sec-next-league","sec-next-push","sec-next-rivalries"])roots.set(id,{innerHTML:""});
let forbiddenCalls=0;
const db={rpc(){forbiddenCalls++;throw Error("Guest cannot read a league's data");}};
const document={readyState:"loading",addEventListener:(n,fn)=>{listeners[n]=fn;},
 getElementById:id=>roots.get(id)||null,querySelectorAll:()=>[],createElement:()=>({}),
 body:{appendChild(){}}};
const window={
 SEC_BRIDGE:{week:()=>week,weeks:[week],state:()=>state,isLocked:g=>g.liveStatus==="final",
  view:()=>"picks",toast(){}},
 SEC_FEATURES:{isUnavailable:()=>false,finalData:g=>g.liveStatus==="final"?{points:1}:null},
 SEC_FINAL_CARDS:{outcome:()=>({kind:"won"})},
 SEC_PRIDE:{getCode:()=>"UK",names:{UGA:"Georgia",ALA:"Alabama",UK:"Kentucky",TENN:"Tennessee",ARK:"Arkansas",LSU:"LSU"}},
 SEC_TEAM_RECORDS:{entry:()=>({overall:"5-1"})},SEC_RANKINGS:{hasCurrent:()=>false},
 secOnline:{configured:false,getUser:()=>null,getClient:()=>db},
 SEC_LEAGUE_SETTINGS:{getSelected:()=>null},SDS_TROPHY_RIVALRIES:[]
};
vm.runInNewContext(read("sec-next.js"),{window,document,navigator:{},console,Date,setTimeout,Intl},{filename:"sec-next.js"});
const advanced=window.SEC_NEXT;
assert.equal(advanced.pending().length,1);
advanced.onPicks();
assert.match(roots.get("sec-next-picks").innerHTML,/1 matchups still need a pick/);
advanced.onResults();
assert.match(roots.get("sec-next-results").innerHTML,/Pick’em Career/);
assert.match(roots.get("sec-next-results").innerHTML,/Your Week in Review/);
advanced.onLeague();
assert.match(roots.get("sec-next-league").innerHTML,/League Pick Trends/);
assert.match(roots.get("sec-next-league").innerHTML,/Live Championship Race/);
assert.match(roots.get("sec-next-league").innerHTML,/Friend Challenges/);
advanced.onSettings();
assert.match(roots.get("sec-next-push").innerHTML,/not yet configured/);
assert.equal(forbiddenCalls,0);
for(const id of ["sec-next-picks","sec-next-rivalries","sec-next-league","sec-next-results","sec-next-push"])assert.ok(html.includes('id="'+id+'"'),id+" missing");
assert.match(css,/@media\(max-width:390px\)/);
assert.match(css,/secnext-dialog::backdrop/);
assert.match(sw,/self\.addEventListener\("push"/);
assert.match(sw,/self\.addEventListener\("notificationclick"/);
assert.match(sw,/sec-pickem-v103/);
const migration=read("supabase/migrations/20261012_advanced_challenges_push.sql");
assert.match(migration,/public\.sec_is_member\(league_id\)/);
assert.match(migration,/recipient_id/);
assert.match(migration,/auth\.uid\(\)/);
console.log("Advanced features: Quick Pick, verified recap/career, private trends/challenges and gated device push PASS");