#!/usr/bin/env python3
"""Fetch verified SEC men's basketball and college baseball fixtures for GitHub Pages.
Only real ESPN events are published; no client/API secrets or invented games.
"""
from __future__ import annotations
import datetime as dt,json,math
from pathlib import Path
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'sports-schedules.json'
UTC=dt.timezone.utc
SEC_IDS={'333','8','2','57','61','96','99','344','142','201','145','2579','2633','251','245','238'}
SPORTS={'basketball':'basketball/mens-college-basketball','baseball':'baseball/college-baseball'}
def season(today):
 return today.year+1 if today.month>=8 else today.year
def start(sport,year):
 return dt.datetime(year-1 if sport=='basketball' else year,11 if sport=='basketball' else 2,1,tzinfo=UTC)
def parse(data,sport,year):
 begin=start(sport,year)
 rows=[]
 for event in data.get('events',[]):
  try:
   competitors=event['competitions'][0]['competitors']
   away=next(i for i in competitors if i.get('homeAway')=='away')
   home=next(i for i in competitors if i.get('homeAway')=='home')
   a,h=str(away['team']['id']),str(home['team']['id'])
   if a not in SEC_IDS and h not in SEC_IDS:continue
   tip=dt.datetime.fromisoformat(event['date'].replace('Z','+00:00')).astimezone(UTC)
   if tip.year<year-1 or tip.year>year:continue
   def pts(player):
    value=player.get('score')
    if isinstance(value,dict):value=value.get('value')
    return int(float(value)) if value not in (None,'') else None
   ap,hp=pts(away),pts(home)
   final=bool(event.get('status',{}).get('type',{}).get('completed')) and ap is not None and hp is not None
   canceled='cancel' in event.get('status',{}).get('type',{}).get('name','').lower()
   rows.append({
    'id':f'{sport}-{year}-{event["id"]}','sport':sport,'season':year,
    'week':max(1,int((tip-begin).total_seconds()//604800)+1),
    'kickoff_at':tip.isoformat().replace('+00:00','Z'),
    'away_code':a,'home_code':h,
    'away_name':away['team'].get('displayName',away['team'].get('name','Away')),
    'home_name':home['team'].get('displayName',home['team'].get('name','Home')),
    'away_score':ap,'home_score':hp,
    'winner_code':h if final and hp>ap else a if final and ap>hp else None,
    'game_status':'canceled' if canceled else 'final' if final else
      'live' if event.get('status',{}).get('type',{}).get('state')=='in' else 'scheduled',
    'source':'ESPN'
   })
  except (KeyError,ValueError,StopIteration,TypeError,IndexError):continue
 return rows
def windows(sport,year,now):
 begin=start(sport,year)
 first=max(begin,now-dt.timedelta(days=21))
 if now<begin:first=begin
 final=min(dt.datetime(year,7,1,tzinfo=UTC),max(now,begin)+dt.timedelta(days=112))
 at=first
 while at<final:
  right=min(at+dt.timedelta(days=13),final)
  yield at,right
  at+=dt.timedelta(days=14)
def download(url):
 with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0 SEC Pickem schedule','Accept':'application/json'}),timeout=20) as response:
  return json.load(response)
def build(now=None,get=download,existing=None):
 now=now or dt.datetime.now(UTC)
 result={'updated_at':now.isoformat().replace('+00:00','Z'),'sports':{}}
 for sport,slug in SPORTS.items():
  year=season(now)
  old=((existing or {}).get('sports') or {}).get(sport) or {}
  saved={x['id']:x for x in old.get('games',[]) if x.get('season')==year and x.get('id')}
  successes=0
  for left,right in windows(sport,year,now):
   iso=lambda x:x.strftime('%Y%m%d')
   url=('https://site.api.espn.com/apis/site/v2/sports/'+slug+'/scoreboard?dates='+iso(left)+'-'+iso(right)+'&groups=8&limit=500')
   try:
    batch=parse(get(url),sport,year)
    for game in batch:
     before=saved.get(game['id'])
     if before and before.get('game_status')=='final' and game['game_status']!='final':
      game={**game,'game_status':'final','winner_code':before.get('winner_code'),
       'home_score':before.get('home_score'),'away_score':before.get('away_score')}
     saved[game['id']]=game
    successes+=1
   except (Exception) as ex:
    print(sport,'source unavailable:',type(ex).__name__)
  rows=sorted(saved.values(),key=lambda x:(x['kickoff_at'],x['id']))
  result['sports'][sport]={'season':year,'games':rows,'source':'ESPN',
   'source_windows':successes,'warning':None if successes else 'Schedule source unavailable. Showing previously verified fixtures only.'}
  print(sport,year,len(rows),'verified games',successes,'successful source windows')
 return result
def main():
 prior=json.loads(OUT.read_text()) if OUT.exists() else None
 data=build(existing=prior)
 OUT.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
if __name__=='__main__':main()
