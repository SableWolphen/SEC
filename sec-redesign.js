/* Gamedays Down South — simple navigation and dashboard layer.
   UI-only: never writes leagues, games, memberships, or picks. */
(()=>{'use strict';
const go=v=>document.querySelector('[data-nav="'+v+'"]')?.click();
const sport=v=>{if(v==='football')go('picks');else go(v)};
const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n};
function dashboard(){
 const host=document.getElementById('sec-home-root');if(!host||document.getElementById('sec-simple-home'))return;
 const pane=make('section','sec-simple-home');pane.id='sec-simple-home';
 const label=make('div','sec-simple-heading','Start here');pane.append(label);
 const league=make('button','sec-simple-club');league.type='button';league.dataset.nav='league';
 league.innerHTML='<span aria-hidden="true">🏆</span><span><strong>Your leagues</strong><small>Members, standings and all three sports</small></span><span aria-hidden="true">›</span>';
 pane.append(league);
 const hint=make('p','sec-simple-hint','Choose your sport, then pick the winners.');
 pane.append(hint);
 const tiles=make('div','sec-simple-sports');
 [['football','🏈','Football'],['basketball','🏀','Basketball'],['baseball','⚾','Baseball']].forEach(([id,emoji,name])=>{
  const b=make('button','sec-simple-sport');b.type='button';b.dataset.simpleSport=id;
  b.innerHTML='<span class="sec-simple-emoji" aria-hidden="true">'+emoji+'</span><strong>'+name+'</strong><small>Make picks ›</small>';
  tiles.append(b);
 });pane.append(tiles);
 const row=make('div','sec-simple-quick');
 [['game-center','🏅 Scores'],['trophies','🏆 Trophies'],['more','⚙️ More']].forEach(([id,label])=>{
  const b=make('button','sec-simple-link',label);b.type='button';b.dataset.nav=id;row.append(b);
 });pane.append(row);
 host.parentNode.insertBefore(pane,host); // Keep dashboard persistent when live Home content refreshes.
}
function simplify(){
 // The main five destinations match the visual redesign; account settings live under More.
 document.querySelectorAll('.bottom-nav [data-nav="settings"],.desktop-nav [data-nav="settings"]').forEach(b=>{
 b.dataset.nav='more';const span=b.querySelector('span');if(span)span.textContent='More';else b.textContent='More';
 });
 dashboard();enhance();
 // Existing sport modules redraw asynchronously; enhance after those redraws.
 const root=document.querySelector('main');if(root){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance();});}).observe(root,{childList:true,subtree:true});}
}

