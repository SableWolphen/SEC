-- Verified NCAA live-score alternative to ESPN. This is provenance only;
-- the existing final/winner and scoring authorization checks are unchanged.
alter table public.sec_games
 add column if not exists live_score_source text;
comment on column public.sec_games.live_score_source is
 'Provider whose verified live scoreboard advance was accepted (ESPN or NCAA). Final winners remain ESPN verified.';
