/* Saturdays Down South matchup insights. Nothing is shown as a betting odd or guaranteed winner. */
(function(){
"use strict";
var games={},generated=null,source="";
function num(n){var v=Number(n);return Number.isFinite(v)?v:null;}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function rate(rec){if(!rec)return null;var m=String(rec).match(/^(\d+)-(\d+)/);return m&&(+m[1]+ +m[2])?+m[1]/(+m[1]+ +m[2]):null;}
function estimate(a,b){
  var x=rate(a.record),y=rate(b.record);
  if(x===null||y===null)return null;
  // A small, transparent heuristic, NOT an ESPN or bookmaker forecast.
  var diff=2.4*(y-x)+0.22;
  return Math.max(8,Math.min(92,Math.round(100/(1+Math.exp(-diff)))));
}
function featured(list){
  if(!list || !list.length)return null;
  var ranked=list.map(function(g){
    var d=games[g.id];if(!d)return null;
    var ar=Number(d.away&&d.away.rank)||99, hr=Number(d.home&&d.home.rank)||99;
    if(ar>25&&hr>25)return null;
    var both=ar<=25&&hr<=25;
    // Two ranked teams get priority, then top ranking strength, then estimated competitiveness.
    var p=num(d.home_win_pct);
    var closeness=p!==null?Math.max(0,20-Math.abs(50-p)*0.4):0;
    var score=(both?150:0)+(ar<=25?(26-ar)*2:0)+(hr<=25?(26-hr)*2:0)+closeness;
    return {g:g,score:score};
  }).filter(Boolean).sort(function(a,b){return b.score-a.score;});
  return ranked[0]?ranked[0].g:null;
}
function render(g){
  var d=games[g.id];if(!d)return '<div class="matchup-insight"><span class="insight-muted">Matchup insights are not available yet for this game.</span></div>';
  var away=d.away||{},home=d.home||{},p=num(d.home_win_pct),method="ESPN matchup projection";
  if(p===null||p<0||p>100){p=estimate(away,home);method="Record-based estimate";}
  var ar=away.record||"Not listed",hr=home.record||"Not listed";
  var ap=away.rank&&Number(away.rank)<=25?" · #"+Number(away.rank):"";
  var hp=home.rank&&Number(home.rank)<=25?" · #"+Number(home.rank):"";
  var url=d.source_url&&/^https:\/\/www\.espn\.com\/college-football\/game\//.test(d.source_url)?d.source_url:"";
  var link=url?' · <a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">ESPN matchup ↗</a>':'';
  var result='<div class="insight-head"><strong>📊 Matchup stats</strong><small>'+esc(d.updated_at?new Date(d.updated_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"2026 season")+' · ESPN data'+link+'</small></div>'+
  '<div class="insight-records"><span><b>Away</b> '+esc(ar)+esc(ap)+'</span><span><b>Home</b> '+esc(hr)+esc(hp)+'</span></div>';
  if(p!==null){
    var awayPct=Math.round((100-p)*10)/10;
    p=Math.round(p*10)/10;
    var lean=p>55?g.home:p<45?g.away:'Toss-up';
    result+='<p class="insight-lean"><strong>Projected lean: '+esc(lean)+'</strong> · '+esc(method)+'</p><div class="insight-forecast"><span>'+esc(g.away)+' <strong>'+awayPct+'%</strong></span><span>'+esc(g.home)+' <strong>'+p+'%</strong></span></div>'+
      '<div class="insight-bar" role="img" aria-label="'+esc(g.away)+' '+awayPct+' percent; '+esc(g.home)+' '+p+' percent"><span style="width:'+awayPct+'%"></span></div>'+
      '<p class="insight-disclaimer">'+esc(method)+(method==="Record-based estimate"?" (season win–loss records + home-field adjustment; not a validated predictive model)":" (as published by ESPN)")+' · Predictions are uncertain, not guarantees or betting odds.</p>';
  } else {
    result+='<p class="insight-disclaimer">No verified win probability yet. Records and rankings are for context only.</p>';
  }
  return '<div class="matchup-insight">'+result+'</div>';
}
async function refresh(){
  try{
    var res=await fetch("./stats.json",{cache:"no-store"});
    if(!res.ok)throw new Error("Stats feed unavailable");
    var data=await res.json();
    if(!data||!data.games||typeof data.games!=="object")throw Error("Invalid stats feed");
    games=data.games;generated=data.generated_at;source=data.source;
    if(window.SEC_BRIDGE&&window.SEC_BRIDGE.view()==="picks")window.SEC_BRIDGE.renderPicks();
  }catch(err){console.info("SEC matchup insights unavailable",err);}
}
window.SEC_STATS={render:render,featured:featured,refresh:refresh,lastUpdated:function(){return generated;},count:function(){return Object.keys(games).length;}};
void refresh();
})();