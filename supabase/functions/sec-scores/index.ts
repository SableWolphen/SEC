// SEC scores: ESPN public scoreboard -> verified game results.
// Called only by the private pg_cron token kept in Supabase Vault; no arbitrary client writes.
const PROJECT = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ESPN="https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard";
const aliases: Record<string,string[]> = {
 ALA:["ALA","BAMA","ALABAMA"],ARK:["ARK","ARKANSAS"],AUB:["AUB","AUBURN"],
 FLA:["FLA","FLORIDA"],UGA:["UGA","GEORGIA"],UK:["UK","KENTUCKY"],LSU:["LSU"],
 MISS:["MISS","OLE MISS","MISSISSIPPI"],MSST:["MSST","MISS STATE","MISSISSIPPI STATE"],
 MIZ:["MIZ","MIZZOU","MISSOURI"],OU:["OU","OKLAHOMA"],SC:["SC","SCAR","SOUTH CAROLINA"],
 TENN:["TENN","TENNESSEE"],TEX:["TEX","TEXAS"],TAMU:["TAMU","TA&M","TEXAS A&M","TEXAS AM"],
 VAN:["VAN","VANDERBILT"],CLEM:["CLEM","CLEMSON"],OHST:["OSU","OHST","OHIO STATE"],
 GATECH:["GATECH","GT","GEORGIA TECH"],FSU:["FSU","FLORIDA STATE"],BAY:["BAY","BAYLOR"],
 ULM:["ULM","LOUISIANA MONROE"],LOU:["LOU","LOUISVILLE"],UTAH:["UTAH"],
 // In 2026 KSU means Kennesaw State, not Kansas State.
 KSU:["KSU","KENN","KENNESAW","KENNESAW STATE"],NCST:["NCST","NC STATE"],CHAR:["CHAR","CHARLOTTE"],
 ECU:["ECU","EAST CAROLINA"],ASU:["ASU","ARIZONA STATE"],TROY:["TROY"],
 UTSA:["UTSA"],TXST:["TXST","TEXAS STATE"],KANS:["KU","KANSAS"],
 MICH:["MICH","MICHIGAN"],MINN:["MINN","MINNESOTA"],FAU:["FAU","FLORIDA ATLANTIC"],
 UTEP:["UTEP"],SOMISS:["USM","SOUTHERN MISS"],WKU:["WKU","WESTERN KENTUCKY"],
 LATECH:["LT","LOUISIANA TECH"],UNM:["UNM","NEW MEXICO"],SOALA:["USA","SOUTH ALABAMA"],
 AUSTPEAY:["APSU","APS","AUSTIN PEAY","AUSTIN PEAY STATE"],
 NALA:["UNA","NORTH ALABAMA","NORTH ALA"],
 TNSTATE:["TSU","TNST","TENNESSEE STATE","TENNESSEE ST"],
 CAMP:["CAMP","CAM","CAMPBELL"]
};
const norm=(s:unknown)=>String(s??"").toLowerCase().replace(/[^a-z0-9]/g,"");
const stamp=()=>new Date().toISOString();
const jsonify=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
function recognize(code:string,competitor:any):boolean{
 const t=competitor?.team||{};
 const keys=[code,...(aliases[code]||[])].map(norm);
 const candidates=[t.abbreviation,t.shortDisplayName,t.displayName,t.location,t.name].map(norm);
 return keys.some(x=>candidates.includes(x));
}
function stateFrom(event:any,comp:any):string{
 const typ=event?.status?.type || comp?.status?.type || {};
 const state=String(typ.state||"").toLowerCase();
 const name=String(typ.name||"").toLowerCase();
 // ESPN can mark a canceled game 'completed'. Cancellation and postponement
 // must take precedence, so a non-game cannot be scored as a final.
 if(name.includes("postpon"))return "postponed";
 if(name.includes("cancel"))return "canceled";
 if(typ.completed===true && (name.includes("final")||state==="post"))return "final";
 if(state==="in")return "live";
 return "scheduled";
}
function parseNum(raw:unknown):number|null{
 const n=Number(raw);return raw===null||raw===undefined||raw===""||!Number.isFinite(n)?null:n;
}
async function api(path:string,options?:RequestInit):Promise<any>{
 const res=await fetch(PROJECT+"/rest/v1/"+path,{...options,headers:{
  apikey:SERVICE,Authorization:"Bearer "+SERVICE, ...(options?.headers||{}) as Record<string,string>
 }});
 if(!res.ok)throw Error("Database request failed: "+res.status+" "+(await res.text()).slice(0,190));
 return (res.status===204||!res.headers.get("content-type")?.includes("json"))?null:await res.json();
}
async function espn(date:string):Promise<any[]>{
 const res=await fetch(ESPN+"?dates="+date.replaceAll("-","")+"&groups=80&limit=350",{
   headers:{"Accept":"application/json","User-Agent":"SaturdaysDownSouth-SEC-Pickem/1.0"},
   signal:AbortSignal.timeout(12000)
 });
 if(!res.ok)throw Error("ESPN returned "+res.status+" for "+date);
 const data=await res.json();return data.events||[];
}

