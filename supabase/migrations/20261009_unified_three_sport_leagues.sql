-- Unified fan league (additive; does not migrate or delete any existing leagues/picks).
-- One invite securely enrolls the SAME auth user in three independent straight-pick leagues.
-- Composite season standings are computed server-side from verified scored picks.
create table if not exists public.sec_clubs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 2 and 50),
 invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
 football_league uuid not null unique references public.sec_leagues(id) on delete restrict,
 basketball_league uuid not null unique references public.sec_sport_leagues(id) on delete restrict,
 baseball_league uuid not null unique references public.sec_sport_leagues(id) on delete restrict,
 football_season integer not null,
 basketball_season integer not null,
 baseball_season integer not null,
 created_at timestamptz not null default now()
);
create table if not exists public.sec_club_members (
 club_id uuid not null references public.sec_clubs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(club_id,user_id)
);
create index if not exists sec_club_members_user on public.sec_club_members(user_id,club_id);
alter table public.sec_clubs enable row level security;
alter table public.sec_club_members enable row level security;
revoke all on public.sec_clubs,public.sec_club_members from public,anon,authenticated;
grant select on public.sec_clubs,public.sec_club_members to authenticated;

create or replace function public.sec_club_is_member(p_club uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.sec_club_members m
 where m.club_id=p_club and m.user_id=auth.uid());
$$;
revoke all on function public.sec_club_is_member(uuid) from public,anon;
grant execute on function public.sec_club_is_member(uuid) to authenticated;
create policy sec_clubs_member_select on public.sec_clubs for select to authenticated
 using(public.sec_club_is_member(id));
create policy sec_club_members_member_select on public.sec_club_members for select to authenticated
 using(public.sec_club_is_member(club_id));

create or replace function public.sec_club_create(p_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 me uuid:=auth.uid(); yy integer:=extract(year from now())::integer;
 mm integer:=extract(month from now())::integer;
 fb uuid; bb uuid; bs uuid; club uuid;
 sport_year integer;
begin
 if me is null then raise exception 'Sign in to start a three-sport league'; end if;
 if char_length(btrim(coalesce(p_name,''))) not between 2 and 50 then
  raise exception 'League name must have 2–50 characters';end if;
 -- Football plays autumn; basketball/baseball use spring-ending season label.
 sport_year:=yy+(case when mm>=8 then 1 else 0 end);
 select league_id into fb from public.sec_create_league_mode(btrim(p_name),'straight') limit 1;
 select league_id into bb from public.sec_sport_create_league('basketball',sport_year,btrim(p_name),'straight') limit 1;
 select league_id into bs from public.sec_sport_create_league('baseball',sport_year,btrim(p_name),'straight') limit 1;
 insert into public.sec_clubs(owner_id,name,football_league,basketball_league,baseball_league,
 football_season,basketball_season,baseball_season)
 values(me,btrim(p_name),fb,bb,bs,case when mm>=8 then yy else yy-1 end,
 sport_year,sport_year) returning id into club;
 insert into public.sec_club_members(club_id,user_id) values(club,me);
 return club;
end;$$;

create or replace function public.sec_club_join(p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); club record; fcode text; bbcode text; bscode text;
begin
 if me is null then raise exception 'Log in to join your friends';end if;
 if p_code is null or p_code !~ '^[A-Za-z0-9]{10}$' then raise exception 'Invalid invite code';end if;
 select * into club from public.sec_clubs where invite_code=upper(btrim(p_code));
 if not found then raise exception 'Three-sport invite was not found';end if;
 select invite_code into fcode from public.sec_leagues where id=club.football_league;
 select invite_code into bbcode from public.sec_sport_leagues where id=club.basketball_league;
 select invite_code into bscode from public.sec_sport_leagues where id=club.baseball_league;
 if fcode is null or bbcode is null or bscode is null then raise exception 'League configuration is unavailable';end if;
 -- All mutations run in the same transaction: never leave partial sport membership.
 perform public.sec_join_league(fcode);
 perform public.sec_sport_join_league(bbcode);
 perform public.sec_sport_join_league(bscode);
 insert into public.sec_club_members(club_id,user_id) values(club.id,me) on conflict do nothing;
 return club.id;
end;$$;

create or replace function public.sec_club_standings(p_club uuid)
returns table(user_id uuid,display_name text,football numeric,basketball numeric,baseball numeric,
 total numeric,football_correct bigint,basketball_correct bigint,baseball_correct bigint)
language plpgsql stable security definer set search_path='' as $$
declare c record;
begin
 if not public.sec_club_is_member(p_club) then raise exception 'League members only';end if;
 select * into c from public.sec_clubs where id=p_club;
 return query
 with f as (
  select s.user_id,s.season_points,s.correct_picks from public.sec_league_standings_v3(c.football_league,1) s
 ),b as(
  select s.user_id,s.season_points,s.correct_picks from public.sec_sport_standings(c.basketball_league,1) s
 ),bs as(
  select s.user_id,s.season_points,s.correct_picks from public.sec_sport_standings(c.baseball_league,1) s
 )
 select m.user_id,coalesce(p.display_name,'Player')::text,
  coalesce(f.season_points,0)::numeric,coalesce(b.season_points,0)::numeric,coalesce(bs.season_points,0)::numeric,
  (coalesce(f.season_points,0)+coalesce(b.season_points,0)+coalesce(bs.season_points,0))::numeric,
  coalesce(f.correct_picks,0)::bigint,coalesce(b.correct_picks,0)::bigint,coalesce(bs.correct_picks,0)::bigint
 from public.sec_club_members m
 left join public.sec_profiles p on p.user_id=m.user_id
 left join f on f.user_id=m.user_id left join b on b.user_id=m.user_id left join bs on bs.user_id=m.user_id
 where m.club_id=p_club
 order by 6 desc,2 asc;
end;$$;
revoke all on function public.sec_club_create(text),public.sec_club_join(text),
 public.sec_club_standings(uuid) from public,anon;
grant execute on function public.sec_club_create(text),public.sec_club_join(text),
 public.sec_club_standings(uuid) to authenticated;
