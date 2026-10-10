// Independent NCAA FBS live scoreboard. Only authoritative ESPN finals award picks.
// The secondary feed may update a live score early, but cannot set a winner.
const API="https://sdataprod.ncaa.com/";
const HASH="7287cda610a9326931931080cb3a604828febe6fe3c9016a7e4a36db99efdb7c";
export async function fetchNcaa(season:number,week:number):Promise<any[]>{
 if(!Number.isInteger(season)||season<2024||season>2040||
    !Number.isInteger(week)||week<1||week>20)return [];
 const params={sportCode:"MFB",division:11,seasonYear:season,week};
 const ext={persistedQuery:{version:1,sha256Hash:HASH}};
 const url=API+"?extensions="+encodeURIComponent(JSON.stringify(ext))+
  "&variables="+encodeURIComponent(JSON.stringify(params));
 try{
  const response=await fetch(url,{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(7000)});
  if(!response.ok)return [];
  const body=await response.json();
  return !body?.errors?.length&&Array.isArray(body?.data?.contests)?body.data.contests:[];
 }catch(error){
  console.info("NCAA score feed unavailable; ESPN fallback active",String(error));return [];
 }
}
const num=(v:any)=>v===null||v===undefined||v===""?null:Number(v);
export function matchNcaa(game:any,rows:any[],recognize:(code:string,competitor:any)=>boolean):
  {away:number,home:number,state:string,period:string}|null{
 const match=rows.filter(row=>{
  const [month,day,year]=String(row?.startDate||"").split("/");
  if([year,month?.padStart(2,"0"),day?.padStart(2,"0")].join("-")!==game.game_date||
     !["I","F"].includes(row?.gameState)||!Array.isArray(row.teams))return false;
  const a=row.teams.find((x:any)=>x.isHome===false);
  const h=row.teams.find((x:any)=>x.isHome===true);
  if(!a||!h)return false;
  const wrapped=(x:any)=>({team:{displayName:x.nameShort,shortDisplayName:x.nameShort,
    name:x.nameShort,abbreviation:x.name6Char}});
  return recognize(game.away_code,wrapped(a))&&recognize(game.home_code,wrapped(h));
 });
 if(match.length!==1)return null;
 const row=match[0];
 const away=num(row.teams.find((x:any)=>x.isHome===false)?.score);
 const home=num(row.teams.find((x:any)=>x.isHome===true)?.score);
 if(!Number.isInteger(away)||!Number.isInteger(home)||away<0||home<0||away>199||home>199)return null;
 const period=String(row.currentPeriod||"").toUpperCase();
 const n={"1ST":1,"2ND":2,"3RD":3,"4TH":4}[period as "1ST"|"2ND"|"3RD"|"4TH"];
 const clock=String(row.contestClock||"").trim();
 return {away,home,state:row.gameState,
   period:period==="HALF"?"Halftime":n&&/^\d{1,2}:\d{2}$/.test(clock)?"Q"+n+" · "+clock:""};
}
export function pickLive(espnAway:number|null,espnHome:number|null,
 ncaa:{away:number,home:number}|null,oldAway:number|null,oldHome:number|null,live:boolean){
 let away=espnAway,home=espnHome,source="ESPN";
 if(live&&ncaa&&(away===null||home===null||
   (ncaa.away>=away&&ncaa.home>=home))&&
   (away===null||home===null||ncaa.away>away||ncaa.home>home)){
  away=ncaa.away;home=ncaa.home;source="NCAA";
 }
 if(live&&oldAway!==null&&oldHome!==null&&away!==null&&home!==null&&
   (away<oldAway||home<oldHome)){
  // Wait for both sources to agree before accepting a downward correction.
  const agree=ncaa&&ncaa.away===espnAway&&ncaa.home===espnHome;
  if(!agree){away=oldAway;home=oldHome;source="HOLD";}
 }
 return {away,home,source};
}
