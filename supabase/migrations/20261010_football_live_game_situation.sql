-- ESPN-sourced in-game situation. Never generated from score differences or guesses.
-- The nullable fields prevent misleading UI when a provider has no play-by-play.
alter table public.sec_games
 add column if not exists live_possession_code text,
 add column if not exists live_down integer,
 add column if not exists live_distance integer,
 add column if not exists live_position_text text,
 add column if not exists live_field_percent integer,
 add column if not exists live_drive_summary text,
 add column if not exists live_last_play text,
 add column if not exists live_situation_updated_at timestamptz;
comment on column public.sec_games.live_field_percent is 'Source-verified offensive progress, 0-100 from own goal to opposing goal; null if ESPN cannot verify position.';
comment on column public.sec_games.live_position_text is 'ESPN current ball position (e.g. MIZ 25) when reported; may be null.';
comment on column public.sec_games.live_situation_updated_at is 'UTC ingestion timestamp of a validated play-by-play situation, independent from scoreboard timestamp.';
