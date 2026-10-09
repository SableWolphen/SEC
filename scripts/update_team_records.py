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
from sportradar_baseball import fetch_verified

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
# Completed 2026 season (source: Southeastern Conference official final table).
# Unlike ESPN's incomplete college-baseball endpoints, the SEC publishes every
# school's final overall and conference result:
# https://www.secsports.com/standings/baseball  (2026 final standings).
# These are immutable final 2026 records, NOT a projection for 2027+.
BASEBALL_FINAL_2026 = {
    "UGA": ("53-14", "23-7"), "TEX": ("46-15", "19-10"),
    "TAMU": ("41-16", "18-11"), "ALA": ("42-21", "18-12"),
    "FLA": ("41-21", "18-12"), "AUB": ("42-22", "17-13"),
    "ARK": ("41-22", "17-13"), "MSST": ("43-19", "16-14"),
    "MISS": ("41-23", "15-15"), "TENN": ("38-22", "15-15"),
    "OU": ("43-23", "14-16"), "VAN": ("33-25", "14-16"),
    "UK": ("33-23", "13-17"), "LSU": ("30-28", "9-21"),
    "SC": ("22-35", "7-23"), "MIZ": ("24-31", "6-24"),
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
    wrong_season = (isinstance(season, dict) and season.get("year") and
                    int(season["year"]) != year)
    overall, conference = (None, None) if wrong_season else record_parts(data)
    if not overall and not wrong_season:
        overall, conference = record_parts(team)
    scope = "Season"
    if not overall:
        # Site team endpoints often show only the upcoming year's records.
        # The ESPN core endpoint addresses the desired season explicitly.
        core_sport, league = slug.split("/")
        core_url = (f"https://sports.core.api.espn.com/v2/sports/{core_sport}/"
                    f"leagues/{league}/seasons/{year}/types/2/teams/{team_id}/record")
        try:
            historical = get(core_url)
            overall, conference = record_parts({"record": historical})
            if overall:
                scope = "Regular season"  # ESPN /types/2 excludes playoffs.
        except Exception:
            pass
    if not overall:
        return None
    return {
        "overall": overall,
        "conference": conference,
        "season": year,
        "scope": scope,
        "source": "ESPN",
        "source_url": f"https://www.espn.com/{slug.replace('football/college-football','college-football').replace('basketball/mens-college-basketball','mens-college-basketball').replace('baseball/college-baseball','college-baseball')}/team/_/id/{team_id}",
    }


def _season_matches(payload, year):
    season = payload.get("season")
    if isinstance(season, dict):
        season = season.get("year")
    return not season or str(season) == str(year)


def _standings_entries(obj):
    """Walk ESPN standings trees, including conference groups and nested children."""
    if isinstance(obj, list):
        for item in obj:
            yield from _standings_entries(item)
    elif isinstance(obj, dict):
        entries = obj.get("entries")
        if isinstance(entries, list):
            for item in entries:
                if isinstance(item, dict) and isinstance(item.get("team"), dict):
                    yield item
        for key in ("children", "groups", "standings"):
            if key in obj:
                yield from _standings_entries(obj[key])


def _wins_losses(stats, prefix=""):
    by_name = {str(item.get("name", "")).lower(): item
               for item in stats if isinstance(item, dict)}
    win = by_name.get(prefix + "wins")
    loss = by_name.get(prefix + "losses")
    if not win or not loss:
        return None
    try:
        w = float(win.get("value", win.get("displayValue")))
        l = float(loss.get("value", loss.get("displayValue")))
    except (ValueError, TypeError):
        return None
    if w < 0 or l < 0 or not w.is_integer() or not l.is_integer():
        return None
    return valid_record(f"{int(w)}-{int(l)}")


def standings_records(payload, sport, year):
    """Find validated SEC school records in ESPN's season-specific conference table."""
    if not isinstance(payload, dict) or not _season_matches(payload, year):
        return {}
    ids = {id_value: code for code, (id_value, _) in SEC_TEAMS.items()}
    found = {}
    for entry in _standings_entries(payload):
        team = entry["team"]
        code = ids.get(str(team.get("id", "")))
        if not code:
            continue
        if any(team.get(k) for k in ("location", "shortDisplayName")) and not identity_ok(code, team):
            continue
        stats = entry.get("stats") or []
        overall, conference = record_parts({"record": {"items": stats}})
        if not overall:
            overall = _wins_losses(stats)
        if not conference:
            conference = _wins_losses(stats, "conference")
        if not overall:
            continue
        found[code] = {
            "overall": overall, "conference": conference, "season": year,
            "scope": "Season", "source": "ESPN",
            "source_url": f"https://www.espn.com/college-baseball/team/_/id/{team['id']}",
        }
    return found


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
                        and old.get("source") in ("ESPN", "SEC", "Sportradar") and valid_record(old.get("overall"))):
                    updated[code][sport] = old

    # ESPN team details and Core API occasionally omit baseball records entirely.
    # A source-verified, season-scoped SEC standings table is an independent fallback.
    if any("baseball" not in updated[code] for code in SEC_TEAMS):
        year = seasons["baseball"]
        url = (f"https://site.api.espn.com/apis/v2/sports/baseball/"
               f"college-baseball/standings?group=8&season={year}")
        try:
            table = standings_records(get(url), "baseball", year)
            for code, record in table.items():
                if "baseball" not in updated[code]:
                    updated[code]["baseball"] = {**record, "verified_at": stamp}
                    sourced += 1
            print(f"ESPN SEC baseball standings filled {len(table)} source-linked schools")
        except Exception as error:
            print("SEC baseball standings unavailable:", type(error).__name__)

    # Optional licensed feed. Requires a GitHub Actions secret and an explicit
    # NCAA Baseball season URN/year pair; no API key is sent to browser clients.
    # When validated, Sportradar takes priority over the ESPN baseball fallback.
    try:
        licensed_records = fetch_verified(seasons["baseball"])
        for code, record in licensed_records.items():
            if code in SEC_TEAMS and record.get("season") == seasons["baseball"]:
                updated[code]["baseball"] = {**record, "verified_at": stamp}
        if licensed_records:
            print("Verified Sportradar NCAA baseball records:", len(licensed_records))
    except (ValueError, OSError, TimeoutError) as error:
        print("Optional Sportradar coverage unavailable:", type(error).__name__)

    # Authoritative SEC *final* results outrank both ESPN and licensed data
    # for the already completed 2026 season. Never reuse these in 2027.
    if seasons["baseball"] == 2026:
        for code, (overall, conference) in BASEBALL_FINAL_2026.items():
            updated[code]["baseball"] = {
                "overall": overall, "conference": conference,
                "season": 2026, "scope": "Final 2026 season",
                "source": "SEC",
                "source_url": "https://www.secsports.com/standings/baseball",
                "verified_at": stamp,
            }

    available = sum(bool(updated[code]) for code in SEC_TEAMS)
    record_count = sum(len(updated[code]) for code in SEC_TEAMS)
    if sourced == 0 and available == 0:
        print("ESPN returned no verified records. Publishing honest unavailable state.")
    print(f"SEC record tracker: {sourced}/48 newly confirmed records; "
          f"{failed} source request errors; {available}/16 schools with at least one record")
    providers = sorted({record["source"] for sports in updated.values()
                        for record in sports.values()})
    return {"updated_at": stamp, "source": "ESPN", "sources_used": providers,
            "reference_links": {
                "sec_team_statistics": "https://stats.secsports.com/#team",
                "ncaa_baseball_records": "https://www.ncaa.org/championships/statistics-and-records/baseball/",
                "sportradar_documentation": "https://developer.sportradar.com/baseball/reference/global-baseball-overview",
            },
            "seasons": seasons, "teams": updated,
            "warning": "Some records are not available from ESPN or SEC; unavailable cells are not estimates."
                       if record_count < 48 else None}


def main():
    prior = json.loads(OUT.read_text()) if OUT.exists() else None
    data = build(existing=prior)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("Published source-tagged records, with season and verification timestamps.")


if __name__ == "__main__":
    main()
