#!/usr/bin/env python3
"""Refresh public SEC basketball/baseball fixtures without discarding verified data.

The upstream ESPN scoreboard is an optional source. A *read-only*, publicly
accessible Supabase schedule is the fallback for officially imported fixtures.
Never manufacture baseball first-pitch times from weekend-only series pairings.
"""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "sports-schedules.json"
CONFIG = ROOT / "config.js"
UTC = dt.timezone.utc
SEC_IDS = {'333', '8', '2', '57', '61', '96', '99', '344', '142',
           '201', '145', '2579', '2633', '251', '245', '238'}
SPORTS = {
    'basketball': 'basketball/mens-college-basketball',
    'baseball': 'baseball/college-baseball',
}


def season(today):
    return today.year + 1 if today.month >= 8 else today.year


def start(sport, year):
    return dt.datetime(year - 1 if sport == 'basketball' else year,
                       11 if sport == 'basketball' else 2, 1, tzinfo=UTC)


def parse(data, sport, year):
    begin = start(sport, year)
    rows = []
    for event in data.get('events', []):
        try:
            competitors = event['competitions'][0]['competitors']
            away = next(i for i in competitors if i.get('homeAway') == 'away')
            home = next(i for i in competitors if i.get('homeAway') == 'home')
            a, h = str(away['team']['id']), str(home['team']['id'])
            if a not in SEC_IDS and h not in SEC_IDS:
                continue
            tip = dt.datetime.fromisoformat(event['date'].replace('Z', '+00:00')).astimezone(UTC)
            if tip.year < year - 1 or tip.year > year:
                continue

            def pts(player):
                value = player.get('score')
                if isinstance(value, dict):
                    value = value.get('value')
                return int(float(value)) if value not in (None, '') else None

            ap, hp = pts(away), pts(home)
            final = bool(event.get('status', {}).get('type', {}).get('completed')) and ap is not None and hp is not None
            canceled = 'cancel' in event.get('status', {}).get('type', {}).get('name', '').lower()
            rows.append({
                'id': f'{sport}-{year}-{event["id"]}', 'sport': sport, 'season': year,
                'week': max(1, int((tip - begin).total_seconds() // 604800) + 1),
                'kickoff_at': tip.isoformat().replace('+00:00', 'Z'),
                'away_code': a, 'home_code': h,
                'away_name': away['team'].get('displayName', away['team'].get('name', 'Away')),
                'home_name': home['team'].get('displayName', home['team'].get('name', 'Home')),
                'away_score': ap, 'home_score': hp,
                'winner_code': h if final and hp > ap else a if final and ap > hp else None,
                'game_status': 'canceled' if canceled else 'final' if final else
                'live' if event.get('status', {}).get('type', {}).get('state') == 'in' else 'scheduled',
                'source': 'ESPN'
            })
        except (KeyError, ValueError, StopIteration, TypeError, IndexError):
            continue
    return rows


def windows(sport, year, now):
    begin = start(sport, year)
    first = max(begin, now - dt.timedelta(days=21))
    if now < begin:
        first = begin
    final = min(dt.datetime(year, 7, 1, tzinfo=UTC),
                max(now, begin) + dt.timedelta(days=112))
    at = first
    while at < final:
        right = min(at + dt.timedelta(days=13), final)
        yield at, right
        at += dt.timedelta(days=14)


def download(url):
    with urlopen(Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; SEC Pickem schedule)',
        'Accept': 'application/json'
    }), timeout=18) as response:
        return json.load(response)


def public_config():
    """These are intentionally published *browser* credentials, never admin keys."""
    text = CONFIG.read_text()
    endpoint = re.search(r"\burl:\s*['\"](https://[a-z0-9-]+\.supabase\.co)['\"]", text)
    key = re.search(r"\bpublishableKey:\s*['\"](sb_publishable_[A-Za-z0-9_-]+)['\"]", text)
    if not endpoint or not key:
        raise ValueError('Public SEC browser configuration is unavailable')
    return endpoint.group(1), key.group(1)


def load_public_games(sport, year):
    """Read-only REST endpoint with the exact same RLS as an anonymous browser."""
    endpoint, key = public_config()
    parameters = urlencode({
        'select': 'id,sport,season,week,kickoff_at,away_code,home_code,away_name,home_name,'
                  'away_score,home_score,winner_code,game_status,source,espn_event_id',
        'sport': f'eq.{sport}', 'season': f'eq.{year}',
        'order': 'kickoff_at.asc', 'limit': '1000'
    })
    url = endpoint + '/rest/v1/sec_sport_games?' + parameters
    request = Request(url, headers={
        'apikey': key, 'Accept': 'application/json',
        'User-Agent': 'SEC-Pickem-verified-public-schedule'
    })
    with urlopen(request, timeout=16) as response:
        rows = json.load(response)
    if not isinstance(rows, list):
        raise ValueError('Unexpected verified schedule response')
    return rows


