# Saturdays Down South — SEC Pick’em

An **unofficial fan-made SEC football pick’em website** in [SableWolphen/SEC](https://github.com/SableWolphen/SEC).

**Website:** https://sablewolphen.github.io/SEC/ (publishes automatically from `main` after GitHub Pages is configured to deploy from the root branch).

## Game features

- Mobile-first and desktop-friendly dark interface; works in a browser on Android, iOS or desktop.
- All 16 SEC teams; **120 regular-season games across 13 weeks**, including nonconference opponents.
- One point per correct predicted winner, choose each game independently, and lock picks at kickoff.
- TBD kickoff times lock provisionally at 10 AM Central on the game date, until official kickoff information is entered.
- Friends can compete in online private leagues using email sign-in and a shareable invitation URL **after the backend is configured**.
- All authenticated online picks are stored on the server; row-level security protects user data and deadlines; weekly and season standings are centrally calculated.
- The existing device-only preview remains usable while online configuration is absent.
- No gambling, payments or betting.

## Deployment status / activation

The GitHub Pages site and the online multiplayer service are **two different components**.

The **website files are committed**. GitHub Pages must be enabled once under repository Settings; after that, GitHub's native branch publishing updates the site on each push. The online multiplayer code and SQL have also been committed, but **the shared database is not connected by default**. Do not mistake the local-preview leaderboard for a synchronized live league.

### Finish multiplayer setup (site owner, one-time)

1. Create a **new dedicated Supabase project for SEC Pick’em**. Do not reuse the PlushList or Baby PupFit project.
2. In the new project's **SQL Editor**, run the complete [supabase/setup.sql](supabase/setup.sql). It creates `sec_*` tables, seed games, access policies, server-validated pick deadlines, and league/standing functions.
3. In **Project Settings → API Keys**, get its **publishable key**, and in the project settings copy its Project URL (the `https://...supabase.co` address).
4. Edit [config.js](config.js) on `main` with the Project URL and **publishable key only**. **Never paste a service role/secret key, database password or admin key into GitHub, the browser, or client JS**. The publishable key is intentionally public.
5. In **Supabase Authentication → URL Configuration**, set Site URL to `https://sablewolphen.github.io/SEC/` and include `https://sablewolphen.github.io/SEC/**` in Redirect URLs. Enable Email auth and test delivery of the email sign-in links. Email sending on default Supabase SMTP may be rate-limited; connect an SMTP provider for a larger audience.
6. In GitHub repository **Settings → Pages → Build and deployment**, choose **Deploy from a branch**. Set **Branch: `main`** and **Folder: `/(root)`**, then Save. GitHub Pages republishes automatically after pushes to `main` without a custom deploy workflow.
7. Visit https://sablewolphen.github.io/SEC/#league, sign in and create a league. Copy your league invite link. Open it in another browser signed into a different email account to test the shared standings.

The setup SQL grants only the necessary public API permissions and applies **row-level security**. Members can access leagues they belong to, save only their own picks, and cannot edit past-kickoff picks. Results can only be updated by the trusted database administrator, not players.

### Updating results and kickoff times

Only verified games should be marked final. From the dedicated Supabase project's SQL Editor:

```sql
-- Example only; verify official final score first.
-- update public.sec_games set winner = 'ALA'
-- where id = '2026-6-UGA-ALA';

-- Update a formerly TBD game's kickoff to its announced instant:
-- update public.sec_games set kickoff_at='2026-11-28T15:30:00-05:00',
--   provisional=false where id='2026-13-SC-CLEM';
```

Make sure the published kickoff and timezone are right. Server-side deadlines are based on the `sec_games.kickoff_at` value, so do not rely on the browser's clock. Week 1–5 games are historically locked; dates and future kickoffs need ongoing official verification.

Games after the regular season (conference championship, bowls, playoff games) are **not yet listed**; add them as confirmed to the schedule in both `index.html` and `sec_games`.

### Troubleshooting

- **Site says owner setup required:** `config.js` still has blank values, or the Supabase browser client did not load.
- **Sign-in link goes somewhere else:** update the project's Auth Site URL and Redirect allowlist.
- **Data API permission error:** run `supabase/setup.sql` in the correct dedicated project and confirm the public schema is exposed in Data API settings.
- **Picks refused:** kickoff has passed according to the database or the user isn't authenticated. Confirm the latest official game time.
- **Scores show zero:** results have not yet been recorded by the administrator.
- **Pages missing/404:** GitHub Pages is not yet enabled. Open repository **Settings → Pages**, select **Deploy from a branch → `main` → `/(root)`**, and Save. The old Actions-based deployment failed because it was not authorized to create a Pages site; it was removed to stop repeated failure notifications.

## License and affiliation

Fan-made project. Not affiliated with, endorsed by, or sponsored by the Southeastern Conference, its universities, or the similarly named sports publication *Saturday Down South*. Original stylized team initials are used instead of official logos.
