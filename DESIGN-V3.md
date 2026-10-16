# Clean & Connected redesign

Implemented from the approved Figma V3 page 17:2 in [Gamedays Down South](https://www.figma.com/design/rwYLZ3ObbDJbypmz2bIPWU?node-id=18-2).

Reference frames: Home 18:2, Picks 18:74, League & Chat 18:143, Scores 18:215, News 18:274, Trophy Room 18:319, You & Find 18:379; desktop Home 19:2 and League 19:74.

## Behavior

- Navy panels, gold actions, responsive Home and League layouts, and persistent Home / Picks / League / Scores / You navigation.
- You opens the feature directory with account access, trophies, news, results, team hub and leagues. Find retains the complete searchable destination directory and user pins.
- Home reads actual pick completion, source-linked headlines and member-only league chat previews. Opening a conversation selects its league and opens Chat; switching leagues keeps Chat selected. Linked football conversations work for multi-sport clubs. Stale requests cannot navigate after an account change or override a newer request.
- Scores browses the existing three sport feeds with All / Live / Final filters. Football retains game details, stats and plays. Provisional kickoff times are labeled unavailable rather than published as confirmed times.
- Trophy filters expose championships, rivalry collections by school and badges. Championship archives, trophy assets and earned records remain in the existing services.
- Optional pick tools, league extras, news filters, recaps and player awards remain accessible through disclosures.

The implementation uses the existing plain JavaScript and CSS stack. No new runtime dependencies, database migrations or player-data writes were introduced. Design frames contain no external static image assets; existing dynamic team and trophy visuals remain in use. The final scoped stylesheet takes precedence over older ID-scoped skins.

## Validation — October 16, 2026

Passed:

- 50 rendered route/viewport combinations at 320, 390, 768, 1024 and 1280 pixels; no horizontal overflow or browser script errors.
- Browser interactions: five-tab navigation, You shortcuts, Find routing and dismissal, sport switching, score filters and football details, trophy filters, private chat switching, Home chat deep links, and linked multi-sport chat.
- 17 regression scripts: home, clean-navigation, access, chat-navigation, social, online, two-accounts, league-choice, league-tabs, multi-sport, news, trophies, trophy-legacy, championship-years, live-scores, football-scores and team-scores.
- JavaScript syntax checks, mobile bundle preparation/check, and git whitespace checks.

The full Python suite passed 49 of 51 tests. Two pre-existing failures are in unchanged sports-feed code/tests:

- `test_offline_reuses_only_verified_old_fixture`: old fixture omits `away_code`, causing a KeyError in coverage counting.
- `test_team_schedules_are_checked_even_when_scoreboard_succeeds`: expects 16 team requests, but the feed checks 32 across both sports.

Authenticated writes and account transitions were verified with the repository's mocked service tests; browser league scenarios use in-memory fixtures. No production accounts, picks, messages or championships were created during validation.

Run `npm run test:design` for focused regressions. Run `npm run audit:design` with Playwright available and a local server on port 8765. `SEC_BROWSER_URL` overrides that URL; `SEC_BROWSER_CHANNEL=msedge` uses installed Microsoft Edge. Screenshots are written to ignored `artifacts/clean-connected/`.
