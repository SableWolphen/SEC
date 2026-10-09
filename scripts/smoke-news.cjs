/* SEC News integration smoke test — real source links, safe rendering, no fabricated breaking items. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const elements={};
function node(tag){
 const n={tag,children:[],attrs:{},handlers:{},value:"",textContent:"",className:"",id:"",
  append(...parts){this.children.push(...parts);},
  replaceChildren(...parts){this.children=parts;},
  setAttribute(k,v){this.attrs[k]=v;},
  addEventListener(type,fn){this.handlers[type]=fn;},
  get lastElementChild(){return [...this.children].reverse().find(x=>x&&typeof x==="object")||null;}
 };
 return n;
}
const root=node("section");elements["sec-news-root"]=root;
function traverse(current,match){
 return [...(match(current)?[current]:[]),...(current.children||[]).flatMap(c=>c&&typeof c==="object"?traverse(c,match):[])];
}
const now=new Date();
const time=new Date(now.getTime()-25*60000).toISOString();
const old=new Date(now.getTime()-30*86400000).toISOString();
const dataset={updated_at:now.toISOString(),sources:["ESPN","NCAA"],articles:[
 {id:"real",sport:"football",title:"SEC announces a new football award",summary:"The Southeastern Conference announced a new award.",source:"ESPN",published_at:time,teams:["Alabama"],breaking:true,url:"https://www.espn.com/college-football/story/_/id/1234"},
 {id:"baseball",sport:"baseball",title:"Tennessee baseball announces a new series",summary:"The Volunteers confirmed the baseball schedule.",source:"NCAA",published_at:time,teams:["Tennessee"],breaking:false,url:"https://www.ncaa.com/news/baseball/d1/story"},
 {id:"basketball",sport:"basketball",title:"Kentucky basketball coach announces roster",summary:"The Wildcats confirmed their new men's basketball roster.",source:"ESPN",published_at:time,teams:["Kentucky"],breaking:false,url:"https://www.espn.com/mens-college-basketball/story/_/id/999"},
 {id:"stale",title:"Old Ole Miss update",summary:"Months ago.",source:"ESPN",published_at:old,teams:["Ole Miss"],breaking:false,url:"https://www.espn.com/stale"},
 {id:"unsafe",title:"Dangerous link",summary:"Bad link.",source:"ESPN",published_at:time,teams:["Texas"],breaking:true,url:"javascript:alert(1)"}
]};
const document={getElementById:id=>elements[id]||traverse(root,x=>x.id===id)[0]||null,createElement:node,
 createTextNode:text=>({tag:"#text",textContent:text,children:[]}),hidden:false};
const window={SEC_BRIDGE:{view:()=>"news"},location:{hash:""}};
const context={window,document,Date,URL,console,Option:function(label,value){return {label,value}},
 setInterval(){},fetch:async()=>({ok:true,json:async()=>dataset})};
vm.runInNewContext(fs.readFileSync("sec-news.js","utf8"),context,{filename:"sec-news.js"});
async function run(){
 const feature=window.SEC_NEWS;assert.ok(feature,"news module initializes");
 assert.equal(feature.safeUrl("javascript:alert(1)"),null);
 assert.equal(feature.safeUrl("https://evil.com"),null);
 assert.equal(feature.safeUrl("https://www.espn.com/a"),"https://www.espn.com/a");
 feature.mount();
 await new Promise(setImmediate);
 await new Promise(setImmediate);
 assert.equal(feature.getArticles().length,3,"reject stale/unsafe articles and keep all three sports");
 assert.equal(feature.getSport(),"football","news opens with football pick'em sport");
 const cards=traverse(root,x=>String(x.className).includes("sec-news-card")&&!String(x.className).includes("labels")&&!String(x.className).includes("title")&&!String(x.className).includes("summary"));
 assert.ok(cards.length>=1,"headline cards render");
 const anchors=traverse(root,x=>x.tag==="a");
 assert.equal(anchors.length,1,"each story has one direct source link");
 assert.match(anchors[0].href,/espn\.com/,"story links to original publisher");
 assert.equal(anchors[0].rel,"noopener noreferrer");
 assert.equal(anchors[0].target,"_blank");
 const summaries=traverse(root,x=>x.className==="sec-news-card-summary");
 assert.equal(summaries.length,1,"TLDR visible");
 const text=JSON.stringify(root);
 assert.match(text,/SEC announces a new football award/);
 assert.match(text,/BREAKING/,"fresh confirmed headline receives breaking badge");
 assert.match(text,/The Southeastern Conference announced a new award/,"source excerpt visible");
 assert.doesNotMatch(text,/Old Ole Miss update/,"stale headline hidden");
 assert.doesNotMatch(text,/Dangerous link/,"unsafe article hidden");
 assert.doesNotMatch(text,/Tennessee baseball announces/,"baseball stories never leak into football news");
 assert.doesNotMatch(text,/Kentucky basketball coach/,"basketball stories never leak into football news");
 let sportButtons=traverse(root,x=>x.attrs?.["data-news-sport"]);
 assert.equal(sportButtons.length,3,"independent news sport tabs exist");
 sportButtons.find(x=>x.attrs["data-news-sport"]==="baseball").handlers.click();
 assert.equal(feature.getSport(),"baseball");
 let baseballText=JSON.stringify(root);
 assert.match(baseballText,/Tennessee baseball announces a new series/);
 assert.doesNotMatch(baseballText,/SEC announces a new football award/);
 assert.doesNotMatch(baseballText,/Kentucky basketball coach/);
 sportButtons=traverse(root,x=>x.attrs?.["data-news-sport"]);
 sportButtons.find(x=>x.attrs["data-news-sport"]==="basketball").handlers.click();
 assert.equal(feature.getSport(),"basketball");
 let basketballText=JSON.stringify(root);
 assert.match(basketballText,/Kentucky basketball coach announces roster/);
 assert.doesNotMatch(basketballText,/Tennessee baseball announces/);
 assert.doesNotMatch(basketballText,/SEC announces a new football award/);
 const articles=traverse(root,x=>x.tag==="article");
 assert.equal(articles.length,1,"selected news sport has exactly one matching story");
 const html=fs.readFileSync("index.html","utf8");
 assert.match(html,/id="news-view"/,"news screen exists");
 assert.match(html,/data-nav="news"/,"news navigation item exists");
 assert.match(html,/window\.SEC_NEWS\?\.mount/,"route mounts news screen");
 assert.match(html,/sec-news\.js\?v=/,"versioned mobile news script included");
 const sw=fs.readFileSync("sw.js","utf8");
 assert.match(sw,/sec-news\.js/,"PWA pre-caches SEC news");
 assert.match(sw,/news\.json/,"PWA caches the published news feed");
 assert.match(fs.readFileSync("scripts/update_news.py","utf8"),/news\/baseball\/d1\/rss\.xml/,"baseball news comes from NCAA's sport feed");
 assert.match(fs.readFileSync("scripts/update_news.py","utf8"),/news\/basketball-men\/d1\/rss\.xml/,"basketball news comes from NCAA's sport feed");
 console.log("SEC News tests passed: source links, safe TLDR, breaking freshness, browser navigation and mobile assets.");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
