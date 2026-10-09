#!/usr/bin/env python3
"""Refresh SEC news from NCAA FBS RSS and ESPN college-football metadata.
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
SOURCES=[
 ('NCAA','https://www.ncaa.com/news/football/fbs/rss.xml','rss'),
 ('ESPN','https://site.api.espn.com/apis/site/v2/sports/football/college-football/news?limit=100','json')
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
def story(title,desc,url,date,source,now):
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
  'teams':teams,'breaking':age<=6*3600 and bool(BREAKING.search(title))}
def from_rss(raw,now):
 root=ET.fromstring(raw);items=[]
 for node in root.findall('.//channel/item'):
  field=lambda key:node.findtext(key,default='')
  item=story(field('title'),field('description'),field('link'),field('pubDate'),'NCAA',now)
  if item:items.append(item)
 return items
def from_espn(raw,now):
 obj=json.loads(raw);items=[]
 for record in obj.get('articles',[]):
  if not isinstance(record,dict):continue
  web=(record.get('links') or {}).get('web') or {}
  item=story(record.get('headline'),record.get('description'),web.get('href') or record.get('link'),
    record.get('published') or record.get('lastModified'),'ESPN',now)
  if item:items.append(item)
 return items
def download(url):
 req=Request(url,headers={'User-Agent':'Mozilla/5.0 SEC-Pickem-News/1.0',
  'Accept':'application/json,application/rss+xml,application/xml'})
 with urlopen(req,timeout=22) as response:return response.read(2000000)
def build(now=None,get=download,existing=None):
 now=now or dt.datetime.now(UTC);stories=[];working=[]
 for name,url,kind in SOURCES:
  try:
   raw=get(url)
   batch=from_rss(raw,now) if kind=='rss' else from_espn(raw,now)
   stories.extend(batch);working.append(name);print(name,'stories:',len(batch))
  except (Exception) as exc:
   print(name,'temporarily unavailable:',type(exc).__name__)
 if not working:
  if existing:
   old=[item for item in existing.get('articles',[]) if when(item.get('published_at')) and 0<=(now-when(item['published_at'])).total_seconds()<9*86400]
   if old:return {**existing,'checked_at':now.isoformat().replace('+00:00','Z'),
       'warning':'Sources temporarily unavailable; showing previously collected articles.','articles':old[:50]}
  raise RuntimeError('No working source; never publish invented or empty news in place of real stories')
 dedup={}
 for item in stories:
  key=item['url'].split('?')[0].rstrip('/')
  if key not in dedup or len(item['summary'])>len(dedup[key]['summary']):dedup[key]=item
 articles=sorted(dedup.values(),key=lambda r:r['published_at'],reverse=True)[:50]
 if not articles and existing:
  articles=[item for item in existing.get('articles',[]) if when(item.get('published_at')) and 0<=(now-when(item['published_at'])).total_seconds()<9*86400][:50]
 stamp=now.isoformat().replace('+00:00','Z')
 return {'updated_at':stamp,'checked_at':stamp,'sources':working,'articles':articles,'warning':None}
def main():
 old=json.loads(OUT.read_text()) if OUT.exists() else None
 data=build(existing=old)
 OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print('News feed:',len(data['articles']),'confirmed source-linked SEC headlines.')
if __name__=='__main__':main()
