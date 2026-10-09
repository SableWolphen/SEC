-- Saturdays Down South: ONE-TIME trusted live-score scheduler activation.
-- Run this ONLY in the dedicated "SEC Pick'em" Supabase SQL Editor.
-- The secret is generated/stored inside Supabase Vault; never commit or paste it into public JS.
-- This script is needed after supabase/setup.sql + migrations/20261009_four_modes.sql.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
 if not exists(select 1 from vault.secrets where name='sec_scores_job_token') then
  perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'sec_scores_job_token');
 end if;
end $$;

create or replace function public.sec_verify_scores_job(p_token text)
returns boolean language sql stable security definer set search_path=''
as $$
select length(coalesce(p_token,''))>=32 and exists(
 select 1 from vault.decrypted_secrets v
 where v.name='sec_scores_job_token' and v.decrypted_secret=p_token
)
$$;
revoke all on function public.sec_verify_scores_job(text) from public,anon,authenticated;
grant execute on function public.sec_verify_scores_job(text) to service_role;

-- Use only a token looked up at execution time; the secret never appears in cron.job.
-- Friday-Sunday live-score polling (UTC), plus regular checks during the rest of the week.
select cron.schedule(
 'sec-scores-weekend-half-hour',
 '*/30 * * * 5,6,0',
 $job$
 select net.http_post(
  url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-scores',
  headers:=jsonb_build_object('Content-Type','application/json','X-SEC-Job-Token',
   (select decrypted_secret from vault.decrypted_secrets where name='sec_scores_job_token')),
  body:='{}'::jsonb,
  timeout_milliseconds:=30000
 );
 $job$
);
select cron.schedule(
 'sec-scores-weekdays-every-six-hours',
 '0 */6 * * 1-4',
 $job$
 select net.http_post(
  url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-scores',
  headers:=jsonb_build_object('Content-Type','application/json','X-SEC-Job-Token',
   (select decrypted_secret from vault.decrypted_secrets where name='sec_scores_job_token')),
  body:='{}'::jsonb,
  timeout_milliseconds:=30000
 );
 $job$
);
-- First immediate refresh; subsequent updates run by pg_cron.
select net.http_post(
 url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-scores',
 headers:=jsonb_build_object('Content-Type','application/json','X-SEC-Job-Token',
  (select decrypted_secret from vault.decrypted_secrets where name='sec_scores_job_token')),
 body:='{}'::jsonb,
 timeout_milliseconds:=30000
);
-- Monitor jobs at: Dashboard > Integrations > Cron.
-- To inspect outcomes: SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
-- The score endpoint validates the token against Vault before it reads or writes results.
-- Do not give anonymous users permissions to update sec_games.
