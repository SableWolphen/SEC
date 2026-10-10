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
 if(typ.completed===true && (name.includes("final")||state==="post"))return "final";
 if(name.includes("postpon"))return "postponed";
 if(name.includes("cancel"))return "canceled";
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
  const games:any[]=await api("sec_games?select=id,game_date,kickoff_at,away_code,home_code,game_status,espn_event_id,spread_home&order=game_date.asc");
  const today=new Date().toISOString().slice(0,10);
  const min=new Date(Date.now()-65*86400000).toISOString().slice(0,10);
  const max=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  // No fake ESPN predictions: only reported competitions with both teams matched.
  const eligible=games.filter(g=>g.game_date>=min&&g.game_date<=max&&
    (g.game_status!=="final" || g.game_date>=new Date(Date.now()-3*86400000).toISOString().slice(0,10)));
  const dates=[...new Set(eligible.map(g=>g.game_date))];
  const matches:Record<string,any[]>={};
  let failures=0;
  for(let i=0;i<dates.length;i+=5){
   await Promise.all(dates.slice(i,i+5).map(async day=>{
    try{matches[day]=await espn(day);}
    catch(e){failures++;console.warn("ESPN fetch",day,String(e));}
   }));
  }
  let updated=0, skipped=0,finals=0,lines=0;
  for(const g of eligible){
   const events=matches[g.game_date]||[];
   const valid=events.map(ev=>{
     const comp=(ev.competitions||[])[0];
     const away=(comp?.competitors||[]).find((c:any)=>c.homeAway==="away");
     const home=(comp?.competitors||[]).find((c:any)=>c.homeAway==="home");
     return away&&home&&recognize(g.away_code,away)&&recognize(g.home_code,home)?{ev,comp,away,home}:null;
   }).filter(Boolean);
   if(valid.length!==1){skipped++;continue;}
   const {ev,comp,away,home}=valid[0];
   const rawStatus=stateFrom(ev,comp);
   const awayScore=parseNum(away.score),homeScore=parseNum(home.score);
   // Only declare winners from an official completed event with two distinct scores.
   const winner=rawStatus==="final"&&awayScore!==null&&homeScore!==null&&awayScore!==homeScore
      ?(homeScore>awayScore?g.home_code:g.away_code):null;
   const status=rawStatus==="final"&&!winner?"live":rawStatus;
   const patch:any={
     game_status:status,
     status_detail:String(ev.status?.type?.shortDetail||comp.status?.type?.shortDetail||"").slice(0,80),
     away_score:awayScore,
     home_score:homeScore,
     score_updated_at:stamp(),
     espn_event_id:String(ev.id)
   };
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
   try{
     await api("sec_games?id=eq."+encodeURIComponent(g.id),{
      method:"PATCH",headers:{"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify(patch)
     });updated++;
   }catch(e){failures++;console.warn("SEC result update failed",g.id,String(e));}
  }
  return jsonify({updated,finalsObserved:finals,linesObserved:lines,unmatched:skipped,errors:failures,checkedDates:dates.length,at:stamp()},failures?207:200);
 }catch(e){console.error("SEC scores job failed",e);return jsonify({error:"Score refresh unavailable"},503);}
});
