/* Verified completed-game layout. Never hardcode scores or member picks. */
(()=>{
"use strict";
const e=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const points=x=>x===null?"—":Number(x).toLocaleString("en-US",{maximumFractionDigits:1})+" pts";
function team(g,id,d,ctx){
 const t=ctx.team(id),winner=d.winner===id,mine=d.pick===id;
 const n=id===g.away?d.awayScore:d.homeScore;
 return '<div class="sec-final-team'+(winner?' is-winner':'')+(mine?' is-my-pick':'')+'">'+
 ctx.logo(id)+'<span class="sec-final-team-copy"><strong>'+e(t.name)+'</strong>'+
 '<small>'+e(t.nick)+'</small></span>'+
 '<strong class="sec-final-team-score" aria-label="'+e(t.name)+' scored '+n+'">'+n+'</strong>'+
 '<span class="sec-final-team-foot"><span class="sec-final-team-context">'+
 (window.SEC_STATS?.pickContext?.(g,id)||'')+'</span>'+
 (winner?'<small class="sec-final-winner-label">🏆 WINNER</small>':'')+
 '</span></div>';
}
function grade(g,d,ctx){
 const winner=e(ctx.team(d.winner).name),margin=Math.abs(d.homeScore-d.awayScore);
 const label=d.mode==="spread"?
  d.spread===null?"Spread pending":d.push?"Spread push":
  d.cover===d.winner?"Covered "+(d.winner===g.home?(d.spread>0?"+":"")+d.spread:
  (-d.spread>0?"+":"")+(-d.spread)):"Won by "+margin+" · did not cover":
  "Won by "+margin;
 const kind=d.points===null?"unknown":d.points>0?"correct":"missed";
 const icon=kind==="correct"?"✓":kind==="missed"?"✕":"–";
 return '<div class="sec-final-grade">'+
 '<div class="sec-final-metric"><span class="sec-final-metric-icon '+kind+'">'+icon+'</span>'+
 '<span><small>YOUR PICK</small><b>'+e(d.pick?ctx.team(d.pick).name:"No pick")+'</b>'+
 '<strong class="'+kind+'">'+e(points(d.points))+'</strong></span></div>'+
 '<div class="sec-final-metric"><span class="sec-final-metric-icon success">▥</span>'+
 '<span><small>RESULT</small><b>'+winner+' won</b><strong class="success">'+e(label)+'</strong></span></div>'+
 '<div class="sec-final-metric"><span class="sec-final-metric-icon star">★</span>'+
 '<span><small>LEAGUE IMPACT</small>'+
 (d.total?'<b>'+d.majorityCount+' of '+d.total+' picked '+e(d.majority)+'</b>'+
 '<strong class="missed">'+d.missed+' missed their pick</strong>':
 '<b>League picks unavailable</b>')+'</span></div></div>';
}
function friends(g,d){
 if(!d.total)return '<div class="sec-final-no-reveals">League picks appear after kickoff when available.</div>';
 const pct=Math.round(d.awayCount/d.total*100),opct=100-pct;
 return '<details class="sec-final-reveal"><summary>'+
 '<span class="sec-final-friends-symbol" aria-hidden="true">♟</span>'+
 '<span class="sec-final-friends-summary"><b>Friends’ picks revealed</b><small>'+
 e(g.away)+': '+d.awayCount+' ('+pct+'%) · '+e(g.home)+': '+d.homeCount+' ('+opct+'%)</small></span>'+
 '<span class="sec-final-pick-count">'+d.total+' picks</span><span class="sec-final-chevron">⌄</span></summary>'+
 '<div class="sec-final-friends-content"><div class="sec-final-pick-bar" aria-label="'+e(g.away)+' '+pct+
 ' percent, '+e(g.home)+' '+opct+' percent" role="img"><span style="width:'+pct+'%"></span></div>'+
 '<div class="sec-final-pick-split"><span>'+e(g.away)+': '+d.awayCount+' ('+pct+'%)</span>'+
 '<span>'+e(g.home)+': '+d.homeCount+' ('+opct+'%)</span></div>'+
 '<div class="sec-final-pick-people">'+d.reveal.map(x=>'<span>'+e(x.display_name||"Player")+
 ': <b>'+e(x.pick_code)+'</b></span>').join("")+'</div></div></details>';
}
function render(g,index,ctx){
 const d=window.SEC_FEATURES?.finalData?.(g);
 if(!d)return "";
 const event=String(d.eventId||""),hasLink=/^\d{6,14}$/.test(event);
 const url=hasLink?"https://www.espn.com/college-football/":null;
 const link=(name,desc,suffix,symbol,cls)=>'<'+(url?'a href="'+url+suffix+'/_/gameId/'+event+
 '" target="_blank" rel="noopener noreferrer"':'div aria-disabled="true"')+
 ' class="sec-final-action '+cls+'"><span class="sec-final-action-symbol">'+symbol+'</span>'+
 '<span class="sec-final-action-label"><b>'+name+'</b><small>'+desc+'</small></span>'+
 '<span class="sec-final-action-arrow" aria-hidden="true">›</span></'+(url?'a':'div')+'>';
 return '<article class="game-card sec-final-card" data-game-id="'+e(g.id)+'" data-final-game="true" tabindex="-1">'+
 '<div class="game-header"><div class="game-index"><strong>'+String(index+1).padStart(2,"0")+'</strong> / MATCHUP</div>'+
 '<div class="game-meta">'+ctx.displayDate(g.date,g.date!==ctx.weekDate)+' · '+e(ctx.gameTime(g))+
 (g.network?' · '+e(g.network):"")+'</div></div>'+
 '<div class="sec-final-teams">'+team(g,g.away,d,ctx)+'<span class="sec-final-vs">VS</span>'+
 team(g,g.home,d,ctx)+'</div>'+
 '<div class="sec-final-scoreline"><strong>✓ FINAL</strong><span>'+e(g.away)+' '+
 d.awayScore+' – '+d.homeScore+' '+e(g.home)+'</span></div>'+
 grade(g,d,ctx)+friends(g,d)+
 '<div class="sec-final-actions">'+
 link("Game Recap",url?"Final stats, scoring summary and key plays":"Recap not yet available",
 "game","▤","sec-final-recap-link")+
 link("View Box Score",url?"Official game statistics":"Stats not yet available",
 "boxscore","▥","sec-final-box-link")+'</div></article>';
}
window.SEC_FINAL_CARDS=Object.freeze({render});
if(window.SEC_BRIDGE?.view?.()==="picks")window.SEC_BRIDGE.renderPicks?.();
})();