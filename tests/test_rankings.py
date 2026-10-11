#!/usr/bin/env python3
"""Poll extraction must never invent school ranks or assign historical polls to current."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
import update_rankings as polls

NOW=dt.datetime(2026,10,11,18,tzinfo=dt.timezone.utc)
IDS=list(polls.CODES)
def payload(name="AP Top 25",date="2026-10-06",season=None):
 return {"latestWeek":{"number":6,"startDate":date},
         "rankings":[{"name":name,"type":"ap" if "AP" in name else "other",
          "ranks":[{"current":i+1,"previous":i+2 if i<23 else 25,
                    "team":{"id":IDS[i%len(IDS)] if i<16 else str(9500+i),
                             "displayName":"University "+str(i)}}
                   for i in range(25)]}]}
class RankingTests(unittest.TestCase):
 def test_exact_school_ids_and_unranked(self):
  p=polls.parse_poll(payload(), "football",NOW)
  self.assertEqual(p["poll"],"AP Top 25")
  self.assertEqual(p["teams"]["ALA"]["rank"],1)
  self.assertEqual(p["teams"]["TENN"]["rank"],13)
  self.assertEqual(p["published_at"],"2026-10-06")
  self.assertEqual(p["season"],2026)
  self.assertEqual(p["poll_size"],25)
  self.assertNotIn("UTEP",p["teams"])
 def test_requires_verifiable_date_and_complete_poll(self):
  missing=payload()
  missing.pop("latestWeek")
  self.assertIsNone(polls.parse_poll(missing,"football",NOW))
  partial=payload()
  partial["rankings"][0]["ranks"]=partial["rankings"][0]["ranks"][:12]
  self.assertIsNone(polls.parse_poll(partial,"football",NOW))
 def test_prevent_conflicting_rankings_and_team_ids(self):
  dup=payload()
  dup["rankings"][0]["ranks"][1]["current"]=1
  self.assertIsNone(polls.parse_poll(dup,"football",NOW))
  duplicate_team=payload()
  duplicate_team["rankings"][0]["ranks"][1]["team"]["id"]="333"
  self.assertIsNone(polls.parse_poll(duplicate_team,"football",NOW))
 def test_season_and_future_dates_rejected(self):
  old=payload(date="2024-10-06")
  self.assertIsNone(polls.parse_poll(old,"football",NOW))
  future=payload(date="2026-11-06")
  self.assertIsNone(polls.parse_poll(future,"football",NOW))
  old_bball=payload(date="2025-03-16")
  self.assertIsNone(polls.parse_poll(old_bball,"basketball",NOW))
 def test_basketball_season_rollover(self):
  date=NOW.replace(month=12,day=3)
  data=payload(date="2026-12-01")
  result=polls.parse_poll(data,"basketball",date)
  self.assertEqual(result["season"],2027)
  self.assertEqual(polls.season_for("basketball",date.date()),2027)
 def test_named_poll_preference(self):
  p=payload(name="USA Today Coaches",date="2026-10-06")
  p["rankings"][0]["type"]="coaches"
  better=payload(name="AP Top 25",date="2026-10-06")["rankings"][0]
  p["rankings"].append(better)
  self.assertEqual(polls.parse_poll(p,"football",NOW)["poll"],"AP Top 25")
 def test_baseball_requires_named_poll(self):
  generic=payload(name="Unknown Top 25",date="2026-06-01")
  self.assertIsNone(polls.parse_poll(generic,"baseball",NOW))
  top=payload(name="D1Baseball Top 25",date="2026-06-01")
  x=polls.parse_poll(top,"baseball",NOW)
  self.assertEqual(x["season"],2026)
 def test_fetch_failure_preserves_only_labeled_recent_history(self):
  p=polls.parse_poll(payload(),"football",NOW)
  def down(_):raise OSError("No network")
  d=polls.build(now=NOW,get=down,prior={"sports":{"football":p}})
  self.assertEqual(d["sports"]["football"],p)
  self.assertNotIn("basketball",d["sports"])
  self.assertNotIn("baseball",d["sports"])
  old=NOW.replace(year=2028)
  self.assertNotIn("football",polls.build(now=old,get=down,prior={"sports":{"football":p}})["sports"])
 def test_do_not_use_team_names_for_identity(self):
  p=payload()
  p["rankings"][0]["ranks"][0]["team"]={"id":"123456","displayName":"Alabama Crimson Tide"}
  rank=polls.parse_poll(p,"football",NOW)
  self.assertNotIn("ALA",rank["teams"],"ID mismatch must not map by displayName alone")
 def test_poll_season_boundaries(self):
  self.assertEqual(polls.season_for("football",dt.date(2027,1,4)),2026)
  self.assertEqual(polls.season_for("baseball",dt.date(2027,1,4)),2026)
  self.assertEqual(polls.season_for("baseball",dt.date(2027,2,4)),2027)
if __name__=="__main__":unittest.main()
