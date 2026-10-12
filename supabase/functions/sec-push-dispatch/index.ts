// SEC private Web Push dispatcher: only verified football fixtures/finals.
import {createClient} from "npm:@supabase/supabase-js@2.75.0";
import webpush from "npm:web-push@3.6.7";
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const good=n=>Number.isInteger(n)&&n>=0&&n<=999;
const codes=new Set(["ALA","ARK","AUB","FLA","UGA","UK","LSU","MISS","MSST","MIZ","OU","SC","TENN","TEX","TAMU","VAN"]);
type G={id:string;away_code:string;home_code:string;winner:string|null;game_status:string;away_score:number|null;home_score:number|null;kickoff_at:string;score_updated_at:string|null};
type S={id:string;endpoint:string;p256dh:string;auth_secret:string;favorite_school:string|null};
function matches(list:G[],now:number){
 const result:{game:G;type:"kickoff"|"final"}[]=[];
 for(const g of list){
  const t=Date.parse(g.kickoff_at),updated=Date.parse(g.score_updated_at||"");
  if(!Number.isFinite(t))continue;
  if(g.game_status==="scheduled"&&t-now>=14*60000&&t-now<=25*60000)
   result.push({game:g,type:"kickoff"});
  const final=g.game_status==="final"&&good(g.away_score)&&good(g.home_score)&&
   g.away_score!==g.home_score&&
   ((g.winner===g.away_code&&Number(g.away_score)>Number(g.home_score))||
    (g.winner===g.home_code&&Number(g.home_score)>Number(g.away_score)));
  if(final&&Number.isFinite(updated)&&now-updated>=0&&now-updated<=30*60000)
   result.push({game:g,type:"final"});
 }
 return result;
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const token=req.headers.get("x-sec-job-token")||"";
 if(token.length<32)return json({error:"Forbidden"},403);
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!service)return json({error:"Service unavailable"},503);
 const db=createClient(url,service,{auth:{persistSession:false}});
 const checked=await db.rpc("sec_verify_scores_job",{p_token:token});
 if(checked.error||checked.data!==true)return json({error:"Forbidden"},403);
 const [secret,publicKey]=await Promise.all([
  db.rpc("sec_push_vapid_private"),Promise.resolve(Deno.env.get("SEC_PUSH_PUBLIC_KEY"))
 ]);
 if(secret.error||!secret.data||!publicKey)return json({error:"VAPID not configured"},503);
 webpush.setVapidDetails("https://sablewolphen.github.io/SEC/",publicKey,String(secret.data));
 const now=Date.now();
 const [data,recipients]=await Promise.all([
  db.from("sec_games").select("id,away_code,home_code,winner,game_status,away_score,home_score,kickoff_at,score_updated_at")
   .gte("kickoff_at",new Date(now-8*86400000).toISOString())
   .lte("kickoff_at",new Date(now+48*3600000).toISOString()).limit(300),
  db.from("sec_push_subscriptions").select("id,endpoint,p256dh,auth_secret,favorite_school").limit(500)
 ]);
 if(data.error||recipients.error)return json({error:"Feeds unavailable"},503);
 const events=matches(data.data as G[]||[],now);
 let delivered=0,skipped=0,failed=0;
 for(const s of recipients.data as S[]||[]){
  if(!s.favorite_school||!codes.has(s.favorite_school))continue;
  for(const {game:g,type} of events.filter(x=>
   x.game.home_code===s.favorite_school||x.game.away_code===s.favorite_school)){
   const eventKey=type+":"+g.id;
   const claim=await db.from("sec_push_deliveries").insert({subscription_id:s.id,event_key:eventKey});
   if(claim.error){skipped++;continue;} // unique claim prevents repeat sends
   const label=g.away_code+" vs "+g.home_code;
   const push=type==="kickoff"?
    {title:"SEC kickoff reminder",body:label+" begins soon. Review your picks.",route:"picks",tag:eventKey}:
    {title:"Verified SEC final",body:label+": "+g.away_score+"–"+g.home_score+". See your results.",route:"results",tag:eventKey};
   try{
    await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth_secret}},
     JSON.stringify(push),{TTL:1800,urgency:"normal"});
    delivered++;
   }catch(e){
    failed++;
    const status=(e as {statusCode?:number})?.statusCode;
    if(status===404||status===410)await db.from("sec_push_subscriptions").delete().eq("id",s.id);
    else await db.from("sec_push_deliveries").delete().eq("subscription_id",s.id).eq("event_key",eventKey);
   }
  }
 }
 return json({delivered,skipped,failed,eligible:events.length});
});
