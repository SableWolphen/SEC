# Saturdays Down South — SEC Pick’em

An **unofficial fan-made SEC football, basketball and baseball pick’em website** in [SableWolphen/SEC](https://github.com/SableWolphen/SEC).

**Website:** https://sablewolphen.github.io/SEC/ (GitHub Pages publishes from `main` branch root).

## SEC News — live TL;DR headlines

News has its **own separate 🏈 Football / ⚾ Baseball / 🏀 Basketball filter**. Selecting a sport keeps you on the News page and displays only articles tagged for that sport; school, Breaking, and text-search filters work within it. News opens to the sport last viewed in Picks (or current season by default). Unlike the Picks selector, this news-only switcher never changes the active pick slate. The feed updater collects verified dated news from official [NCAA FBS](https://www.ncaa.com/news/football/fbs/rss.xml), [NCAA DI baseball](https://www.ncaa.com/news/baseball/d1/rss.xml), [NCAA DI men's basketball](https://www.ncaa.com/news/basketball-men/d1/rss.xml), and ESPN sport news APIs. Up to 50 verified stories per sport are retained; if a sport has no recent SEC articles, it displays a clear empty state instead of showing football stories under another sport or inventing articles.


Open **News** in the desktop or six-item mobile navigation (or go directly to [the SEC News tab](https://sablewolphen.github.io/SEC/#news)). It displays real, dated Southeastern Conference football, baseball and men's basketball articles from NCAA and ESPN sport feeds, filtered for the 16 current SEC schools.

- **TL;DR:** short, plainly marked excerpts from each story's own published description, **not** invented AI summaries or independently verified reporting. If no source description is available, the app says so rather than inventing one.
- Tap anywhere on a news card or **Read full story ↗** to open the original publisher's linked webpage in a new browser tab. Cards show publication age, source, and relevant SEC schools.
- Search by headline or player, filter by each SEC school, or choose **Breaking**. The breaking label is conservative: the original story must be under six hours old and its headline must contain a time-sensitive development word (such as *suspended*, *transfer* or *hires*). It isn't an independent verification of an event.
- **Automatic updates:** [`.github/workflows/refresh-news.yml`](.github/workflows/refresh-news.yml) runs around **once per hour** via GitHub Actions, filters/deduplicates stories, and commits [`news.json`](news.json) for GitHub Pages. Scheduled jobs can be delayed, and this isn't second-by-second breaking coverage or background push. Opening the tab requests the newest published file; while the News tab is open, it rechecks every five minutes.
- **Fail safely:** no made-up headlines, invented dates, unverified website redirects, or stories outside the past nine days. If both news sources are unavailable, recent cached stories may be displayed with a clear warning. Existing pick'em scoring automation is unchanged. No API tokens or account connections are needed.
- **Testing:** `python3 -m unittest discover -s tests -p test_news.py -v` validates source parsing, recency and link safety, and `node scripts/smoke-news.cjs` checks the mobile navigation, breaking-badge freshness, TL;DR rendering and direct source links.

## One account across all three sports

Football, basketball and baseball all use the **same Supabase Auth session**. Returning players sign in only once; switching sports does not create a separate user. The sport-specific page waits for the saved session to restore before deciding the player is signed out, automatically refreshes when login changes, and shows the current signed-in email. Sports keep separate league standings and picks, but those leagues belong to the same account. Creating/joining another sport's league is **not** creating another account.

## Persistent sport icons and automatic season landing

The site opens directly to the **most recently started season**, without a mandatory choose-sport homepage: **football in August–October, men's basketball in November–January, and baseball in February–July**. The compact 🏈 Football / ⚾ Baseball / 🏀 Basketball switcher appears directly **below the headline and description on the football, baseball, and basketball Picks screens only**. It does not appear in League, News, Teams, Trophy Case, or Settings. You can jump between pick slates in one tap, while each sport keeps its own picks and leagues. The Picks item in desktop/mobile navigation returns to the sport you were viewing. The original football deep link stays `#picks`; basketball and baseball use `#basketball` and `#baseball`. Old `#sports` links redirect to the current season. Loading the root route starts at the latest season regardless of the sport visited in the previous browser session.

Schedules for basketball and baseball rely on verified imported games. If no officially confirmed game date/time is available, the app shows a schedule-pending message instead of creating fake fixtures or accepting invalid picks.

## Teams: Favorite School HQ — all three sports

Open **SEC Teams** and star one of the 16 SEC schools. The top of the page becomes your school's compact **Team HQ**, showing **🏈 Football, 🏀 Men's Basketball and ⚾ Baseball** side by side (stacked on phones). Each sport card displays the verified **overall W–L record**, season label, and SEC/conference W–L where ESPN publishes that split. Every school's listing also has three tiny sport-record badges for quick comparisons. Records belong to the school, not separate player accounts.

The source-linked snapshots are collected by `scripts/update_team_records.py` from ESPN's public NCAA team records, then published in `team-records.json`. `.github/workflows/update-team-records.yml` checks for updates **four times daily**. The **Update records** button reloads the latest published snapshot; it does not bypass the scheduled updater. The record display shows **—** for unsupported, unavailable, stale-season or pre-season results: no fabricated W–L, projected standings, or silently mixed seasons. Historical ESPN Core API data may be **regular-season only** (excluding postseason) and is labeled as such. If sources fail, the same-season verified snapshot is retained. Favorite selection uses the site's existing storage and does not change picks, accounts or league membership.

## Game features

- Mobile-first and desktop-friendly dark interface; works in a browser on Android, iOS or desktop.
- New **SEC News** tab: current college football headlines, quick summaries, per-school filters and publisher links.
- All 16 SEC teams; **120 regular-season games across 13 weeks**, including nonconference opponents.
- Four independently scored league modes: **Straight Picks** (1 point per winner), **Confidence** (unique 1–N point weights each week), **Against the Spread** (published ESPN lines, half-point push), and **Head-to-Head** (weekly paired opponents with W/L/T records). All picks lock at kickoff.
- TBD kickoff times lock provisionally at 10 AM Central on the game date, until official kickoff information is entered.
- Private leagues, in-app account registration and login, invitation links, separate league-specific picks, member management and centrally calculated standings. Verify that public email confirmation/delivery works before inviting a large group.
- All authenticated online picks are stored on the server; row-level security protects user data and deadlines; weekly and season standings are centrally calculated.
- The device-only pick preview remains available without signing in. Once the online service is configured, signed-in picks sync across devices.
- No gambling, wagers, prizes or betting. Spread mode is a points-only sports-prediction game.

## Matchup insights and what they mean

Each game card now includes season win-loss records, Top-25 ranking when available, and a clearly labeled forecast. A published ESPN game projection is used when ESPN supplies one. Otherwise, a simple record-based estimate uses the two teams' win percentage plus a small home-field adjustment; **it is not a validated forecasting model** and is never presented as an ESPN projection or betting line.

Data is sourced from ESPN's public college football game feed. `scripts/update_stats.py` refreshes `stats.json`; `.github/workflows/update-stats.yml` automatically runs three times per day and supports manual runs. The script refuses to overwrite the feed when the upstream source cannot be matched reliably. Unavailable data is labeled unavailable, not fabricated. Only publicly available team records, rankings and predictions are used.

**Online league database is provisioned and connected.** Its dedicated Supabase project ID is `vzjrlvkwuswkryxxrvtp` (separate from PlushList and Baby PupFit). Players have successfully created a real league; full third-party public email-delivery configuration remains an owner task.

## Titled Rivalry Trophy Case (school by school)

The Trophy Case shows **35 named rivalry games and trophy contests** grouped into **16 inline SEC school accordions**. Every school shows three trophy-art previews directly in its row; Alabama’s full trophy shelf opens by default. Select a different school to expand its complete set of rotating 3D or emblem trophy cards directly underneath the school heading, without changing pages. Tap again to collapse it. Only one shelf is expanded at a time. The full named rivalry browse view remains available. It includes the **Beer Barrel**, **Battle for Highway 82**, **Iron Bowl**, **Golden Egg**, **Victory Bell**, **Bedlam**, **Border War** and more. Generic labels such as "Alabama–Florida Rivalry" are still hidden. Tennessee–Vanderbilt has been restored under the descriptive title **Battle for the Volunteer State**, and Florida–Tennessee under the established **Third Saturday in September** nickname.

**Non-destructive change:** the complete 73-pair rivalry registry remains available in `rivalry-catalog.js` and the existing Supabase `sec_rivalry_definitions` and `sec_trophy_history` tables. Thirty-eight generic pairings are hidden from the Trophy Case, **not deleted** from account history or the database. Permanent trophy IDs and league picks are untouched. The original `tennessee-vanderbilt.glb` is now visible again under the Volunteer State name; **all 15 original 3D trophy files remain available**. Newly titled Florida–Tennessee currently uses an emblem rather than a new 3D model.

The displayed collections contain **19 SEC vs SEC, 15 nonconference, and 1 historic named rivalry**. Every named game remains visible during off-seasons. The school-first view, My Trophies, History, Rivalry Week, search, and cross-school rivalry sharing still operate on the named selection.

**Nickname accuracy:** The University of Tennessee described the 2022 Vanderbilt matchup as a “Battle for Volunteer State Supremacy” ([official athletics preview](https://utsports.com/news/2022/11/23/football-fb-preview-10-vols-cap-regular-season-in-nashville-in-battle-for-volunteer-state-supremacy)). The displayed **Battle for the Volunteer State** is a descriptive/fan-style collectible title, **not** an official physical rivalry trophy. Florida–Tennessee’s **Third Saturday in September** is a historically used game nickname, but today’s schedule may use different dates ([rivalry history](https://en.wikipedia.org/wiki/Florida%E2%80%93Tennessee_football_rivalry)). Both reuse their established rivalry IDs so past results and awards still match. No additional database migration is necessary.

## Full SEC Rivalry Archive (underlying reference registry)

The named Trophy Case is organized as **16 alphabetical SEC dropdown sections**. Each school shows trophy previews and its earned count; expand it to see the whole trophy shelf inline without navigating away. The first shelf is open on initial load. Games between two SEC schools appear in both teams' views but still count as one unique trophy/achievement. Each school includes distinctly titled SEC, nonconference and historic rivalries—even when games aren't on this season's schedule. The full 35-trophy view remains available via **Browse all 35 named rivalry trophies →**, and category filters, search, My Trophies, History and Rivalry Week still work within each school. All changes are client-side and leave league picks and permanent trophy IDs intact.

The **underlying rivalry database catalogs 73 distinct football pairings** drawn from the historic and current SEC rivalry lists: **37 games involving two current SEC schools, 33 nonconference matchups and 3 historic series**. It covers **all 16 current SEC football programs** and includes named trophies, traditional rivalries and historic nonconference opponents—even when a game is absent from the 2026 schedule.

Examples: **Battle for Highway 82** (Alabama–Mississippi State, also known as the 90 Mile Drive; **not Highway 85**), Kentucky–Tennessee's historical Beer Barrel, Auburn–LSU's Tiger Bowl, Missouri–Oklahoma's Tiger–Sooner Peace Pipe, Missouri–Kansas Border War, Florida–Florida State Sunshine Showdown, Georgia–Georgia Tech Clean, Old-Fashioned Hate, Texas–Texas Tech Chancellor's Spurs, Texas A&M–Baylor Battle of the Brazos, Oklahoma–Oklahoma State Bedlam, and all 15 original headline rivalries (Tennessee–Vanderbilt is now displayed using its Volunteer State descriptive nickname). The term "rivalry" does not necessarily mean there is an official physical trophy.

- The **original 15 rotating 3D GLB collectibles remain** in [`trophies/`](trophies/) with their original achievement IDs unchanged. New archival matchups display individual named rivalry emblems for now; do not represent these as new 3D trophy models.
- Filter the **35 named trophy cards** by **SEC vs SEC, Nonconference, Historic**, or search by name (e.g. Highway 82). All named titles remain visible year-round; generic untitled pairings remain preserved in the underlying registry.
- The Rivalry Week view likewise lists every documented matchup and lets players jump to games actually on the current pick schedule. A missing game is labelled *Not scheduled this season*, and **no date, score, prediction or trophy is invented**.
- **Permanent awards:** The `sec_sync_trophy_history` RPC matches an authenticated league pick to a confirmed final score using the database's read-only `sec_rivalry_definitions` catalog, saving the result in `sec_trophy_history` across leagues and seasons. The existing 15 earned IDs remain valid. Only authenticated members can sync their own picks, and anonymous users cannot insert awards or change the catalog.
- **Database setup:** The initial trophy migration [`20261009_trophies_chat_champions.sql`](supabase/migrations/20261009_trophies_chat_champions.sql) is followed by [`20261009_73_rivalry_catalog.sql`](supabase/migrations/20261009_73_rivalry_catalog.sql), which adds the 73 public definitions and expands award processing. Current production already has both. Automatic score scheduling is unchanged.
- **Reproducibility and testing:** [`rivalry-catalog.js`](rivalry-catalog.js) retains all 73 source entries and explicitly identifies the 35 displayed titled or descriptive rivalries. `node scripts/smoke-trophies.cjs` validates those 35 pairs, full registry retention, 16 school rooms, no phantom awards, user isolation and 3D assets.

The curated archive is broad but is **not a claim that every college football rivalry ever played is documented**. It follows published SEC intra- and interconference series lists, with historic games categorized separately. References: [SEC conference rivalries](https://en.wikipedia.org/wiki/Southeastern_Conference#Intra-conference_football_rivalries), [interconference rivalries](https://en.wikipedia.org/wiki/Southeastern_Conference#Interconference_football_rivalries), [Battle for Highway 82](https://en.wikipedia.org/wiki/Alabama%E2%80%93Mississippi_State_football_rivalry).

## League chat and season championships

- Every signed-in private league has its own **Locker Room** chat embedded directly **inside that league’s scoreboard**, alongside standings. A league selector appears in the scoreboard when a member belongs to multiple leagues; switching loads only the newly selected league’s messages. There are 4 emoji reactions and a commissioner moderation option. Only members can read/send/react in that league; users cannot impersonate another author. Content is escaped before rendering; messages are capped at 500 characters and rate-limited to 3 seconds apart.
- Messages refresh while the League or Trophy Case view is open, at most every 15 seconds, using the connected Supabase database. Notifications while the app is closed require additional push integration and are **not** included in this version.
- **Trophy Case → League Honors:** League Championship and League Achievements are together in a compact section **above the school trophy dropdowns**. The Championship card displays confirmed season awards, a provisional leader, and the commissioner's finalization control. The Achievements card shows earned weekly player badges based on verified results or an empty state until results exist. A quick link on the League page opens the Trophy Case, avoiding duplicate panels.
- The league commissioner alone can finalize a championship, and the database refuses to crown a champion until all season games are final or canceled. Stored awards include season, champion, league mode, points and date. The League tab keeps the scoreboard and its embedded chat, standings, reminders and member management; no schema, league pick or score scheduler changes were made.
- Championships and chats do not change existing pickem modes or points and do not require automatic score jobs. However, they depend on **confirmed official finals** to complete championship awards.
- Production SQL for these features was applied without altering existing league memberships or picks. Reproducible source is in [`supabase/migrations/20261009_trophies_chat_champions.sql`](supabase/migrations/20261009_trophies_chat_champions.sql). Apply **after** the original setup and four-mode migration when provisioning a new project.
- Test with `node scripts/smoke-trophies.cjs` and `node scripts/smoke-social.cjs`. GitHub CI validates the headers and JSON chunks of all 15 `.glb` models.

**Scheduler boundary:** no change was made to the optional automatic ESPN score Cron setup. It remains unactivated until the project owner chooses to enable it. The app will not claim a result is final until the database records it.

## New competition features

- **Weekly tiebreakers live on the Picks page**, directly above the weekly game slate—not in League settings. Each selected week has its own saved predicted total in the existing `sec_week_tiebreakers` table. The card chooses the last-kickoff game in that week, shows saved/unsaved status, and prevents saving after that game's kickoff. A signed-out player can navigate to League to sign in. No database migration required. Test with `node scripts/smoke-tiebreakers.cjs`.
- **Four game modes:** choose the scoring format while creating a league. Existing leagues stay Straight Picks. Confidence ranks are unique within a week; pick a rank and tap the team to save. Spread games cannot be picked without a sourced pregame line. Head-to-Head opponents rotate each week.
- **Live scoreboard pipeline:** a private Supabase Edge Function `sec-scores` fetches ESPN's verified statuses/scores and pregame spreads, then updates SEC tables (not client-accessible writes). The Edge Function is **deployed**, but its recurring scheduler is **not activated yet**. See [One-time score automation setup](supabase/enable-score-automation.sql). Until activation, scores/standings don't update automatically.
- **Friends' picks:** secret before kickoff, viewable only by fellow league members after the game starts, including team-by-team pick percentages and names.
- **League standings:** weekly and season points, automatic Head-to-Head W/L/T once all games in the week are complete, optional total-points tiebreaker for tied weekly scores, and member avatars/league-owner controls.
- **Achievements:** 5 Correct Club, a genuine five-game pick streak, Perfect Week and an Upset King earned from verified final results and sourced spreads.
- **Reminders:** opt-in pick-deadline, final-score and ranking alerts **only while the app is open**. This is NOT OS-level background web push. Do not rely on it for guaranteed off-app notifications.
- **Game insight cards:** ESPN projections if published, otherwise a visibly labeled, unvalidated record-based estimate. Forecasts are not betting odds or guaranteed results.

### Enable unattended score refresh (one-time)

The secure score-fetching Edge Function and a private database token already exist in the dedicated SEC Supabase project. The connector could not activate the recurring Supabase Cron jobs, so **the site owner must do this once**:

1. Open the [SEC Supabase SQL Editor](https://supabase.com/dashboard/project/vzjrlvkwuswkryxxrvtp/sql/new).
2. Copy and run [`supabase/enable-score-automation.sql`](supabase/enable-score-automation.sql). It enables `pg_cron` / `pg_net`, schedules private jobs for game weekends and weekdays, and triggers an initial refresh. The token is fetched securely from Vault; do not copy private credentials to a public file.
3. Inspect [Supabase Cron](https://supabase.com/dashboard/project/vzjrlvkwuswkryxxrvtp/integrations/cron) and the edge function logs. A complete game should move to `game_status='final'` with verified scores and a winner. Games without ESPN data are not invented. Standings then calculate from the verified stored results automatically.

If the scheduled function cannot be enabled under your Supabase plan, the manual database administration fallback remains available. Keep authentication and SQL permissions restricted to project admins.

### Database migration/source

For a new standalone project, first run [`supabase/setup.sql`](supabase/setup.sql), then [`supabase/migrations/20261009_four_modes.sql`](supabase/migrations/20261009_four_modes.sql). The currently connected production SEC database already has the four-mode schema and 14 historical picks were copied into the existing straight-pick league without deleting the originals. Re-running the initial seed should never overwrite verified final scores.

## Deployment and online activation

The GitHub Pages site is published, and the SEC-specific database has been created and populated with all 120 games. The tables are protected by row-level security, and the **public publishable** key is configured in `config.js`. The other Supabase projects were left untouched.

### Account registration and league creation

Players can open **My league** directly in the app, select **Create account**, enter a display name, email, and password, and then **Create league** or **Join league**. Existing players choose **Log in**. The Picks screen also has a direct account shortcut. A logged-in player can create multiple private leagues and invite friends with a shared URL or invite code.

#### Required project-level email confirmation setting

In the dedicated [SEC Supabase Email provider settings](https://supabase.com/dashboard/project/vzjrlvkwuswkryxxrvtp/auth/providers), choose one approach:

- **Recommended for a public launch:** keep **Confirm email** enabled, set up a real SMTP provider in [Supabase Authentication SMTP](https://supabase.com/dashboard/project/vzjrlvkwuswkryxxrvtp/auth/smtp), and set **Site URL** to `https://sablewolphen.github.io/SEC/` plus **Redirect URLs** `https://sablewolphen.github.io/SEC/**` in [URL Configuration](https://supabase.com/dashboard/project/vzjrlvkwuswkryxxrvtp/auth/url-configuration). This verifies players' email ownership and supports password reset, but needs working outbound email.
- **For a quick private test only:** disable **Confirm email** in the Email provider settings. Supabase then returns an authenticated session immediately when players register with a password, without sending confirmation mail. The trade-off is that email addresses are unverified; users may impersonate another address and password recovery still needs outbound email. Restore email confirmations with proper SMTP before inviting the public.

Those are Auth service settings; **they cannot be configured using SQL or the connected Supabase project tools**. They must be changed by the project owner. The site does not store passwords itself; Supabase Auth handles registration, session management, and password verification.

The database and browser code are connected, but **successful registration by two real people has not been verified** until this setting and an end-to-end invitation test are complete. After changing the setting:

1. Open [Saturdays Down South — My league](https://sablewolphen.github.io/SEC/#league).
2. Select **Create account**, enter a display name, email and password, and register. Log in if asked to confirm your email first.
3. Select **Create league**, give it a name, and use **Share invite link**.
4. Have a friend visit that link, register under their own email, and verify they appear in the same weekly and season standings.

The setup SQL grants only the necessary public API permissions and applies **row-level security**. Members can access leagues they belong to, save only their own picks, and cannot edit past-kickoff picks. Results can only be updated by the trusted database administrator, not players.

### Updating verified results and kickoff times

The trusted `sec-scores` updater is the intended source once Cron has been activated. For manual emergency corrections by the project administrator only, set **both** final team scores and `game_status='final'`, plus the correct winning team. Setting `winner` alone does not award points in the new scoring system.

Always confirm official times and results before corrections. Provisional game kickoff times may need updates from official schedules. Championship, bowls and playoff games are not yet in the 120-game regular-season slate.

### Troubleshooting

- **Site says owner setup required:** check that `config.js` has the dedicated public Supabase project values and the browser Supabase client loads.
- **Email confirmation link goes somewhere else:** update the project's Auth Site URL and Redirect allowlist.
- **Data API permission error:** run `supabase/setup.sql` in the correct dedicated project and confirm the public schema is exposed in Data API settings.
- **Picks refused:** kickoff has passed according to the database or the user isn't authenticated. Confirm the latest official game time.
- **Scores show zero:** check whether the official game is `final`, and whether the one-time private score scheduler has been activated.
- **Pages missing/404:** GitHub Pages is not yet enabled. Open repository **Settings → Pages**, select **Deploy from a branch → `main` → `/(root)`**, and Save. The old Actions-based deployment failed because it was not authorized to create a Pages site; it was removed to stop repeated failure notifications.

## License and affiliation

Fan-made project. Not affiliated with, endorsed by, or sponsored by the Southeastern Conference, its universities, or the similarly named sports publication *Saturday Down South*. Original stylized team initials are used instead of official logos.
