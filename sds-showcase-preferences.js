/* Real, per-user Game Day in-app alert preferences.
 * This only controls alerts while the app is in use. It does NOT register
 * a service worker push subscription or claim background notification access.
 */
(()=>{
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const me=()=>window.secOnline?.getUser?.();
const canUse=()=>window.secOnline?.configured!==true||!!me();
const key=()=>me()?.id||"guest";
const get=k=>{try{return localStorage.getItem(k);}catch{return null;}};
const set=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
const types=[
 ["kickoff","🏈","Kickoff alerts","When a verified game starts"],
 ["final","✓","Final scores","Official results and pick outcomes"],
 ["upset","⚡","Upset results","Confirmed surprise winners"],
 ["rival","🏆","Rivalry wins","Verified league competition"]
];
function card(){
 const can=canUse(),active=can&&get("sec-fan-alerts-"+key())==="on";
 return '<section class="sds-notice-card" aria-label="Game Day notification preferences">'+
 '<div class="sds-notice-head"><div><span class="sds-eyebrow">NOTIFICATIONS</span>'+
 '<h3>Never miss game day.</h3><p>Choose which verified updates you see while the app is open.</p></div>'+
 '<label class="sds-notice-master">Alerts <input type="checkbox" data-sds-alert-master '+
 (active?"checked ":"")+(can?"":"disabled ")+
 'aria-label="Turn in-app game-day alerts on or off"></label></div>'+
 '<div class="sds-notice-grid">'+types.map(([name,icon,title,desc])=>
 '<label class="sds-notice-option"><span aria-hidden="true">'+icon+'</span>'+
 '<span class="sds-notice-description"><strong>'+esc(title)+'</strong><small>'+esc(desc)+'</small></span>'+
 '<input type="checkbox" data-day-alert="'+name+'" '+
 (get("sec-gameday-"+key()+"-"+name)==="off"?"":"checked ")+
 (!active?"disabled ":"")+'aria-label="'+esc(title)+'"></label>').join("")+'</div>'+
 '<p class="sds-notice-foot">'+(!can?"Sign in to save alert preferences to your account on this device. ":
 !active?"Turn on Alerts to use these options. ":"")+
 'In-app alerts only; background push notifications are not configured.</p></section>';
}
function mount(){
 for(const id of ["sds-settings-notifications","sds-news-notifications"]){
  const root=document.getElementById(id);
  if(root){const html=card();if(root.innerHTML!==html)root.innerHTML=html;}
 }
}
document.addEventListener("change",e=>{
 if(e.target?.matches?.("[data-sds-alert-master]")&&canUse()){
  set("sec-fan-alerts-"+key(),e.target.checked?"on":"off");
  mount();window.SEC_GAMEDAY?.refresh?.();
 }
 if(e.target?.matches?.("[data-day-alert]")){Promise.resolve().then(mount);}
});
window.SDS_PREFERENCES=Object.freeze({mount});
})();