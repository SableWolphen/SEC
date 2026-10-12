-- Server-only private VAPID key reader, and authenticated cron dispatch.
create or replace function public.sec_push_vapid_private()
returns text language sql stable security definer set search_path=''
as $$
 select decrypted_secret from vault.decrypted_secrets where name='sec_push_vapid_private' limit 1
$$;
revoke all on function public.sec_push_vapid_private() from public,anon,authenticated;
grant execute on function public.sec_push_vapid_private() to service_role;
select cron.schedule('sec-push-favorite-events','*/10 * * * *',$job$
 select net.http_post(
  url:='https://vzjrlvkwuswkryxxrvtp.supabase.co/functions/v1/sec-push-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','X-SEC-Job-Token',
   (select decrypted_secret from vault.decrypted_secrets where name='sec_scores_job_token')),
  body:='{}'::jsonb,timeout_milliseconds:=120000)
$job$);
