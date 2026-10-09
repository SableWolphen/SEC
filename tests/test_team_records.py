#!/usr/bin/env python3
"""Offline tests for ESPN SEC team record extraction and season isolation."""
import datetime as dt
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"scripts"))
import update_team_records as tracker
NOW=dt.datetime(2026,10,9,20,tzinfo=dt.timezone.utc)


class TeamRecordTests(unittest.TestCase):
 def test_season_rollovers(self):
  self.assertEqual(tracker.season_year("football",NOW),2026)
  self.assertEqual(tracker.season_year("basketball",NOW),2026)
  self.assertEqual(tracker.season_year("baseball",NOW),2026)
  december=NOW.replace(month=12)
  self.assertEqual(tracker.season_year("basketball",december),2027)
  january=NOW.replace(year=2027,month=1)
  self.assertEqual(tracker.season_year("football",january),2026)
  self.assertEqual(tracker.season_year("baseball",january),2026)
 def test_records_and_conference_splits(self):
  obj={"record":{"items":[{"type":"total","name":"All Splits","summary":"8-2"},
     {"type":"vsconf","name":"vs. Conference","summary":"4-2"}]}}
  self.assertEqual(tracker.record_parts(obj),("8-2","4-2"))
  self.assertEqual(tracker.record_parts({"record":{"summary":"19-8"}}),("19-8",None))
  self.assertEqual(tracker.record_parts({"record":[]}),(None,None))
  self.assertIsNone(tracker.valid_record("12-0<script>"))
 def test_baseball_conference_standings_source(self):
  payload={'season':{'year':2026},'children':[{'name':'SEC','standings':{'entries':[
   {'team':{'id':'2633','location':'Tennessee'},'stats':[
    {'name':'overall','displayValue':'46-15'},
    {'name':'conference','displayValue':'18-12'}]},
   {'team':{'id':'333','location':'Alabama'},'stats':[
    {'name':'wins','value':34},{'name':'losses','value':21},
    {'name':'conferenceWins','value':14},{'name':'conferenceLosses','value':16}]},
   {'team':{'id':'251','location':'Texas A&M'},'stats':[
    {'name':'overall','displayValue':'99-0'}]},
   {'team':{'id':'1','location':'Oregon'},'stats':[
    {'name':'overall','displayValue':'23-1'}]}
  ]}}]}
  rows=tracker.standings_records(payload,'baseball',2026)
  self.assertEqual(rows['TENN']['overall'],'46-15')
  self.assertEqual(rows['TENN']['conference'],'18-12')
  self.assertEqual(rows['ALA']['overall'],'34-21')
  self.assertEqual(rows['ALA']['conference'],'14-16')
  self.assertNotIn('TEX',rows)
  self.assertEqual(len(rows),2)
  self.assertEqual(tracker.standings_records({'season':{'year':2027},'children':payload['children']},'baseball',2026),{})
 def test_build_fills_missing_baseball_from_espn_standings(self):
  def get(url):
   if '/standings?' in url:
    return {'season':{'year':2026},'groups':[
     {'standings':{'entries':[{'team':{'id':'333','location':'Alabama'},
        'stats':[{'name':'overall','displayValue':'43-16'},
                 {'name':'vsconf','displayValue':'20-10'}]}]}}]}
   raise OSError('Other requests missing')
  result=tracker.build(NOW,get=get)
  self.assertEqual(result['teams']['ALA']['baseball']['overall'],'43-16')
  self.assertEqual(result['teams']['ALA']['baseball']['conference'],'20-10')
  self.assertNotIn('baseball',result['teams']['TENN'])
 def test_official_baseball_2026_finals_not_projected_to_2027(self):
  self.assertEqual(len(tracker.BASEBALL_FINAL_2026),16)
  self.assertEqual(tracker.BASEBALL_FINAL_2026['UGA'],('53-14','23-7'))
  self.assertEqual(tracker.BASEBALL_FINAL_2026['TENN'],('38-22','15-15'))
  self.assertEqual(tracker.BASEBALL_FINAL_2026['ALA'],('42-21','18-12'))
  self.assertEqual(tracker.BASEBALL_FINAL_2026['SC'],('22-35','7-23'))
  def offline(_url):raise OSError('Source unavailable')
  record=tracker.build(NOW,get=offline)
  self.assertEqual(record['teams']['UGA']['baseball']['overall'],'53-14')
  self.assertEqual(record['teams']['UGA']['baseball']['source'],'SEC')
  self.assertEqual(record['teams']['UGA']['baseball']['conference'],'23-7')
  self.assertNotIn('baseball',tracker.build(NOW.replace(year=2027),get=offline)['teams']['UGA'])
 def test_no_cross_school_records(self):
  self.assertTrue(tracker.identity_ok("TEX",{"location":"Texas","shortDisplayName":"Texas"}))
  self.assertFalse(tracker.identity_ok("TEX",{"location":"Texas A&M","shortDisplayName":"Texas A&M"}))
  self.assertFalse(tracker.identity_ok("MSST",{"location":"Ole Miss"}))
  self.assertTrue(tracker.identity_ok("TAMU",{"location":"Texas A&M"}))
 def test_full_build_source_verification(self):
  called=[]
  def mock(url):
   called.append(url)
   code=next(c for c,(team_id,_name) in tracker.SEC_TEAMS.items()
             if f"/teams/{team_id}?" in url)
   name=tracker.SEC_TEAMS[code][1]
   return {"team":{"id":tracker.SEC_TEAMS[code][0],"location":name,
                    "record":{"items":[{"name":"Overall","type":"total","summary":"3-1"},
                                       {"name":"Conference","type":"vsconf","summary":"2-0"}]}}}
  result=tracker.build(NOW,get=mock)
  self.assertEqual(len(called),48)
  self.assertEqual(len(result["teams"]),16)
  self.assertEqual(result["teams"]["TENN"]["football"]["overall"],"3-1")
  self.assertEqual(result["teams"]["TENN"]["basketball"]["conference"],"2-0")
  self.assertEqual(result["teams"]["TENN"]["baseball"]["season"],2026)
  self.assertEqual(result["warning"],None)
 def test_outage_preserves_only_same_season_verified_data(self):
  previous={"teams":{"TENN":{
   "football":{"overall":"4-2","conference":None,"season":2026,
               "source":"ESPN","verified_at":"2026-10-09T00:00:00Z"},
   "basketball":{"overall":"20-10","season":2025,"source":"ESPN"}},
    "ALA":{"football":{"overall":"17-2","season":2026,"source":"made-up"}}}}
  def offline(_url):raise OSError("ESPN temporarily unreachable")
  result=tracker.build(NOW,get=offline,existing=previous)
  self.assertEqual(result["teams"]["TENN"]["football"]["overall"],"4-2")
  self.assertEqual(result["teams"]["TENN"].get("basketball"),None)
  self.assertEqual(result["teams"]["ALA"].get("football"),None)
 def test_historical_season_record_core_fallback(self):
  urls=[]
  def get(url):
   urls.append(url)
   if 'site.api.espn.com' in url:
    return {'season':{'year':2027},
      'team':{'id':'2633','location':'Tennessee','record':{'summary':'0-0'}}}
   return {'count':2,'items':[
      {'name':'All Splits','type':'total','summary':'27-9'},
      {'name':'vs Conference','type':'vsconf','summary':'14-4'}]}
  record=tracker.get_one('TENN','basketball',2026,get)
  self.assertEqual(record['overall'],'27-9')
  self.assertEqual(record['conference'],'14-4')
  self.assertEqual(record['scope'],'Regular season')
  self.assertEqual(record['season'],2026)
  self.assertIn('/seasons/2026/types/2/teams/2633/record',urls[-1])
 def test_unavailable_historical_record_never_shows_wrong_season(self):
  def get(url):
   if 'site.api.espn.com' in url:
    return {'season':{'year':2027},
      'team':{'id':'333','location':'Alabama','record':{'summary':'0-0'}}}
   raise OSError('No verified historical records')
  self.assertIsNone(tracker.get_one('ALA','baseball',2026,get))
 def test_missing_or_mismatched_espn_team_is_unknown(self):
  def mistaken(_url):
   return {"team":{"id":"333","location":"Arkansas",
                   "record":{"items":[{"type":"total","summary":"14-0"}]}}}
  self.assertIsNone(tracker.get_one("ALA","football",2026,mistaken))


if __name__=="__main__":
 unittest.main()
