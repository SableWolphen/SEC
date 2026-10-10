-- 2026 football: activate the verified-only game score importer.
-- Existing sec-scores Edge Function accepts a private token from Vault.
-- Do NOT grant public game-write privileges or store credentials in the repo.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$
begin
 if not exists(select 1 from vault.secrets where name='sec_scores_job_token') then
  perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'sec_scores_job_token');
 end if;
end $$;
-- Reconfirm the previously deployed token gate. No public execution.
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
-- Include Thursday SEC games; run twice/hour Thu–Sun while football is active.
select cron.schedule('sec-scores-weekend-half-hour','*/30 * * * 4,5,6,0',
$job$
 select net.http_post(
  url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-scores',
  headers:=jsonb_build_object('Content-Type','application/json','X-SEC-Job-Token',
   (select decrypted_secret from vault.decrypted_secrets where name='sec_scores_job_token')),
  body:='{}'::jsonb,
  timeout_milliseconds:=30000
 );
$job$);
-- Three updates daily during quieter weekdays; sufficient for any leftover finals.
select cron.schedule('sec-scores-weekdays-every-six-hours','0 */6 * * 1,2,3',
$job$
 select net.http_post(
  url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-scores',
  headers:=jsonb_build_object('Content-Type','application/json','X-SEC-Job-Token',
   (select decrypted_secret from vault.decrypted_secrets where name='sec_scores_job_token')),
  body:='{}'::jsonb,
  timeout_milliseconds:=30000
 );
$job$);
-- Fire a one-off verified refresh so historical final games catch up now.
select net.http_post(
 url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-scores',
 headers:=jsonb_build_object('Content-Type','application/json','X-SEC-Job-Token',
  (select decrypted_secret from vault.decrypted_secrets where name='sec_scores_job_token')),
 body:='{}'::jsonb,
 timeout_milliseconds:=30000
);
