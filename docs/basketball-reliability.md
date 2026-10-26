# Basketball Pick'em reliability review — October 26, 2026

The basketball application lives in this SEC repository alongside football and
baseball. The six accessible GitHub repositories were checked for project
identity; SEC is the shared three-sport Pick'em application. Football's account
isolation tests and baseball's verified-fixture behavior provided comparison
context. Changes are in the basketball/baseball shared client and schedule
health reporting; football's competition code and database are unchanged.

## Fixed behavior

- **Remember the chosen week:** session storage was read before the `currentSeason`
  constant initialized. Its ReferenceError was silently caught, discarding the
  selection. A hoisted function now makes restoration work.
- **Keep league/week selections during slow requests:** switching leagues now
  invalidates the pending request and immediately clears previous league picks,
  tiebreakers, standings and pairings. Week changes invalidate old standings
  requests and queue a fresh load. Late errors are ignored as well as late data.
  Account changes also clear old notices.
- **Request the correct first standings week:** standings and H2H requests use
  newly fetched database fixtures rather than the previous game's cache. This
  matters when the public display feed is unavailable or empty.
- **Explain results accurately:** game cards and the weekly score strip share
  one outcome calculation. Against-the-spread cards grade the cover, show pushes
  as no points, and leave missing results pending instead of calling them losses.
  Straight picks without a confirmed winner also remain pending.
- **Report actual schedule coverage:** empty school responses previously counted
  as usable feeds, producing a misleading 16/16 label with zero usable feeds.
  The client and audit now count only SEC school responses containing games.
- **Refresh installed assets:** the page and service worker use the same new
  basketball client URL; the offline cache moves to v118. Existing cache-version
  smoke expectations are advanced accordingly.

## Validation

`node scripts/smoke-basketball-reliability.cjs` adds eight deterministic regression
scenarios, including delayed league/week responses, account changes, remembered
weeks, database-only schedules, spreads, pushes, pending results and empty feeds.
Seven of these eight fail against the original client; the existing account
response isolation case already passed. The new suite runs in CI.

- Smoke matrix: 53/53 scripts pass, including the eight new scenarios.
- Python: 52/52 tests pass, including a new school-coverage regression.
- JavaScript syntax and mobile asset preparation/checks pass.
- Real headless Chrome via Playwright: 70 route/viewport combinations at widths
  320, 360, 390, 768 and 1280 pass the repository browser audit without overflow
  or navigation clipping. This audit is anonymous; it does not prove real-account
  login, email delivery, or production pick writes.

## Remaining blockers

1. **Incomplete basketball fixtures:** the checked-in display feed contains 116
   games, 10–20 per school. Its latest snapshot reports unavailable ESPN data and
   zero usable school feeds. A fresh anonymous, read-only query against
   `sec_sport_games` confirmed 95 scheduled basketball games for season 2027,
   10–18 per school. The existing issue [#56](https://github.com/SableWolphen/SEC/issues/56)
   tracks this gap. The linked schedule workflow retained verified fixtures after
   upstream queries failed. Complete, source-verified fixture coverage and secure
   server import are still required. Display-only fixtures remain unpickable;
   no games, times, or results were fabricated or written to production.
2. **Authenticated end-to-end validation:** no real-account test credentials were
   supplied. Registration, confirmation email, two-person invitations and real
   pick saves remain unverified. Automated account/league checks use controlled
   mock responses; they cannot validate external email or production permissions.
3. **Release:** changes are prepared on a review branch. No merge, GitHub Pages
   deployment, database migration or Edge Function deployment was performed.

The database and server importer were inspected for context only. No Supabase
API contract, SQL permission, scoring RPC, saved pick or production account was
changed.
