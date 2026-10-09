-- Saturdays Down South · standalone SEC multiplayer tables.
-- Run this on a DEDICATED Supabase project, not your other app database.
-- Safe to rerun for schema setup. Existing game winners are preserved on seed updates.
create extension if not exists pgcrypto;
create table if not exists public.sec_games (
  id text primary key,
  week integer not null check (week between 1 and 20),
  game_date date not null,
  away_code text not null,
  home_code text not null,
  kickoff_at timestamptz not null,
  provisional boolean not null default true,
  winner text,
  constraint sec_game_winner_valid check (winner is null or winner = away_code or winner = home_code)
);
create table if not exists public.sec_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 32),
  updated_at timestamptz not null default now()
);
create table if not exists public.sec_leagues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 50),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  created_at timestamptz not null default now()
);
create table if not exists public.sec_members (
  league_id uuid not null references public.sec_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id,user_id)
);
create table if not exists public.sec_picks (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.sec_games(id) on delete cascade,
  pick_code text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id,game_id)
);
create index if not exists sec_members_user on public.sec_members(user_id,league_id);
create index if not exists sec_games_week on public.sec_games(week);
create index if not exists sec_picks_game on public.sec_picks(game_id);
alter table public.sec_games enable row level security;
alter table public.sec_profiles enable row level security;
alter table public.sec_leagues enable row level security;
alter table public.sec_members enable row level security;
alter table public.sec_picks enable row level security;
revoke all on public.sec_games,public.sec_profiles,public.sec_leagues,public.sec_members,public.sec_picks from anon,authenticated;
grant select on public.sec_games to anon,authenticated;
grant select,insert,update on public.sec_profiles to authenticated;
grant select on public.sec_leagues,public.sec_members to authenticated;
grant select,insert,update on public.sec_picks to authenticated;
drop policy if exists sec_games_read on public.sec_games;
create policy sec_games_read on public.sec_games for select to anon,authenticated using (true);
drop policy if exists sec_profiles_self_read on public.sec_profiles;
create policy sec_profiles_self_read on public.sec_profiles for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists sec_profiles_self_insert on public.sec_profiles;
create policy sec_profiles_self_insert on public.sec_profiles for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists sec_profiles_self_update on public.sec_profiles;
create policy sec_profiles_self_update on public.sec_profiles for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create or replace function public.sec_is_member(p_league uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.sec_members where league_id=p_league and user_id=(select auth.uid())) $$;
revoke all on function public.sec_is_member(uuid) from public,anon;
grant execute on function public.sec_is_member(uuid) to authenticated;
drop policy if exists sec_leagues_member_read on public.sec_leagues;
create policy sec_leagues_member_read on public.sec_leagues for select to authenticated using (public.sec_is_member(id));
drop policy if exists sec_members_member_read on public.sec_members;
create policy sec_members_member_read on public.sec_members for select to authenticated using (public.sec_is_member(league_id));
drop policy if exists sec_picks_own_read on public.sec_picks;
create policy sec_picks_own_read on public.sec_picks for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists sec_picks_before_kickoff_insert on public.sec_picks;
create policy sec_picks_before_kickoff_insert on public.sec_picks for insert to authenticated with check (
 user_id=(select auth.uid()) and exists (select 1 from public.sec_games g where g.id=game_id and now() < g.kickoff_at and pick_code in (g.away_code,g.home_code))
);
drop policy if exists sec_picks_before_kickoff_update on public.sec_picks;
create policy sec_picks_before_kickoff_update on public.sec_picks for update to authenticated
 using (user_id=(select auth.uid()) and exists(select 1 from public.sec_games g where g.id=game_id and now() < g.kickoff_at))
 with check (user_id=(select auth.uid()) and exists(select 1 from public.sec_games g where g.id=game_id and now() < g.kickoff_at and pick_code in (g.away_code,g.home_code)));
