/* Saturdays Down South visual identity — editorial NCAA university marks.
 * ESPN team-logo thumbnails are optional display assets, never data sources.
 * Team ID mapping is fixed and matches the verified records/rankings feed.
 * No fetched script, pick state, player data or account mutation.
 */
(()=>{
"use strict";
const TEAMS=Object.freeze({
 ALA:{id:333,label:"Alabama",mark:"A",color:"#9a273d"},ARK:{id:8,label:"Arkansas",mark:"AR",color:"#a82443"},
 AUB:{id:2,label:"Auburn",mark:"AU",color:"#152e5b"},FLA:{id:57,label:"Florida",mark:"F",color:"#e77125"},
 UGA:{id:61,label:"Georgia",mark:"G",color:"#bb2a39"},UK:{id:96,label:"Kentucky",mark:"UK",color:"#2667ac"},
 LSU:{id:99,label:"LSU",mark:"LSU",color:"#5f3897"},MISS:{id:145,label:"Ole Miss",mark:"M",color:"#bb3142"},
 MSST:{id:344,label:"Mississippi State",mark:"MS",color:"#7a3145"},MIZ:{id:142,label:"Missouri",mark:"M",color:"#c19e28"},
 OU:{id:201,label:"Oklahoma",mark:"OU",color:"#9f3543"},SC:{id:2579,label:"South Carolina",mark:"SC",color:"#882b43"},
 TENN:{id:2633,label:"Tennessee",mark:"T",color:"#d87c2c"},TEX:{id:251,label:"Texas",mark:"TX",color:"#b26435"},
 TAMU:{id:245,label:"Texas A&M",mark:"ATM",color:"#783847"},VAN:{id:238,label:"Vanderbilt",mark:"V",color:"#8e8052"}
});
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function imageUrl(code){
 const t=TEAMS[code];return t?"https://a.espncdn.com/i/teamlogos/ncaa/500/"+t.id+".png":null;
}
function mark(code,{className="sds-team-mark",showFallback=true}={}){
 const t=TEAMS[code],abb=t?.mark||String(code||"SEC").slice(0,4).toUpperCase();
 const color=t?.color||"#263a50";
 const img=t?'<img class="sds-team-logo" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="'+imageUrl(code)+'">':"";
 return '<span class="'+safe(className)+' sds-team-brand" data-sds-school="'+safe(code)+
  '" style="--school-accent:'+color+'" aria-hidden="true">'+
  (showFallback?'<span class="sds-team-fallback">'+safe(abb)+'</span>':"")+img+'</span>';
}
function logoElements(container=document){
 if(!container?.querySelectorAll)return;
 for(const el of container.querySelectorAll("img.sds-team-logo")){
  if(el.complete&&!el.naturalWidth)el.hidden=true;
 }
}
document.addEventListener("error",e=>{
 if(e.target?.matches?.("img.sds-team-logo"))e.target.hidden=true;
},true);
window.SDS_VISUALS=Object.freeze({mark,imageUrl,teams:TEAMS,logoElements});
})();