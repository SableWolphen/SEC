/* Retired paid-AI endpoint. Free SEC commentary is generated locally by
 * sec-game-community.js using existing verified scores, rankings and news.
 * This endpoint performs no provider calls and cannot incur LLM fees. */
Deno.serve((_request:Request)=>new Response(
 JSON.stringify({available:false,retired:true,
  message:"SEC Pick'em now uses free, verified-data Smart Commentary in Game Center."}),
 {status:410,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}}
));
