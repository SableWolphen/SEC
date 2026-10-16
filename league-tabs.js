/* Compact League Hub: presentation-only tabs. All database and scoring RPCs stay unchanged. */
(()=>{
"use strict";
const byId=id=>document.getElementById(id);
const manager=()=>window.SEC_LEAGUE_SETTINGS;
let pane="scores",selectedKey=null,pending=false,requestedChat=null,chatRequest=0;
const paneNames=["scores","chat","brags","more"];
function chatLeagueId(item){
 if(item?.kind==="football")return item.id;
 return item?.kind==="club"&&item.sports?.includes("football")?item.detail?.football_league:null;
}
function eligible(){
 const member=window.secOnline?.getUser?.(),item=manager()?.getSelected?.();
 return {member,item,chat:!!member&&!!chatLeagueId(item)};
}
function switchPane(next,focus=false){
 const {member,item,chat}=eligible(),allowed=member?["scores",...(chat?["chat"]:[]),"brags","more"]:["scores"];
 pane=allowed.includes(next)?next:"scores";
 const view=byId("league-view");if(view)view.dataset.v3Pane=pane;
 const tabs=byId("fan-league-tabs");if(tabs)tabs.hidden=!member;
 for(const name of paneNames){
  const button=byId("fan-tab-"+name),content=byId("fan-pane-"+name),active=name===pane;
  if(button){
   button.hidden=name==="chat"&&!chat;
   button.tabIndex=active?0:-1;
   button.classList.toggle("active",active);
   button.setAttribute("aria-selected",String(active));
  }
  const sideBySide=window.matchMedia?.("(min-width:1000px)")?.matches&&member&&chat&&["scores","chat"].includes(pane)&&["scores","chat"].includes(name);
  if(content)content.hidden=!(active||sideBySide);
 }
 if(focus)byId("fan-tab-"+pane)?.focus();
}
function relocate(source,selector,target){
 const parent=byId(source),mount=byId(target);
 if(!parent||!mount)return;
 const child=parent.querySelector(selector);
 if(child){
  if(target==="fan-league-football-manager"&&selector===".fan-football-advanced")mount.appendChild(child);
  else mount.replaceChildren(child);
 }
}
// Keep every player visible in standings; controls live in separate tabs.
function synchronize(){
 const {member,item}=eligible();
 const key=member?item?item.kind+":"+item.id:"empty":"guest";
 if(selectedKey!==key){
  selectedKey=key;pane=member&&!item?"more":pane==="chat"&&chatLeagueId(item)?"chat":"scores";
  if(member&&item){void window.SEC_PRIDE?.load?.(item.kind,item.id);void window.SEC_BRAGS?.load?.(item);
   void window.SEC_POWER?.show?.(item);
   void window.SEC_BRAG_ARENA?.load?.(item);
   window.SEC_BRAG_ARENA?.render?.();}
  else window.SEC_BRAGS?.render?.();
  for(const id of ["fan-league-club-manager","fan-league-single-manager","fan-league-football-manager","fan-league-chat-content"])byId(id)?.replaceChildren();
 }
 if(requestedChat&&chatLeagueId(item)===requestedChat&&
   window.secOnline?.getLeague?.()?.id===requestedChat){pane="chat";requestedChat=null;}
 switchPane(pane);
 if(!member)return;
 if(pane==="brags"){window.SEC_BRAGS?.render?.();void window.SEC_BRAG_ARENA?.load?.(item);}
 if(item?.kind==="club"){
  relocate("fan-club-hub",".fan-club-settings","fan-league-club-manager");

 }else if(item){
  relocate("fan-single-league",".fan-standalone-settings","fan-league-single-manager");
  relocate("fan-single-league",".fan-single-panel > details.fan-fold","fan-league-single-manager");
 }
 if(item&&chatLeagueId(item)){
   const actual=window.secOnline?.getLeague?.();
   if(actual?.id===chatLeagueId(item)){
    relocate("league-content",".sec-scoreboard-chat","fan-league-chat-content");
    relocate("league-content",".fan-football-management","fan-league-football-manager");
    relocate("league-content",".fan-football-advanced","fan-league-football-manager");

   }else{
    // Never show the previous league's messages during a fast league switch.
    byId("fan-league-chat-content")?.replaceChildren();
   }
 }
}
function schedule(){
 if(pending)return;
 pending=true;
 queueMicrotask(()=>{pending=false;synchronize();});
}
document.addEventListener("click",e=>{
 const tab=e.target.closest?.("[data-league-pane]");
 if(tab){
  e.preventDefault();
  switchPane(tab.dataset.leaguePane);
  if(tab.dataset.leaguePane==="scores"){
   void window.SEC_BRAG_ARENA?.load?.(eligible().item);
   void window.SEC_POWER?.show?.(eligible().item);
  }
  if(tab.dataset.leaguePane==="brags"){
   void window.SEC_BRAG_ARENA?.load?.(eligible().item);
   void window.SEC_POWER?.show?.(eligible().item);
  }
  if(["scores","brags"].includes(tab.dataset.leaguePane)){
   const item=eligible().item;
   if(item)void window.SEC_PRIDE?.load?.(item.kind,item.id,true);
  }
  return;
 }
 // Existing Manage Leagues button opens its disclosure; first make More visible.
 if(e.target.closest?.('[data-league-action="manage"]'))switchPane("more");
},true);
document.addEventListener("keydown",e=>{
 const tab=e.target.closest?.("[data-league-pane]");
 if(!tab||!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;
 e.preventDefault();
 const chat=eligible().chat,list=["scores",...(chat?["chat"]:[]),"brags","more"];
 const current=list.indexOf(tab.dataset.leaguePane);
 if(current<0)return;
 const target=e.key==="Home"?0:e.key==="End"?list.length-1:
  (current+(e.key==="ArrowRight"?1:-1)+list.length)%list.length;
 switchPane(list[target],true);
});
for(const id of ["fan-league-choice","fan-single-league","fan-club-hub","league-content"]){
 const node=byId(id);
 if(node)new MutationObserver(schedule).observe(node,{childList:true,subtree:true});
}
window.matchMedia?.("(min-width:1000px)")?.addEventListener?.("change",()=>switchPane(pane));
synchronize();
async function openChat(id){
 const uid=window.secOnline?.getUser?.()?.id;
 if(!uid||!window.secOnline?.getLeagues?.().some(l=>l.id===id))return;
 const request=++chatRequest;requestedChat=id;
 // Select through the unified league manager so standings, composer and chat
 // all refer to the same league, including when opened from Home.
 await manager()?.load?.();
 if(request!==chatRequest)return;
 if(window.secOnline?.getUser?.()?.id!==uid){requestedChat=null;return;}
 const item=manager()?.getLeagues?.().find(l=>chatLeagueId(l)===id);
 if(!item){requestedChat=null;return;}
 await manager().choose(item.kind+":"+item.id);
 if(request!==chatRequest)return;
 if(window.secOnline?.getUser?.()?.id!==uid){requestedChat=null;return;}
 window.SEC_BRIDGE?.setView?.("league");
 synchronize();
}
window.SEC_LEAGUE_TABS=Object.freeze({switchPane,synchronize,openChat});
})();