def validated_public_games(rows, sport, year):
    """Reject untrusted/malformed rows and preserve the original imported IDs."""
    good = []
    for raw in rows:
        if not isinstance(raw, dict) or raw.get('sport') != sport or raw.get('season') != year:
            continue
        away, home = str(raw.get('away_code') or ''), str(raw.get('home_code') or '')
        if not away or not home or away == home or not (away in SEC_IDS or home in SEC_IDS):
            continue
        try:
            tip = dt.datetime.fromisoformat(str(raw['kickoff_at']).replace('Z', '+00:00'))
            if tip.tzinfo is None:
                continue
            tip = tip.astimezone(UTC)
            week = int(raw['week'])
            if week < 1 or week > 70 or tip.year < year - 1 or tip.year > year:
                continue
        except (KeyError, TypeError, ValueError):
            continue
        game_id = str(raw.get('id') or '')
        if not game_id.startswith(f'{sport}-{year}-') or len(game_id) > 150:
            continue
        status = raw.get('game_status')
        if status not in ('scheduled', 'live', 'final', 'canceled'):
            continue
        ap, hp = raw.get('away_score'), raw.get('home_score')
        winner = raw.get('winner_code') if status == 'final' else None
        if winner not in (away, home):
            winner = None
        good.append({
            'id': game_id, 'sport': sport, 'season': year, 'week': week,
            'kickoff_at': tip.isoformat().replace('+00:00', 'Z'),
            'away_code': away, 'home_code': home,
            'away_name': str(raw.get('away_name') or 'Away')[:150],
            'home_name': str(raw.get('home_name') or 'Home')[:150],
            'away_score': ap, 'home_score': hp, 'winner_code': winner,
            'game_status': status,
            'source': str(raw.get('source') or 'SEC verified import')[:100],
            'espn_event_id': raw.get('espn_event_id'),
        })
    return good


def merge_game(saved, game):
    """Do not undo a verified final when upstream schedules temporarily regress."""
    old = saved.get(game['id'])
    if old and old.get('game_status') == 'final' and game['game_status'] != 'final':
        game = {**game, 'game_status': 'final', 'winner_code': old.get('winner_code'),
                'home_score': old.get('home_score'), 'away_score': old.get('away_score')}
    saved[game['id']] = game


def build(now=None, get=download, existing=None, fallback=None):
    now = now or dt.datetime.now(UTC)
    if fallback is None:
        # Existing tests and offline users who mock ESPN never touch production.
        fallback = load_public_games if get is download else lambda s, yr: []
    result = {'updated_at': now.isoformat().replace('+00:00', 'Z'), 'sports': {}}
    for sport, slug in SPORTS.items():
        year = season(now)
        old = ((existing or {}).get('sports') or {}).get(sport) or {}
        saved = {x['id']: x for x in old.get('games', []) if x.get('season') == year and x.get('id')}
        successes = 0
        for left, right in windows(sport, year, now):
            fmt = lambda day: day.strftime('%Y%m%d')
            url = ('https://site.api.espn.com/apis/site/v2/sports/' + slug +
                   '/scoreboard?dates=' + fmt(left) + '-' + fmt(right) +
                   '&groups=8&limit=500')
            try:
                for game in parse(get(url), sport, year):
                    merge_game(saved, game)
                successes += 1
            except Exception as ex:
                print(sport, 'ESPN source unavailable:', type(ex).__name__)

        official = []
        database_ok = False
        try:
            official = validated_public_games(fallback(sport, year), sport, year)
            database_ok = True
        except Exception as ex:
            print(sport, 'public verified schedule unavailable:', type(ex).__name__)

        # Official imports reuse the original IDs the pick server knows about.
        # For ESPN's different IDs, avoid double-displaying the SAME event.
        official_espn_ids = {str(g.get('espn_event_id'))
                             for g in official if g.get('espn_event_id')}
        official_signatures = {
            (g['away_code'], g['home_code'], g['kickoff_at'][:10])
            for g in official if sport == 'basketball'
        }
        for game in official:
            merge_game(saved, game)
        for game_id, game in list(saved.items()):
            if game.get('source') != 'ESPN' or game_id in {g['id'] for g in official}:
                continue
            espn_id = game_id.split('-')[-1]
            same_match = (sport == 'basketball' and
                          (game['away_code'], game['home_code'], game['kickoff_at'][:10])
                          in official_signatures)
            if espn_id in official_espn_ids or same_match:
                del saved[game_id]

        games = sorted(saved.values(), key=lambda g: (g['kickoff_at'], g['id']))
        issue = None
        if not successes and not database_ok:
            issue = 'Live schedule sources unavailable; retaining previously confirmed games.'
        elif not successes and database_ok:
            issue = 'Live ESPN feed unavailable; displaying verified SEC/university fixtures.'
        elif not games:
            issue = 'No individual matchups have been published with verified start times yet.'
        result['sports'][sport] = {
            'season': year, 'games': games,
            'source': 'Verified SEC/university fixtures + ESPN',
            'source_windows': successes, 'verified_database_games': len(official),
            'database_connected': database_ok, 'warning': issue
        }
        print(sport, year, len(games), 'games;', len(official),
              'verified database fixtures;', successes, 'ESPN windows')
    return result


def main():
    prior = json.loads(OUT.read_text()) if OUT.exists() else None
    data = build(existing=prior)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
