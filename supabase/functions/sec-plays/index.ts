// Verified SEC football play-by-play. Public games only; never touches picks or
// league membership. Browser key, origin, and game ID are validated before fetch.
import {createClient} from "npm:@supabase/supabase-js@2.75.0";
const PROJECT=Deno.env.get("SUPABASE_URL")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const PUBLISHABLE="sb_publishable_WJToxplIqB2Yqycd6Bs_qw_j8FD0QR3"; // public browser key, NOT a secret
const ORIGINS=new Set(["https://sablewolphen.github.io"]);
type Fixture={id:string;espn_event_id:string|null;game_status:string;away_code:string;home_code:string};
type Play={id:string;period:number;clock:string;text:string;shortText:string;type:string;team:string|null;scoring:boolean;turnover:boolean;firstDown:boolean;driveId:string;order:number};
const cache=new Map<string,{expires:number;body:object;status:number}>();
const clampText=(v:unknown,n=250)=>typeof v==="string"?v.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,n):"";
const int=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0;
const cleanClock=(c:unknown)=>clampText(c,15).match(/^\d{1,2}:\d{2}$/)?.[0]||"";
function response(body:object,status:number,origin:string,ttl=0):Response{
 const headers=new Headers({"content-type":"application/json; charset=utf-8","vary":"Origin",
  "cache-control":ttl?"public, max-age="+ttl:"no-store","x-content-type-options":"nosniff"});
 if(ORIGINS.has(origin))headers.set("access-control-allow-origin",origin);
 return new Response(JSON.stringify(body),{status,headers});
}
function parse(source:any,game:Fixture,sourceId:string){
 const rawDrives=[...(Array.isArray(source?.drives?.previous)?source.drives.previous:[]),
 ...(source?.drives?.current?[source.drives.current]:[])];
 const competitors=source?.header?.competitions?.[0]?.competitors||[];
 const teamIds:Record<string,string>={};
 if(Array.isArray(competitors))for(const t of competitors){
  const code=t?.homeAway==="home"?game.home_code:t?.homeAway==="away"?game.away_code:null;
  if(code&&t?.team?.id)teamIds[String(t.team.id)]=code;
 }
 const rawPlays: {raw:any;drive:string;index:number}[]=[];
 let idx=0;
 for(const drive of rawDrives){
  const did=String(drive?.id||"drive-"+idx).slice(0,55);
  for(const p of Array.isArray(drive?.plays)?drive.plays:[]){
   rawPlays.push({raw:p,drive:did,index:idx++});
  }
 }
 // The summary's scoringPlays subset is not a complete play-by-play feed:
 // don't substitute it for missing full drives.
 const uniq=new Set<string>(),plays:Play[]=[];
 for(const {raw:p,drive,index} of rawPlays.slice(0,900)){
  if(!p||typeof p!=="object")continue;
  const text=clampText(p.text,330);
  if(!text)continue;
  const period=int(p.period?.number??p.period);
  const clock=cleanClock(p.clock?.displayValue||p.clock);
  const sourceKey=String(p.id||"").slice(0,75);
  const key=sourceKey||[period,clock,text,drive].join("|");
  if(uniq.has(key))continue;uniq.add(key);
  const teamId=String(p.team?.id||p.teamId||"");
  const team=teamIds[teamId]||null;
  plays.push({id:sourceKey||String(index),period:period>=1&&period<=20?period:0,
   clock,text,shortText:clampText(p.shortText,110),
   type:clampText(p.type?.text||p.type?.abbreviation,48),team,
   scoring:p.scoringPlay===true,turnover:p.isTurnover===true,
   firstDown:p.isFirstDown===true,driveId:drive,
   order:Number.isFinite(Number(p.sequenceNumber))?Number(p.sequenceNumber):index});
  if(plays.length>=450)break;
 }
 plays.sort((a,b)=>b.period-a.period||clockSeconds(a.clock)-clockSeconds(b.clock)||b.order-a.order);
 const drives=rawDrives.slice(-45).map((d:any,i:number)=>{
  const id=String(d?.id||"drive-"+i).slice(0,55);
  const scoring=Array.isArray(d?.plays)&&d.plays.some((p:any)=>p?.scoringPlay===true);
  return {id,team:teamIds[String(d?.team?.id||"")]||null,
   description:clampText(d?.description,120),result:clampText(d?.displayResult,90),
   yards:Number.isInteger(Number(d?.yards))&&Number(d.yards)>=-100&&Number(d.yards)<=1000?Number(d.yards):null,
   plays:plays.filter(p=>p.driveId===id).length,scoring};
 }).filter((d:any)=>d.plays>0||d.description).reverse();
 return {game_id:game.id,event_id:sourceId,status:game.game_status,source:"ESPN game summary",
  plays,drives,updated_at:new Date().toISOString(),truncated:rawPlays.length>450};
}
function clockSeconds(clock:string){const v=/^(\d{1,2}):(\d{2})$/.exec(clock);return v?Number(v[1])*60+Number(v[2]):9999;}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS"){
  if(!ORIGINS.has(origin))return response({error:"Origin not allowed"},403,origin);
  return new Response(null,{status:204,headers:{"access-control-allow-origin":origin,
   "access-control-allow-methods":"GET, OPTIONS","access-control-allow-headers":"apikey, content-type",
   "access-control-max-age":"3600","vary":"Origin"}});
 }
 if(req.method!=="GET")return response({error:"GET only"},405,origin);
 // The browser publishable key is intentionally public. It gates incidental
 // traffic, not private data; only the service key is allowed to read the DB.
 if(!ORIGINS.has(origin)||req.headers.get("apikey")!==PUBLISHABLE)
  return response({error:"Not authorized for this app"},403,origin);
 if(!PROJECT||!SERVICE)return response({error:"Play service not configured"},503,origin);
 const id=new URL(req.url).searchParams.get("game")||"";
 if(!/^\d{4}-\d{1,2}-[A-Z0-9]{2,12}-[A-Z0-9]{2,12}$/.test(id))
  return response({error:"Unknown SEC game"},400,origin);
 const hit=cache.get(id);
 if(hit&&hit.expires>Date.now())return response(hit.body,hit.status,origin,
  Math.max(0,Math.floor((hit.expires-Date.now())/1000)));
 try{
  const db=createClient(PROJECT,SERVICE,{auth:{persistSession:false}});
  const found=await db.from("sec_games").select("id,espn_event_id,game_status,away_code,home_code")
   .eq("id",id).maybeSingle();
  if(found.error)throw Error("Fixture unavailable");
  const game=found.data as Fixture|null;
  if(!game)return response({error:"Game not available"},404,origin);
  if(!["live","final"].includes(game.game_status))
   return response({game_id:id,status:game.game_status,source:"ESPN game summary",plays:[],drives:[],
    message:"Play-by-play begins after the official kickoff."},200,origin,60);
  const eventId=String(game.espn_event_id||"");
  if(!/^\d{6,14}$/.test(eventId))
   return response({game_id:id,status:game.game_status,source:"ESPN game summary",plays:[],drives:[],
    message:"An ESPN event identifier has not been confirmed for this matchup."},200,origin,30);
  const resp=await fetch("https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event="+eventId,{
   headers:{"accept":"application/json","user-agent":"SaturdaysDownSouth-SEC-Pickem/1.0"},
   signal:AbortSignal.timeout(8000)
  });
  if(!resp.ok)throw Error("ESPN game summary temporarily unavailable");
  const data=await resp.json();
  const upstream=String(data?.header?.id||data?.header?.competitions?.[0]?.id||"");
  if(upstream&&upstream!==eventId)throw Error("Game source mismatch");
  const body=parse(data,game,eventId);
  const seconds=game.game_status==="live"?20:600;
  if(cache.size>70)cache.delete(cache.keys().next().value!);
  cache.set(id,{body,status:200,expires:Date.now()+seconds*1000});
  return response(body,200,origin,seconds);
 }catch(e){
  return response({game_id:id,error:"Play feed temporarily unavailable",
    message:"ESPN play data couldn't be verified just now. Try again shortly."},503,origin);
 }
});
