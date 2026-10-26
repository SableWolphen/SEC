#!/usr/bin/env python3
"""Check public sports schedule coverage without fabricating unpublished games."""
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEC = ('333','8','2','57','61','96','99','344','142','201','145','2579','2633','251','245','238')

def report(payload, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    details = {}
    for sport in ('basketball','baseball'):
        data = payload.get('sports', {}).get(sport, {})
        games = data.get('games', [])
        counts = {team: sum(team in (str(g.get('away_code')),str(g.get('home_code'))) for g in games)
                  for team in SEC}
        school_feeds = data.get('team_coverage') or {}
        usable_feeds = sum(isinstance(school_feeds.get(team), (int, float)) and school_feeds[team] > 0
                           for team in SEC)
        season = int(data.get('season', now.year))
        basketball_active = now >= dt.datetime(season-1,10,1,tzinfo=dt.timezone.utc)
        baseball_active = now >= dt.datetime(season,2,1,tzinfo=dt.timezone.utc)
        is_active = basketball_active if sport == 'basketball' else baseball_active
        low = {team:n for team,n in counts.items() if n < (25 if sport == 'basketball' else 35)} if is_active else {}
        issues = []
        if is_active and low:
            issues.append(f'Low published fixture coverage for {len(low)} SEC schools')
        if is_active and not games:
            issues.append('No confirmed individual fixtures')
        if is_active and usable_feeds < len(SEC):
            issues.append(f'Only {usable_feeds}/16 school feeds returned usable data')
        if data.get('warning'):
            issues.append(str(data['warning']))
        details[sport] = {'season':season,'games':len(games),'per_school':counts,
                          'school_feeds':usable_feeds,'issues':issues,
                          'coverage_verified':not issues and is_active}
    return {'generated_at':now.isoformat(),'sports':details,
            'needs_review':any(v['issues'] for v in details.values())}

if __name__ == '__main__':
    source=json.loads((ROOT/'sports-schedules.json').read_text())
    status=report(source)
    path=ROOT/'sports-schedule-health.json'
    path.write_text(json.dumps(status,indent=2)+'\n')
    print(json.dumps(status,indent=2))
    for name,item in status['sports'].items():
        for problem in item['issues']:
            print(f'::warning::{name}: {problem}')
