# Saturdays Down South — SEC Pick’em

An **unofficial fan-made SEC football pick’em website** in [SableWolphen/SEC](https://github.com/SableWolphen/SEC).

**Website:** https://sablewolphen.github.io/SEC/ (GitHub Pages publishes from `main` branch root).

## Game features

- Mobile-first and desktop-friendly dark interface; works in a browser on Android, iOS or desktop.
- All 16 SEC teams; **120 regular-season games across 13 weeks**, including nonconference opponents.
- One point per correct predicted winner, choose each game independently, and lock picks at kickoff.
- TBD kickoff times lock provisionally at 10 AM Central on the game date, until official kickoff information is entered.
- Online private leagues, email sign-in, invite links and scoreboards: **database provisioned; email delivery and allowed redirects require owner setup before friends can log in.**
- All authenticated online picks are stored on the server; row-level security protects user data and deadlines; weekly and season standings are centrally calculated.
- The device-only pick preview remains available without signing in. Once the online service is configured, signed-in picks sync across devices.
- No gambling, payments or betting.

## Matchup insights and what they mean

Each game card now includes season win-loss records, Top-25 ranking when available, and a clearly labeled forecast. A published ESPN game projection is used when ESPN supplies one. Otherwise, a simple record-based estimate uses the two teams' win percentage plus a small home-field adjustment; **it is not a validated forecasting model** and is never presented as an ESPN projection or betting line.

Data is sourced from ESPN's public college football game feed. `scripts/update_stats.py` refreshes `stats.json`; `.github/workflows/update-stats.yml` automatically runs three times per day and supports manual runs. The script refuses to overwrite the feed when the upstream source cannot be matched reliably. Unavailable data is labeled unavailable, not fabricated. Only publicly available team records, rankings and predictions are used.

**Online league database is provisioned and connected.** Its dedicated Supabase project ID is `vzjrlvkwuswkryxxrvtp` (separate from PlushList and Baby PupFit). Friend sign-ins require the remaining Auth redirect and outbound email configuration described below. Do not claim public friend logins are tested until a second email address has actually joined a league.

## Deployment and online activation

The GitHub Pages site is published, and the SEC-specific database has been created and populated with all 120 games. The tables are protected by row-level security, and the **public publishable** key is configured in `config.js`. The other Supabase projects were left untouched.

### Owner actions remaining: email sign-in

These Supabase Auth settings are project configuration, **not SQL tables or GitHub files**, so the connected tools cannot change them:

1. Open [Auth URL Configuration](https://supabase.com/dashboard/project/vzjrlvkwuswkryxxrvtp/auth/url-configuration). Set **Site URL** to `https://sablewolphen.github.io/SEC/` and add `https://sablewolphen.github.io/SEC/**` to the **Redirect URLs** allowlist.
2. Open [Auth SMTP settings](https://supabase.com/dashboard/project/vzjrlvkwuswkryxxrvtp/auth/smtp). Configure a real email delivery provider (e.g. Resend, Postmark, SES or Brevo) for sign-in links. **Supabase's built-in mailer only sends to Supabase organization members**, and has a low hourly rate limit, so it cannot invite ordinary friends. Do not add SMTP passwords or secret API keys to `config.js` or GitHub.
3. On [Saturdays Down South](https://sablewolphen.github.io/SEC/#league), send yourself a login link, set a display name, click **Create league**, and copy the invitation link. Have a friend open it, sign in with their own email, and verify both accounts appear in the same live standings.

A correct deployment **does not imply** sign-in emails are ready until those settings and an end-to-end friend test are complete.

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
