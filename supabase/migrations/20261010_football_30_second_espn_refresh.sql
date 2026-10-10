-- Upgrade the SAME named active-game scorer from once/minute to every
-- 30 seconds. pg_cron >=1.5 supports second-based intervals; project has 1.6.
-- Reusing the job name modifies the existing schedule (not a second job).
-- The worker secret stays in Vault and is never exposed to browser clients.
-- The existing half-hour weekend and 6-hour weekday catch-up jobs remain intact.
select cron.schedule('sec-scores-live-minute','30 seconds',
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
