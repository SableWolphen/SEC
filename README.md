# Saturdays Down South — SEC Pick’em

An unofficial, free, mobile-friendly SEC college football pick'em website. Picks cover **every game involving a 2026 SEC football team**, including games against nonconference opponents.

## Website

GitHub Pages: **https://sablewolphen.github.io/SEC/** (available after Pages is configured and its workflow succeeds).

## Features

- 16 SEC teams, 13 weeks and 120 scheduled games (72 SEC vs SEC and 48 nonconference games).
- Straight-up winner picks, 1 point per correct result; pick locks begin at announced kickoff time.
- For TBA kickoffs, provisional locks are labeled, so verify actual game times as they are announced.
- Local saved picks, manually entered results, weekly leaderboards, and friend pick-code imports.
- Works in a mobile or desktop browser. No wagering or real-money betting.
- September games are archived and locked against retroactive picks.

## Set up GitHub Pages

1. Open this repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Open **Actions** and look for the **Deploy Saturdays Down South to GitHub Pages** workflow. It runs on pushes to `main` and can also be run manually.
4. Once the deployment completes successfully, open **https://sablewolphen.github.io/SEC/**.

No database, accounts, automated score feed or server is included. Friend codes are shared and imported manually, results are manually entered, and browser-local information is not a tamper-resistant central leaderboard. This is a prototype for private friendly competitions, not a production shared league.

## Schedule note

Kickoff times and dates are subject to change; manually maintain the `RAW_WEEKS` section of `index.html`. Selected dates/times are from the planned 2026 fixtures and must be checked against current official schedules before use. For future games lacking announced kickoff times, this site uses a clearly indicated early provisional lock.

## Trademark / affiliation

Unofficial fan-made application. It is not affiliated with, endorsed by, or sponsored by the SEC, its member universities, or the similarly named sports publication *Saturday Down South*. No official team logos are used.
