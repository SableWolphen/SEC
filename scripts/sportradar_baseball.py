#!/usr/bin/env python3
"""Optional, licensed NCAA baseball standings from Sportradar Global Baseball v2.

Runs ONLY in GitHub Actions with a secret x-api-key, explicit season ID and year.
Never send credentials or an API response containing account details to GitHub Pages.
Reject wrong-season, non-NCAA, non-SEC or ambiguously named teams rather than
guessing. Empty results safely leave SEC/ESPN historical data in place.
"""
import json
import os
import re
from urllib.request import Request, urlopen

DOCUMENTATION = "https://developer.sportradar.com/baseball/reference/global-baseball-season-standings"
ROOT = "https://api.sportradar.com/baseball"
ALLOWED_NAMES = {
    "ALA": ("alabama", "alabamacrimsontide"),
    "ARK": ("arkansas", "arkansasrazorbacks"),
    "AUB": ("auburn", "auburntigers"),
    "FLA": ("florida", "floridagators"),
    "UGA": ("georgia", "georgiabulldogs"),
    "UK": ("kentucky", "kentuckywildcats"),
    "LSU": ("lsu", "lsutigers", "louisianastate", "louisianastatetigers"),
    "MISS": ("olemiss", "olemissrebels", "mississippi", "mississippirebels"),
    "MSST": ("mississippistate", "mississippistatebulldogs"),
    "MIZ": ("missouri", "missouritigers"),
    "OU": ("oklahoma", "oklahomasooners"),
    "SC": ("southcarolina", "southcarolinagamecocks"),
    "TENN": ("tennessee", "tennesseevolunteers"),
    "TEX": ("texas", "texaslonghorns"),
    "TAMU": ("texasam", "texasamaggies", "texasaandm", "texasaandmaggies"),
    "VAN": ("vanderbilt", "vanderbiltcommodores"),
}
# Built from exact school name + mascot, not a fuzzy similarity search.
NAME_TO_CODE = {re.sub(r"[^a-z0-9]", "", n): c
                for c, names in ALLOWED_NAMES.items() for n in names}


def request_json(url, key):
    request = Request(url, headers={"Accept": "application/json", "x-api-key": key,
                                    "User-Agent": "SEC-Pickem-Team-Records/1.0"})
    with urlopen(request, timeout=18) as response:
        return json.load(response)


def provider_url(level, season_id, resource):
    if level not in ("trial", "production"):
        raise ValueError("Invalid Sportradar API access level")
    if not re.fullmatch(r"sr:season:[0-9]+", season_id):
        raise ValueError("Season identifier must be a Sportradar season URN")
    if resource not in ("info", "standings"):
        raise ValueError("Unexpected Sportradar resource")
    return f"{ROOT}/{level}/v2/en/seasons/{season_id}/{resource}.json"


def season_is_ncaabaseball(info, season_id, year):
    season = info.get("season") if isinstance(info, dict) else None
    if not isinstance(season, dict) or season.get("id") != season_id:
        return False
    if str(season.get("year", "")) != str(year):
        return False
    competition = season.get("competition") or info.get("competition") or {}
    name = str(competition.get("name", "") if isinstance(competition, dict) else "")
    # Explicit NCAA coverage is necessary; do not treat MLB/NPB as college data.
    if "ncaa" not in name.lower():
        return False
    sport = season.get("sport") or info.get("sport") or {}
    sport_name = str(sport.get("name", "") if isinstance(sport, dict) else "")
    return sport_name.lower() == "baseball"


def _nonnegative_int(value):
    if type(value) is int and 0 <= value <= 200:
        return value
    return None


def parse_standings(payload, year):
    """Read only total-type standings from a named SEC group within an NCAA season."""
    found = {}
    if not isinstance(payload, dict):
        return found
    for division in payload.get("standings", []):
        if not isinstance(division, dict) or division.get("type") != "total":
            continue
        for group in division.get("groups", []):
            if not isinstance(group, dict):
                continue
            title = " ".join(str(group.get(k) or "") for k in ("name", "group_name"))
            if not re.search(r"\bsec\b|southeastern", title, flags=re.I):
                continue
            for standing in group.get("standings", []):
                if not isinstance(standing, dict) or not isinstance(standing.get("competitor"), dict):
                    continue
                competitor = standing["competitor"]
                if competitor.get("virtual"):
                    continue
                candidate = re.sub(r"[^a-z0-9]", "", str(competitor.get("name", "")).lower())
                code = NAME_TO_CODE.get(candidate)
                if not code:
                    continue
                wins = _nonnegative_int(standing.get("win"))
                losses = _nonnegative_int(standing.get("loss"))
                if wins is None or losses is None:
                    continue
                record = f"{wins}-{losses}"
                # Two conflicting rows for one school must not be arbitrarily resolved.
                if code in found:
                    if found[code] is not None and found[code]["overall"] != record:
                        found[code] = None
                else:
                    found[code] = {
                        "overall": record, "conference": None, "season": year,
                        "scope": "Sportradar season standings", "source": "Sportradar",
                        "source_url": DOCUMENTATION,
                    }
    return {code: row for code, row in found.items() if row is not None}


def fetch_verified(year, environ=None, get=request_json):
    env = os.environ if environ is None else environ
    key = env.get("SPORTRADAR_API_KEY", "").strip()
    season_id = env.get("SPORTRADAR_BASEBALL_SEASON_ID", "").strip()
    configured_year = env.get("SPORTRADAR_BASEBALL_SEASON_YEAR", "").strip()
    if not key or not season_id or configured_year != str(year):
        return {}
    access = (env.get("SPORTRADAR_ACCESS_LEVEL") or "trial").strip()
    info = get(provider_url(access, season_id, "info"), key)
    if not season_is_ncaabaseball(info, season_id, year):
        raise ValueError("Sportradar season is not a verified NCAA baseball season for the requested year")
    records = get(provider_url(access, season_id, "standings"), key)
    return parse_standings(records, year)
