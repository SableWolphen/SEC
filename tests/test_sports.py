#!/usr/bin/env python3
"""SEC basketball/baseball schedule parsing without network or real user data."""
import datetime as dt,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import update_sports as sport
NOW=dt.datetime(2026,10,9,tzinfo=dt.timezone.utc)
def event(event_id,away,home,day,complete=False,away_score=None,home_score=None):
 return {'id':event_id,'date':day,'status':{'type':{'completed':complete,'state':'post' if complete else 'pre'}},
  'competitions':[{'competitors':[
   {'homeAway':'away','team':{'id':str(away),'displayName':'Away'},'score':away_score},
   {'homeAway':'home','team':{'id':str(home),'displayName':'Home'},'score':home_score}]}]}
class SportFeedTests(unittest.TestCase):
 def test_season_bounds(self):
  self.assertEqual(sport.season(NOW),2027)
  self.assertEqual(sport.start('basketball',2027).strftime('%Y-%m-%d'),'2026-11-01')
  self.assertEqual(sport.start('baseball',2027).strftime('%Y-%m-%d'),'2027-02-01')
 def test_only_sec_and_verified_final(self):
  example={'events':[
   event('1001',333,2,'2026-11-04T23:00:00Z',True,'65','73'),
   event('1002',55,66,'2026-11-05T23:00:00Z'),
   event('1003',344,245,'2026-11-06T23:00:00Z')]}
  rows=sport.parse(example,'basketball',2027)
  self.assertEqual(len(rows),2)
  self.assertEqual(rows[0]['winner_code'],'2')
  self.assertEqual(rows[0]['away_score'],65)
  self.assertEqual(rows[0]['id'],'basketball-2027-1001')
  self.assertEqual(rows[0]['week'],1)
  self.assertIsNone(rows[1]['winner_code'])
 def test_real_sport_calendar_and_no_made_up_fixtures(self):
  def mock(url):
   if 'basketball/' in url:return {'events':[event('2027bb',333,2,'2026-11-09T01:00:00Z')]}
   return {'events':[]}
  result=sport.build(now=NOW,get=mock)
  self.assertEqual(result['sports']['basketball']['season'],2027)
  self.assertEqual(len(result['sports']['basketball']['games']),1)
  self.assertEqual(result['sports']['baseball']['games'],[])
  self.assertEqual(result['sports']['basketball']['source_windows']>0,True)
 def test_offline_reuses_only_verified_old_fixture(self):
  existing={'sports':{'basketball':{'games':[
   {'id':'basketball-2027-old','season':2027,'kickoff_at':'2026-11-06T17:00:00Z','game_status':'scheduled'},
   {'id':'basketball-2026-old','season':2026,'kickoff_at':'2025-11-06T17:00:00Z'}]}}}
  def offline(url):raise OSError('offline')
  r=sport.build(now=NOW,get=offline,existing=existing)
  self.assertEqual(len(r['sports']['basketball']['games']),1)
  self.assertIn('unavailable',r['sports']['basketball']['warning'])
 def test_database_fallback_populates_real_games_even_when_espn_is_down(self):
  imported={'id':'basketball-2027-sec-20261103-2747-2633',
   'sport':'basketball','season':2027,'week':1,
   'kickoff_at':'2026-11-03T22:00:00+00:00','away_code':'2747',
   'home_code':'2633','away_name':'Wofford','home_name':'Tennessee',
   'away_score':None,'home_score':None,'winner_code':None,
   'game_status':'scheduled','source':'Tennessee Athletics · confirmed tipoff',
   'espn_event_id':None}
  def offline(url):raise OSError('ESPN down')
  def fallback(sport,year):return [imported] if sport=='basketball' else []
  result=sport.build(now=NOW,get=offline,fallback=fallback)
  rows=result['sports']['basketball']
  self.assertEqual(len(rows['games']),1)
  self.assertEqual(rows['games'][0]['id'],imported['id'])
  self.assertEqual(rows['verified_database_games'],1)
  self.assertEqual(rows['source_windows'],0)
  self.assertIn('verified',rows['warning'])
  self.assertIsNone(rows['games'][0]['winner_code'])
  self.assertEqual(result['sports']['baseball']['games'],[])
 def test_schedules_use_server_import_ids_instead_of_duplicate_espn_ids(self):
  imported={'id':'basketball-2027-sec-20261103-2747-2633',
   'sport':'basketball','season':2027,'week':1,
   'kickoff_at':'2026-11-03T22:00:00Z','away_code':'2747',
   'home_code':'2633','away_name':'Wofford','home_name':'Tennessee',
   'away_score':None,'home_score':None,'winner_code':None,
   'game_status':'scheduled','source':'Tennessee Athletics · confirmed tipoff',
   'espn_event_id':'espn001'}
  def espn(url):
   if 'basketball/' not in url:return {'events':[]}
   return {'events':[event('espn001',2747,2633,'2026-11-03T22:00:00Z')]}
  result=sport.build(now=NOW,get=espn,
     fallback=lambda s,y:[imported] if s=='basketball' else [])
  ids=[g['id'] for g in result['sports']['basketball']['games']]
  self.assertEqual(ids,[imported['id']],"No duplicate visible games or changed pick IDs")
 def test_offline_sources_preserve_prior_verified_finals(self):
  old={'sports':{'basketball':{'games':[{
    'id':'basketball-2027-sec-20261103-2747-2633','sport':'basketball',
    'season':2027,'week':1,'away_code':'2747','home_code':'2633',
    'away_name':'Wofford','home_name':'Tennessee',
    'kickoff_at':'2026-11-03T22:00:00Z','source':'SEC confirmed',
    'game_status':'final','winner_code':'2633','away_score':65,'home_score':73
  }]}}}
  revised={**old['sports']['basketball']['games'][0],
      'game_status':'scheduled','winner_code':None,'away_score':None,'home_score':None}
  result=sport.build(now=NOW,get=lambda u: (_ for _ in ()).throw(OSError('offline')),
      fallback=lambda s,y:[revised] if s=='basketball' else [],existing=old)
  actual=result['sports']['basketball']['games'][0]
  self.assertEqual(actual['game_status'],'final')
  self.assertEqual(actual['winner_code'],'2633')
  self.assertEqual(actual['home_score'],73)
 def test_invalid_database_rows_cannot_create_false_games(self):
  bad={'id':'basketball-2027-forged','sport':'basketball','season':2027,'week':1,
      'kickoff_at':'2026-11-03T22:00:00Z','away_code':'1','home_code':'2',
      'game_status':'final','source':'Unverified'}
  self.assertEqual(sport.validated_public_games([bad],'basketball',2027),[])

if __name__=='__main__':unittest.main()
