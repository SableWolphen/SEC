-- Poll the existing secure scoreboard worker once a minute ONLY when a game
-- is about to kick off, is live, or might still be playing.
-- All other hours use existing 30min weekend / 6h weekday catch-up cron.
-- The job secret stays in Vault and is never returned to browser clients.
select cron.schedule('sec-scores-live-minute','* * * * *',
$job$
 select net.http_post(
  url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-scores',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'X-SEC-Job-Token',(select decrypted_secret from vault.decrypted_secrets where name='sec_scores_job_token')
  ),body:='{}'::jsonb,timeout_milliseconds:=30000
 )
 where exists(
  select 1 from public.sec_games g
  where g.game_status in ('scheduled','live')
    and g.kickoff_at between now()-interval '7 hours' and now()+interval '20 minutes'
 );
$job$);
