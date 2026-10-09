/* Tournament brackets are pickable only for authenticated, SEC-verified fixtures.
   A real SEC bracket must be imported server-side before any matchup appears. */
(()=>{
"use strict";
const app=()=>window.SEC_BRIDGE,db=()=>window.secOnline?.getClient?.(),user=()=>window.secOnline?.getUser?.(),club=()=>window.SEC_FAN?.getClub?.();
const esc=x=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const unpack=x=>{if(x?.error)throw x.error;return x?.data;};
const html=id=>document.getElementById(id);
let fixtures=[],own=[],basketball=[],baseball=[],currentClub=null,currentUser=null,last=0,pending=false,error="";
const dates=iso=>{const n=Date.parse(iso);return Number.isFinite(n)?new Date(n).toLocaleString("en-US",
 {timeZone:"America/Chicago",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"Time pending";};
const sportLabel={basketball:"🏀 Men's Basketball",baseball:"⚾ Baseball"};
const safeSource=s=>typeof s==="string"&&/^https:\/\/www\.secsports\.com\/[a-zA-Z0-9/_-]+$/.test(s)?s:null;
const sportYear=(c,s)=>Number(c?.[s+"_season"]);
function gameCard(g){
 const selected=own.find(p=>p.game_id===g.id)?.pick_code;
 const kickoff=Date.parse(g.kickoff_at),locked=!Number.isFinite(kickoff)||kickoff<=Date.now()||g.status!=="scheduled";
 const button=(code,label)=>'<button type="button" class="fan-bracket-team '+(selected===code?"selected":"")+
 '" data-bracket-game="'+esc(g.id)+'" data-bracket-pick="'+esc(code)+'" aria-pressed="'+(selected===code)+
 '" '+(locked?"disabled":"")+'>'+esc(label)+(selected===code?" ✓":"")+'</button>';
 const outcome=g.status==="final"&&g.winner_code?(selected?(selected===g.winner_code?"✓ Correct":"✕ Missed"):"Final"):"";
 const source=safeSource(g.source_url);
 return '<article class="fan-bracket-game"><div class="fan-bracket-top"><b>'+esc(g.round_label)+'</b>'+
  '<span>'+esc(g.status==="final"?"Final":g.status==="live"?"● Live":dates(g.kickoff_at))+'</span></div>'+
  '<div class="fan-bracket-teams">'+button(g.away_code,g.away_name)+
  '<span>VS</span>'+button(g.home_code,g.home_name)+'</div>'+
  '<p class="fan-subtle">'+(outcome|| (locked?"Picks closed":"Pick your tournament winner"))+
  (source?' · <a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">Official matchup ↗</a>':"")+'</p></article>';
}
function render(){
 const root=html("fan-brackets");if(!root)return;
 const c=club(),isMember=Boolean(user()&&c);
 const bracket=(sport)=>{
  const enabled=Array.isArray(c?.enabled_sports)?c.enabled_sports.includes(sport):true;
  if(!enabled)return "";
  const year=sportYear(c,sport),games=fixtures.filter(g=>g.sport===sport&&g.season===year);
  const board=sport==="basketball"?basketball:baseball;
  const winners=board.filter(row=>Number(row.correct)>0).slice().sort((a,b)=>Number(b.correct)-Number(a.correct));
  return '<section class="fan-bracket-section"><h4>'+sportLabel[sport]+(year?" · "+year:"")+'</h4>'+
   (!isMember?'<p class="fan-subtle">Join an all-sports league to compete in the bracket.</p>':
   !games.length?'<p class="fan-subtle">No official tournament seeds and first tip/first pitch are verified in the bracket feed yet. Picks will unlock once published.</p>':
   '<div class="fan-bracket-games">'+games.map(gameCard).join("")+'</div>'+
   (winners.length?'<p class="fan-subtle">Current leaders: '+winners.slice(0,3).map(x=>esc(x.display_name)+" "+Number(x.correct)).join(" · ")+'</p>':""))+
   '<a href="https://www.secsports.com/sport/'+(sport==="basketball"?"mens-basketball":"baseball")+
   '" target="_blank" rel="noopener noreferrer">Official SEC '+(sport==="basketball"?"basketball":"baseball")+' coverage ↗</a></section>';
 };
 root.innerHTML='<details class="fan-fold fan-tournament" '+(fixtures.length?"open":"")+'><summary>🏀⚾ SEC Tournament brackets <span>'+
  (fixtures.length?fixtures.length+" official games":"Awaiting official matchups")+'</span></summary>'+
  '<p class="fan-subtle">Bracket picks count only within your joined all-sports league. The server locks selections at verified game time.</p>'+
  (error?'<p class="fan-warning">'+esc(error)+'</p>':"")+
  '<div class="fan-tournament-columns">'+bracket("basketball")+bracket("baseball")+'</div></details>';
}
async function load(force=false){
 const c=club(),u=user();
 if(!db()||!u||!c){fixtures=[];own=[];currentClub=null;currentUser=u?.id||null;render();return;}
 if(pending)return;
 if(!force&&currentClub===c.id&&currentUser===u.id&&Date.now()-last<2*60000){render();return;}
 pending=true;error="";
 try{
  const rr=await db().from("sec_bracket_games").select("id,sport,season,round_label,away_code,away_name,home_code,home_name,kickoff_at,winner_code,status,source_url").order("kickoff_at");
  const fetched=unpack(rr)||[];
  fixtures=fetched.filter(g=>["baseball","basketball"].includes(g.sport)&&
    (!Array.isArray(c.enabled_sports)||c.enabled_sports.includes(g.sport))&&
    g.season===sportYear(c,g.sport));
  const [p,b,base]=await Promise.all([
   db().from("sec_bracket_picks").select("game_id,pick_code").eq("club_id",c.id).eq("user_id",u.id),
   db().rpc("sec_bracket_standings",{p_club:c.id,p_sport:"basketball"}),
   db().rpc("sec_bracket_standings",{p_club:c.id,p_sport:"baseball"})
  ]);
  own=unpack(p)||[];basketball=unpack(b)||[];baseball=unpack(base)||[];
  currentClub=c.id;currentUser=u.id;last=Date.now();
 }catch(e){error="Tournament feed unavailable. Try again.";console.info("SEC brackets",e.message);}
 finally{pending=false;render();}
}
async function select(gameId,code){
 const c=club(),g=fixtures.find(x=>x.id===gameId);if(!c||!g||!user())return;
 try{
  unpack(await db().rpc("sec_bracket_save",{p_club:c.id,p_game:gameId,p_pick:code}));
  await load(true);
  app()?.toast?.("Tournament pick saved!");
 }catch(e){error=e.message||"Pick could not be saved";render();}
}
document.addEventListener("click",e=>{
 const btn=e.target.closest?.("[data-bracket-game]");if(!btn)return;
 e.preventDefault();
 if(btn.disabled)return;
 void select(btn.dataset.bracketGame,btn.dataset.bracketPick);
});
window.SEC_BRACKETS=Object.freeze({mount:()=>load(),getFixtures:()=>fixtures.slice()});
if(app()?.view?.()==="league")void load();
})();