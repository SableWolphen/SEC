# Saturdays Down South — stadium-night ten-screen redesign

## Approved visual reference
The user-approved ten-phone showcase is the visual target. This rollout upgrades the **working GitHub Pages app**, preserving its existing Home, Teams, Picks, league, news, game center, trophies, settings, basketball, and baseball behaviors.

## Design system
- Deep midnight-blue surfaces (#071423), stadium-under-lights vector art, warm gold (#f1bf68) for active selections, ivory typography, authentic per-school accent colors, and compact mobile cards.
- Serif display headings reinforce the "Saturdays Down South" brand. Regular readable system fonts remain for scores, labels, forms and statistics.
- All 16 SEC universities have a source-mapped team identity. Editorial ESPN logo thumbnails are decorative only, with an original colored text crest fallback when assets fail or work offline. The unofficial/non-affiliated footer remains.
- The five existing bottom tabs (Home, Picks, League, Trophies, More) **do not move**. New premium screens stay one tap away without creating more permanent phone tabs.
- 320px minimum width, inset-aware fixed bottom navigation, reduced motion, no empty overlays or horizontal page overflow.

## Screen-by-screen implementation

| Mockup | Existing live route | Implementation |
|---|---|---|
| Home / Game Day HQ | `#home` | Favorite university badge, ranking/record when verified, conditional Make Picks/Live Game/Results CTA, actual next published kickoff, real scores and publisher news |
| Personalized Team Hub | `#team-hub` | Dynamic school banner, four functional Overview/Schedule/Roster/Stats tabs, actual dated polls, team schedule and verified records |
| Live Game Center | `#game-center` | Verified selected game scoreboard, original provider field-position data when fresh, working Game/Stats/Plays/Discussion tabs |
| Team News & Ranking Movers | `#team-news` | Verified publisher headlines, calculated AP movement and real opt-in in-app alert preferences |
| Football Picks | `#picks` | Real auto-saved picks, current week, verified locks and scores, accessible gold-selected team buttons |
| Pick'em Results | `#results` | Existing authenticated pick grading, actual league position, historic week selector and final-game results |
| League Standings & Social | `#league` | Existing league chooser, standings, chat and bragging rights restyled in a consistent navy/gold system |
| Trophies / SEC Legacy | `#trophies` | Keep existing 3D championships, engraved years, rivalry shelves, collection and Hall-of-Fame/legacy features |
| University Directory | `#teams` | All 16 current SEC schools; responsive badges, source-verified rank/records, favorite state, Team Hub links |
| Settings & Notifications | `#settings` | Existing account/profile/privacy settings plus functional account-scoped in-app kickoff, final, upset and rivalry alert options |

The basketball and baseball pick screens, news feed, all-sports hub and More page also inherit the new compact stadium design system. No saved picks, score provider, league mode, 3D trophy history, login, or database schema were changed.

## Source and functionality limitations
- The referenced mockups contain *illustrative* live stats, player cards, scores, dates, and odds. Only real official-source, verified feed data appears in this build. Missing box scores, roster photography or player names display honest availability messaging/source links.
- University marks load as decorative public remote thumbnails when possible. The first-party fallback is always available, including offline.
- App alerts operate **while the app is open**, and require opting in. They are **not** silent background mobile push notifications. No alert settings are shared between signed-in accounts on the same device.
- The website/PWA deploys through GitHub Pages. Publishing native Android/iOS binaries requires separate signed builds and developer accounts.

## Verification
`scripts/smoke-showcase.cjs` validates all ten screen routes, official team-ID display map and fallbacks, CSS/PWA asset delivery, source-bound controls, and user-scoped alerts. Full legacy smoke tests and `scripts/browser-audit.cjs` validate the complete app across five responsive sizes, including Team Hub tabs and all 16 logos.

An editable Figma source file is not required to apply the already approved visual reference; working GitHub screens are the release source of truth.
