-- Separate competition engine for SEC men's college basketball and college baseball.
-- Additive only. Does not alter ANY football games, leagues, picks or scoring functions.
create table if not exists public.sec_sport_games(
 id text primary key,
 sport text not null check(sport in ('basketball','baseball')),
 season integer not null check(season between 2025 and 2100),
 week integer not null check(week between 1 and 60),
 espn_event_id text not null,
 kickoff_at timestamptz not null,
 away_code text not null,away_name text not null,
 home_code text not null,home_name text not null,
 away_score integer check(away_score>=0),
 home_score integer check(home_score>=0),
 winner_code text,
 spread_home numeric(6,1),
 game_status text not null default 'scheduled' check(game_status in ('scheduled','live','final','postponed','canceled')),
 source text not null default 'ESPN',updated_at timestamptz not null default now(),
 constraint sec_sport_winner_valid check(winner_code is null or winner_code in (away_code,home_code)),
 constraint sec_sport_distinct_teams check(away_code<>home_code),
 unique(sport,season,espn_event_id)
);
create index if not exists sec_sport_games_schedule on public.sec_sport_games(sport,season,kickoff_at);
create index if not exists sec_sport_games_week on public.sec_sport_games(sport,season,week);
alter table public.sec_sport_games enable row level security;
revoke all on public.sec_sport_games from public,anon,authenticated;
grant select on public.sec_sport_games to anon,authenticated;
create policy sec_sport_games_read on public.sec_sport_games for select to anon,authenticated using(true);

