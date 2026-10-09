#!/usr/bin/env python3
"""Publish source-verified season records for all 16 SEC schools, across three sports.

No invented wins, losses, zero-zero seasons or copied records between sports.
The static snapshot is refreshed by GitHub Actions. The frontend shows N/A when
ESPN has not supplied a verified record for that team/sport/season.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import datetime as dt
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "team-records.json"
UTC = dt.timezone.utc
BASE = "https://site.api.espn.com/apis/site/v2/sports"
SPORTS = {
    "football": "football/college-football",
    "basketball": "basketball/mens-college-basketball",
    "baseball": "baseball/college-baseball",
}
# ESPN team IDs are shared across all three NCAA sports in the existing fixture feed.
SEC_TEAMS = {
    "ALA": ("333", "Alabama"), "ARK": ("8", "Arkansas"),
    "AUB": ("2", "Auburn"), "FLA": ("57", "Florida"),
    "UGA": ("61", "Georgia"), "UK": ("96", "Kentucky"),
    "LSU": ("99", "LSU"), "MISS": ("145", "Ole Miss"),
    "MSST": ("344", "Mississippi State"), "MIZ": ("142", "Missouri"),
    "OU": ("201", "Oklahoma"), "SC": ("2579", "South Carolina"),
    "TENN": ("2633", "Tennessee"), "TEX": ("251", "Texas"),
    "TAMU": ("245", "Texas A&M"), "VAN": ("238", "Vanderbilt"),
}
ALIAS = {
    "LSU": {"lsu", "louisianastate"},
    "MISS": {"olemiss", "mississippi"},
    "MSST": {"mississippistate", "mississippist"},
    "MIZ": {"missouri", "mizzou"},
    "SC": {"southcarolina"},
    "TAMU": {"texasam", "texasaandm", "tamu", "texasaandmuniversity"},
    "TENN": {"tennessee"},
    "VAN": {"vanderbilt"},
}
RECORD = re.compile(r"^(?:[0-9]{1,3})-(?:[0-9]{1,3})(?:-[0-9]{1,3})?$")


def season_year(sport, now):
    yr, month = now.year, now.month
    if sport == "football":
        return yr if month >= 8 else yr - 1
    if sport == "basketball":
        return yr + 1 if month >= 11 else yr
    return yr if month >= 2 else yr - 1


def normalize(name):
    return re.sub(r"[^a-z0-9]", "", str(name or "").lower())


def identity_ok(code, team):
    if not isinstance(team, dict):
        return False
    official = normalize(SEC_TEAMS[code][1])
    matches = {official} | ALIAS.get(code, set())
    # Compare location and short name only: "Tigers" and "Bulldogs" aren't unique.
    candidate = {normalize(team.get("location")), normalize(team.get("shortDisplayName"))}
    # Location "Texas A&M" must not be confused with "Texas".
    return bool(matches & candidate)


def valid_record(value):
    if isinstance(value, dict):
        value = value.get("summary") or value.get("displayValue")
    return value if isinstance(value, str) and RECORD.fullmatch(value.strip()) else None


def record_parts(obj):
    """Read actual ESPN overall/conference splits, never infer a missing record."""
    if not isinstance(obj, dict):
        return None, None
    record = obj.get("record")
    if not record and isinstance(obj.get("team"), dict):
        record = obj["team"].get("record")
    if not record:
        return None, None
    if isinstance(record, str):
        return valid_record(record), None
    if isinstance(record, list):
        items = record
    elif isinstance(record, dict):
        items = record.get("items") or record.get("entries") or record.get("records") or []
        if isinstance(items, dict):
            items = list(items.values())
        if not items and (record.get("summary") or record.get("displayValue")):
            return valid_record(record), None
    else:
        return None, None
    overall, conference = None, None
    for item in items:
        if not isinstance(item, dict):
            continue
        label = " ".join(str(item.get(k, "")) for k in ("name", "type", "description", "abbreviation")).lower()
        value = valid_record(item)
        if not value:
            continue
        if "conference" in label or "vsconf" in label or "vs conf" in label or "sec record" in label:
            conference = conference or value
        elif any(name in label for name in ("overall", "all splits", "total")):
            overall = overall or value
    if len(items) == 1 and overall is None and conference is None:
        overall = valid_record(items[0])
    return overall, conference


def get_json(url):
    request = Request(url, headers={
        "User-Agent": "SEC-Pickem-Record-Tracker/1.0 (public team records)",
        "Accept": "application/json",
    })
    with urlopen(request, timeout=14) as response:
        return json.load(response)


def get_one(code, sport, year, get):
    team_id, _ = SEC_TEAMS[code]
    slug = SPORTS[sport]
    url = f"{BASE}/{slug}/teams/{team_id}?season={year}"
    data = get(url)
    team = data.get("team") or {}
    if str(team.get("id", "")) != team_id or not identity_ok(code, team):
        return None  # A bad ESPN mapping must never place one school's record on another.
    season = data.get("season")
    if isinstance(season, dict) and season.get("year") and int(season["year"]) != year:
        return None
    overall, conference = record_parts(data)
    if not overall:
        overall, conference = record_parts(team)
    if not overall:
        # Some college endpoints only serve records through /teams/{id}/record.
        try:
            extra = get(f"{BASE}/{slug}/teams/{team_id}/record?season={year}")
            overall, conference = record_parts({"record": extra})
        except Exception:
            pass
    if not overall:
        return None
    return {
        "overall": overall,
        "conference": conference,
        "season": year,
        "source": "ESPN",
        "source_url": f"https://www.espn.com/{slug.replace('football/college-football','college-football').replace('basketball/mens-college-basketball','mens-college-basketball').replace('baseball/college-baseball','college-baseball')}/team/_/id/{team_id}",
    }


def build(now=None, get=get_json, existing=None):
    now = now or dt.datetime.now(UTC)
    stamp = now.astimezone(UTC).isoformat().replace("+00:00", "Z")
    prev = (existing or {}).get("teams") or {}
    updated = {code: {} for code in SEC_TEAMS}
    seasons = {sport: season_year(sport, now) for sport in SPORTS}
    work = [(code, sport, year) for code in SEC_TEAMS for sport, year in seasons.items()]
    sourced, failed = 0, 0

    def collect(args):
        code, sport, year = args
        try:
            return args, get_one(code, sport, year, get)
        except Exception as error:
            return args, error

    # Throttle requests: a single scheduled job, not each site visitor, hits ESPN.
    with ThreadPoolExecutor(max_workers=6) as pool:
        for args, outcome in pool.map(collect, work):
            code, sport, year = args
            if isinstance(outcome, Exception):
                failed += 1
            if isinstance(outcome, dict):
                updated[code][sport] = {**outcome, "verified_at": stamp}
                sourced += 1
            else:
                # Retain *only* a previously verified record from the same season.
                old = (prev.get(code) or {}).get(sport)
                if (isinstance(old, dict) and old.get("season") == year
                        and old.get("source") == "ESPN" and valid_record(old.get("overall"))):
                    updated[code][sport] = old

    available = sum(bool(updated[code]) for code in SEC_TEAMS)
    if sourced == 0 and available == 0:
        print("ESPN returned no verified records. Publishing honest unavailable state.")
    print(f"SEC record tracker: {sourced}/48 newly confirmed records; "
          f"{failed} source request errors; {available}/16 schools with at least one record")
    return {"updated_at": stamp, "source": "ESPN", "seasons": seasons, "teams": updated,
            "warning": "Some team records are unavailable from ESPN; unavailable cells are not estimates."
                       if sourced < 48 else None}


def main():
    prior = json.loads(OUT.read_text()) if OUT.exists() else None
    data = build(existing=prior)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("Published source-tagged records, with season and verification timestamps.")


if __name__ == "__main__":
    main()
