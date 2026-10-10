/* SEC school pride: account-level favorite + private-league badges. */
(()=>{
"use strict";
const CODES={ALA:"Alabama",ARK:"Arkansas",AUB:"Auburn",FLA:"Florida",UGA:"Georgia",UK:"Kentucky",
 LSU:"LSU",MISS:"Ole Miss",MSST:"Mississippi State",MIZ:"Missouri",OU:"Oklahoma",
 SC:"South Carolina",TENN:"Tennessee",TEX:"Texas",TAMU:"Texas A&M",VAN:"Vanderbilt"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const valid=s=>Object.prototype.hasOwnProperty.call(CODES,s)?s:null;
const client=()=>window.secOnline?.getClient?.(),user=()=>window.secOnline?.getUser?.();
const key=id=>"ss-sec-favorite-profile:"+id,lastKey="ss-sec-last-favorite-account";
const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
const write=(k,v)=>{try{localStorage.setItem(k,String(v));}catch{}};
let owner=null,chosen=null,flair={},leagueKey="",inflight=null,revision=0,loadedAt=0,saving=false;
function badge(uid){
 const code=uid===owner?chosen:flair[uid];
 return valid(code)?'<span class="sec-school-badge" title="Supports '+esc(CODES[code])+
  '" aria-label="Supports '+esc(CODES[code])+'">★ '+esc(code)+'</span>':"";
}
function myBadge(){return owner?badge(owner):"";}
function refreshBadges(){
 if(typeof document!=="undefined"&&typeof document.querySelectorAll==="function"){
  for(const node of document.querySelectorAll("#league-view [data-player-id]")){
   const id=node.getAttribute("data-player-id");
   node.querySelector?.(".sec-school-badge")?.remove();
   const html=badge(id);if(html)node.insertAdjacentHTML?.("beforeend",html);
  }
 }
 window.SEC_POWER?.render?.();
 window.SEC_BRAGS?.render?.();
 window.SEC_SOCIAL?.refreshDisplay?.();
}
function redraw(){window.SEC_BRIDGE?.renderHeader?.();refreshBadges();}
function setProfile(profile){
 const id=user()?.id||null;
 if(id!==owner){owner=id;chosen=null;flair={};leagueKey="";inflight=null;loadedAt=0;revision++;}
 if(!id||saving)return;
 const remote=valid(profile?.favorite_school_code),state=window.SEC_BRIDGE?.state?.();
 const existing=read(key(id)),local=valid(state?.favorite),prior=read(lastKey);
 // Existing players picked a team before account syncing existed. Adopt that
 // local choice once, only for its original account; never another user's.
 const migrate=!remote&&existing===null&&local&&(!prior||prior===id);
 chosen=remote||(migrate?local:null);
 if(state)state.favorite=chosen;
 write(lastKey,id);
 if(remote)write(key(id),remote);
 redraw();
 if(migrate)void saveFavorite(local,{quiet:true});
}
async function saveFavorite(value,{quiet=false}={}){
 const next=valid(value),u=user(),db=client();
 const state=window.SEC_BRIDGE?.state?.();
 if(state)state.favorite=next;
 if(!u||!db){chosen=next;redraw();return;}
 const id=u.id;
 chosen=next;if(next)flair[id]=next;else delete flair[id];
 redraw();saving=true;
 try{
  const result=await db.from("sec_profiles").update({favorite_school_code:next})
   .eq("user_id",id).select("user_id");
  if(result.error)throw result.error;
  if(Array.isArray(result.data)&&result.data.length===0){
   const name=String(state?.name||u.user_metadata?.display_name||"").trim().slice(0,32);
   if(name.length<2)throw Error("Save your player profile first.");
   const missing=await db.from("sec_profiles").upsert({user_id:id,display_name:name,favorite_school_code:next},{onConflict:"user_id"});
   if(missing.error)throw missing.error;
  }
  if(user()?.id!==id||owner!==id)return;
  write(key(id),next||"none");write(lastKey,id);
  const selected=window.SEC_LEAGUE_SETTINGS?.getSelected?.();
  if(selected)void load(selected.kind,selected.id,true);
 }catch(e){
  console.warn("Favorite school sync:",e?.message||e);
  if(user()?.id===id)window.SEC_BRIDGE?.toast?.(
   quiet?"Favorite school needs online sync. Select it again in Teams.":
   "Favorite shows locally but is not saved online. Select it again to retry.");
 }finally{saving=false;}
}
async function load(kind,id,force=false){
 const u=user(),db=client();
 if(!u||!db||!["club","football","basketball","baseball"].includes(kind)||!id){
  flair={};leagueKey="";loadedAt=0;return;
 }
 const k=u.id+":"+kind+":"+id;
 if(inflight===k)return;
 if(!force&&k===leagueKey&&Date.now()-loadedAt<60000)return;
 leagueKey=k;inflight=k;const token=++revision;
 try{
  const response=await db.rpc("sec_member_pride",{p_kind:kind,p_league:id});
  if(response.error)throw response.error;
  if(token!==revision||k!==leagueKey||user()?.id!==u.id)return;
  flair=Object.fromEntries((response.data||[]).filter(r=>r.user_id&&valid(r.favorite_school_code))
   .map(r=>[r.user_id,r.favorite_school_code]));
  loadedAt=Date.now();redraw();
 }catch(e){
  if(token===revision){loadedAt=Date.now()-45000;console.info("School badges unavailable",e?.message||e);}
 }finally{if(inflight===k)inflight=null;}
}
window.SEC_PRIDE=Object.freeze({badge,myBadge,setProfile,saveFavorite,load,refreshBadges,getCode:()=>chosen,names:CODES});
})();