create table if not exists public.sec_sport_leagues(
 id uuid primary key default gen_random_uuid(),
 sport text not null check(sport in('basketball','baseball')),
 season integer not null check(season between 2025 and 2100),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 2 and 70),
 mode text not null default 'straight' check(mode in('straight','confidence','spread','h2h')),
 invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
 created_at timestamptz not null default now()
);
create index if not exists sec_sport_leagues_owner on public.sec_sport_leagues(owner_id,sport,season);
create table if not exists public.sec_sport_members(
 league_id uuid not null references public.sec_sport_leagues(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(league_id,user_id)
);
create index if not exists sec_sport_members_user on public.sec_sport_members(user_id,league_id);
alter table public.sec_sport_leagues enable row level security;
alter table public.sec_sport_members enable row level security;
revoke all on public.sec_sport_leagues,public.sec_sport_members from public,anon,authenticated;
grant select on public.sec_sport_leagues,public.sec_sport_members to authenticated;

create or replace function public.sec_sport_is_member(p_league uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists
 (select 1 from public.sec_sport_members m
  where m.league_id=p_league and m.user_id=(select auth.uid()));
$$;
revoke all on function public.sec_sport_is_member(uuid) from public,anon;
grant execute on function public.sec_sport_is_member(uuid) to authenticated;
create policy sec_sport_leagues_member_read on public.sec_sport_leagues for select to authenticated
 using(public.sec_sport_is_member(id));
create policy sec_sport_members_member_read on public.sec_sport_members for select to authenticated
 using(public.sec_sport_is_member(league_id));

create table if not exists public.sec_sport_picks(
 league_id uuid not null references public.sec_sport_leagues(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 game_id text not null references public.sec_sport_games(id) on delete cascade,
 pick_code text not null,
 confidence_points integer,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(league_id,user_id,game_id)
);
create index if not exists sec_sport_picks_by_game on public.sec_sport_picks(league_id,game_id);
alter table public.sec_sport_picks enable row level security;
revoke all on public.sec_sport_picks from public,anon,authenticated;
grant select on public.sec_sport_picks to authenticated;
create policy sec_sport_picks_self on public.sec_sport_picks for select to authenticated
 using(user_id=(select auth.uid()) and public.sec_sport_is_member(league_id));

create table if not exists public.sec_sport_tiebreakers(
 league_id uuid not null references public.sec_sport_leagues(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 game_id text not null references public.sec_sport_games(id),
 week integer not null,
 predicted_total integer not null check(predicted_total between 0 and 300),
 updated_at timestamptz not null default now(),
 primary key(league_id,user_id,week)
);
alter table public.sec_sport_tiebreakers enable row level security;
revoke all on public.sec_sport_tiebreakers from public,anon,authenticated;
grant select on public.sec_sport_tiebreakers to authenticated;
create policy sec_sport_tiebreakers_self on public.sec_sport_tiebreakers for select to authenticated
 using(user_id=(select auth.uid()) and public.sec_sport_is_member(league_id));

-- Only the backend ESPN fetcher may change these rows; never accept schedules from browsers.
create table if not exists public.sec_sport_sync_state(
 sport text primary key check(sport in('basketball','baseball')),
 last_checked_at timestamptz,
 last_success_at timestamptz,
 imported integer not null default 0
);
alter table public.sec_sport_sync_state enable row level security;
revoke all on public.sec_sport_sync_state from public,anon,authenticated;

create or replace function public.sec_sport_create_league(p_sport text,p_season integer,p_name text,p_mode text default 'straight')
returns table(league_id uuid,invite_code text)
language plpgsql security definer set search_path='' as $$
declare owner uuid:=(select auth.uid());new_id uuid;new_code text;
begin
 if owner is null then raise exception 'Sign in before creating a league';end if;
 if p_sport not in('basketball','baseball') or p_season not between 2025 and 2100 then raise exception 'Invalid sport or season';end if;
 if char_length(btrim(coalesce(p_name,''))) not between 2 and 70 then raise exception 'League name must contain 2–70 characters';end if;
 if p_mode not in('straight','confidence','spread','h2h') then raise exception 'Invalid game mode';end if;
 insert into public.sec_sport_leagues(sport,season,owner_id,name,mode)
 values(p_sport,p_season,owner,btrim(p_name),p_mode)
 returning id,public.sec_sport_leagues.invite_code into new_id,new_code;
 insert into public.sec_sport_members(league_id,user_id) values(new_id,owner);
 return query select new_id,new_code;
end;$$;
create or replace function public.sec_sport_join_league(p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());chosen uuid;
begin
 if me is null then raise exception 'Sign in before joining a league';end if;
 select l.id into chosen from public.sec_sport_leagues l where l.invite_code=upper(btrim(coalesce(p_code,'')));
 if chosen is null then raise exception 'Invite code not found';end if;
 insert into public.sec_sport_members(league_id,user_id) values(chosen,me) on conflict do nothing;
 return chosen;
end;$$;
create or replace function public.sec_sport_save_pick(p_league uuid,p_game text,p_pick text,p_confidence integer default null)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());l record;g record;maxpoints integer;
begin
 if me is null or not public.sec_sport_is_member(p_league) then raise exception 'Not a member of this league';end if;
 select sport,season,mode into l from public.sec_sport_leagues where id=p_league;
 select * into g from public.sec_sport_games where id=p_game;
 if not found or g.sport<>l.sport or g.season<>l.season then raise exception 'Game is not in this league sport and season';end if;
 if clock_timestamp()>=g.kickoff_at or g.game_status<>'scheduled' then raise exception 'Picks are locked for this matchup';end if;
 if p_pick not in(g.away_code,g.home_code) then raise exception 'Choose one of the two teams';end if;
 if l.mode='spread' and g.spread_home is null then raise exception 'No verified spread available; wait for a published line';end if;
 if l.mode='confidence' then
  select count(*) into maxpoints from public.sec_sport_games
   where sport=l.sport and season=l.season and week=g.week and game_status<>'canceled';
  if p_confidence is null or p_confidence<1 or p_confidence>maxpoints then raise exception 'Invalid weekly confidence value';end if;
  if exists(select 1 from public.sec_sport_picks p join public.sec_sport_games x on x.id=p.game_id
   where p.league_id=p_league and p.user_id=me and x.week=g.week
   and p.confidence_points=p_confidence and p.game_id<>p_game) then raise exception 'Confidence values must be unique within the week';end if;
 else
  p_confidence:=null;
 end if;
 insert into public.sec_sport_picks(league_id,user_id,game_id,pick_code,confidence_points)
 values(p_league,me,p_game,p_pick,p_confidence)
 on conflict(league_id,user_id,game_id) do update
 set pick_code=excluded.pick_code,confidence_points=excluded.confidence_points,updated_at=now();
end;$$;
create or replace function public.sec_sport_save_tiebreaker(p_league uuid,p_game text,p_total integer)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());l record;g record;
begin
 if me is null or not public.sec_sport_is_member(p_league) then raise exception 'Not a member';end if;
 select sport,season into l from public.sec_sport_leagues where id=p_league;
 select * into g from public.sec_sport_games where id=p_game;
 if not found or g.sport<>l.sport or g.season<>l.season then raise exception 'Wrong league season';end if;
 if clock_timestamp()>=g.kickoff_at or g.game_status<>'scheduled' then raise exception 'This tiebreaker is locked';end if;
 if p_total not between 0 and (case when l.sport='baseball' then 80 else 300 end) then raise exception 'Invalid combined score prediction';end if;
 if exists(select 1 from public.sec_sport_games other
   where other.sport=l.sport and other.season=l.season and other.week=g.week and other.kickoff_at>g.kickoff_at)
   then raise exception 'Predict the last scheduled game of the week';end if;
 insert into public.sec_sport_tiebreakers(league_id,user_id,game_id,week,predicted_total)
 values(p_league,me,p_game,g.week,p_total)
 on conflict(league_id,user_id,week) do update
 set game_id=excluded.game_id,predicted_total=excluded.predicted_total,updated_at=now();
end;$$;

-- Scoring uses only verified final scores. Spread mode requires a published spread;
-- H2H is separately calculated from week-vs-week player pairings.
create or replace function public.sec_sport_standings(p_league uuid,p_week integer)
returns table(user_id uuid,display_name text,picked bigint,week_points numeric,season_points numeric,correct_picks bigint)
language plpgsql stable security definer set search_path='' as $$
declare l record;
begin
 if (select auth.uid()) is null or not public.sec_sport_is_member(p_league) then raise exception 'League member access required';end if;
 select sport,season,mode into l from public.sec_sport_leagues where id=p_league;
 return query with picks as(
  select p.user_id,p.game_id,g.week,g.game_status,g.winner_code,p.pick_code,p.confidence_points,
   case when g.game_status='final' and g.winner_code is not null then
    (case when l.mode='spread' and g.spread_home is not null and g.home_score is not null and g.away_score is not null
     then ((g.home_score-g.away_score+g.spread_home)>0 and p.pick_code=g.home_code)
       or ((g.home_score-g.away_score+g.spread_home)<0 and p.pick_code=g.away_code)
     else g.winner_code=p.pick_code end)
    else false end as correct
  from public.sec_sport_picks p join public.sec_sport_games g on g.id=p.game_id
  where p.league_id=p_league and g.sport=l.sport and g.season=l.season
 ),points as(
  select p.user_id,count(*) filter(where p.week=p_week) as picked,
   coalesce(sum(case when p.week=p_week and p.correct then case when l.mode='confidence' then p.confidence_points else 1 end else 0 end),0)::numeric as weekly,
   coalesce(sum(case when p.correct then case when l.mode='confidence' then p.confidence_points else 1 end else 0 end),0)::numeric as seasonal,
   count(*) filter(where p.correct) as correct
  from picks p group by p.user_id
 )
 select m.user_id,coalesce(prof.display_name,'Player')::text,
  coalesce(p.picked,0)::bigint,coalesce(p.weekly,0)::numeric,
  coalesce(p.seasonal,0)::numeric,coalesce(p.correct,0)::bigint
 from public.sec_sport_members m
 left join points p on p.user_id=m.user_id
 left join public.sec_profiles prof on prof.user_id=m.user_id
 where m.league_id=p_league
 order by coalesce(p.seasonal,0) desc,coalesce(p.weekly,0) desc,coalesce(prof.display_name,'Player') asc;
end;$$;

-- Pair players deterministically each week. Byes are explicit; H2H season W-L-T
-- can be calculated with this RPC without revealing picks before kickoff.
create or replace function public.sec_sport_h2h_week(p_league uuid,p_week integer)
returns table(a_user uuid,a_name text,b_user uuid,b_name text,a_points numeric,b_points numeric,status text)
language plpgsql stable security definer set search_path='' as $$
declare l record;
begin
 if not public.sec_sport_is_member(p_league) then raise exception 'League member access required';end if;
 select sport,season,mode into l from public.sec_sport_leagues where id=p_league;
 if l.mode<>'h2h' then raise exception 'Not a Head-to-Head league';end if;
 return query with ranked as(
 select s.user_id,s.display_name,s.week_points,
 row_number() over(order by md5(s.user_id::text||':'||p_week::text)) as rowno
 from public.sec_sport_standings(p_league,p_week) s
 )
 select a.user_id,a.display_name,b.user_id,b.display_name,
 a.week_points,b.week_points,
 case when b.user_id is null then 'bye'
      when exists(select 1 from public.sec_sport_games g where g.sport=l.sport and g.season=l.season and g.week=p_week and g.game_status<>'final' and g.game_status<>'canceled') then 'pending'
      when a.week_points>b.week_points then 'a_win'
      when a.week_points<b.week_points then 'b_win' else 'tie' end::text
 from ranked a left join ranked b on b.rowno=a.rowno+1
 where mod(a.rowno::integer,2)=1;
end;$$;

revoke all on function public.sec_sport_create_league(text,integer,text,text),
 public.sec_sport_join_league(text), public.sec_sport_save_pick(uuid,text,text,integer),
 public.sec_sport_save_tiebreaker(uuid,text,integer),
 public.sec_sport_standings(uuid,integer),public.sec_sport_h2h_week(uuid,integer) from public,anon;
grant execute on function public.sec_sport_create_league(text,integer,text,text),
 public.sec_sport_join_league(text), public.sec_sport_save_pick(uuid,text,text,integer),
 public.sec_sport_save_tiebreaker(uuid,text,integer),
 public.sec_sport_standings(uuid,integer),public.sec_sport_h2h_week(uuid,integer) to authenticated;
