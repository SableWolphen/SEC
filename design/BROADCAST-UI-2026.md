# Saturdays Down South — Broadcast UI system (2026)

## Intent
Bring the entire football, basketball, baseball, league, news, team, trophy and settings experience into one **premium navy / gold sports-broadcast identity**. Keep the current Saturday game-day brand, account continuity, game data, achievements and league rules. This is a visual and usability refactor, not a sports-data rewrite.

## Foundation

| Token | Value | Purpose |
|---|---|---|
| `--sds-navy` | `#0b1726` | Deep backdrops |
| `--sds-panel` | `#112538` | Content surfaces |
| `--sds-panel-raised` | `#192e43` | Interactive panels |
| `--sds-stroke` | `#354e64` | Card boundaries |
| `--sds-gold` | `#f0c775` | Brand accent / selection / trophies |
| `--sds-gold-light` | `#ffe3a4` | Primary highlight |
| `--sds-success` | `#8ed0ae` | Verified correct pick or final winner |
| `--sds-error` | `#f6a0a1` | Missed pick, errors |
| `--sds-radius` | `15px` | Ordinary cards |
| `--sds-radius-lg` | `21px` | Hero cards |

## Universal patterns

1. **Page masthead:** Compact eyebrow (section context), navy/gold title banner, short explanation. The Trophy Room retains its own purpose-built museum header.
2. **Navigation:** Five stable mobile destinations — Home, Picks, League, Trophies, More — with active gold emphasis. News, Teams and Settings remain accessible through Home and More. Desktop nav presents the same flow.
3. **Cards:** One stroke/radius/shadow family, responsive sizes, readable 11–14px detail text. No neon-lime components from the old look.
4. **Sports:** Shared interactions and components for football, basketball and baseball. Preserve sport-specific iconography and record/timing information.
5. **Picks:** Gold means **selected**, mint means **verified correct**, pink means **missed/incorrect**; do not recolor scores or fake live status.
6. **Leagues:** Sticky concise tabs (Standings / Chat / Brags / More), gold active tab, matching forms and standings. Never change a league's per-sport scoring.
7. **News:** Source links and timestamps remain visible. Favorite-team news stays prominent on Home and in News.
8. **Teams:** Account favorite keeps its elevated border state; all 16 SEC schools remain reachable.
9. **Trophies:** Navy museum and gold details coexist with existing WebGL rendering/fallback, archival championship years, locked states and rivalry selectors.
10. **Settings:** Consistent fields/buttons, keyboard focus and profile controls; no invented privacy/account-deletion status.

## Responsive contract

- **1280px+:** desktop nav, football picks with side summary, multi-column grids and stadium Home.
- **790px and below:** accessible five-item bottom nav, one-column pick layout, conservative spacing and safe-area padding.
- **540px and below:** compact page headers and shorter cards; no clipped inputs or horizontally spilling controls.
- **320px minimum:** test every app screen for horizontal overflow and clipped bottom navigation.
- **Reduced motion:** disable decorative movement while preserving all interactions.
- **Data refresh:** CSS never manipulates DOM or player state; the existing stable Home refresh behavior remains authoritative.

## Implementation ownership

- `sec-design-system.css`: central design tokens, global components and screen-specific polish, imported **last** from `index.html`.
- `index.html`, `multi-sport.css`, `sec-final-cards.css`, `trophy-case.js`: convert old literal neon-brand green to matching gold to avoid isolated mismatched accent colors.
- `icon.svg`, `manifest.webmanifest`: consistent navy-gold installed-app identity.
- `sw.js`: new style and bumped cache version for installed PWAs.
- `scripts/smoke-design-system.cjs`: guard brand, coverage, cache and consistency.
- `scripts/browser-audit.cjs`: real-browser computed-style checks across every screen and viewport.

## Data safety

Never change Supabase tables, RLS, auth, season years, scored results, pick locks, score providers, league membership, news aggregation or user preferences just for a design release. The native Android/iOS app shells still need separately signed builds to update store installations.
