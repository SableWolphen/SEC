#!/usr/bin/env python3
"""Refresh SEC football, baseball and men\'s basketball news from verified RSS/API feeds.
All headlines, concise source descriptions, publication times and links come from source data.
No fictional news, AI speculation, account access, or score scheduler changes.
"""
from __future__ import annotations
import datetime as dt
import email.utils,hashlib,html,json,re
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
from xml.etree import ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'news.json'
UTC=dt.timezone.utc
SPORTS=('football','baseball','basketball')
SOURCES=[
 ('NCAA','https://www.ncaa.com/news/football/fbs/rss.xml','rss','football'),
 ('NCAA','https://www.ncaa.com/news/baseball/d1/rss.xml','rss','baseball'),
 ('NCAA','https://www.ncaa.com/news/basketball-men/d1/rss.xml','rss','basketball'),
 ('ESPN','https://site.api.espn.com/apis/site/v2/sports/football/college-football/news?limit=100','json','football'),
 ('ESPN','https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/news?limit=100','json','baseball'),
 ('ESPN','https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/news?limit=100','json','basketball')
]
TEAMS={
 'Alabama':r'(?<!South )\bAlabama\b|\bCrimson Tide\b|\bBama\b',
 'Arkansas':r'\bArkansas(?! State)\b|\bRazorbacks?\b',
 'Auburn':r'\bAuburn\b|\bWar Eagles?\b',
 'Florida':r'(?<!South )\bFlorida(?! State| Atlantic| International)\b|\bGators?\b',
 'Georgia':r'\bGeorgia(?! Tech| State| Southern)\b|\bBulldogs?\b',
 'Kentucky':r'\bKentucky\b|\bWildcats?\b',
 'LSU':r'\bLSU\b|\bLouisiana State\b',
 'Mississippi State':r'\bMississippi State\b|\bMississippi St\.?\b',
 'Missouri':r'\bMissouri\b|\bMizzou\b',
 'Oklahoma':r'\bOklahoma(?! State)\b|\bSooners?\b',
 'Ole Miss':r'\bOle Miss\b|\bMississippi Rebels?\b',
 'South Carolina':r'\bSouth Carolina(?! State)\b|\bGamecocks?\b',
 'Tennessee':r'\bTennessee\b|\bVolunteers?\b|\bVols\b',
 'Texas':r'(?<!North )(?<!West )(?<!East )\bTexas(?! Tech| State| A&M| Christian| Southern| San Antonio| El Paso| Rio Grande)\b|\bLonghorns?\b',
 'Texas A&M':r'\bTexas A&M\b|\bAggies\b',
 'Vanderbilt':r'\bVanderbilt\b|\bCommodores?\b'
}
BREAKING=re.compile(r'\b(breaking|fired|fires|hired|hires|suspended|ruled out|out for season|injured|injury|transfer|commits|commitment|decommits|announces|confirmed|resigns)\b',re.I)
def clean(x):
 return ' '.join(html.unescape(re.sub(r'<[^>]+>',' ',str(x or ''))).split())
def verified_url(url):
 try:
  p=urlsplit(str(url or '').strip())
  return str(url).strip() if p.scheme=='https' and p.hostname in ('www.ncaa.com','ncaa.com','espn.com','www.espn.com') and not p.username and not p.password else None
 except ValueError:return None
def when(x):
 if not x:return None
 try:d=dt.datetime.fromisoformat(str(x).replace('Z','+00:00'))
 except (TypeError,ValueError):
  try:d=email.utils.parsedate_to_datetime(x)
  except (TypeError,ValueError):return None
 return d.replace(tzinfo=UTC).astimezone(UTC) if d.tzinfo is None else d.astimezone(UTC)
def digest(summary,title):
 s=clean(summary)
 if not s or s.lower()==clean(title).lower():return ''
 if len(s)<=220:return s
 m=re.search(r'^(.{35,215}?[.!?])(?:\s|$)',s)
 if m:return m.group(1)
 return s[:210].rsplit(' ',1)[0]+'…'