const ESPN_SUMMARY="https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=";
const SITUATION_KEYS=["live_possession_code","live_down","live_distance","live_position_text",
 "live_field_percent","live_drive_summary","live_last_play"];
function liveSituation(summary:any,away:any,home:any):Record<string,unknown>{
 const info=summary?.situation||summary?.header?.competitions?.[0]?.situation||{};
 const current=summary?.drives?.current||null;
 const plays=Array.isArray(current?.plays)?current.plays:[];
 const latest=info?.lastPlay||plays[plays.length-1]||null;
 const ids=[away?.team?.id,home?.team?.id].map(x=>String(x||""));
 let possession=info?.possession??null;
 if(possession&&typeof possession==="object"){
  possession=possession.id||possession.team?.id||String(possession.$ref||"").split("/").pop();
 }
 const raw=String(possession??"").trim();
 let code=raw&&raw===ids[0]?away.team.abbreviation:raw&&raw===ids[1]?home.team.abbreviation:null;
 // A completed drive can still name the team that just punted. Do not
 // infer *current* possession from a drive's previous offensive team.
 if(!code){
  const competitors=summary?.header?.competitions?.[0]?.competitors||[];
  const carrying=competitors.filter((v:any)=>v?.possession===true);
  if(carrying.length===1){
   const id=String(carrying[0]?.team?.id||"");
   code=id===ids[0]?away.team.abbreviation:id===ids[1]?home.team.abbreviation:null;
  }
 }
 // Normalize ESPN's external abbreviations to our own matching code at caller.
 const validDown=(x:unknown)=>Number.isInteger(Number(x))&&Number(x)>=1&&Number(x)<=4?Number(x):null;
 const validDistance=(x:unknown)=>x!==null&&x!==undefined&&x!==""&&
  Number.isInteger(Number(x))&&Number(x)>=0&&Number(x)<=99?Number(x):null;
 const down=validDown(info.down??latest?.end?.down);
 const distance=validDistance(info.distance??latest?.end?.distance);
 const posStrings=[info.possessionText,info.downDistanceText,latest?.end?.text]
  .filter(x=>typeof x==="string"&&x.length<140);
 let positionText:string|null=null;
 for(const str of posStrings){
  const m=String(str).match(/(?:^|\bat\s+)([A-Z][A-Za-z0-9&.' -]{0,16})\s+(\d{1,2})(?:\b|$)/);
  if(m&&Number(m[2])<=50){positionText=(m[1].trim()+" "+m[2]).slice(0,34);break;}
 }
 const endzone=latest?.end?.yardsToEndzone??info.yardsToEndzone;
 const yards=endzone!==null&&endzone!==undefined&&endzone!==""?Number(endzone):NaN;
 // The marker moves only when ESPN explicitly reports yards remaining to goal
 // AND which verified team has possession. No guess from an ambiguous yardLine.
 const pct=code&&down!==null&&Number.isInteger(yards)&&yards>=0&&yards<=100?100-yards:null;
 const summaryText=typeof current?.description==="string"?current.description.slice(0,90):null;
 const playText=typeof latest?.text==="string"?latest.text.slice(0,180):null;
 return {live_possession_code:code||null,live_down:down,live_distance:distance,
  live_position_text:positionText,live_field_percent:pct,
  live_drive_summary:summaryText,live_last_play:playText};
}
async function liveSummary(id:string):Promise<any|null>{
 if(!/^\d{6,14}$/.test(id))return null;
 try{
  const res=await fetch(ESPN_SUMMARY+id,{
   headers:{"Accept":"application/json","User-Agent":"SaturdaysDownSouth-SEC-Pickem/1.0"},
   signal:AbortSignal.timeout(3000)
  });
  if(!res.ok)return null;
  return await res.json();
 }catch{return null;}
}

Deno.serve(async req=>{
 if(req.method!=="POST")return jsonify({error:"POST only"},405);
 if(!PROJECT||!SERVICE)return jsonify({error:"Server not configured"},503);
 const token=req.headers.get("x-sec-job-token")||"";
 if(token.length<32)return jsonify({error:"Forbidden"},403);
 try{
  const valid=await api("rpc/sec_verify_scores_job",{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({p_token:token})
  });
  if(valid!==true)return jsonify({error:"Forbidden"},403);
 }catch(e){console.error("SEC job authorization failed",e);return jsonify({error:"Authorization unavailable"},503);}
 try{
  const games:any[]=await api("sec_games?select=id,game_date,kickoff_at,away_code,home_code,game_status,status_detail,away_score,home_score,espn_event_id,spread_home,score_updated_at,live_possession_code,live_down,live_distance,live_position_text,live_field_percent,live_drive_summary,live_last_play,live_situation_updated_at&order=game_date.asc");
  const today=new Date().toISOString().slice(0,10);
  const min=new Date(Date.now()-65*86400000).toISOString().slice(0,10);
  const max=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  // No fake ESPN predictions: only reported competitions with both teams matched.
  const eligible=games.filter(g=>g.game_date>=min&&g.game_date<=max&&
    (g.game_status!=="final" || g.game_date>=new Date(Date.now()-3*86400000).toISOString().slice(0,10)));
  const datesSet=new Set<string>(eligible.map(g=>g.game_date));
  // Search adjacent published scoreboard days only for near-term games. This
  // safely picks up ESPN changes from Saturday to Friday/Sunday without
  // making broad historical or next-season requests every minute.
  for(const g of eligible){
   const at=Date.parse(g.kickoff_at);
   if(g.game_status==="final" || !Number.isFinite(at) ||
      at<Date.now()-36*3600000 || at>Date.now()+72*3600000)continue;
   for(const d of [-1,1])datesSet.add(new Date(Date.parse(g.game_date+"T12:00:00Z")+d*86400000).toISOString().slice(0,10));
  }
  const dates=[...datesSet].sort();
  const matches:Record<string,any[]>={};
  let failures=0;
  for(let i=0;i<dates.length;i+=5){
   await Promise.all(dates.slice(i,i+5).map(async day=>{
    try{matches[day]=await espn(day);}
    catch(e){failures++;console.warn("ESPN fetch",day,String(e));}
   }));
  }

  // Enrich only matched live SEC games, in bounded concurrent batches.
  // One bad ESPN summary must never interfere with official score grading.
  const liveEvents=new Set<string>();
  const currentTime=Date.now();
  for(const g of eligible){
   const kick=Date.parse(g.kickoff_at||"");
   if(!Number.isFinite(kick)||kick<currentTime-9*3600000||kick>currentTime+2*3600000)continue;
   for(const entries of Object.values(matches)){
    for(const ev of entries){
     const c=ev.competitions?.[0];
     if(!c||stateFrom(ev,c)!=="live")continue;
     const a=(c.competitors||[]).find((x:any)=>x.homeAway==="away");
     const h=(c.competitors||[]).find((x:any)=>x.homeAway==="home");
     if(a&&h&&recognize(g.away_code,a)&&recognize(g.home_code,h)&&/^\d{6,14}$/.test(String(ev.id)))
      liveEvents.add(String(ev.id));
    }
   }
  }
  const detailed=new Map<string,any>();
  const ids=[...liveEvents].slice(0,24);
  for(let i=0;i<ids.length;i+=6){
   await Promise.all(ids.slice(i,i+6).map(async id=>{
    const data=await liveSummary(id);
    if(data)detailed.set(id,data);
   }));
  }

  let updated=0, skipped=0,finals=0,lines=0;
  for(const g of eligible){
   const all=[...(matches[g.game_date]||[])];
   // Adjacent-day candidates must match the exact event ID when known, or
   // uniquely match both competitors; never trust only one school/name.
   const at=Date.parse(g.kickoff_at);
   if(g.game_status!=="final" && Number.isFinite(at) &&
      at>=Date.now()-36*3600000 && at<=Date.now()+72*3600000){
     for(const d of [-1,1]){
       const day=new Date(Date.parse(g.game_date+"T12:00:00Z")+d*86400000).toISOString().slice(0,10);
       all.push(...(matches[day]||[]));
     }
   }
   const unique=[...new Map(all.map(ev=>[String(ev.id),ev])).values()];
   const valid=unique.map(ev=>{
     const comp=(ev.competitions||[])[0];
     const away=(comp?.competitors||[]).find((c:any)=>c.homeAway==="away");
     const home=(comp?.competitors||[]).find((c:any)=>c.homeAway==="home");
     return away&&home&&recognize(g.away_code,away)&&recognize(g.home_code,home)?{ev,comp,away,home}:null;
   }).filter(Boolean);
   const byId=g.espn_event_id?valid.filter(v=>String(v.ev.id)===String(g.espn_event_id)):[];
   const candidates=byId.length?byId:valid;
   if(candidates.length!==1){skipped++;continue;}
   const {ev,comp,away,home}=candidates[0];
   const rawStatus=stateFrom(ev,comp);
   const awayScore=parseNum(away.score),homeScore=parseNum(home.score);
   // Only declare winners from an official completed event with two distinct scores.
   const winner=rawStatus==="final"&&awayScore!==null&&homeScore!==null&&awayScore!==homeScore
      ?(homeScore>awayScore?g.home_code:g.away_code):null;
   const status=rawStatus==="final"&&!winner?"live":rawStatus;
   // Never undo a previously verified final if the provider briefly regresses.
   if(g.game_status==="final"&&status!=="final"){skipped++;continue;}
   const liveStatus=ev.status||comp.status||{};
   const period=Number(liveStatus.period);
   const rawClock=String(liveStatus.displayClock||"").trim();
   const clock=/^\d{1,2}:\d{2}$/.test(rawClock)?rawClock:null;
   const periodName=period>=1&&period<=4?"Q"+period:period>=5&&period<=8?"OT"+(period-4):null;
   const stage=status==="live"&&clock&&periodName?periodName+" · "+clock:null;
   const detail=stage||String(ev.status?.type?.shortDetail||comp.status?.type?.shortDetail||"");
   const officialKickoff=Date.parse(ev.date||comp.date||"");
   const originalKickoff=Date.parse(g.kickoff_at);
   // Never silently reopen a kicked-off or completed game. A source-verified
   // reschedule may change the deadline only while the old lock is still open.
   const safeReschedule=g.game_status==="scheduled"&&status==="scheduled"&&
      Number.isFinite(officialKickoff)&&Number.isFinite(originalKickoff)&&
      Date.now()<originalKickoff&&Math.abs(officialKickoff-originalKickoff)<=72*3600000;
   const patch:any={
     game_status:status,
     status_detail:detail.slice(0,80),
     away_score:awayScore,
     home_score:homeScore,
     espn_event_id:String(ev.id)
   };

   const summary=status==="live"?detailed.get(String(ev.id)):null;
   const situation=summary?liveSituation(summary,away,home):null;
   if(status!=="live"){
    for(const field of SITUATION_KEYS)patch[field]=null;
    patch.live_situation_updated_at=null;
   }else if(situation){
    const possession=String(situation.live_possession_code||"");
    const verifiedCode=possession&&recognize(g.away_code,away)&&
      norm(possession)===norm(away.team.abbreviation)?g.away_code:
      possession&&norm(possession)===norm(home.team.abbreviation)?g.home_code:null;
    situation.live_possession_code=verifiedCode;
    if(!verifiedCode)situation.live_field_percent=null;
    Object.assign(patch,situation);
    const detailChanged=SITUATION_KEYS.some(k=>(situation[k]??null)!==(g[k]??null));
    if(detailChanged)patch.live_situation_updated_at=stamp();
   }

   if(safeReschedule && officialKickoff!==originalKickoff){
      patch.kickoff_at=new Date(officialKickoff).toISOString();
      patch.game_date=new Date(officialKickoff).toISOString().slice(0,10);
      // Move only verified upcoming kickoffs. No guesses about TBD games.
      patch.provisional=false;
   }
   if(winner){patch.winner=winner;finals++;}
   // Capture sourced pregame spread as points added to HOME; never change after kickoff.
   const kickoff=Date.parse(g.kickoff_at);
   if(Date.now()<kickoff){
    const odds=(comp.odds||[])[0];
    const amount=parseNum(odds?.spread);
    const homeFav=odds?.homeTeamOdds?.favorite;
    const awayFav=odds?.awayTeamOdds?.favorite;
    if(amount!==null&&Math.abs(amount)<70&&(homeFav===true||awayFav===true)&&homeFav!==awayFav){
     patch.spread_home=(homeFav?-1:1)*Math.abs(amount);
     patch.spread_source="ESPN scoreboard odds";
     lines++;
    }
   }
   // Track when the *published* scoreboard changes, not merely when our job
   // re-polls an unchanged response. This enables meaningful stale-feed alerts.
   const changed=status!==g.game_status || patch.status_detail!==g.status_detail ||
     awayScore!==g.away_score || homeScore!==g.home_score ||
     patch.kickoff_at!==undefined ||
     (patch.spread_home!==undefined&&patch.spread_home!==g.spread_home) ||
     (g.espn_event_id||null)!==String(ev.id) ||
     SITUATION_KEYS.some(k=>Object.hasOwn(patch,k) && (patch[k]??null)!==(g[k]??null)) ||
     (Object.hasOwn(patch,"live_situation_updated_at")&&patch.live_situation_updated_at===null&&g.live_situation_updated_at!==null);
   if(!changed){skipped++;continue;}
   patch.score_updated_at=stamp();
   try{
     await api("sec_games?id=eq."+encodeURIComponent(g.id),{
      method:"PATCH",headers:{"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify(patch)
     });updated++;
   }catch(e){failures++;console.warn("SEC result update failed",g.id,String(e));}
  }
  return jsonify({updated,finalsObserved:finals,linesObserved:lines,unmatched:skipped,errors:failures,checkedDates:dates.length,at:stamp()},failures?207:200);
 }catch(e){console.error("SEC scores job failed",e);return jsonify({error:"Score refresh unavailable"},503);}
});
