-- Deployed to SEC Pick'em Supabase on 2026-10-10 as sec_ai_commentary_optin_limits_20261010.
-- Optional paid AI: OPENAI_API_KEY is never stored in GitHub or exposed to browsers.
-- Service-only cache and atomic per-account spending limit for generated game commentary.
create table if not exists public.sec_ai_commentary_cache (
 game_key text primary key check(length(game_key) between 10 and 130),
 fingerprint text not null check(length(fingerprint)<=500),
 commentary text not null check(length(commentary) between 30 and 1400),
 generated_at timestamptz not null default now()
);
alter table public.sec_ai_commentary_cache enable row level security;
revoke all on public.sec_ai_commentary_cache from public,anon,authenticated;
create table if not exists public.sec_ai_commentary_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 window_hour timestamptz not null,
 count integer not null check(count between 0 and 12),
 primary key(user_id,window_hour)
);
alter table public.sec_ai_commentary_usage enable row level security;
revoke all on public.sec_ai_commentary_usage from public,anon,authenticated;
create or replace function public.sec_spend_commentary_credit(p_user uuid)
returns boolean language plpgsql volatile security definer set search_path=''
as $$
declare v_count integer;
begin
 if p_user is null or not exists(select 1 from auth.users where id=p_user) then return false; end if;
 insert into public.sec_ai_commentary_usage(user_id,window_hour,count)
 values(p_user,date_trunc('hour',now()),1)
 on conflict(user_id,window_hour) do update set count=public.sec_ai_commentary_usage.count+1
 where public.sec_ai_commentary_usage.count<12 returning count into v_count;
 return coalesce(v_count,0)<=12 and v_count is not null;
end;$$;
revoke all on function public.sec_spend_commentary_credit(uuid) from public,anon,authenticated;
grant execute on function public.sec_spend_commentary_credit(uuid) to service_role;
