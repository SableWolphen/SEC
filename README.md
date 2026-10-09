# Saturdays Down South — SEC Pick’em

An **unofficial fan-made SEC football pick’em website** in [SableWolphen/SEC](https://github.com/SableWolphen/SEC).

**Website:** https://sablewolphen.github.io/SEC/ (GitHub Pages publishes from `main` branch root).

## Game features

- Mobile-first and desktop-friendly dark interface; works in a browser on Android, iOS or desktop.
- All 16 SEC teams; **120 regular-season games across 13 weeks**, including nonconference opponents.
- One point per correct predicted winner, choose each game independently, and lock picks at kickoff.
- TBD kickoff times lock provisionally at 10 AM Central on the game date, until official kickoff information is entered.
- Private leagues, account registration, password login, invitation links, and synchronized scores. **Confirm-email settings still require the Supabase owner to finish activation for public registrations.**
- All authenticated online picks are stored on the server; row-level security protects user data and deadlines; weekly and season standings are centrally calculated.
- The device-only pick preview remains available without signing in. Once the online service is configured, signed-in picks sync across devices.
- No gambling, payments or betting.

## Matchup insights and what they mean

Each game card now includes season win-loss records, Top-25 ranking when available, and a clearly labeled forecast. A published ESPN game projection is used when ESPN supplies one. Otherwise, a simple record-based estimate uses the two teams' win percentage plus a small home-field adjustment; **it is not a validated forecasting model** and is never presented as an ESPN projection or betting line.

Data is sourced from ESPN's public college football game feed. `scripts/update_stats.py` refreshes `stats.json`; `.github/workflows/update-stats.yml` automatically runs three times per day and supports manual runs. The script refuses to overwrite the feed when the upstream source cannot be matched reliably. Unavailable data is labeled unavailable, not fabricated. Only publicly available team records, rankings and predictions are used.

**Online league database is provisioned and connected.** Its dedicated Supabase project ID is `vzjrlvkwuswkryxxrvtp` (separate from PlushList and Baby PupFit). Friend sign-ins require the remaining Auth redirect and outbound email configuration described below. Do not claim public friend logins are tested until a second email address has actually joined a league.

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

- **Site says owner setup required:** check that `config.js` has the dedicated public Supabase project values and the browser Supabase client loads.
- **Email confirmation link goes somewhere else:** update the project's Auth Site URL and Redirect allowlist.
- **Data API permission error:** run `supabase/setup.sql` in the correct dedicated project and confirm the public schema is exposed in Data API settings.
- **Picks refused:** kickoff has passed according to the database or the user isn't authenticated. Confirm the latest official game time.
- **Scores show zero:** results have not yet been recorded by the administrator.
- **Pages missing/404:** GitHub Pages is not yet enabled. Open repository **Settings → Pages**, select **Deploy from a branch → `main` → `/(root)`**, and Save. The old Actions-based deployment failed because it was not authorized to create a Pages site; it was removed to stop repeated failure notifications.

## License and affiliation

Fan-made project. Not affiliated with, endorsed by, or sponsored by the Southeastern Conference, its universities, or the similarly named sports publication *Saturday Down South*. Original stylized team initials are used instead of official logos.
