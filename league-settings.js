/* League choices belong to individual leagues, never the user's entire account.
   A disabled sport is hidden from this league's composite scoring, not deleted. */
(()=>{
"use strict";
const win=window,app=()=>win.SEC_BRIDGE,db=()=>win.secOnline?.getClient?.(),me=()=>win.secOnline?.getUser?.();
const byId=id=>document.getElementById(id);
const html=x=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const unwrap=r=>{if(r?.error)throw r.error;return r?.data;};
const ALL=["football","basketball","baseball"];
const names={football:"🏈 Football",basketball:"🏀 Basketball",baseball:"⚾ Baseball"};
const validSports=c=>(Array.isArray(c?.enabled_sports)?c.enabled_sports:ALL).filter(s=>ALL.includes(s));
let clubs=[],singles=[],selection=null,leaderboard=[],lastUser=null,loading=false,lastLoad=0,message="";
let inflight=null,inflightUser=null,standingsVersion=0,standingsLoading=false,lastRenderedSelection=null,actionPending=false;
const ident=i=>i?.kind+":"+i?.id;
const key=()=> "sec-selected-league:"+(me()?.id||"guest");
const cached=()=>{try{return localStorage.getItem(key());}catch(e){return null;}};
const saveCache=v=>{try{localStorage.setItem(key(),v);}catch(e){}};
const club=()=>items().find(x=>ident(x)===selection&&x.kind==="club")?.detail||null;
const selectedItem=()=>items().find(x=>ident(x)===selection)||null;
const score=n=>Number.isFinite(Number(n))?Number(n):0;
const sportRoute=s=>s==="football"?"picks":s;
const olderSeason=item=>item&&["basketball","baseball"].includes(item.kind)&&
  Number.isInteger(item.detail?.season)&&Number.isInteger(win.SEC_SPORTS?.year?.(item.kind))&&
  item.detail.season!==win.SEC_SPORTS.year(item.kind);
function reset(){
 const id=me()?.id||"guest";
 if(lastUser===id)return;
 lastUser=id;clubs=[];singles=[];selection=null;leaderboard=[];lastLoad=0;message="";
 standingsVersion++;standingsLoading=false;lastRenderedSelection=null;
}
function items(){
 return [
  ...clubs.map(c=>({kind:"club",id:c.id,name:c.name,sports:validSports(c),owner_id:c.owner_id,detail:c})),
  ...singles.map(s=>({kind:s.sport,id:s.id,name:s.name,sports:[s.sport],owner_id:s.owner_id,detail:s}))
 ];
}
function checkboxes(selected,group){
 return '<div class="fan-sport-checkboxes" role="group" aria-label="Choose sports for this league">'+
 ALL.map(s=>'<label class="fan-sport-checkbox"><input type="checkbox" data-league-sports="'+group+
 '" value="'+s+'" '+(selected.includes(s)?"checked ":"")+'><span>'+names[s]+'</span></label>').join("")+'</div>';
}
function checked(group){
 const box=byId("fan-"+group+"-sport-options");
 if(!box)return [];
 return [...box.querySelectorAll('input[data-league-sports="'+group+'"]:checked')]
  .map(x=>x.value).filter(s=>ALL.includes(s));
}

/* Preserve an in-progress league name, invitation code, and chosen checkboxes.
   Automatic refreshes must not erase a form while someone is typing. */
function formState(){
 const state={sameSelection:lastRenderedSelection===selection,inputs:{},choices:{},open:{}};
 for(const id of ["fan-new-name","fan-join-code"]){
  const node=byId(id);if(node&&typeof node.value==="string")state.inputs[id]=node.value;
 }
 for(const kind of ["create","edit","upgrade"]){
  if(kind!=="create"&&!state.sameSelection)continue;
  const region=byId("fan-"+kind+"-sport-options");
  if(region?.querySelectorAll){
   const boxes=[...region.querySelectorAll('input[data-league-sports]')];
   if(boxes.length)state.choices[kind]=boxes.filter(b=>b.checked).map(b=>b.value);
  }
 }
 for(const [id,selector] of [["fan-club-hub",".fan-edit-league"]]){
  const node=id==="fan-join-league"?byId("fan-league-create"):byId(id);
  const details=node?.querySelector?.(selector);
  if(details)state.open[id]=details.open;
 }
 const clubSettings=(byId("fan-league-club-manager")?.querySelector?.(".fan-club-settings")||byId("fan-club-hub")?.querySelector?.(".fan-club-settings"));
 if(clubSettings&&state.sameSelection)state.open["club-settings"]=clubSettings.open;
 return state;
}
function restoreForms(state){
 for(const [id,value] of Object.entries(state.inputs)){
  const node=byId(id);if(node&&typeof node.value==="string")node.value=value;
 }
 for(const [kind,selected] of Object.entries(state.choices)){
  const region=byId("fan-"+kind+"-sport-options");
  if(!region?.querySelectorAll)continue;
  for(const input of region.querySelectorAll('input[data-league-sports]'))
   input.checked=selected.includes(input.value);
 }
 for(const [id,selector] of [["fan-club-hub",".fan-edit-league"]]){
  if(!(id in state.open))continue;
  const node=id==="fan-join-league"?byId("fan-league-create"):byId(id);
  const details=node?.querySelector?.(selector);
  if(details)details.open=state.open[id];
 }
 const clubSettings=(byId("fan-league-club-manager")?.querySelector?.(".fan-club-settings")||byId("fan-club-hub")?.querySelector?.(".fan-club-settings"));
 if(clubSettings&&"club-settings" in state.open)clubSettings.open=state.open["club-settings"];
}
function render(){
 reset();
 const preserved=formState();
 const heading=byId("fan-league-choice"),create=byId("fan-league-create"),
  single=byId("fan-single-league"),multi=byId("fan-club-hub"),football=byId("league-content");
 if(!heading)return;
 const logged=!!me(),all=items(),item=selectedItem(),current=club();
 heading.innerHTML='<section class="fan-format-wrap fan-league-summary">'+
 '<div class="fan-league-title-row"><div><div class="card-kicker">YOUR LEAGUES</div>'+
 '<h2>League hub</h2><p>Each league chooses its own sports.</p></div>'+
 '<div class="fan-league-home-actions">'+
 (logged&&item&&(current||item.kind==="football")?
 '<button class="fan-small fan-primary" type="button" data-league-action="share">↗ Invite</button>':"")+
 (logged?'<button class="fan-small" type="button" data-league-action="manage">⚙ Manage leagues</button>':"")+
 '</div></div>'+
 (logged?(all.length?'<label class="fan-league-select-label" for="fan-selected-league">Playing in</label>'+
 '<select class="fan-league-select" id="fan-selected-league" aria-label="Choose your league">'+
 all.map(x=>'<option value="'+html(ident(x))+'" '+(ident(x)===selection?"selected":"")+'>'+html(x.name)+
 ' · '+x.sports.map(s=>names[s].split(" ")[0]).join("")+(olderSeason(x)?" · "+x.detail.season+" archive":"")+'</option>').join("")+'</select>'+
 (item?'<div class="fan-current-league-meta"><div class="fan-sport-tags" aria-label="Sports in this league">'+
 item.sports.map(s=>'<span class="fan-sport-tag">'+names[s]+'</span>').join("")+'</div>'+
 (olderSeason(item)?'<span class="fan-archive-tag">Past season</span>':'')+'</div>':''):
 '<p class="fan-format-note">'+(loading?"Loading your leagues…":"No leagues yet. Create one below or join a friend.")+'</p>'):
 '<p class="fan-format-note">Log in below to create or join a league.</p>')+
 (message?'<p class="fan-warning" role="status">'+html(message)+'</p>':"")+'</section>';
 const tools=byId("fan-league-tools"),extras=byId("fan-league-extras");
 if(tools){tools.hidden=!logged;if(logged&&!all.length&&!loading)tools.open=true;}
 if(extras)extras.hidden=!logged||!item;
 if(create)create.innerHTML=logged?'<div class="fan-league-action-grid">'+
 '<section class="fan-league-action fan-new-league"><h3>Create a league</h3>'+
 '<p class="fan-subtle">Choose one, two or all three sports.</p>'+
 '<label class="fan-league-select-label" for="fan-new-name">League name</label>'+
 '<input class="field" id="fan-new-name" maxlength="50" placeholder="SEC Legends">'+
 '<div id="fan-create-sport-options">'+checkboxes(["football"],"create")+'</div>'+
 '<button class="fan-small fan-primary" type="button" data-league-action="create">Create league →</button></section>'+
 '<section class="fan-league-action fan-join-league"><h3>Join with an invite code</h3>'+
 '<p class="fan-subtle">Use the code a friend sent you. One account works for every sport.</p>'+
 '<label class="fan-league-select-label" for="fan-join-code">10-character league code</label>'+
 '<input class="field" id="fan-join-code" autocomplete="off" maxlength="10" placeholder="Paste your invite code" autocapitalize="characters">'+
 '<button class="fan-small fan-primary" type="button" data-league-action="join">Join league →</button></section></div>':"";
 if(single){
  single.hidden=!logged||!item||item.kind==="club";
  if(!single.hidden){
   const kind=item.kind,owner=item.owner_id===me().id;
   single.innerHTML=kind==="football"?
    (owner?'<details class="fan-fold fan-standalone-settings"><summary>⚙ Football league settings <span>Optional</span></summary>'+
     '<p class="fan-subtle">Add more sports without losing existing picks or members.</p>'+
     '<details class="fan-fold"><summary>⚙️ Add sports to this league</summary>'+
     '<div id="fan-upgrade-sport-options">'+checkboxes([kind],"upgrade")+'</div>'+
     '<button class="fan-small fan-primary" type="button" data-league-action="upgrade">Save league sports →</button></details></details>':""):
'<section class="fan-panel fan-single-panel"><div class="card-kicker">SINGLE-SPORT LEAGUE</div>'+
    '<h3>'+html(item.name)+'</h3><p class="fan-subtle">'+names[kind]+
    ' · Your original scores, picks and membership remain available.</p>'+
    (owner?'<details class="fan-fold"><summary>⚙️ Add sports to this league</summary>'+
      '<p>Add a second or third sport without losing the existing league. Members can choose to join the newly added competitions.</p>'+
      '<div id="fan-upgrade-sport-options">'+checkboxes([kind],"upgrade")+'</div>'+
      '<button class="fan-small fan-primary" type="button" data-league-action="upgrade">Save league sports →</button></details>':
      '<p class="fan-subtle">Only this league’s owner can change its sports.</p>')+
    (olderSeason(item)?'<p class="fan-warning" role="status">'+item.detail.season+
       ' season archive. Your historical membership is preserved, but current picks use the new season.</p>':
     kind!=="football"?'<button class="fan-small" type="button" data-league-action="open-sport" data-sport="'+kind+
       '">Open '+names[kind]+' picks →</button>':
       '<p class="fan-subtle">Your football scoreboard and league chat are below.</p>')+
    (kind!=="football"&&!olderSeason(item)?(win.SEC_SPORTS?.renderLeaguePanel?.(kind)||
      '<p class="fan-subtle">Loading this sport’s league controls…</p>'):"")+
    '</section>';
  }
 }
 if(multi){
  multi.hidden=!logged||!current;
  if(current&&!multi.hidden)renderClub(current,multi);
 }
 for(const id of ["fan-brackets","fan-series"]){const el=byId(id);if(el)el.hidden=!current||!validSports(current).some(s=>s!=="football");}
 // Guests always retain the shared login and password recovery.
 if(football)football.hidden=logged&&(!item||item.kind!=="football");
 restoreForms(preserved);
 lastRenderedSelection=selection;
 // Power rankings are specific to the selected league, never a player-wide score.
 win.SEC_POWER?.show?.(item);
}
function renderClub(c,host){
 const sports=validSports(c),owner=c.owner_id===me()?.id,info=leaderboard.find(x=>x.user_id===me()?.id);
 const columns=sports.map(s=>'<th>'+names[s]+'</th>').join("");
 host.innerHTML='<section class="fan-panel fan-club-focus" aria-label="Standings for '+html(c.name)+'">'+
 '<div class="fan-title-row fan-club-title"><div><div class="card-kicker">🏆 '+html(c.name)+'</div>'+
 '<h2>League standings</h2><p>Only these sports count toward this league’s leaderboard.</p></div>'+
 '<button class="fan-small" type="button" data-league-action="reload">↻ Refresh</button></div>'+
 '<div class="fan-table-wrap"><table class="fan-table"><thead><tr><th>Player</th>'+columns+'<th>Total</th></tr></thead><tbody>'+
 (leaderboard.length?leaderboard.map((p,i)=>'<tr><td>#'+(i+1)+' '+html(p.display_name)+(win.SEC_PRIDE?.badge?.(p.user_id)||"")+(p.user_id===me()?.id?" ★":"")+'</td>'+
 sports.map(s=>'<td>'+score(p[s])+'</td>').join("")+'<td>'+score(p.total)+'</td></tr>').join(""):
 '<tr><td colspan="'+(sports.length+2)+'" class="fan-subtle">Waiting for verified game results.</td></tr>')+
 '</tbody></table></div>'+
 '<div class="fan-sport-links">'+sports.map(s=>'<button class="fan-small" type="button" data-league-action="sport" data-sport="'+s+
 '">'+names[s]+' picks ↗</button>').join("")+'</div>'+
 '<details class="fan-fold fan-club-settings"><summary>⚙ League settings <span>Invite · Sports · Membership</span></summary>'+
 '<div class="fan-club-invite"><span>Invite code: <strong>'+html(c.invite_code)+'</strong></span>'+
 '<button class="fan-small" type="button" data-league-action="share">Share invite ↗</button></div>'+
 (owner?'<details class="fan-fold fan-edit-league"><summary>⚙️ Change sports for this league <span>Owner only</span></summary>'+
 '<p>Choose which sports count. Disabled sports keep their existing picks and results.</p>'+
 '<div id="fan-edit-sport-options">'+checkboxes(sports,"edit")+'</div>'+
 '<button class="fan-small fan-primary" type="button" data-league-action="save-sports">Save these sports →</button></details>':"")+
 (info&&sports.length>1?'<details class="fan-fold"><summary>📈 My statistics</summary>'+
 '<div class="fan-metrics">'+sports.map(s=>'<span><strong>'+score(info[s+"_correct"])+
 '</strong><small>'+names[s]+' correct</small></span>').join("")+'</div></details>':"")+
 '<details class="fan-fold fan-member-sync"><summary>Member sync options</summary>'+
 '<p class="fan-subtle">Opt into newly enabled sports. Disabled sports never erase old picks.</p>'+
 '<button class="fan-small" type="button" data-league-action="sync">Join newly added sports</button></details>'+
 '</details></section>';
}
async function standings(){
 const currentClub=club(),who=me()?.id,version=++standingsVersion;
 if(!currentClub){leaderboard=[];standingsLoading=false;return;}
 standingsLoading=true;
 try{
  const rows=unwrap(await db().rpc("sec_club_standings",{p_club:currentClub.id}))||[];
  if(version===standingsVersion&&me()?.id===who&&club()?.id===currentClub.id)leaderboard=rows;
 }finally{
  if(version===standingsVersion)standingsLoading=false;
 }
}
function load(force=false){
 if(inflight){
  if(inflightUser!==me()?.id)return inflight.then(()=>load(true));
  return force?inflight.then(()=>load(true)):inflight;
 }
 inflightUser=me()?.id||null;
 inflight=loadNow(force).finally(()=>{inflight=null;inflightUser=null;});
 return inflight;
}
async function loadNow(force=false){
 reset();
 if(!db()||!me()||(!force&&Date.now()-lastLoad<45000)){render();return;}
 const id=me().id;loading=true;message="";
 try{
  const [c,f,b]=await Promise.all([
   db().from("sec_clubs").select("id,name,invite_code,owner_id,enabled_sports,football_league,basketball_league,baseball_league,basketball_season,baseball_season").order("created_at",{ascending:false}),
   db().from("sec_leagues").select("id,name,mode,owner_id").order("created_at",{ascending:false}),
   db().from("sec_sport_leagues").select("id,name,mode,owner_id,sport,season").order("created_at",{ascending:false})
  ]);
  if(me()?.id!==id)return;
  clubs=unwrap(c)||[];
  const linked=new Set(clubs.flatMap(x=>[x.football_league,x.basketball_league,x.baseball_league]));
  singles=[...(unwrap(f)||[]).map(x=>({...x,sport:"football"})),...(unwrap(b)||[])]
   .filter(x=>!linked.has(x.id)&&ALL.includes(x.sport));
  const list=items(),previous=selection,remembered=cached();
  selection=list.some(x=>ident(x)===previous)?previous:
   list.some(x=>ident(x)===remembered)?remembered:
   list.length?ident(list[0]):null;
  // Restore the sport-specific pick screen to the selected standalone league.
  const item=selectedItem();
  if(item?.kind==="football"&&win.secOnline?.getLeague?.()?.id!==item.id)
   win.secOnline?.useLeague?.(item.id);
  if(item&&["basketball","baseball"].includes(item.kind)&&!olderSeason(item)&&
    win.SEC_SPORTS?.getState?.(item.kind)?.active!==item.id)
   win.SEC_SPORTS?.selectLeague?.(item.kind,item.id);
  await standings();
  if(me()?.id!==id)return;
  lastLoad=Date.now();
 }catch(e){if(me()?.id===id)message="Could not load league settings: "+(e.message||"Try refreshing.");}
 finally{
  loading=false;if(me()?.id===id){render();win.SEC_BRACKETS?.mount?.();}
 }
}
async function choose(value){
 const x=items().find(x=>ident(x)===value);if(!x)return;
 const previous=selection;
 selection=value;saveCache(value);
 if(previous!==value){leaderboard=[];standingsVersion++;}
 render();
 try{
  if(x.kind==="football")win.secOnline?.useLeague?.(x.id);
  else if(x.kind!=="club"&&!olderSeason(x))win.SEC_SPORTS?.selectLeague?.(x.kind,x.id);
  await standings();
 }catch(e){message="Could not refresh this league’s standings: "+(e.message||"Please retry.");}
 render();win.SEC_BRACKETS?.mount?.();
}
async function invitation(){
 const code=new URLSearchParams(location.search).get("club");
 if(!db()||!me()||!/^[A-Za-z0-9]{10}$/.test(code||""))return;
 const marker="sec-club-invite:"+me().id+":"+code;
 if(sessionStorage.getItem(marker))return;
 try{
  const id=unwrap(await db().rpc("sec_club_join",{p_code:code}));
  selection="club:"+id;saveCache(selection);sessionStorage.setItem(marker,"ok");
  const uri=new URL(location.href);uri.searchParams.delete("club");
  history.replaceState(null,"",uri.pathname+uri.search+"#league");
  lastLoad=0;await load(true);
  app()?.toast?.("Joined this league’s selected sports!");
 }catch(e){message="Could not join this league: "+(e.message||"Please retry.");render();}
}
async function action(name,button){
 if(name==="manage"){
  const pane=byId("fan-league-tools");
  if(pane){pane.open=true;pane.scrollIntoView?.({behavior:"smooth",block:"start"});}
  return;
 }
 if(!me()||!db()){app()?.toast?.("Log in first.");return;}
 // Avoid duplicate league creation/joining from double-taps or slow networks.
 if(actionPending)return;
 actionPending=true;
 if(button)button.disabled=true;
 const item=selectedItem(),c=club();
 try{
  if(name==="create"){
   const title=byId("fan-new-name")?.value?.trim()||"",sports=checked("create");
   if(title.length<2||title.length>50)throw Error("Use a league name between 2 and 50 characters.");
   if(!sports.length)throw Error("Choose at least one sport.");
   if(sports.length>1){
    const id=unwrap(await db().rpc("sec_club_create",{p_name:title,p_sports:sports}));
    if(!id)throw Error("League creation did not return an ID.");
    selection="club:"+id;
   }else{
    const sport=sports[0];let id;
    if(sport==="football"){
     const data=unwrap(await db().rpc("sec_create_league_mode",{p_name:title,p_mode:"straight"}));
     id=Array.isArray(data)?data[0]?.league_id:data?.league_id;
     if(id)win.secOnline?.useLeague?.(id);
    }else{
     const yr=win.SEC_SPORTS?.year?.(sport);
     if(!Number.isInteger(yr))throw Error("Current sport season unavailable.");
     const data=unwrap(await db().rpc("sec_sport_create_league",{
      p_sport:sport,p_season:yr,p_name:title,p_mode:"straight"}));
     id=Array.isArray(data)?data[0]?.league_id:data?.league_id;
     if(id)win.SEC_SPORTS?.selectLeague?.(sport,id);
    }
    if(!id)throw Error("Single-sport league creation returned no ID.");
    selection=sport+":"+id;
   }
   app()?.toast?.("New league created with "+sports.length+" sport"+(sports.length===1?"":"s")+"!");
   if(byId("fan-league-tools"))byId("fan-league-tools").open=false;
  }else if(name==="join"){
   const invite=(byId("fan-join-code")?.value||"").trim().toUpperCase();
   if(!/^[A-Z0-9]{10}$/.test(invite))throw Error("Enter a valid 10-character league code.");
   // Try the club's code first. Single-sport invites use the existing secure RPCs.
   // Only genuine "not found" responses fall through; permission errors are surfaced.
   const methods=["sec_club_join","sec_join_league","sec_sport_join_league"];
   let joined=null;
   for(const method of methods){
    try{
     joined=unwrap(await db().rpc(method,{p_code:invite}));
     if(joined)break;
    }catch(e){
     if(!/not found|check the invite code/i.test(e.message||""))throw e;
    }
   }
   if(!joined)throw Error("No league matches that code. Check the invitation and try again.");
   lastLoad=0;
   await load(true);
   const match=items().find(x=>x.id===joined&&
     (x.kind==="club"||x.kind==="football"||x.kind==="basketball"||x.kind==="baseball"));
   if(match){await choose(ident(match));saveCache(ident(match));}
   app()?.toast?.("Joined the league with your existing account!");
   if(byId("fan-league-tools"))byId("fan-league-tools").open=false;
   return;
  }else if(name==="save-sports"){
   if(!c||c.owner_id!==me().id)throw Error("Only the league owner can edit these sports.");
   const picked=checked("edit");
   if(!picked.length)throw Error("Choose at least one sport.");
   unwrap(await db().rpc("sec_club_set_sports",{p_club:c.id,p_sports:picked}));
   app()?.toast?.("This league now uses "+picked.length+" sport"+(picked.length===1?"":"s")+". Existing picks are safe.");
  }else if(name==="upgrade"){
   if(!item||item.kind==="club"||item.owner_id!==me().id)
    throw Error("Only the original league owner can add sports.");
   const picked=checked("upgrade");
   if(!picked.includes(item.kind))throw Error("Keep this league’s original sport selected.");
   if(picked.length<2)throw Error("Choose at least one more sport to add.");
   const id=unwrap(await db().rpc("sec_club_upgrade_single",{
    p_sport:item.kind,p_league:item.id,p_sports:picked
   }));
   if(!id)throw Error("Upgrade did not return a league ID.");
   selection="club:"+id;app()?.toast?.("Original league history saved! Invite members to the added sports.");
  }else if(name==="reload"){await load(true);return;}
  else if(name==="sync"){
   if(!c)return;
   unwrap(await db().rpc("sec_club_join",{p_code:c.invite_code}));
   app()?.toast?.("Joined this league’s currently enabled sports.");
   void win.secOnline?.refresh?.();
   for(const s of validSports(c).filter(s=>s!=="football"))void win.SEC_SPORTS?.load?.(s,true);
  }else if(name==="sport"){
   const sport=button.dataset.sport;
   if(!c||!validSports(c).includes(sport))return;
   if(sport==="football")win.secOnline?.useLeague?.(c.football_league);
   else win.SEC_SPORTS?.selectLeague?.(sport,c[sport+"_league"]);
   app()?.setView?.(sportRoute(sport));return;
  }else if(name==="open-sport"){app()?.setView?.(button.dataset.sport);return;}
  else if(name==="share"){
   if(!c){
    if(item?.kind==="football")win.secOnline?.copyInvite?.();
    return;
   }
   const url=new URL(location.href);url.searchParams.set("club",c.invite_code);url.hash="league";
   try{
    if(navigator.share){await navigator.share({title:c.name,url:url.href,text:"Join my SEC league"});return;}
    await navigator.clipboard.writeText(url.href);app()?.toast?.("Invite link copied!");
   }catch(e){if(e.name!=="AbortError")win.prompt("Copy this invite:",url.href);}
   return;
  }else return;
  saveCache(selection);lastLoad=0;await load(true);
  if(selection?.startsWith("football:"))void win.secOnline?.refresh?.();
  else if(/^(basketball|baseball):/.test(selection||""))
    void win.SEC_SPORTS?.load?.(selection.split(":")[0],true);
 }catch(e){message=e.message||"Could not update league.";render();}
 finally{
  actionPending=false;
  if(button)button.disabled=false;
 }
}
async function onView(){
 reset();render();
 await win.secOnline?.whenAuthReady?.();
 await load();
 await invitation();
 render();
}
document.addEventListener("change",e=>{
 if(e.target?.id==="fan-selected-league")void choose(e.target.value);
});
document.addEventListener("click",e=>{
 const btn=e.target.closest?.("[data-league-action]");if(!btn)return;
 e.preventDefault();void action(btn.dataset.leagueAction,btn);
});
win.SEC_LEAGUE_SETTINGS=Object.freeze({onView,render,getClub:club,getStandings:()=>leaderboard.slice(),
 getSelected:selectedItem,getLeagues:()=>items().slice(),choose,load});
if(app()?.view?.()==="league")void onView();
})();