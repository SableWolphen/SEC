#!/usr/bin/env python3
"""Refresh public matchup context from ESPN's CFB scoreboard.

This feed NEVER posts betting odds or silently invents an ESPN prediction.
A missing projection leaves room for the site's labeled, simple record heuristic.
Run with: python3 scripts/update_stats.py
"""
from __future__ import annotations
import datetime as dt
import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
BASE="https://site.api.espn.com/apis/site/v2/sports/football/college-football"
ALIASES={
"ALA":"alabama","ARK":"arkansas","AUB":"auburn","FLA":"florida","UGA":"georgia",
"UK":"kentucky","LSU":"lsu","MISS":"olemiss","MSST":"mississippistate",
"MIZ":"missouri","OU":"oklahoma","SC":"southcarolina","TENN":"tennessee",
"TEX":"texas","TAMU":"texasam","VAN":"vanderbilt",
"UAPB":"arkansaspinebluff","UTEP":"utep","ECU":"eastcarolina","KENT":"kentstate",
"YSU":"youngstownstate","TNSTATE":"tennesseestate","BAY":"baylor",
"TXST":"texasstate","FUR":"furman","NALA":"northalabama","MOST":"missouristate",
"AUSTPEAY":"austinpeay","CLEM":"clemson","ULM":"louisianamonroe","FAU":"floridaatlantic",
"LOU":"louisville","UTAH":"utah","SOMISS":"southernmiss","CAMP":"campbell",
"WKU":"westernkentucky","LATECH":"louisianatech","CHAR":"charlotte",
"MINN":"minnesota","KANS":"kansas","MICH":"michigan","TOW":"towson",
"GATECH":"georgiatech","OHST":"ohiostate","ASU":"arizonastate",
"DEL":"delaware","FSU":"floridastate","TROY":"troy","UNM":"newmexico",
"KSU":"kansasstate","UTSA":"utsa","TULSA":"tulsa","SOALA":"southalabama",
"MCN":"mcneese","NCST":"ncstate","CITADEL":"thecitadel","CHATT":"chattanooga",
"SAM":"samford","WOFF":"wofford","TNTECH":"tennesseetech","TNSTATE":"tennesseestate"}
EXTRA={
"TAMU":{"tamu","txam","taandm","texasam","texasamuniversity","texasaandm"},
"MSST":{"msst","missst","mississippist"},
"MISS":{"miss","olemiss"},
"SC":{"sc","scar","southcarolina"},
"UGA":{"uga","ga"},
"UK":{"uk","ken"},
"FLA":{"fla","uf"},
"TENN":{"tenn","ut"},
"OU":{"ou","okla"},
"OHST":{"osu","ohst"},
"SOALA":{"usa","southalabama"},
"TNTECH":{"tntech","tennesseetech"},
"NCST":{"ncst","ncsu","northcarolinastate"},
"KSU":{"ksu","kansasstate","kennesawstate"},
"LSU":{"lsu","louisianastate"}}
def norm(s):
    return re.sub(r"[^a-z0-9]","",str(s or "").lower())
def matches(code,competitor):
    team=competitor.get("team") or {}
    choices={norm(code),norm(ALIASES.get(code,code))}
    choices|=EXTRA.get(code,set())
    seen={norm(team.get(k)) for k in ("abbreviation","location","shortDisplayName","displayName","name")}
    return bool(choices & seen)
def get_json(url):
    req=Request(url,headers={"User-Agent":"SEC-Pickem-Stats/1.0 (fan app; publicly published data)","Accept":"application/json"})
    with urlopen(req,timeout=18) as response:
        return json.load(response)
def schedule():
    sql=(ROOT/"supabase"/"setup.sql").read_text()
    pattern=re.compile(r"\('(?P<id>2026-\d+-[A-Z0-9]+-[A-Z0-9]+)',\s*\d+,\s*'(?P<date>2026-\d{2}-\d{2})',\s*'(?P<away>[A-Z0-9]+)',\s*'(?P<home>[A-Z0-9]+)'")
    games=[m.groupdict() for m in pattern.finditer(sql)]
    if len(games)!=120: raise RuntimeError(f"Expected 120 scheduled games, found {len(games)}")
    return games
