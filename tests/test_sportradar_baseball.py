#!/usr/bin/env python3
"""Offline-only safety checks for optional Sportradar Global Baseball v2 data."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"scripts"))
import sportradar_baseball as sr

URN="sr:season:12345"
INFO={"season":{"id":URN,"year":"2027",
                "competition":{"name":"NCAA Division I Baseball"},
                "sport":{"name":"Baseball"}}}
STANDINGS={"standings":[
 {"type":"home","groups":[{"name":"SEC","standings":[
    {"competitor":{"name":"Alabama Crimson Tide"},"win":99,"loss":0}]}]},
 {"type":"total","groups":[
    {"name":"Southeastern Conference","standings":[
     {"competitor":{"name":"Tennessee Volunteers"},"win":39,"loss":22},
     {"competitor":{"name":"Alabama Crimson Tide"},"win":40,"loss":18},
     {"competitor":{"name":"Georgia State Panthers"},"win":44,"loss":12},
     {"competitor":{"name":"Ole Miss Rebels"},"win":31,"loss":22}]},
    {"name":"Big Ten","standings":[
     {"competitor":{"name":"Georgia Bulldogs"},"win":60,"loss":0}]}]}
 ]}


class SportradarSafety(unittest.TestCase):
 def test_exact_sec_mapping_and_total_records(self):
  result=sr.parse_standings(STANDINGS,2027)
  self.assertEqual(set(result),{"TENN","ALA","MISS"})
  self.assertEqual(result["TENN"]["overall"],"39-22")
  self.assertEqual(result["TENN"]["source"],"Sportradar")
  self.assertEqual(result["ALA"]["overall"],"40-18")
  self.assertNotIn("UGA",result)
 def test_reject_ambiguous_and_invalid_rows(self):
  obj={"standings":[{"type":"total","groups":[{"name":"SEC","standings":[
   {"competitor":{"name":"Alabama Crimson Tide"},"win":4,"loss":1},
   {"competitor":{"name":"Alabama Crimson Tide"},"win":5,"loss":1},
   {"competitor":{"name":"Alabama Crimson Tide"},"win":5,"loss":1},
   {"competitor":{"name":"Tennessee Volunteers"},"win":-1,"loss":3},
   {"competitor":{"name":"Vanderbilt Commodores","virtual":True},"win":3,"loss":2},
   {"competitor":{"name":"Auburn Tigers"},"win":True,"loss":2}
  ]}]}]}
  self.assertEqual(sr.parse_standings(obj,2027),{})
 def test_optional_credentials_and_season_validation(self):
  self.assertEqual(sr.fetch_verified(2027,environ={}),{})
  self.assertEqual(sr.fetch_verified(2027,environ={"SPORTRADAR_API_KEY":"testsecret",
          "SPORTRADAR_BASEBALL_SEASON_ID":URN,"SPORTRADAR_BASEBALL_SEASON_YEAR":"2026"}),{})
  calls=[]
  def fake_get(url,key):
   calls.append((url,key))
   return INFO if "/info.json" in url else STANDINGS
  env={"SPORTRADAR_API_KEY":"testsecret",
       "SPORTRADAR_BASEBALL_SEASON_ID":URN,
       "SPORTRADAR_BASEBALL_SEASON_YEAR":"2027",
       "SPORTRADAR_ACCESS_LEVEL":"trial"}
  got=sr.fetch_verified(2027,env,fake_get)
  self.assertEqual(got["MISS"]["overall"],"31-22")
  self.assertEqual(len(calls),2)
  self.assertTrue(all(key=="testsecret" and "testsecret" not in url for url,key in calls))
  bad=dict(env);bad["SPORTRADAR_ACCESS_LEVEL"]="invalid"
  with self.assertRaises(ValueError):sr.fetch_verified(2027,bad,fake_get)
  def wrong_season(url,key):
   return {"season":{**INFO["season"],"year":"2026"}}
  with self.assertRaisesRegex(ValueError,"not a verified NCAA"):
   sr.fetch_verified(2027,env,wrong_season)
  wrong_league={"season":{**INFO["season"],"competition":{"name":"MLB"}}}
  self.assertFalse(sr.season_is_ncaabaseball(wrong_league,URN,2027))
 def test_no_unverified_team_id_guessing(self):
  self.assertNotIn("georgiastatepanthers",sr.NAME_TO_CODE)
  self.assertNotIn("texasstatebobcats",sr.NAME_TO_CODE)


if __name__=="__main__":
 unittest.main()
