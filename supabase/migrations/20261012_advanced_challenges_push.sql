-- 2026-10-12: opt-in football friend challenges and private browser push endpoints.
-- Migration must be applied to the SEC Supabase project before these server-backed
-- features are available. No cross-member picks are exposed before kickoff.

create table if not exists public.sec_friend_challenges(
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references public.sec_leagues(id) on delete cascade,
 challenger_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 week integer not null check(week between 1 and 22),
 status text not null default 'pending' check(status in('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 constraint sec_friend_challenge_not_self check(challenger_id<>recipient_id)
);
create unique index if not exists sec_friend_unique_pair
 on public.sec_friend_challenges(league_id,week,
  least(challenger_id,recipient_id),greatest(challenger_id,recipient_id));
create index if not exists sec_friend_challenge_recipient on public.sec_friend_challenges(recipient_id,created_at desc);
alter table public.sec_friend_challenges enable row level security;
revoke all on public.sec_friend_challenges from public,anon,authenticated;
grant select on public.sec_friend_challenges to authenticated;
drop policy if exists sec_friend_challenges_participants on public.sec_friend_challenges;
create policy sec_friend_challenges_participants on public.sec_friend_challenges
 for select to authenticated using (
 public.sec_is_member(league_id) and
 ((select auth.uid())=challenger_id or (select auth.uid())=recipient_id));

create or replace function public.sec_challenge_friend(
 p_league uuid,p_opponent uuid,p_week integer
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_me uuid:=(select auth.uid()); v_id uuid;
begin
 if v_me is null or p_league is null or p_opponent is null or p_opponent=v_me or
   p_week is null or p_week not between 1 and 22 then
  raise exception 'Valid account, opponent, league and week required';
 end if;
 if not public.sec_is_member(p_league) or
  not exists(select 1 from public.sec_members where league_id=p_league and user_id=p_opponent)
 then raise exception 'Both friends must belong to this football league';end if;
 if not exists(select 1 from public.sec_games where week=p_week and kickoff_at>clock_timestamp())
 then raise exception 'This challenge window has closed';end if;
 insert into public.sec_friend_challenges(league_id,challenger_id,recipient_id,week)
 values(p_league,v_me,p_opponent,p_week)
 on conflict do nothing returning id into v_id;
 if v_id is null then raise exception 'This pair already has a challenge for the selected week';end if;
 return v_id;
end $$;
revoke all on function public.sec_challenge_friend(uuid,uuid,integer) from public,anon;
grant execute on function public.sec_challenge_friend(uuid,uuid,integer) to authenticated;

create or replace function public.sec_respond_friend_challenge(
 p_id uuid,p_status text
) returns text language plpgsql security definer set search_path=''
as $$
declare v_me uuid:=(select auth.uid());v_found uuid;
begin
 if v_me is null or p_id is null or p_status not in ('accepted','declined')
 then raise exception 'Valid response required';end if;
 update public.sec_friend_challenges
  set status=p_status,responded_at=clock_timestamp()
  where id=p_id and recipient_id=v_me and status='pending'
    and public.sec_is_member(league_id)
 returning id into v_found;
 if v_found is null then raise exception 'This private challenge is unavailable or already answered';end if;
 return p_status;
end $$;
revoke all on function public.sec_respond_friend_challenge(uuid,text) from public,anon;
grant execute on function public.sec_respond_friend_challenge(uuid,text) to authenticated;

-- Private Web Push subscriptions. Stored endpoint/key material must never be
-- visible to another league member or in any client-side leaderboard query.
create table if not exists public.sec_push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint) between 40 and 2048),
 p256dh text not null check(length(p256dh) between 30 and 512),
 auth_secret text not null check(length(auth_secret) between 12 and 256),
 favorite_school text check(favorite_school is null or favorite_school in(
 'ALA','ARK','AUB','FLA','UGA','UK','LSU','MISS','MSST','MIZ','OU','SC','TENN','TEX','TAMU','VAN')),
 created_at timestamptz not null default now()
);
create index if not exists sec_push_subscription_user on public.sec_push_subscriptions(user_id);
alter table public.sec_push_subscriptions enable row level security;
revoke all on public.sec_push_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.sec_push_subscriptions to authenticated;
drop policy if exists sec_push_self_select on public.sec_push_subscriptions;
create policy sec_push_self_select on public.sec_push_subscriptions for select to authenticated
 using (user_id=(select auth.uid()));
drop policy if exists sec_push_self_insert on public.sec_push_subscriptions;
create policy sec_push_self_insert on public.sec_push_subscriptions for insert to authenticated
 with check(user_id=(select auth.uid()));
drop policy if exists sec_push_self_update on public.sec_push_subscriptions;
create policy sec_push_self_update on public.sec_push_subscriptions for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists sec_push_self_delete on public.sec_push_subscriptions;
create policy sec_push_self_delete on public.sec_push_subscriptions for delete to authenticated
 using(user_id=(select auth.uid()));

-- Internal notification deduplication; never grant access to browser clients.
create table if not exists public.sec_push_deliveries(
 subscription_id uuid not null references public.sec_push_subscriptions(id) on delete cascade,
 event_key text not null,
 delivered_at timestamptz not null default now(),
 primary key(subscription_id,event_key)
);
alter table public.sec_push_deliveries enable row level security;
revoke all on public.sec_push_deliveries from public,anon,authenticated;
