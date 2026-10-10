-- Refresh source-backed basketball/baseball scores without waiting for a user
-- to open the website. Uses the existing private Vault job token. Cron does
-- not possess user credentials or permission to submit picks.
select cron.schedule('sec-basketball-auto-scores','*/2 * * * *',
 $job$select net.http_post(
  url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-sport-sync',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'X-SEC-Job-Token',(select decrypted_secret from vault.decrypted_secrets
                      where name='sec_scores_job_token')),
  body:='{"sport":"basketball"}'::jsonb,
  timeout_milliseconds:=15000);$job$);
select cron.schedule('sec-baseball-auto-scores','*/2 * * * *',
 $job$select net.http_post(
  url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-sport-sync',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'X-SEC-Job-Token',(select decrypted_secret from vault.decrypted_secrets
                      where name='sec_scores_job_token')),
  body:='{"sport":"baseball"}'::jsonb,
  timeout_milliseconds:=15000);$job$);
