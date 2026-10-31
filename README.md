# Gamedays Down South — SEC Pick'em

An **unofficial, fan-made pick'em game** for SEC football, men's basketball and
baseball. Free to play, no gambling, no prizes.

**Live site:** https://sablewolphen.github.io/SEC/ (GitHub Pages, `main` branch root)
**Release history:** [CHANGELOG.md](CHANGELOG.md)

## What players can do

- **Pick winners** for every SEC game in all three sports with one account.
  Picks lock at kickoff/tipoff; unconfirmed start times are shown as *TBA* with a
  provisional pick lock, never as a made-up time.
- **Private leagues** with invite links. Each league chooses its own sports
  (1, 2 or all 3) and a scoring mode: Straight Picks, Confidence, Against the
  Spread (published lines, points only) or Head-to-Head.
- **Standings, weekly Power Rankings, tiebreakers and season championships**,
  all calculated on the server from verified final scores.
- **Live scores** during games, matchup insights, AP/D1Baseball poll ranks, team
  records, and source-linked SEC news.
- **League chat** (Locker Room), achievements, and a rivalry **Trophy Case**
  (35 named rivalries, 15 with 3D trophies).

Everything shown comes from a named source. Missing data is shown as missing —
the app never invents games, scores, rankings, headlines or awards.

## How it works

| Piece | Where |
| --- | --- |
| Web app (static HTML/CSS/JS, installable PWA) | repo root, `index.html` |
| Accounts, leagues, picks, scoring | Supabase project `vzjrlvkwuswkryxxrvtp`, protected by row-level security. `config.js` holds only the public *publishable* key. |
| Live scores | Supabase Edge Functions `sec-scores` / `sec-sport-sync`, run by `pg_cron` (football every 30 s near live games plus catch-up jobs; basketball/baseball every 2 min in season) |
| Published data files | Committed by GitHub Actions (below) |

### Scheduled GitHub Actions

| Workflow | Updates | Runs |
| --- | --- | --- |
| `update-sports.yml` | `sports-schedules.json` (basketball/baseball fixtures) + coverage audit issue | 4× daily |
| `update-stats.yml` | `stats.json` (football matchup insights) | 3× daily |
| `update-team-records.yml` | `team-records.json` | 4× daily |
| `update-rankings.yml` | `rankings.json` (national polls) | every 3 h |
| `refresh-news.yml` | `news.json` | hourly |
| `football-health.yml` | Opens/closes a GitHub issue if live football data goes stale | every 15 min Thu–Sun, every 3 h Mon–Wed |
| `validate.yml`, `browser-audit.yml` | Tests on every push | on push |

Scheduled jobs can run late; nothing here is second-by-second.

## Not done yet (owner tasks)

These can't be done from code; they need the project owner's accounts.

1. **Email delivery for sign-up and password reset.** In Supabase Auth, set up
   a real SMTP provider, keep *Confirm email* on, and set Site URL to
   `https://sablewolphen.github.io/SEC/` with redirect `https://sablewolphen.github.io/SEC/**`.
   ([SMTP](https://supabase.com/dashboard/project/vzjrlvkwuswkryxxrvtp/auth/smtp) ·
   [URLs](https://supabase.com/dashboard/project/vzjrlvkwuswkryxxrvtp/auth/url-configuration))
2. **Two-person end-to-end test:** register two real accounts, create a league,
   join by invite link, and confirm both appear in standings.
3. **Background push notifications.** The code exists
   (`supabase/functions/sec-push-dispatch`, `20261012_push_dispatch.sql`) but is
   intentionally not scheduled until VAPID keys are stored in Supabase Vault.
   Until then, reminders only work while the app is open.
4. **Postseason.** The football slate is the 120-game regular season; the SEC
   Championship, bowls and playoff are not included. Basketball/baseball
   brackets work once official fixtures are imported into `sec_bracket_games`.
5. **Baseball 2027** individual games appear once ESPN/SEC publish first-pitch
   times; until then only weekend series previews are shown.
6. **Before any public marketing or app-store release:** trademark clearance
   for the name, and the steps in [mobile/STORE-RELEASE-CHECKLIST.md](mobile/STORE-RELEASE-CHECKLIST.md).

Optional: licensed Sportradar baseball standings — add the
`SPORTRADAR_API_KEY` secret and `SPORTRADAR_BASEBALL_SEASON_ID` /
`SPORTRADAR_BASEBALL_SEASON_YEAR` variables in repository settings.

## Development

Run the same checks CI runs:

```sh
node scripts/run-smoke-matrix.cjs          # all browser-free smoke tests
python3 -m unittest discover -s tests      # data updater tests
```

**When you change a CSS or JS file**, bump its `?v=` in `index.html` **and** the
matching entry in the `CORE` list in `sw.js`, or phones keep the old copy.
`scripts/smoke-asset-cache.cjs` fails if the two drift apart.

Stylesheets load in a deliberate order (later files override earlier ones), so
add new styles to the file for that feature rather than reordering links.

Design notes live in [`design/`](design/); mobile (Capacitor) build steps are in
[`mobile/STORE-RELEASE-CHECKLIST.md`](mobile/STORE-RELEASE-CHECKLIST.md).

### Setting up a fresh database

Run `supabase/setup.sql`, then every file in `supabase/migrations/` in filename
order. Deploy the Edge Functions in `supabase/functions/` and store the
`sec_scores_job_token` secret in Vault first, because the migrations schedule
the score jobs that call them. (`supabase/enable-score-automation.sql` is an
older one-off script; the migrations schedule the same named jobs.) The
production project already has all of this.

## Troubleshooting

- **"Owner setup required":** `config.js` must point at the SEC Supabase project.
- **Email links go to the wrong place:** fix Auth Site URL / redirect list (above).
- **Pick refused:** the game has started per the database, or the player isn't signed in.
- **Scores not updating:** check Supabase → Integrations → Cron and the
  `sec-scores` function logs. Manual corrections must set both scores,
  `game_status='final'` and the winner.
- **Basketball/baseball games missing:** see the latest "SEC schedule
  completeness alert" issue and the `sec-schedule-coverage` workflow artifact.

## License, affiliation and branding

Fan-made project. Not affiliated with, endorsed by, or sponsored by the
Southeastern Conference, its universities, or the publication *Saturday Down
South*.

Do not embed, hotlink, download or imitate university logos, mascots, wordmarks
or conference branding without written permission. The app uses plain text
abbreviations (ALA, TENN, TEX…) and original numbered badges; that is not a
guarantee of trademark clearance. **Gamedays Down South** is a working name —
get a trademark review before marketing, monetizing or submitting to app stores.
Sportradar data, if enabled, must follow your subscription's terms.
