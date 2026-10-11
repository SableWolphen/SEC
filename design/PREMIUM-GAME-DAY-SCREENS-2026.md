# Saturdays Down South — 2026 Premium Game Day Screens

## Approved reference screens

This release implements four illustrated mobile concepts in the existing
Saturdays Down South navy + brushed-gold system:

1. **Favorite University Team Hub** (`#team-hub`): personalized university
   hero/mascot, AP / basketball / baseball national ranking cards with dated
   polls, source-confirmed records, 2026 football schedule/results, future
   matchup card, publisher-linked team news, and an honest roster/photos
   unavailable state with an external official coverage link.
2. **Live Game Center** (`#game-center`): selected college football matchup,
   live/final/upcoming verified scoreboard, status clock, source freshness,
   previously implemented provider-confirmed field-position visualization,
   Game / Stats / Plays / Discussion tabs and direct ESPN game/box-score
   links. Player yards, scoring plays and roster photography are **not
   fabricated** when the existing feed lacks those details.
3. **Team News** (`#team-news`): favorite-university hero, grounded links to
   existing in-app alert settings (not fake push-permission toggles), AP ranking
   movers calculated from actual `previous` and `rank` fields, and
   source-linked published headlines.
4. **Pick'em Results** (`#results`): real weekly selected picks, verified
   final games, grading by the selected league's scoring mode (including
   spread pushes), earned points, actual current league season standings,
   week picker and one-tap links back to leagues and Game Center.

### Navigation

The existing five fixed tabs remain **Home / Picks / League / Trophies / More**.
The redesigned experiences are accessible from the personalized homepage,
from Teams (including each of the 16 school cards), football Picks, SEC News
and More. Deep links to all four new routes work.

### Data preservation and trust

All views reuse `SEC_BRIDGE`, `SEC_PRIDE`, `SEC_TEAM_RECORDS`,
`SEC_RANKINGS`, `SEC_NEWS`, `SEC_FINAL_CARDS`,
`SEC_FEATURES.finalData`, `SEC_LIVE_DRIVE`, the
existing authenticated league ranking tools, and the existing
RLS-controlled football score updater. No server tables or scoring rules
are modified. The mockup's sample scores, player statistics, betting lines,
photographs, awards or push notification checkmarks are **not** used as data.
A source's absence produces a source-labeled empty state.

### Implementation and testing

- `sec-premium.js` and `sec-premium.css`: four mobile/desktop screens.
- `index.html`: routes, deep links, and entry points.
- `sec-home.js`: shortcuts to Team Hub, Game Center, Results and News.
- `sec-live-scores.js`: make the verified score updater work in Game Center.
- Source modules refresh the Team Hub and News only when data changes,
  preventing repeated DOM replacement while scrolling on a phone.
- `scripts/smoke-premium.cjs`: provider-grounded data, incorrect rank,
  cross-account isolation, safe headline links, page/action coverage.
- `scripts/browser-audit.cjs`: all 14 routes over 5 viewports, tab
  interaction, no overflow or clipped navigation.
- `sw.js`: update the PWA cache so installed phones receive the new version.

Native store submission, fully featured background push, verified roster
images, detailed team/player game box scores, betting odds and real-time
complete play-by-play require separately sourced feed and platform work.