/* Pick details use the same authenticated save handler as the existing cards. */
let dialog=null;
function closeDetails(){if(dialog){dialog.remove();dialog=null;}}
function details(card){
 closeDetails();
 const options=[...card.querySelectorAll('[data-sport-action="pick"]')];
 if(options.length!==2)return;
 const title=options.map(b=>b.querySelector('.sport-team-name')?.textContent?.trim()||'Team');
 const meta=card.querySelector('.sport-kickoff')?.textContent?.trim()||'';
 const time=card.querySelector('.sport-game-top span:last-child')?.textContent?.trim()||'';
 const overlay=make('div','sec-pick-overlay');
 const panel=make('section','sec-pick-modal');
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Pick a winner');
 const header=make('div','sec-pick-modal-head');const heading=make('h2','',title.join(' vs '));
 const close=make('button','sec-pick-close','✕');close.type='button';close.setAttribute('aria-label','Close pick details');close.addEventListener('click',closeDetails);
 header.append(heading,close);panel.append(header);
 const sub=make('p','sec-pick-meta',meta+' · '+time);panel.append(sub);
 const msg=make('p','sec-pick-intro','Choose a team, then save your pick.');panel.append(msg);
 const teamRow=make('div','sec-pick-modal-teams');let selected=null;
 options.forEach((source,i)=>{
  const b=make('button','sec-pick-modal-team',title[i]);b.type='button';b.disabled=source.disabled;
  if(source.getAttribute('aria-pressed')==='true'){selected=source;b.classList.add('selected');}
  b.addEventListener('click',()=>{selected=source;teamRow.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');});
  teamRow.append(b);
 });panel.append(teamRow);
 const info=make('details','sec-pick-info');info.innerHTML='<summary>Game information</summary>';
 const content=card.querySelector('.sport-game-provider');if(content)info.append(make('p','',content.textContent));
 panel.append(info);
 const save=make('button','sec-pick-save','Save pick');save.type='button';
 const onResult=e=>{
  if(!selected||e.detail?.game!==selected.dataset.game||e.detail?.sport!==selected.dataset.sport)return;
  document.removeEventListener('sec-sport-pick-result',onResult);
  if(e.detail.ok){closeDetails();return;}
  save.disabled=false;save.textContent='Try saving again';
  msg.textContent=e.detail.message||'Unable to save. Your previous pick was not changed.';
 };
 save.addEventListener('click',()=>{
  if(!selected){msg.textContent='Select a team first.';return;}
  if(selected.disabled){msg.textContent='This matchup is unavailable for picks.';return;}
  save.disabled=true;save.textContent='Saving…';msg.textContent='Waiting for secure confirmation';
  document.removeEventListener('sec-sport-pick-result',onResult);
  document.addEventListener('sec-sport-pick-result',onResult);
  selected.click();
 });panel.append(save);
 overlay.append(panel);overlay.addEventListener('click',e=>{if(e.target===overlay)closeDetails();});
 document.body.append(overlay);dialog=overlay;close.focus();
}
function enhanceSportCards(){
 document.querySelectorAll('.sport-game-card').forEach(card=>{
  if(card.querySelector('.sec-open-pick'))return;
  const opts=card.querySelectorAll('[data-sport-action="pick"]');
  if(opts.length!==2)return;
  const open=make('button','sec-open-pick',opts[0].disabled&&opts[1].disabled?'View game details':'Open game & pick winner');
  open.type='button';open.addEventListener('click',()=>details(card));
  card.querySelector('.sport-team-options')?.after(open);
 });
}
function enhanceSecondary(){
 const league=document.getElementById('league-view');
 if(league&&!document.getElementById('sec-league-intro')){
  const t=make('div','sec-screen-intro');t.id='sec-league-intro';
  t.innerHTML='<strong>🏆 Your league</strong><p>See your standings, members and competition in one place.</p>';
  league.querySelector('.page-intro')?.after(t);
 }
 const scores=document.getElementById('game-center-view');
 if(scores&&!document.getElementById('sec-score-shortcuts')){
  const shortcuts=make('div','sec-score-shortcuts');shortcuts.id='sec-score-shortcuts';
  [['football','🏈 Football'],['basketball','🏀 Basketball'],['baseball','⚾ Baseball']].forEach(([id,label])=>{
   const b=make('button','sec-score-shortcut',label);b.type='button';b.dataset.simpleSport=id;shortcuts.append(b);
  });
  scores.querySelector('h1')?.after(shortcuts);
 }
 const profile=document.getElementById('settings-view');
 if(profile&&!document.getElementById('sec-profile-intro')){
  const intro=make('div','sec-screen-intro');intro.id='sec-profile-intro';
  intro.innerHTML='<strong>👤 Your profile</strong><p>Manage your account, notifications, preferences and game settings.</p>';
  profile.querySelector('.page-intro')?.after(intro);
 }
 const more=document.getElementById('more-view');
 if(more&&!document.getElementById('sec-more-guide')){
  const guide=make('div','sec-more-guide');guide.id='sec-more-guide';
  [['settings','👤 My profile & settings','Manage your account, reminders and preferences'],['trophies','🏆 Trophies','Your wins and achievements'],['news','📰 SEC news','Stay informed'],['teams','🏟️ Teams','Browse SEC schools']].forEach(([id,label,desc])=>{
   const b=make('button','sec-more-row');b.type='button';b.dataset.nav=id;
   const name=make('strong','',label);const sub=make('small','',desc);b.append(name,sub);guide.append(b);
  });more.querySelector('.page-intro')?.after(guide);
 }
}
function enhanceDashboardProgress(){
 const pane=document.getElementById('sec-simple-home');if(!pane)return;
 let target=pane.querySelector('.sec-live-progress');
 if(!target){target=make('div','sec-live-progress');pane.querySelector('.sec-simple-hint')?.after(target);}
 const sports=[['football','🏈','Football'],['basketball','🏀','Basketball'],['baseball','⚾','Baseball']];
 const rows=sports.map(([id,emoji,name])=>{
  const state=window.SEC_SPORTS?.getState?.(id);
  if(!state?.games?.length)return null;
  const now=Date.now();
  const eligible=state.games.filter(g=>g.game_status==='scheduled'&&Date.parse(g.kickoff_at)>now);
  const picks=state.picks||{};
  const outstanding=eligible.filter(g=>!picks[g.id]?.pick_code).length;
  return {id,emoji,name,outstanding,total:eligible.length};
 }).filter(Boolean);
 const signature=JSON.stringify(rows);
 if(target.dataset.signature===signature)return;
 target.dataset.signature=signature;
 target.replaceChildren();
 for(const row of rows){
  const b=make('button','sec-progress-row');b.type='button';b.dataset.simpleSport=row.id;
  const name=make('span','',row.emoji+' '+row.name);
  const count=make('strong','',row.total===0?'No upcoming games':row.outstanding===0?'All caught up':row.outstanding+' picks remaining');
  b.append(name,count);target.append(b);
 }
}
function enhanceLeagueSports(){
 const league=document.getElementById('league-view');
 if(!league||document.getElementById('sec-league-sports'))return;
 const wrapper=make('section','sec-league-sports');wrapper.id='sec-league-sports';
 wrapper.append(make('strong','', 'Choose a sport to make picks'));
 const nav=make('div','sec-score-shortcuts');
 [['football','🏈 Football'],['basketball','🏀 Basketball'],['baseball','⚾ Baseball']].forEach(([id,label])=>{
  const b=make('button','sec-score-shortcut',label);b.type='button';b.dataset.simpleSport=id;nav.append(b);
 });
 wrapper.append(nav);
 league.querySelector('#sec-league-intro')?.after(wrapper);
}
function enhance(){
 enhanceSportCards();enhanceSecondary();enhanceDashboardProgress();enhanceLeagueSports();
}

document.addEventListener('click',e=>{
 const b=e.target.closest?.('[data-simple-sport]');if(!b)return;
 e.preventDefault();sport(b.dataset.simpleSport);
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',simplify,{once:true});else simplify();
})();
