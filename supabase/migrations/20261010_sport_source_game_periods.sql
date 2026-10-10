-- Sport game periods and innings are provider-sourced; no invented clock values.
alter table public.sec_sport_games add column if not exists status_detail text;
comment on column public.sec_sport_games.status_detail is
 'Current ESPN period, clock or inning when supplied; blank when the source omits it.';