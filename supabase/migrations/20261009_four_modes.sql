-- Saturdays Down South: run AFTER supabase/setup.sql on a new SEC project.
-- Non-destructive upgrade for four game modes, friends picks, automatic score data and tiebreakers.
-- Production database already has these schema changes; this file is for reproducible installs.
alter table public.sec_leagues add column if not exists mode text not null default 'straight';
alter table public.sec_leagues drop constraint if exists sec_leagues_mode_valid;
alter table public.sec_leagues add constraint sec_leagues_mode_valid check (mode in ('straight','confidence','spread','h2h'));
alter table public.sec_games add column if not exists away_score integer;
alter table public.sec_games add column if not exists home_score integer;
alter table public.sec_games add column if not exists game_status text not null default 'scheduled';
alter table public.sec_games add column if not exists status_detail text;
alter table public.sec_games add column if not exists spread_home numeric(5,1);
alter table public.sec_games add column if not exists spread_source text;
alter table public.sec_games add column if not exists espn_event_id text;
alter table public.sec_games add column if not exists score_updated_at timestamptz;
alter table public.sec_games drop constraint if exists sec_game_status_valid;
alter table public.sec_games add constraint sec_game_status_valid check(game_status in ('scheduled','live','final','postponed','canceled'));
create unique index if not exists sec_games_espn_event on public.sec_games(espn_event_id) where espn_event_id is not null;
create table if not exists public.sec_league_picks(
 league_id uuid not null references public.sec_leagues(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 game_id text not null references public.sec_games(id) on delete cascade,
 pick_code text not null,
 confidence_points integer,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(league_id,user_id,game_id)
);
create index if not exists sec_league_picks_by_game on public.sec_league_picks(league_id,game_id);
alter table public.sec_league_picks enable row level security;
revoke all on public.sec_league_picks from anon,authenticated;
grant select,insert,update on public.sec_league_picks to authenticated;
drop policy if exists sec_league_picks_select on public.sec_league_picks;
create policy sec_league_picks_select on public.sec_league_picks for select to authenticated using (
 public.sec_is_member(league_id) and
 (user_id=(select auth.uid()) or exists(
  select 1 from public.sec_games g where g.id=game_id and clock_timestamp()>=g.kickoff_at
 ))
);
drop policy if exists sec_league_picks_insert on public.sec_league_picks;
create policy sec_league_picks_insert on public.sec_league_picks for insert to authenticated with check (
 user_id=(select auth.uid()) and public.sec_is_member(league_id) and
 exists(select 1 from public.sec_games g where g.id=game_id and clock_timestamp()<g.kickoff_at
    and pick_code in(g.away_code,g.home_code))
);
drop policy if exists sec_league_picks_update on public.sec_league_picks;
create policy sec_league_picks_update on public.sec_league_picks for update to authenticated
 using (user_id=(select auth.uid()) and public.sec_is_member(league_id)
    and exists(select 1 from public.sec_games g where g.id=game_id and clock_timestamp()<g.kickoff_at))
 with check (user_id=(select auth.uid()) and public.sec_is_member(league_id)
    and exists(select 1 from public.sec_games g where g.id=game_id and clock_timestamp()<g.kickoff_at
       and pick_code in(g.away_code,g.home_code)));
-- Copy previously saved straight picks; do not delete or overwrite legacy data.
insert into public.sec_league_picks(league_id,user_id,game_id,pick_code)
select m.league_id,p.user_id,p.game_id,p.pick_code
from public.sec_members m join public.sec_leagues l on l.id=m.league_id
join public.sec_picks p on p.user_id=m.user_id where l.mode='straight'
on conflict(league_id,user_id,game_id) do nothing;
create table if not exists public.sec_week_tiebreakers(
 league_id uuid not null references public.sec_leagues(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 week integer not null check(week between 1 and 20),
 game_id text not null references public.sec_games(id),
 predicted_total integer not null check(predicted_total between 0 and 200),
 updated_at timestamptz not null default now(),
 primary key(league_id,user_id,week)
);
alter table public.sec_week_tiebreakers enable row level security;
revoke all on public.sec_week_tiebreakers from anon,authenticated;
grant select,insert,update on public.sec_week_tiebreakers to authenticated;
drop policy if exists sec_tiebreaker_select on public.sec_week_tiebreakers;
create policy sec_tiebreaker_select on public.sec_week_tiebreakers for select to authenticated using (
 public.sec_is_member(league_id) and
 (user_id=(select auth.uid()) or exists(select 1 from public.sec_games g
    where g.id=game_id and clock_timestamp()>=g.kickoff_at))
);
drop policy if exists sec_tiebreaker_insert on public.sec_week_tiebreakers;
create policy sec_tiebreaker_insert on public.sec_week_tiebreakers for insert to authenticated with check(
 user_id=(select auth.uid()) and public.sec_is_member(league_id) and
 exists(select 1 from public.sec_games g where g.id=game_id and g.week=week
    and clock_timestamp()<g.kickoff_at)
);
drop policy if exists sec_tiebreaker_update on public.sec_week_tiebreakers;
create policy sec_tiebreaker_update on public.sec_week_tiebreakers for update to authenticated
 using(user_id=(select auth.uid()) and public.sec_is_member(league_id) and
   exists(select 1 from public.sec_games g where g.id=game_id and clock_timestamp()<g.kickoff_at))
 with check(user_id=(select auth.uid()) and public.sec_is_member(league_id) and
   exists(select 1 from public.sec_games g where g.id=game_id and g.week=week and clock_timestamp()<g.kickoff_at));

-- sec_guard_league_pick
CREATE OR REPLACE FUNCTION public.sec_guard_league_pick()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare g record; v_mode text; maximum int;
begin
 select g0.week,g0.kickoff_at,g0.away_code,g0.home_code,g0.spread_home
 into g from public.sec_games g0 where g0.id=new.game_id;
 if not found or clock_timestamp()>=g.kickoff_at or new.pick_code not in(g.away_code,g.home_code) then
  raise exception 'This matchup is locked or the pick is invalid';
 end if;
 select l.mode into v_mode from public.sec_leagues l where l.id=new.league_id;
 if v_mode is null or not public.sec_is_member(new.league_id) or new.user_id<>(select auth.uid()) then
  raise exception 'Join this league before making picks';
 end if;
 if v_mode='spread' and g.spread_home is null then
  raise exception 'Verified point spread unavailable for this game';
 end if;
 if v_mode='confidence' then
  select count(*)::int into maximum from public.sec_games g0 where g0.week=g.week;
  if new.confidence_points is null or new.confidence_points not between 1 and maximum then
   raise exception 'Select confidence points between 1 and %',maximum;
  end if;
  if exists(select 1 from public.sec_league_picks lp
     join public.sec_games gg on gg.id=lp.game_id
     where lp.league_id=new.league_id and lp.user_id=new.user_id
       and gg.week=g.week and lp.game_id<>new.game_id
       and lp.confidence_points=new.confidence_points)
  then raise exception 'Each confidence value can only be used once per week'; end if;
 else new.confidence_points:=null; end if;
 new.updated_at:=clock_timestamp();
 return new;
end $function$;

-- sec_create_league_mode
CREATE OR REPLACE FUNCTION public.sec_create_league_mode(p_name text, p_mode text)
 RETURNS TABLE(league_id uuid, code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare new_id uuid; invite text;
begin
 if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 50 then raise exception 'League name must be 2-50 characters'; end if;
 if p_mode not in('straight','confidence','spread','h2h') then raise exception 'Invalid game mode'; end if;
 insert into public.sec_leagues(owner_id,name,mode) values((select auth.uid()),trim(p_name),p_mode)
 returning id,invite_code into new_id,invite;
 insert into public.sec_members(league_id,user_id) values(new_id,(select auth.uid()));
 return query select new_id,invite;
end $function$;

-- sec_save_league_pick
CREATE OR REPLACE FUNCTION public.sec_save_league_pick(p_league uuid, p_game text, p_pick text, p_confidence integer DEFAULT NULL::integer)
 RETURNS sec_league_picks
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare me uuid; g record; v_mode text; maximum int; selected_points int; prior_points int; existing text; saved public.sec_league_picks;
begin
 me:=(select auth.uid());
 if me is null or not public.sec_is_member(p_league) then raise exception 'Join the league first'; end if;
 select week,kickoff_at,away_code,home_code,spread_home into g from public.sec_games where id=p_game;
 if not found or clock_timestamp()>=g.kickoff_at or p_pick not in (g.away_code,g.home_code)
 then raise exception 'This matchup has locked'; end if;
 select l.mode into v_mode from public.sec_leagues l where l.id=p_league;
 if v_mode='spread' and g.spread_home is null then raise exception 'No verified point spread published for this matchup'; end if;
 if v_mode='confidence' then
  perform pg_advisory_xact_lock(hashtextextended(me::text||p_league::text||g.week::text,0));
  select count(*)::int into maximum from public.sec_games where week=g.week;
  select confidence_points into prior_points from public.sec_league_picks
   where league_id=p_league and user_id=me and game_id=p_game;
  selected_points:=coalesce(p_confidence,prior_points);
  if selected_points is null then
    select n into selected_points from generate_series(maximum,1,-1) n
     where not exists(select 1 from public.sec_league_picks lp join public.sec_games gg on gg.id=lp.game_id
      where lp.league_id=p_league and lp.user_id=me and gg.week=g.week and lp.confidence_points=n) limit 1;
  end if;
  if selected_points is null or selected_points not between 1 and maximum then
    raise exception 'Choose an available confidence value from 1 to %',maximum;
  end if;
  select lp.game_id into existing from public.sec_league_picks lp join public.sec_games gg on gg.id=lp.game_id
   where lp.league_id=p_league and lp.user_id=me and gg.week=g.week
     and lp.confidence_points=selected_points and lp.game_id<>p_game;
  if existing is not null then raise exception 'Confidence value % is already used; choose a different number',selected_points; end if;
 else selected_points:=null; end if;
 insert into public.sec_league_picks(league_id,user_id,game_id,pick_code,confidence_points)
 values(p_league,me,p_game,p_pick,selected_points)
 on conflict(league_id,user_id,game_id) do update
 set pick_code=excluded.pick_code,confidence_points=excluded.confidence_points
 returning * into saved;
 return saved;
end $function$;

-- sec_league_standings_v2
CREATE OR REPLACE FUNCTION public.sec_league_standings_v2(p_league uuid, p_week integer)
 RETURNS TABLE(user_id uuid, display_name text, picked bigint, week_points numeric, season_points numeric, correct_picks bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_mode text;
begin
 if (select auth.uid()) is null or not exists(
    select 1 from public.sec_members m where m.league_id=p_league and m.user_id=(select auth.uid())
 ) then raise exception 'Join the league first'; end if;
 select l.mode into v_mode from public.sec_leagues l where l.id=p_league;
 return query
 with results as (
  select pick.user_id,g.week,
   case when g.game_status='final' and g.winner=pick.pick_code then 1 else 0 end as correct,
   case
    when g.game_status<>'final' then 0::numeric
    when v_mode='spread' then
      case when g.spread_home is null or g.home_score is null or g.away_score is null then 0::numeric
           when (g.home_score-g.away_score+g.spread_home)=0 then 0.5::numeric
           when ((g.home_score-g.away_score+g.spread_home)>0 and pick.pick_code=g.home_code)
             or ((g.home_score-g.away_score+g.spread_home)<0 and pick.pick_code=g.away_code)
           then 1::numeric else 0::numeric end
    when g.winner=pick.pick_code then
      (case when v_mode='confidence' then coalesce(pick.confidence_points,0) else 1 end)::numeric
    else 0::numeric end as points
  from public.sec_league_picks pick join public.sec_games g on g.id=pick.game_id
  where pick.league_id=p_league
 )
 select m.user_id,coalesce(profile.display_name,'Player')::text,
  (select count(*) from results r where r.user_id=m.user_id and r.week=p_week),
  coalesce((select sum(r.points) from results r where r.user_id=m.user_id and r.week=p_week),0)::numeric,
  coalesce((select sum(r.points) from results r where r.user_id=m.user_id),0)::numeric,
  (select count(*) from results r where r.user_id=m.user_id and r.correct=1)
 from public.sec_members m left join public.sec_profiles profile on profile.user_id=m.user_id
 where m.league_id=p_league
 order by 4 desc,5 desc,2;
end $function$;

-- sec_revealed_league_picks
CREATE OR REPLACE FUNCTION public.sec_revealed_league_picks(p_league uuid, p_week integer)
 RETURNS TABLE(game_id text, user_id uuid, display_name text, pick_code text, confidence_points integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.sec_members m
    where m.league_id=p_league and m.user_id=(select auth.uid()))
 then raise exception 'Join this league first'; end if;
 return query
 select p.game_id,p.user_id,coalesce(prof.display_name,'Player')::text,p.pick_code,
        case when (select mode from public.sec_leagues where id=p_league)='confidence'
           then p.confidence_points else null::int end
 from public.sec_league_picks p
 join public.sec_games g on g.id=p.game_id
 left join public.sec_profiles prof on prof.user_id=p.user_id
 where p.league_id=p_league and g.week=p_week and clock_timestamp()>=g.kickoff_at;
end $function$;

-- sec_guard_tiebreaker
CREATE OR REPLACE FUNCTION public.sec_guard_tiebreaker()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare g record;
begin
 select week,kickoff_at into g from public.sec_games where id=new.game_id;
 if not found or new.week<>g.week or clock_timestamp()>=g.kickoff_at then
  raise exception 'The tiebreaker is locked or game does not match week';
 end if;
 new.updated_at=clock_timestamp();
 return new;
end $function$;

-- sec_h2h_history
CREATE OR REPLACE FUNCTION public.sec_h2h_history(p_league uuid)
 RETURNS TABLE(week integer, player_id uuid, opponent_id uuid, player_points numeric, opponent_points numeric, result text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.sec_members m where m.league_id=p_league and m.user_id=(select auth.uid())
 ) then raise exception 'Join the league first'; end if;
 if (select l.mode from public.sec_leagues l where l.id=p_league)<>'h2h' then
  raise exception 'Head-to-head records require a head-to-head league';
 end if;
 return query
 with ordered as(
   select m.user_id,row_number() over(order by m.joined_at,m.user_id)-1 as idx,
          count(*) over() as n
   from public.sec_members m where m.league_id=p_league
 ),weeks as(
  select distinct g.week from public.sec_games g
 ),slots as (
  select w.week,o.user_id,o.n,((o.idx+w.week-1)%o.n) as slot
  from ordered o cross join weeks w
 ),pairings as (
  select a.week,a.user_id as player,b.user_id as rival
  from slots a left join slots b on b.week=a.week and b.slot=(
   case when a.slot%2=0 then a.slot+1 else a.slot-1 end)
 ),scores as (
   select w.week,s.user_id,s.week_points
   from weeks w cross join lateral public.sec_league_standings_v2(p_league,w.week) s
 ),complete as(
  select g.week,bool_and(g.game_status in('final','canceled')) as done
  from public.sec_games g group by g.week
 )
 select p.week,p.player,p.rival,
        coalesce(me.week_points,0)::numeric,
        coalesce(them.week_points,0)::numeric,
        (case
         when p.rival is null then 'bye'
         when c.done is not true then 'pending'
         when me.week_points>them.week_points then 'win'
         when me.week_points<them.week_points then 'loss'
         else 'tie' end)::text
 from pairings p
 left join scores me on me.week=p.week and me.user_id=p.player
 left join scores them on them.week=p.week and them.user_id=p.rival
 left join complete c on c.week=p.week
 order by p.week,p.player;
end $function$;

-- sec_league_standings_v3
CREATE OR REPLACE FUNCTION public.sec_league_standings_v3(p_league uuid, p_week integer)
 RETURNS TABLE(user_id uuid, display_name text, picked bigint, week_points numeric, season_points numeric, correct_picks bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select s.user_id,s.display_name,s.picked,s.week_points,s.season_points,s.correct_picks
from public.sec_league_standings_v2(p_league,p_week) s
left join public.sec_week_tiebreakers t
  on t.league_id=p_league and t.user_id=s.user_id and t.week=p_week
left join public.sec_games g on g.id=t.game_id
order by s.week_points desc,
  (case when g.game_status='final' and g.away_score is not null and g.home_score is not null
        then abs(t.predicted_total-g.away_score-g.home_score) end) asc nulls last,
  s.season_points desc, s.display_name asc
$function$;

-- sec_remove_league_member
CREATE OR REPLACE FUNCTION public.sec_remove_league_member(p_league uuid, p_member uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not exists(select 1 from public.sec_leagues l where l.id=p_league and l.owner_id=(select auth.uid())) then
  raise exception 'Only the league creator can remove players';
 end if;
 if p_member=(select auth.uid()) then raise exception 'You cannot remove the league creator'; end if;
 delete from public.sec_members where league_id=p_league and user_id=p_member;
 return found;
end $function$;

drop trigger if exists sec_guard_league_pick_trigger on public.sec_league_picks;
create trigger sec_guard_league_pick_trigger before insert or update on public.sec_league_picks
for each row execute function public.sec_guard_league_pick();
drop trigger if exists sec_guard_tiebreaker_trigger on public.sec_week_tiebreakers;
create trigger sec_guard_tiebreaker_trigger before insert or update on public.sec_week_tiebreakers
for each row execute function public.sec_guard_tiebreaker();
revoke all on function public.sec_create_league_mode(text,text),
  public.sec_save_league_pick(uuid,text,text,integer),
  public.sec_league_standings_v2(uuid,integer),
  public.sec_league_standings_v3(uuid,integer),
  public.sec_revealed_league_picks(uuid,integer),
  public.sec_h2h_history(uuid),
  public.sec_remove_league_member(uuid,uuid) from public,anon;
grant execute on function public.sec_create_league_mode(text,text),
  public.sec_save_league_pick(uuid,text,text,integer),
  public.sec_league_standings_v2(uuid,integer),
  public.sec_league_standings_v3(uuid,integer),
  public.sec_revealed_league_picks(uuid,integer),
  public.sec_h2h_history(uuid),
  public.sec_remove_league_member(uuid,uuid) to authenticated;
-- For scheduled ESPN score refresh, see ../enable-score-automation.sql.
