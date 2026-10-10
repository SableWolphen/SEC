/* SEC school pride: account-saved, member-only badges; never used for permission checks. */
(()=>{
"use strict";
const CODES={ALA:"Alabama",ARK:"Arkansas",AUB:"Auburn",FLA:"Florida",UGA:"Georgia",UK:"Kentucky",
LSU:"LSU",MISS:"Ole Miss",MSST:"Mississippi State",MIZ:"Missouri",OU:"Oklahoma",
SC:"South Carolina",TENN:"Tennessee",TEX:"Texas",TAMU:"Texas A&M",VAN:"Vanderbilt"};
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const client=()=>window.secOnline?.getClient?.(),user=()=>window.secOnline?.getUser?.();
let owner=null,chosen=null,flair={},leagueKey="",inflight=null,revision=0,saving=false;
function badge(uid){
 const code=uid===owner?chosen:flair[uid];
 return CODES[code]?'<span class="sec-school-badge" title="Supports '+esc(CODES[code])+'" aria-label="Supports '+esc(CODES[code])+'">★ '+esc(code)+'</span>':"";
}
function myBadge(){return badge(owner);}
function setProfile(p){
 const id=user()?.id||null;
 if(id!==owner){owner=id;chosen=null;flair={};leagueKey="";revision++;}
 if(!id||saving)return;
 const next=CODES[p?.favorite_school_code]?p.favorite_school_code:null;
 if(chosen!==next){
  chosen=next;
  const state=window.SEC_BRIDGE?.state?.();
  if(state)state.favorite=next;
  window.SEC_BRIDGE?.renderHeader?.();
  if(window.SEC_BRIDGE?.view?.()==="teams")window.SEC_BRIDGE?.renderTeams?.();
 }
}
async function saveFavorite(code){
 const next=CODES[code]?code:null;
 const u=user(),db=client();
 if(!u||!db){chosen=next;return;}
 saving=true;
 try{
  const result=await db.from("sec_profiles").update({favorite_school_code:next}).eq("user_id",u.id);
  if(result.error)throw result.error;
  chosen=next;flair[u.id]=next;
  window.SEC_BRIDGE?.renderHeader?.();
  window.secOnline?.renderLeague?.();
  window.SEC_LEAGUE_SETTINGS?.render?.();
  window.SEC_BRAGS?.render?.();
 }catch(e){
  window.SEC_BRIDGE?.toast?.("School saved on this device only. Online sync unavailable.");
 }finally{saving=false;}
}
async function load(kind,id,force=false){
 const u=user(),db=client(),valid=["club","football","basketball","baseball"];
 if(!u||!db||!valid.includes(kind)||!id){flair={};leagueKey="";return;}
 const k=u.id+":"+kind+":"+id;
 if(!force&&k===leagueKey)return;
 if(inflight&&k===inflight)return;
 leagueKey=k;inflight=k;const myRevision=++revision;
 try{
  const response=await db.rpc("sec_member_pride",{p_kind:kind,p_league:id});
  if(response.error)throw response.error;
  if(myRevision!==revision||k!==leagueKey)return;
  flair=Object.fromEntries((response.data||[]).filter(r=>r.user_id&&CODES[r.favorite_school_code])
   .map(r=>[r.user_id,r.favorite_school_code]));
  if(chosen)flair[u.id]=chosen;
  // No form state changed. Re-render league views to show newly loaded badges.
  if(window.SEC_BRIDGE?.view?.()==="league"){
   window.SEC_LEAGUE_SETTINGS?.render?.();
   window.secOnline?.renderLeague?.();
   window.SEC_SOCIAL?.refreshDisplay?.();
  }
 }catch(e){if(myRevision===revision)console.info("School flair unavailable",e.message);}
 finally{if(inflight===k)inflight=null;}
}
window.SEC_PRIDE=Object.freeze({badge,myBadge,setProfile,saveFavorite,load,getCode:()=>chosen,names:CODES});
})();