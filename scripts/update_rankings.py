#!/usr/bin/env python3
"""Publish the latest source-verified *national* university poll for SEC teams.

Never substitute SEC standings, old matchup curatedRank, projected rank or prior
years for a current Top 25. Every poll carries its actual publication date,
season, name and publisher link. Runs on GitHub Actions, not visitor browsers.
"""
from __future__ import annotations
import datetime as dt
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"rankings.json"
BASE="https://site.api.espn.com/apis/site/v2/sports"
SPORTS={
 "football":("football/college-football","https://www.espn.com/college-football/rankings"),
 "basketball":("basketball/mens-college-basketball","https://www.espn.com/mens-college-basketball/rankings"),
 "baseball":("baseball/college-baseball","https://www.espn.com/college-baseball/rankings"),
}
# Same ESPN team IDs used by the independently verified SEC record tracker.
CODES={
 "333":"ALA","8":"ARK","2":"AUB","57":"FLA","61":"UGA","96":"UK",
 "99":"LSU","145":"MISS","344":"MSST","142":"MIZ","201":"OU",
 "2579":"SC","2633":"TENN","251":"TEX","245":"TAMU","238":"VAN"
}
ALL_CODES=set(CODES.values())
UTC=dt.timezone.utc

def get_json(url):
 req=Request(url,headers={"User-Agent":"SaturdaysDownSouth/1.0 (read public polls)",
                          "Accept":"application/json"})
 with urlopen(req,timeout=20) as response:
  return json.load(response)

def season_for(sport,day):
 if sport=="football":
  return day.year if day.month>=8 else day.year-1
 if sport=="basketball":
  return day.year+1 if day.month>=8 else day.year
 return day.year if day.month>=2 else day.year-1

def parse_day(value):
 if isinstance(value,dict):
  value=value.get("startDate") or value.get("date") or value.get("value")
 if not isinstance(value,str):return None
 try:
  # Support ISO dates and UTC timestamps. Never guess a publication day.
  date=dt.date.fromisoformat(value[:10])
  return date if 2000<=date.year<=2100 else None
 except ValueError:return None

def poll_category(sport,entry):
 name=str(entry.get("name") or entry.get("shortName") or "").lower()
 typ=str(entry.get("type") or "").lower()
 if sport in ("football","basketball"):
  if typ=="ap" or "associated press" in name or re.search(r"\bap\b",name):
   return 0
  if "coaches" in name or "usa today" in name:
   return 1
 else:
  if "d1baseball" in name or "d1 baseball" in name:return 0
  if "baseball america" in name:return 1
  if "coaches" in name or "usa today" in name:return 2
 return None

def choose_poll(payload,sport):
 rankings=payload.get("rankings")
 if not isinstance(rankings,list):return None
 scored=[(poll_category(sport,p),i,p) for i,p in enumerate(rankings) if isinstance(p,dict)]
 scored=[(score,i,p) for score,i,p in scored if score is not None]
 if not scored:return None
 scored.sort(key=lambda x:(x[0],x[1]))
 return scored[0][2]

def parse_poll(payload,sport,now=None):
 now=now or dt.datetime.now(UTC)
 if not isinstance(payload,dict) or sport not in SPORTS:return None
 poll=choose_poll(payload,sport)
 if not poll or not isinstance(poll.get("ranks"),list):return None

 # Actual poll date comes from ESPN, never the job's check time.
 possible=[poll.get("date"),poll.get("publishedAt"),poll.get("updatedAt"),
           payload.get("latestWeek"),payload.get("date")]
 published=next((d for x in possible if (d:=parse_day(x)) is not None),None)
 if published is None:return None
 if published>now.date()+dt.timedelta(days=2):return None
 season=season_for(sport,published)
 wanted=season_for(sport,now.date())
 # The previous completed season is kept only as LAST PUBLISHED history,
 # never marked current or passed off as this year's Top 25.
 if season<wanted-1 or season>wanted:return None

 all_ranks=set();entries={};team_ids=set()
 for item in poll["ranks"]:
  if not isinstance(item,dict):return None
  rank=item.get("current")
  if isinstance(rank,bool) or not isinstance(rank,int) or not 1<=rank<=25:return None
  if rank in all_ranks:return None
  all_ranks.add(rank)
  team=item.get("team") or {}
  identifier=str(team.get("id") or "")
  if not re.fullmatch(r"\d+",identifier):return None
  if identifier in team_ids:return None
  team_ids.add(identifier)
  code=CODES.get(identifier)
  if code:
   prev=item.get("previous")
   prev=prev if isinstance(prev,int) and not isinstance(prev,bool) and 1<=prev<=25 else None
   entries[code]={"rank":rank,"previous":prev}
 # Require a nearly complete published Top 25 before describing missing SEC
 # schools as "not ranked"; a partial poll must never demote schools.
 if len(all_ranks)<20:return None
 name=str(poll.get("name") or poll.get("shortName") or "").strip()[:65]
 if not name:return None
 return {"poll":name,"published_at":published.isoformat(),
         "season":season,"source":"ESPN","source_url":SPORTS[sport][1],
         "poll_size":len(all_ranks),"teams":entries}

def build(now=None,get=get_json,prior=None):
 now=now or dt.datetime.now(UTC)
 checked=now.strftime("%Y-%m-%dT%H:%M:%SZ")
 published={}
 for sport,(path,_) in SPORTS.items():
  try:
   data=get(f"{BASE}/{path}/rankings")
   parsed=parse_poll(data,sport,now)
   if parsed:
    published[sport]=parsed
    print(f"{sport}: {parsed['poll']} {parsed['published_at']} "
          f"({len(parsed['teams'])} SEC schools ranked)")
    continue
   print(f"{sport}: valid current-season national poll unavailable")
  except Exception as exc:
   print(f"{sport}: source unavailable ({type(exc).__name__}); keeping dated poll if applicable")
  old=(prior or {}).get("sports",{}).get(sport)
  if valid_previous(old,sport,now):
   published[sport]=old
 return {"source":"ESPN","checked_at":checked,"sports":published}

def valid_previous(poll,sport,now):
 if not isinstance(poll,dict) or poll.get("source")!="ESPN":return False
 d=parse_day(poll.get("published_at"))
 if d is None or d>now.date()+dt.timedelta(days=2):return False
 if poll.get("season")!=season_for(sport,d) or poll["season"]<season_for(sport,now.date())-1:return False
 if poll.get("poll_size",0)<20 or not isinstance(poll.get("teams"),dict):return False
 for code,entry in poll["teams"].items():
  if code not in ALL_CODES or not isinstance(entry,dict) or type(entry.get("rank")) is not int:return False
  if not 1<=entry["rank"]<=25:return False
 return True

def main():
 prior=None
 if OUT.exists():
  try:prior=json.loads(OUT.read_text())
  except (ValueError,OSError):pass
 result=build(prior=prior)
 # Even an unavailable source is reported honestly with a check timestamp.
 OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
 print("Wrote",OUT.name,"—",", ".join(result["sports"]) or "no verified polls yet")

if __name__=="__main__":main()
