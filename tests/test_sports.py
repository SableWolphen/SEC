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
 def test_full_season_windows_and_annual_rollover(self):
  basketball=list(sport.windows('basketball',2027,NOW))
  baseball=list(sport.windows('baseball',2027,NOW))
  self.assertEqual(basketball[0][0].date(),dt.date(2026,11,1))
  self.assertEqual(basketball[-1][1].date(),dt.date(2027,4,15))
  self.assertEqual(baseball[0][0].date(),dt.date(2027,2,1))
  self.assertEqual(baseball[-1][1].date(),dt.date(2027,7,1))
  self.assertEqual(sport.season(dt.datetime(2027,10,16,tzinfo=dt.timezone.utc)),2028)
  self.assertEqual(sport.season(dt.datetime(2028,3,1,tzinfo=dt.timezone.utc)),2028)
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
  self.assertIn('first-pitch',result['sports']['baseball']['warning'])
  self.assertNotIn('displaying verified',result['sports']['baseball']['warning'])
  self.assertEqual(result['sports']['basketball']['source_windows']>0,True)
 def test_team_schedules_are_checked_even_when_scoreboard_succeeds(self):
  called=[]
  def mock(url):
   called.append(url)
   if '/teams/333/schedule' in url:
    return {'events':[event('team-only',333,55,'2026-11-12T23:00:00Z')]}
   if '/teams/' in url:return {'events':[]}
   if 'basketball/' in url:
    return {'events':[event('scoreboard',8,2,'2026-11-09T01:00:00Z')]}
   return {'events':[]}
  result=sport.build(now=NOW,get=mock)
  ids={g['id'] for g in result['sports']['basketball']['games']}
  self.assertIn('basketball-2027-team-only',ids)
  self.assertIn('basketball-2027-scoreboard',ids)
  self.assertEqual(len([u for u in called if '/teams/' in u]),16)
  self.assertIn('Incomplete SEC basketball coverage',result['sports']['basketball']['warning'])
 def test_baseball_team_schedule_supplements_scoreboard(self):
  def mock(url):
   if '/baseball/college-baseball/teams/333/schedule' in url:
    return {'events':[event('baseball-team',333,55,'2027-03-12T22:00:00Z')]}
   return {'events':[]}
  result=sport.build(now=NOW,get=mock)
  ids={g['id'] for g in result['sports']['baseball']['games']}
  self.assertIn('baseball-2027-baseball-team',ids)
  self.assertEqual(result['sports']['baseball']['team_coverage'].get('333'),1)
 def test_missing_basketball_coverage_is_visible_even_with_healthy_requests(self):
  def mock(url):
   return {'events':[event('one',333,2,'2026-11-04T23:00:00Z')]}
  data=sport.build(now=NOW,get=mock)
  self.assertIn('Incomplete SEC basketball coverage',data['sports']['basketball']['warning'])
  self.assertEqual(len(data['sports']['basketball']['sec_team_game_counts']),16)
 def test_unfiltered_scoreboard_is_always_checked(self):
  requested=[]
  def mock(url):
   requested.append(url)
   if '/teams/' in url:return {'events':[]}
   if 'basketball/' in url and 'groups=8' in url:
    return {'events':[event('sec',333,2,'2026-11-04T23:00:00Z')]}
   if 'basketball/' in url:
    return {'events':[event('nonconference',333,55,'2026-11-05T23:00:00Z')]}
   return {'events':[]}
  result=sport.build(now=NOW,get=mock)
  ids={g['id'] for g in result['sports']['basketball']['games']}
  self.assertIn('basketball-2027-sec',ids)
  self.assertIn('basketball-2027-nonconference',ids)
  self.assertTrue(any('basketball/' in u and 'scoreboard?' in u
                      and 'groups=8' not in u for u in requested))
 def test_matchup_signature_is_independent_of_espn_numeric_team_codes(self):
  official={'kickoff_at':'2026-11-06T20:00:00Z',
            'away_name':'James Madison','home_name':'Kentucky'}
  espn={'kickoff_at':'2026-11-06T23:00:00Z',
        'away_name':'James Madison','home_name':'Kentucky'}
  self.assertEqual(sport.fixture_signature(official),
                   sport.fixture_signature(espn))
 def test_reschedule_preserves_existing_pick_lock_and_flags_conflict(self):
  original={'id':'basketball-2027-unchanged','kickoff_at':'2026-11-05T22:00:00Z',
            'game_status':'scheduled','source':'SEC confirmed'}
  revised={**original,'kickoff_at':'2026-11-05T23:00:00Z','source':'ESPN'}
  saved={original['id']:original}
  sport.merge_game(saved,revised)
  self.assertEqual(saved[original['id']]['kickoff_at'],original['kickoff_at'])
  self.assertEqual(saved[original['id']]['reschedule_pending'],revised['kickoff_at'])
 def test_reschedule_conflict_survives_later_refreshes(self):
  original={'id':'basketball-2027-lock','kickoff_at':'2026-11-05T22:00:00Z',
            'game_status':'scheduled','source':'SEC confirmed'}
  saved={original['id']:original}
  sport.merge_game(saved,{**original,'kickoff_at':'2026-11-05T23:00:00Z','source':'ESPN'})
  sport.merge_game(saved,{**original,'source':'SEC confirmed'})
  self.assertEqual(saved[original['id']]['kickoff_at'],original['kickoff_at'])
  self.assertEqual(saved[original['id']]['reschedule_pending'],'2026-11-05T23:00:00Z')
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
      'kickoff_at':'2026-11-03T22:00:00Z','away_code':'55','home_code':'66',
      'game_status':'final','source':'Unverified'}
  self.assertEqual(sport.validated_public_games([bad],'basketball',2027),[])

if __name__=='__main__':unittest.main()