-- Enforce the deadline again inside the write itself to avoid stale client clocks.
create or replace function public.sec_guard_pick()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare g record;
begin
 select kickoff_at, away_code, home_code into g from public.sec_games where id=new.game_id for share;
 if not found or clock_timestamp()>=g.kickoff_at or new.pick_code not in (g.away_code,g.home_code) then
  raise exception 'This pick is invalid or the game has already started';
 end if;
 new.updated_at := now();
 return new;
end $$;
drop trigger if exists sec_guard_pick_trigger on public.sec_picks;
create trigger sec_guard_pick_trigger before insert or update on public.sec_picks
for each row execute function public.sec_guard_pick();

-- League creation and invite-code redemption are server-authorized.
create or replace function public.sec_create_league(p_name text)
returns table (league_id uuid, code text)
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_code text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 50 then raise exception 'League name must be 2-50 characters'; end if;
 insert into public.sec_leagues(owner_id,name) values(auth.uid(),trim(p_name))
 returning id,invite_code into v_id,v_code;
 insert into public.sec_members(league_id,user_id) values(v_id,auth.uid());
 return query select v_id,v_code;
end $$;
create or replace function public.sec_join_league(p_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select id into v_id from public.sec_leagues where invite_code=upper(trim(coalesce(p_code,'')));
 if v_id is null then raise exception 'League not found — check the invite code'; end if;
 insert into public.sec_members(league_id,user_id) values(v_id,auth.uid()) on conflict do nothing;
 return v_id;
end $$;
create or replace function public.sec_league_standings(p_league uuid, p_week integer)
returns table (user_id uuid, display_name text, picked bigint, week_points bigint, season_points bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.sec_members as checking_member
    where checking_member.league_id = p_league
      and checking_member.user_id = (select auth.uid())
  ) then
    raise exception 'You must join the league first';
  end if;
  return query
  select member.user_id,
         coalesce(profile.display_name, 'Player')::text,
         (select count(*) from public.sec_picks as pick
          join public.sec_games as game on game.id = pick.game_id
          where pick.user_id = member.user_id and game.week = p_week),
         (select count(*) from public.sec_picks as pick
          join public.sec_games as game on game.id = pick.game_id
          where pick.user_id = member.user_id and game.week = p_week
            and game.winner is not null and pick.pick_code = game.winner),
         (select count(*) from public.sec_picks as pick
          join public.sec_games as game on game.id = pick.game_id
          where pick.user_id = member.user_id
            and game.winner is not null and pick.pick_code = game.winner)
  from public.sec_members as member
  left join public.sec_profiles as profile on profile.user_id = member.user_id
  where member.league_id = p_league
  order by 4 desc, 5 desc, 2 asc;
end $$;
revoke all on function public.sec_create_league(text) from public,anon;
revoke all on function public.sec_join_league(text) from public,anon;
revoke all on function public.sec_league_standings(uuid,integer) from public,anon;
grant execute on function public.sec_create_league(text),public.sec_join_league(text),public.sec_league_standings(uuid,integer) to authenticated;

-- Fixed schedule, seed generated from the repository's existing 2026 games.
-- Provisional games lock early at 10 AM Central; update times from official sources as announced.
insert into public.sec_games(id,week,game_date,away_code,home_code,kickoff_at,provisional)
values
 ('2026-1-UAPB-MIZ',1,'2026-09-03','UAPB','MIZ','2026-09-03T20:00:00-04:00',false),
 ('2026-1-UTEP-OU',1,'2026-09-04','UTEP','OU','2026-09-04T20:00:00-04:00',false),
 ('2026-1-ECU-ALA',1,'2026-09-05','ECU','ALA','2026-09-05T12:00:00-04:00',false),
 ('2026-1-KENT-SC',1,'2026-09-05','KENT','SC','2026-09-05T12:45:00-04:00',false),
 ('2026-1-YSU-UK',1,'2026-09-05','YSU','UK','2026-09-05T13:00:00-04:00',false),
 ('2026-1-TNSTATE-UGA',1,'2026-09-05','TNSTATE','UGA','2026-09-05T15:00:00-04:00',false),
 ('2026-1-BAY-AUB',1,'2026-09-05','BAY','AUB','2026-09-05T15:30:00-04:00',false),
 ('2026-1-TXST-TEX',1,'2026-09-05','TXST','TEX','2026-09-05T15:30:00-04:00',false),
 ('2026-1-FUR-TENN',1,'2026-09-05','FUR','TENN','2026-09-05T15:30:00-04:00',false),
 ('2026-1-NALA-ARK',1,'2026-09-05','NALA','ARK','2026-09-05T16:15:00-04:00',false),
 ('2026-1-MOST-TAMU',1,'2026-09-05','MOST','TAMU','2026-09-05T19:00:00-04:00',false),
 ('2026-1-AUSTPEAY-VAN',1,'2026-09-05','AUSTPEAY','VAN','2026-09-05T19:00:00-04:00',false),
 ('2026-1-CLEM-LSU',1,'2026-09-05','CLEM','LSU','2026-09-05T19:30:00-04:00',false),
 ('2026-1-ULM-MSST',1,'2026-09-05','ULM','MSST','2026-09-05T19:30:00-04:00',false),
 ('2026-1-FAU-FLA',1,'2026-09-05','FAU','FLA','2026-09-05T19:45:00-04:00',false),
 ('2026-1-LOU-MISS',1,'2026-09-06','LOU','MISS','2026-09-06T19:30:00-04:00',false),
 ('2026-2-ARK-UTAH',2,'2026-09-12','ARK','UTAH','2026-09-12T11:00:00-04:00',true),
 ('2026-2-SOMISS-AUB',2,'2026-09-12','SOMISS','AUB','2026-09-12T11:00:00-04:00',true),
 ('2026-2-CAMP-FLA',2,'2026-09-12','CAMP','FLA','2026-09-12T11:00:00-04:00',true),
 ('2026-2-WKU-UGA',2,'2026-09-12','WKU','UGA','2026-09-12T11:00:00-04:00',true),
 ('2026-2-ALA-UK',2,'2026-09-12','ALA','UK','2026-09-12T11:00:00-04:00',true),
 ('2026-2-LATECH-LSU',2,'2026-09-12','LATECH','LSU','2026-09-12T11:00:00-04:00',true),
 ('2026-2-CHAR-MISS',2,'2026-09-12','CHAR','MISS','2026-09-12T11:00:00-04:00',true),
 ('2026-2-MSST-MINN',2,'2026-09-12','MSST','MINN','2026-09-12T11:00:00-04:00',true),
 ('2026-2-MIZ-KANS',2,'2026-09-12','MIZ','KANS','2026-09-12T11:00:00-04:00',true),
 ('2026-2-OU-MICH',2,'2026-09-12','OU','MICH','2026-09-12T11:00:00-04:00',true),
 ('2026-2-TOW-SC',2,'2026-09-12','TOW','SC','2026-09-12T11:00:00-04:00',true),
 ('2026-2-TENN-GATECH',2,'2026-09-12','TENN','GATECH','2026-09-12T11:00:00-04:00',true),
 ('2026-2-OHST-TEX',2,'2026-09-12','OHST','TEX','2026-09-12T11:00:00-04:00',true),
 ('2026-2-ASU-TAMU',2,'2026-09-12','ASU','TAMU','2026-09-12T11:00:00-04:00',true),
 ('2026-2-DEL-VAN',2,'2026-09-12','DEL','VAN','2026-09-12T11:00:00-04:00',true),
 ('2026-3-FSU-ALA',3,'2026-09-19','FSU','ALA','2026-09-19T11:00:00-04:00',true),
 ('2026-3-UGA-ARK',3,'2026-09-19','UGA','ARK','2026-09-19T11:00:00-04:00',true),
 ('2026-3-FLA-AUB',3,'2026-09-19','FLA','AUB','2026-09-19T11:00:00-04:00',true),
 ('2026-3-LSU-MISS',3,'2026-09-19','LSU','MISS','2026-09-19T11:00:00-04:00',true),
 ('2026-3-TROY-MIZ',3,'2026-09-19','TROY','MIZ','2026-09-19T11:00:00-04:00',true),
 ('2026-3-UNM-OU',3,'2026-09-19','UNM','OU','2026-09-19T11:00:00-04:00',true),
 ('2026-3-MSST-SC',3,'2026-09-19','MSST','SC','2026-09-19T11:00:00-04:00',true),
 ('2026-3-KSU-TENN',3,'2026-09-19','KSU','TENN','2026-09-19T11:00:00-04:00',true),
 ('2026-3-UTSA-TEX',3,'2026-09-19','UTSA','TEX','2026-09-19T11:00:00-04:00',true),
 ('2026-3-UK-TAMU',3,'2026-09-19','UK','TAMU','2026-09-19T11:00:00-04:00',true),
 ('2026-3-NCST-VAN',3,'2026-09-19','NCST','VAN','2026-09-19T11:00:00-04:00',true),
 ('2026-4-SC-ALA',4,'2026-09-26','SC','ALA','2026-09-26T11:00:00-04:00',true),
 ('2026-4-TULSA-ARK',4,'2026-09-26','TULSA','ARK','2026-09-26T11:00:00-04:00',true),
 ('2026-4-VAN-AUB',4,'2026-09-26','VAN','AUB','2026-09-26T11:00:00-04:00',true),
 ('2026-4-MISS-FLA',4,'2026-09-26','MISS','FLA','2026-09-26T11:00:00-04:00',true),
 ('2026-4-OU-UGA',4,'2026-09-26','OU','UGA','2026-09-26T11:00:00-04:00',true),
 ('2026-4-SOALA-UK',4,'2026-09-26','SOALA','UK','2026-09-26T11:00:00-04:00',true),
 ('2026-4-TAMU-LSU',4,'2026-09-26','TAMU','LSU','2026-09-26T11:00:00-04:00',true),
 ('2026-4-MIZ-MSST',4,'2026-09-26','MIZ','MSST','2026-09-26T11:00:00-04:00',true),
 ('2026-4-TEX-TENN',4,'2026-09-26','TEX','TENN','2026-09-26T11:00:00-04:00',true),
 ('2026-5-VAN-UGA',5,'2026-10-03','VAN','UGA','2026-10-03T11:00:00-04:00',true),
 ('2026-5-MCN-LSU',5,'2026-10-03','MCN','LSU','2026-10-03T11:00:00-04:00',true),
 ('2026-5-ALA-MSST',5,'2026-10-03','ALA','MSST','2026-10-03T11:00:00-04:00',true),
 ('2026-5-FLA-MIZ',5,'2026-10-03','FLA','MIZ','2026-10-03T11:00:00-04:00',true),
 ('2026-5-UK-SC',5,'2026-10-03','UK','SC','2026-10-03T11:00:00-04:00',true),
 ('2026-5-AUB-TENN',5,'2026-10-03','AUB','TENN','2026-10-03T11:00:00-04:00',true),
 ('2026-5-ARK-TAMU',5,'2026-10-03','ARK','TAMU','2026-10-03T11:00:00-04:00',true),
 ('2026-6-TAMU-MIZ',6,'2026-10-10','TAMU','MIZ','2026-10-10T12:00:00-04:00',false),
 ('2026-6-SC-FLA',6,'2026-10-10','SC','FLA','2026-10-10T12:45:00-04:00',false),
 ('2026-6-TEX-OU',6,'2026-10-10','TEX','OU','2026-10-10T15:30:00-04:00',false),
 ('2026-6-MISS-VAN',6,'2026-10-10','MISS','VAN','2026-10-10T15:30:00-04:00',false),
 ('2026-6-TENN-ARK',6,'2026-10-10','TENN','ARK','2026-10-10T16:15:00-04:00',false),
 ('2026-6-LSU-UK',6,'2026-10-10','LSU','UK','2026-10-10T19:00:00-04:00',false),
 ('2026-6-UGA-ALA',6,'2026-10-10','UGA','ALA','2026-10-10T19:30:00-04:00',false),
 ('2026-7-FLA-TEX',7,'2026-10-17','FLA','TEX','2026-10-17T12:00:00-04:00',false),
 ('2026-7-MSST-LSU',7,'2026-10-17','MSST','LSU','2026-10-17T12:00:00-04:00',false),
 ('2026-7-AUB-UGA',7,'2026-10-17','AUB','UGA','2026-10-17T15:30:00-04:00',false),
 ('2026-7-MIZ-MISS',7,'2026-10-17','MIZ','MISS','2026-10-17T15:30:00-04:00',false),
 ('2026-7-ALA-TENN',7,'2026-10-17','ALA','TENN','2026-10-17T15:30:00-04:00',false),
 ('2026-7-ARK-VAN',7,'2026-10-17','ARK','VAN','2026-10-17T19:00:00-04:00',false),
 ('2026-7-UK-OU',7,'2026-10-17','UK','OU','2026-10-17T19:30:00-04:00',false),
 ('2026-7-CITADEL-TAMU',7,'2026-10-17','CITADEL','TAMU','2026-10-17T11:00:00-04:00',true),
 ('2026-8-LSU-AUB',8,'2026-10-24','LSU','AUB','2026-10-24T12:00:00-04:00',false),
 ('2026-8-TENN-SC',8,'2026-10-24','TENN','SC','2026-10-24T11:00:00-04:00',true),
 ('2026-8-VAN-UK',8,'2026-10-24','VAN','UK','2026-10-24T11:00:00-04:00',true),
 ('2026-8-TAMU-ALA',8,'2026-10-24','TAMU','ALA','2026-10-24T11:00:00-04:00',true),
 ('2026-8-OU-MSST',8,'2026-10-24','OU','MSST','2026-10-24T11:00:00-04:00',true),
 ('2026-8-MISS-TEX',8,'2026-10-24','MISS','TEX','2026-10-24T11:00:00-04:00',true),
 ('2026-9-AUB-MISS',9,'2026-10-31','AUB','MISS','2026-10-31T11:00:00-04:00',true),
 ('2026-9-FLA-UGA',9,'2026-10-31','FLA','UGA','2026-10-31T15:30:00-04:00',false),
 ('2026-9-MSST-TEX',9,'2026-10-31','MSST','TEX','2026-10-31T11:00:00-04:00',true),
 ('2026-9-MIZ-ARK',9,'2026-10-31','MIZ','ARK','2026-10-31T11:00:00-04:00',true),
 ('2026-9-SC-OU',9,'2026-10-31','SC','OU','2026-10-31T11:00:00-04:00',true),
 ('2026-10-ARK-AUB',10,'2026-11-07','ARK','AUB','2026-11-07T11:00:00-05:00',true),
 ('2026-10-OU-FLA',10,'2026-11-07','OU','FLA','2026-11-07T11:00:00-05:00',true),
 ('2026-10-ALA-LSU',10,'2026-11-07','ALA','LSU','2026-11-07T11:00:00-05:00',true),
 ('2026-10-UGA-MISS',10,'2026-11-07','UGA','MISS','2026-11-07T11:00:00-05:00',true),
 ('2026-10-VAN-MSST',10,'2026-11-07','VAN','MSST','2026-11-07T11:00:00-05:00',true),
 ('2026-10-TEX-MIZ',10,'2026-11-07','TEX','MIZ','2026-11-07T11:00:00-05:00',true),
 ('2026-10-TAMU-SC',10,'2026-11-07','TAMU','SC','2026-11-07T11:00:00-05:00',true),
 ('2026-10-UK-TENN',10,'2026-11-07','UK','TENN','2026-11-07T11:00:00-05:00',true),
 ('2026-11-SC-ARK',11,'2026-11-14','SC','ARK','2026-11-14T11:00:00-05:00',true),
 ('2026-11-MIZ-UGA',11,'2026-11-14','MIZ','UGA','2026-11-14T11:00:00-05:00',true),
 ('2026-11-FLA-UK',11,'2026-11-14','FLA','UK','2026-11-14T11:00:00-05:00',true),
 ('2026-11-TEX-LSU',11,'2026-11-14','TEX','LSU','2026-11-14T11:00:00-05:00',true),
 ('2026-11-AUB-MSST',11,'2026-11-14','AUB','MSST','2026-11-14T11:00:00-05:00',true),
 ('2026-11-MISS-OU',11,'2026-11-14','MISS','OU','2026-11-14T11:00:00-05:00',true),
 ('2026-11-TENN-TAMU',11,'2026-11-14','TENN','TAMU','2026-11-14T11:00:00-05:00',true),
 ('2026-11-ALA-VAN',11,'2026-11-14','ALA','VAN','2026-11-14T11:00:00-05:00',true),
 ('2026-12-VAN-FLA',12,'2026-11-21','VAN','FLA','2026-11-21T11:00:00-05:00',true),
 ('2026-12-UK-MIZ',12,'2026-11-21','UK','MIZ','2026-11-21T11:00:00-05:00',true),
 ('2026-12-TAMU-OU',12,'2026-11-21','TAMU','OU','2026-11-21T11:00:00-05:00',true),
 ('2026-12-UGA-SC',12,'2026-11-21','UGA','SC','2026-11-21T11:00:00-05:00',true),
 ('2026-12-LSU-TENN',12,'2026-11-21','LSU','TENN','2026-11-21T11:00:00-05:00',true),
 ('2026-12-ARK-TEX',12,'2026-11-21','ARK','TEX','2026-11-21T11:00:00-05:00',true),
 ('2026-12-CHATT-ALA',12,'2026-11-21','CHATT','ALA','2026-11-21T11:00:00-05:00',true),
 ('2026-12-SAM-AUB',12,'2026-11-21','SAM','AUB','2026-11-21T11:00:00-05:00',true),
 ('2026-12-WOFF-MISS',12,'2026-11-21','WOFF','MISS','2026-11-21T11:00:00-05:00',true),
 ('2026-12-TNTECH-MSST',12,'2026-11-21','TNTECH','MSST','2026-11-21T11:00:00-05:00',true),
 ('2026-13-TEX-TAMU',13,'2026-11-27','TEX','TAMU','2026-11-27T11:00:00-05:00',true),
 ('2026-13-AUB-ALA',13,'2026-11-28','AUB','ALA','2026-11-28T11:00:00-05:00',true),
 ('2026-13-LSU-ARK',13,'2026-11-28','LSU','ARK','2026-11-28T11:00:00-05:00',true),
 ('2026-13-MSST-MISS',13,'2026-11-28','MSST','MISS','2026-11-28T11:00:00-05:00',true),
 ('2026-13-OU-MIZ',13,'2026-11-28','OU','MIZ','2026-11-28T11:00:00-05:00',true),
 ('2026-13-TENN-VAN',13,'2026-11-28','TENN','VAN','2026-11-28T11:00:00-05:00',true),
 ('2026-13-FLA-FSU',13,'2026-11-28','FLA','FSU','2026-11-28T11:00:00-05:00',true),
 ('2026-13-GATECH-UGA',13,'2026-11-28','GATECH','UGA','2026-11-28T11:00:00-05:00',true),
 ('2026-13-LOU-UK',13,'2026-11-28','LOU','UK','2026-11-28T11:00:00-05:00',true),
 ('2026-13-SC-CLEM',13,'2026-11-28','SC','CLEM','2026-11-28T11:00:00-05:00',true)
on conflict(id) do update set
 week=excluded.week,game_date=excluded.game_date,away_code=excluded.away_code,home_code=excluded.home_code,
 kickoff_at=excluded.kickoff_at,provisional=excluded.provisional;
-- Correct winners only from SQL Editor / trusted server role:
-- update public.sec_games set winner='UGA' where id='2026-6-UGA-ALA';
