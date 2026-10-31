#!/usr/bin/env python3
"""Regression tests for SEC schedule completeness reporting."""
import datetime as dt
import importlib.util
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / 'scripts' / 'check-schedule-coverage.py'
spec = importlib.util.spec_from_file_location('coverage_checker', SOURCE)
coverage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coverage)

class CoverageTests(unittest.TestCase):
    def test_partial_basketball_season_is_flagged(self):
        payload={'sports':{
            'basketball':{'season':2027,'games':[{'home_code':'333','away_code':'2'}],
                          'team_coverage':{'333':1}},
            'baseball':{'season':2027,'games':[]}}}
        r=coverage.report(payload,dt.datetime(2026,11,1,tzinfo=dt.timezone.utc))
        self.assertTrue(r['needs_review'])
        self.assertFalse(r['sports']['basketball']['coverage_verified'])
        self.assertTrue(r['sports']['basketball']['issues'])
        self.assertEqual(r['sports']['baseball']['issues'],[])
    def test_offseason_note_does_not_keep_alert_open(self):
        full=[{'home_code':t,'away_code':'999'} for t in coverage.SEC for _ in range(30)]
        payload={'sports':{
            'basketball':{'season':2027,'games':full,'team_coverage':{t:30 for t in coverage.SEC}},
            'baseball':{'season':2027,'games':[],'warning':'No verified individual first-pitch times yet'}}}
        r=coverage.report(payload,dt.datetime(2026,11,1,tzinfo=dt.timezone.utc))
        self.assertFalse(r['needs_review'])
        self.assertTrue(r['sports']['basketball']['coverage_verified'])
    def test_in_season_warning_is_reported(self):
        payload={'sports':{'basketball':{'season':2027,'games':[],'warning':'feed down'},
                           'baseball':{'season':2027,'games':[],'warning':'feed down'}}}
        r=coverage.report(payload,dt.datetime(2027,3,1,tzinfo=dt.timezone.utc))
        self.assertIn('feed down',r['sports']['baseball']['issues'])
    def test_report_counts_sec_against_nonconference(self):
        games=[{'home_code':'333','away_code':'999'}]
        r=coverage.report({'sports':{'basketball':{'season':2027,'games':games},
                                      'baseball':{'season':2027,'games':[]}}},
                          dt.datetime(2026,11,1,tzinfo=dt.timezone.utc))
        self.assertEqual(r['sports']['basketball']['per_school']['333'],1)
        self.assertEqual(r['sports']['basketball']['per_school']['2'],0)

if __name__=='__main__':
    unittest.main()
