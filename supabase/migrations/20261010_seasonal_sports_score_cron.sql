-- Score ingestion every two minutes during the relevant playing season.
-- Provider calls are limited by the Edge Function's 15-minute off-game cache.
select cron.schedule('sec-basketball-auto-scores','*/2 * * 11,12,1,2,3,4 *',
 $job$select net.http_post(
  url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-sport-sync',
  headers:=jsonb_build_object('Content-Type','application/json',
   'X-SEC-Job-Token',(select decrypted_secret from vault.decrypted_secrets
                      where name='sec_scores_job_token')),
  body:='{"sport":"basketball"}'::jsonb,timeout_milliseconds:=15000);$job$);
select cron.schedule('sec-baseball-auto-scores','*/2 * * 2,3,4,5,6 *',
 $job$select net.http_post(
  url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-sport-sync',
  headers:=jsonb_build_object('Content-Type','application/json',
   'X-SEC-Job-Token',(select decrypted_secret from vault.decrypted_secrets
                      where name='sec_scores_job_token')),
  body:='{"sport":"baseball"}'::jsonb,timeout_milliseconds:=15000);$job$);