def story(title,desc,url,date,source,now,sport="football"):
 if sport not in SPORTS:return None
 title=clean(title);url=verified_url(url);published=when(date)
 if not title or len(title)>250 or not url or published is None:return None
 age=(now-published).total_seconds()
 if age < -3*3600 or age>9*86400:return None
 body=title+' '+clean(desc)
 teams=[name for name,expression in TEAMS.items() if re.search(expression,body,re.I)]
 if not teams and not re.search(r'\bSEC\b|\bSoutheastern Conference\b',body,re.I):return None
 return {'id':hashlib.sha256(url.encode()).hexdigest()[:16],'title':title,
  'summary':digest(desc,title),'url':url,'source':source,
  'published_at':published.isoformat().replace('+00:00','Z'),
  'sport':sport,'teams':teams,'breaking':age<=6*3600 and bool(BREAKING.search(title))}
def from_rss(raw,now,sport="football")
 root=ET.fromstring(raw);items=[]
 for node in root.findall('.//channel/item'):
  field=lambda key:node.findtext(key,default='')
  item=story(field('title'),field('description'),field('link'),field('pubDate'),'NCAA',now,sport)
  if item:items.append(item)
 return items
def from_espn(raw,now,sport="football")
 obj=json.loads(raw);items=[]
 for record in obj.get('articles',[]):
  if not isinstance(record,dict):continue
  web=(record.get('links') or {}).get('web') or {}
  item=story(record.get('headline'),record.get('description'),web.get('href') or record.get('link'),
    record.get('published') or record.get('lastModified'),'ESPN',now,sport)
  if item:items.append(item)
 return items
def download(url):
 req=Request(url,headers={'User-Agent':'Mozilla/5.0 SEC-Pickem-News/1.0',
  'Accept':'application/json,application/rss+xml,application/xml'})
 with urlopen(req,timeout=22) as response:return response.read(2000000)
def _recent_articles(existing,now):
 """Validate legacy football stories and newly categorized cached stories."""
 rows=[]
 for item in (existing or {}).get('articles',[]):
  if not isinstance(item,dict):continue
  sport=item.get('sport','football')
  published=when(item.get('published_at'))
  if sport not in SPORTS or not published or not verified_url(item.get('url')):continue
  if not 0<=(now-published).total_seconds()<=9*86400:continue
  rows.append({**item,'sport':sport})
 return rows

def _capped(items):
 unique={}
 for item in items:
  key=(item['sport'],item['url'].split('?')[0].rstrip('/'))
  if key not in unique or len(item.get('summary',''))>len(unique[key].get('summary','')):
   unique[key]=item
 counts={sport:0 for sport in SPORTS}
 selected=[]
 for item in sorted(unique.values(),key=lambda r:r['published_at'],reverse=True):
  sport=item['sport']
  if counts[sport]>=50:continue
  counts[sport]+=1
  selected.append(item)
 return selected

def build(now=None,get=download,existing=None):
 now=now or dt.datetime.now(UTC)
 stories=[];working=[];working_sports=set()
 for name,url,kind,sport in SOURCES:
  try:
   raw=get(url)
   batch=from_rss(raw,now,sport) if kind=='rss' else from_espn(raw,now,sport)
   stories.extend(batch);working.append(name);working_sports.add(sport)
   print(name,sport,'stories:',len(batch))
  except Exception as exc:
   print(name,sport,'temporarily unavailable:',type(exc).__name__)
 old=_recent_articles(existing,now)
 stamp=now.isoformat().replace('+00:00','Z')
 if not working:
  if old:
   return {**existing,'checked_at':stamp,
           'warning':'Sources temporarily unavailable; showing previously collected articles.',
           'articles':_capped(old)}
  raise RuntimeError('No working source; never publish invented or empty news in place of real stories')
 # A working football source must not silently erase cached, verified baseball articles
 # when both baseball sources are temporarily unavailable (and vice versa).
 missing=[sport for sport in SPORTS if sport not in working_sports]
 if missing:
  stories.extend(item for item in old if item['sport'] in missing)
 warning=('Some sport news feeds are temporarily unavailable. Previously verified stories are shown where possible.'
          if missing else None)
 articles=_capped(stories)
 if not articles and old:articles=_capped(old)
 return {'updated_at':stamp,'checked_at':stamp,'sources':list(dict.fromkeys(working)),
         'articles':articles,'warning':warning}

def main():
 old=json.loads(OUT.read_text()) if OUT.exists() else None
 data=build(existing=old)
 OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print('News feed:',len(data['articles']),'confirmed source-linked SEC headlines.')
if __name__=='__main__':main()
