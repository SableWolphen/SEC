-- Official Kansas/Missouri schedules verify the September 11 Friday Border War.
-- Preserve all existing IDs, users, membership, and picks while correcting dates.
-- Source: https://kuathletics.com/news/2026/9/12/football-jayhawks-fall-to-23-missouri-in-border-showdown
-- Official kickoff: Friday September 11, 7:00 p.m. Central.
update public.sec_games
 set game_date='2026-09-11',
     kickoff_at='2026-09-11 19:00:00-05',
     provisional=false
 where id='2026-2-MIZ-KANS'
   and away_code='MIZ' and home_code='KANS'
   and game_status='scheduled'
   and winner is null;