def records(comp):
    r=comp.get("records") or comp.get("team",{}).get("record") or []
    if isinstance(r,str):return r
    if isinstance(r,dict):return r.get("summary","")
    return next((x.get("summary","") for x in r if x.get("name")=="overall"), next((x.get("summary","") for x in r),""))
def team_info(comp):
    team=comp.get("team") or {}
    r=comp.get("curatedRank") or {}
    rank=r.get("current") if isinstance(r,dict) else None
    rank=rank if isinstance(rank,int) and 1<=rank<=25 else None
    return {"record":records(comp),"rank":rank}
def projection(obj):
    if not isinstance(obj,dict):return None
    for container in (obj,obj.get("header",{}),((obj.get("header") or {}).get("competitions") or [{}])[0]):
        if not isinstance(container,dict):continue
        pred=container.get("predictor") or {}
        if isinstance(pred,list):pred=pred[0] if pred else {}
        if not isinstance(pred,dict):continue
        h=pred.get("homeTeam") or {}
        raw=h.get("gameProjection")
        try:
            v=float(raw)
            if 0<=v<=100:return round(v,1)
        except (TypeError,ValueError):
            continue
    return None
def main():
    now=dt.datetime.now(dt.timezone.utc)
    schedule_rows=schedule()
    dates=sorted({g["date"] for g in schedule_rows
                  if dt.date.fromisoformat(g["date"])>=now.date()-dt.timedelta(days=3)})
    events=[]
    fails=[]
    for date in dates:
        try:
            j=get_json(f"{BASE}/scoreboard?dates={date.replace('-','')}&limit=300&groups=80")
            events.extend(j.get("events") or [])
        except Exception as exc: fails.append(f"{date}: {exc}")
    if not events:
        raise RuntimeError("ESPN schedule unavailable; not overwriting existing stats. "+str(fails[:3]))
    by_date=defaultdict(list)
    for event in events:
        c=(event.get("competitions") or [{}])[0]
        d=(event.get("date") or c.get("date") or "")[:10]
        by_date[d].append((event,c))
    results={}
    for game in schedule_rows:
        if game["date"] not in dates:continue
        hits=[]
        for event,c in by_date[game["date"]]:
            competitors=c.get("competitors") or []
            away=next((x for x in competitors if x.get("homeAway")=="away"),None)
            home=next((x for x in competitors if x.get("homeAway")=="home"),None)
            if not away or not home:continue
            if matches(game["away"],away) and matches(game["home"],home):
                hits.append((event,c,away,home))
        if len(hits)!=1:continue
        ev,c,away,home=hits[0]
        output={
          "away":team_info(away),"home":team_info(home),
          "source_url":f"https://www.espn.com/college-football/game/_/gameId/{ev['id']}",
          "updated_at":now.strftime("%Y-%m-%dT%H:%M:%SZ")}
        output["home_win_pct"]=projection(c) or projection(ev)
        game_day=dt.date.fromisoformat(game["date"])
        if output["home_win_pct"] is None and game_day<=now.date()+dt.timedelta(days=24) and game_day>=now.date():
            try: output["home_win_pct"]=projection(get_json(f"{BASE}/summary?event={ev['id']}"))
            except Exception: pass
        results[game["id"]]=output
    previous={}
    path=ROOT/"stats.json"
    if path.exists():
        try:previous=json.loads(path.read_text()).get("games") or {}
        except (OSError,ValueError):pass
    if not results:
        raise RuntimeError("No matching matchups; keeping previous feed. Check ESPN identifiers.")
    # Retain verified prior data when games disappear temporarily from the upstream API.
    results={**previous,**results}
    data={"generated_at":now.strftime("%Y-%m-%dT%H:%M:%SZ"),
          "source":"ESPN public college football scoreboard and matchup predictor when provided",
          "games":results}
    path.write_text(json.dumps(data,indent=2,sort_keys=True)+"\n")
    print(f"Refreshed {len(results)} game records ({len(events)} source events); date failures: {len(fails)}")
    if fails:print("Partial source errors:",*fails[:3],sep="\n")
if __name__=="__main__":main()
