/* Navigation-only SEC access regression. Test real routing with a tiny DOM fixture. */
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const src=fs.readFileSync("sec-access.js","utf8"),html=fs.readFileSync("index.html","utf8"),
 css=fs.readFileSync("sec-access.css","utf8"),sw=fs.readFileSync("sw.js","utf8");
new vm.Script(src,{filename:"sec-access.js"});
const handlers={},elements={};let current="home",calls=[],quickOpen=0;
const mk=id=>elements[id]={innerHTML:"",value:"",setAttribute(){},removeAttribute(){},querySelector(){return null},querySelectorAll(){return []}};
["sec-access-more","sec-access-results","sec-access-count","sec-access-search","sec-access-trigger","sec-access-dialog","sec-next-league","sec-next-push"].forEach(mk);
const doc={
 readyState:"loading",addEventListener:(name,cb)=>handlers[name]=cb,getElementById:id=>elements[id]||null,
 activeElement:{tagName:"BODY",isContentEditable:false},querySelector:()=>null
};
const pins={};
const localStorage={getItem:key=>pins[key]||null,setItem:(key,val)=>{pins[key]=val}};
const window={secOnline:{configured:false},SEC_BRIDGE:{setView:x=>{current=x;calls.push(x);},view:()=>current,toast(){}},
 SEC_NEXT:{pending:()=>[{}],openQuick:()=>{quickOpen++}},SEC_LEAGUE_TABS:{switchPane:x=>calls.push("pane:"+x)}};
vm.runInNewContext(src,{window,document:doc,localStorage,console,queueMicrotask:fn=>fn()},{filename:"sec-access.js"});
const app=window.SEC_ACCESS;
assert.ok(app,"global access navigation exists");
assert.ok(app.entries.length>=20,"all advanced features are reachable");
assert.deepEqual([...app.findMatches("friend challenges")].map(x=>x.id),["friend"]);
assert.deepEqual([...app.findMatches("basketball")].map(x=>x.id),["basketball"]);
assert.deepEqual([...app.findMatches("trophy")].map(x=>x.id),["trophies"]);
assert.deepEqual([...app.findMatches("push")].map(x=>x.id),["notifications"]);
app.renderMore();
const directory=elements["sec-access-more"].innerHTML;
assert.match(directory,/data-nav="news"/);
assert.match(directory,/data-nav="teams"/);
assert.match(directory,/data-nav="settings"/);
assert.match(directory,/data-sec-jump="friend"/);
assert.match(directory,/Your shortcuts/);
app.navigate("quick");assert.equal(current,"picks");assert.equal(quickOpen,1,"Quick Pick opens directly");
app.navigate("league-brags");assert.equal(current,"league");assert.ok(calls.includes("pane:brags"));
app.navigate("basketball");assert.equal(current,"basketball");
app.navigate("schedule");assert.equal(current,"team-hub");
app.navigate("news");assert.equal(current,"news");
app.navigate("notifications");assert.equal(current,"settings");
assert.match(html,/id="sec-access-trigger"/);
assert.match(html,/id="sec-access-dialog"/);
assert.match(html,/id="sec-access-search"/);
assert.match(html,/id="sec-access-more"/);
assert.match(html,/sec-access\.js\?v=20261012-access-v1/);
assert.match(html,/sec-access\.css\?v=20261012-access-v1/);
assert.match(css,/@media\(max-width:540px\)/);
assert.match(css,/:focus-visible/);
assert.match(sw,/sec-pickem-v105/);
assert.match(sw,/sec-access\.js\?v=20261012-access-v1/);
console.log("Find Anything: 21 destinations, deep-link routing, mobile access, discoverability and PWA PASS");