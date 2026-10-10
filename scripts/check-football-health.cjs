"use strict";
/* SEC football public-health check. No login, private player data, admin token, or fake results. */
const fs=require("node:fs");
const path=require("node:path");

function evaluate(games,now=Date.now()){
 if(!Array.isArray(games)||games.length<100)
  return {ok:false,issues:["Football schedule unavailable or incomplete (expected full-season games)"],checked:games?.length||0};
 const problems=[],seen=new Set();
 for(const g of games){
  if(!g||!g.id||seen.has(g.id)){problems.push("Duplicate/invalid fixture ID");continue;}
  seen.add(g.id);
  const kickoff=Date.parse(g.kickoff_at||"");
  if(!Number.isFinite(kickoff)){problems.push(g.id+" has no confirmed lock timestamp");continue;}
  const state=g.game_status||"scheduled",elapsed=now-kickoff;
  if(!["scheduled","live","final","canceled","postponed"].includes(state)){
    problems.push(g.id+" unknown status: "+state);continue;
  }
  if(state==="final"){
   if(g.winner!==g.away_code&&g.winner!==g.home_code)
    problems.push(g.id+" is final without a verified winning team");
   if(!Number.isInteger(g.away_score)||!Number.isInteger(g.home_score)||
      g.away_score===g.home_score)
    problems.push(g.id+" has invalid/tied final football score");
  }else if(state==="live"){
   const last=Date.parse(g.score_updated_at||"");
   // A real halftime, replay, or extended stoppage can last 20+ minutes.
   // Only warn after 25 min of a genuinely unchanged reported game state.
   if(elapsed>25*60000&&(elapsed<9*3600000)&&
     (!Number.isFinite(last)||now-last>25*60000))
    problems.push(g.id+" live score unchanged for over 25 minutes");
  }else if(state==="scheduled"){
   if(elapsed>65*60000&&elapsed<24*3600000)
    problems.push(g.id+" kickoff was over 65 minutes ago but no live score was published");
  }
 }
 return {ok:problems.length===0,issues:problems.slice(0,25),checked:games.length,
   final:games.filter(g=>g.game_status==="final").length,live:games.filter(g=>g.game_status==="live").length,
   pending:games.filter(g=>g.game_status==="scheduled").length};
}
function publicConfig(content){
 const url=content.match(/\burl:\s*['"](https:\/\/[a-z0-9-]+\.supabase\.co)['"]/);
 const key=content.match(/\bpublishableKey:\s*['"](sb_publishable_[A-Za-z0-9_-]+)['"]/);
 if(!url||!key)throw Error("Only the existing public browser configuration is supported");
 return {url:url[1],key:key[1]};
}
async function run(){
 const {url,key}=publicConfig(fs.readFileSync(path.resolve(__dirname,"../config.js"),"utf8"));
 const cols="id,kickoff_at,game_status,away_code,home_code,away_score,home_score,winner,score_updated_at";
 const query=new URLSearchParams({select:cols,order:"kickoff_at.asc",limit:"500"});
 const response=await fetch(url+"/rest/v1/sec_games?"+query.toString(),{
   headers:{apikey:key,Accept:"application/json"},
   signal:AbortSignal.timeout(20000)
 });
 if(!response.ok)throw Error("Public football score read unavailable (HTTP "+response.status+")");
 const data=await response.json();
 const report=evaluate(data);
 fs.writeFileSync(path.resolve(process.env.GITHUB_WORKSPACE||".","football-health-status.json"),
   JSON.stringify({...report,checked_at:new Date().toISOString()},null,2)+"\n");
 console.log(JSON.stringify(report,null,2));
 if(!report.ok)process.exitCode=1;
}
if(require.main===module)run().catch(err=>{
 console.error("Football game-day data check failed:",err.message);
 process.exitCode=1;
});
module.exports={evaluate,publicConfig};
