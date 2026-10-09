import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.75.0";
const URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const ANON=Deno.env.get("SUPABASE_ANON_KEY")||"";
const ORIGIN="https://sablewolphen.github.io";
const SEC=new Set(["333","8","2","57","61","96","99","344","142","201","145","2579","2633","251","245","238"]);
const LEAGUES:Record<string,string>={
 basketball:"basketball/mens-college-basketball",
 baseball:"baseball/college-baseball"
};
function currentSeason(now:Date){return now.getUTCMonth()>=7?now.getUTCFullYear()+1:now.getUTCFullYear();}
function seasonStart(sport:string,season:number){
 return new Date(String(sport==="basketball"?season-1:season)+(sport==="basketball"?"-11-01":"-02-01")+"T00:00:00Z");
}
function parseEvents(data:any,sport:string,season:number,start:Date){
 const list:any[]=[];
 for(const event of Array.isArray(data?.events)?data.events:[]){
  const comp=event?.competitions?.[0],competitors=comp?.competitors||[];
  const home=competitors.find((t:any)=>t.homeAway==="home");
  const away=competitors.find((t:any)=>t.homeAway==="away");
  if(!home?.team?.id||!away?.team?.id||!event.id)continue;
  const h=String(home.team.id),a=String(away.team.id);
  if(!SEC.has(a)&&!SEC.has(h))continue;
  const tip=new Date(event.date||comp.date);if(!Number.isFinite(tip.getTime()))continue;
  const score=(v:any):number|null=>{if(v===undefined||v===null)return null;const n=Number(typeof v==="object"?v.value:v);return Number.isFinite(n)&&n>=0?Math.floor(n):null;};
  const hs=score(home.score),as=score(away.score);
  const ended=Boolean(event.status?.type?.completed)&&hs!==null&&as!==null;
  const status=String(event.status?.type?.state||"");
  const canceled=/cancel/i.test(String(event.status?.type?.name||""));
  const winner=ended&&hs!==as?(hs>as?h:a):null;
  const odds=comp?.odds?.[0];
  const spread=typeof odds?.spread==="number"&&Number.isFinite(odds.spread)?odds.spread:null;
  list.push({
   id:sport+"-"+season+"-"+event.id,sport,season,
   week:Math.max(1,Math.floor((tip.getTime()-start.getTime())/604800000)+1),
   espn_event_id:String(event.id),kickoff_at:tip.toISOString(),
   home_code:h,home_name:String(home.team?.displayName||home.team?.name||"Home"),
   away_code:a,away_name:String(away.team?.displayName||away.team?.name||"Away"),
   home_score:hs,away_score:as,winner_code:winner,spread_home:spread,
   game_status:canceled?"canceled":ended?"final":status==="in"?"live":"scheduled",
   source:"ESPN",updated_at:new Date().toISOString()
  });
 }
 return list;
}
function reply(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{
 "Content-Type":"application/json","Access-Control-Allow-Origin":ORIGIN,
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Vary":"Origin","Cache-Control":"no-store"}});}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return reply({ok:true});
 if(req.method!=="POST")return reply({error:"Use POST"},405);
 if(!URL||!SERVICE||!ANON)return reply({error:"Schedule sync not configured"},503);
 try{
  const token=req.headers.get("Authorization")||"";
  if(!token.startsWith("Bearer "))return reply({error:"Sign in before refreshing schedules"},401);
  const session=createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
  const identity=await session.auth.getUser(token.slice(7));
  if(identity.error||!identity.data?.user)return reply({error:"Sign in before refreshing schedules"},401);
  const body=await req.json().catch(()=>({}));
  const sport=String(body.sport||"");
  if(!LEAGUES[sport])return reply({error:"Unsupported sport"},400);
  const database=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  const now=new Date(),season=currentSeason(now),start=seasonStart(sport,season);
  const prev=await database.from("sec_sport_sync_state").select("last_checked_at,imported").eq("sport",sport).maybeSingle();
  const last=prev.data?.last_checked_at?new Date(prev.data.last_checked_at).getTime():0;
  if(now.getTime()-last<900000)return reply({ok:true,sport,season,cached:true,imported:prev.data?.imported||0});
  // The server fetches from a fixed official provider and does NOT accept any
  // game IDs, kickoff dates, winners or scores from a user request.
  const first=new Date(Math.max(start.getTime(),now.getTime()-10*86400000));
  const end=new Date(Math.min(new Date(Date.UTC(season,6,1)).getTime(),Math.max(now.getTime(),start.getTime())+90*86400000));
  const unique=new Map<string,any>();let success=0;
  const compact=(d:Date)=>d.toISOString().slice(0,10).replaceAll("-","");
  for(let at=new Date(first);at<end;at=new Date(at.getTime()+14*86400000)){
   const until=new Date(Math.min(end.getTime(),at.getTime()+13*86400000));
   const path=LEAGUES[sport]+"/scoreboard?dates="+compact(at)+"-"+compact(until)+"&groups=8&limit=500";
   try{
    const response=await fetch("https://site.api.espn.com/apis/site/v2/sports/"+path,{
     headers:{"Accept":"application/json"},signal:AbortSignal.timeout(10000)});
    if(!response.ok)continue;
    const data=await response.json();
    for(const g of parseEvents(data,sport,season,start))unique.set(g.id,g);
    success++;
   }catch(_){/* Keep previously imported verified games. */}
  }
  if(success===0)return reply({error:"Schedule source unavailable; existing games have not been changed"},503);
  const games=[...unique.values()];
  // Reconcile ESPN event IDs with the verified SEC / university fixture IDs.
  // Preserve existing IDs (and all player picks) when ESPN later publishes an
  // exact kickoff for a matchup previously listed with an early provisional lock.
  const official=await database.from("sec_sport_games")
   .select("id,sport,season,kickoff_at,away_code,home_code,source")
   .eq("sport",sport).eq("season",season).neq("source","ESPN").limit(1000);
  if(official.error)throw official.error;
  const key=(g:any)=>{
   const day=String(g.kickoff_at).slice(0,10);
   return day+"|"+g.away_code+"|"+g.home_code;
  };
  const fixtures=new Map((official.data||[]).map((g:any)=>[key(g),g]));
  for(const row of games){
   const original:any=fixtures.get(key(row));
   if(original){row.id=original.id;}
  }

  for(let i=0;i<games.length;i+=75){
   const items=games.slice(i,i+75);
   const ids=items.map(g=>g.id);
   const found=await database.from("sec_sport_games").select("id,game_status,away_score,home_score,winner_code").in("id",ids);
   if(found.error)throw found.error;
   const saved=new Map((found.data||[]).map((row:any)=>[row.id,row]));
   for(const item of items){
    const old:any=saved.get(item.id);
    if(old?.game_status==="final"&&item.game_status!=="final"){
     item.game_status="final";item.away_score=old.away_score;item.home_score=old.home_score;item.winner_code=old.winner_code;
    }
   }
   const upsert=await database.from("sec_sport_games").upsert(items,{onConflict:"id"});
   if(upsert.error)throw upsert.error;
  }
  await database.from("sec_sport_sync_state").upsert({sport,last_checked_at:now.toISOString(),
   last_success_at:now.toISOString(),imported:games.length},{onConflict:"sport"});
  return reply({ok:true,sport,season,imported:games.length,source_windows:success});
 }catch(_){return reply({error:"Could not refresh the verified sports schedule"},503);}
});
