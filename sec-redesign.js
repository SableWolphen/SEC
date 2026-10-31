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
 dashboard();
}
document.addEventListener('click',e=>{
 const b=e.target.closest?.('[data-simple-sport]');if(!b)return;
 e.preventDefault();sport(b.dataset.simpleSport);
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',simplify,{once:true});else simplify();
})();
