-- Weekly SEC Pick'em power rankings: no client-accessible pick data or invented scores.
-- The same verified scoring modes as existing game standings are used.
-- Weekly windows run Monday 00:00 America/Chicago through the current time.
-- Rank movement compares current season totals to season totals at this Monday's start.
create or replace function public.sec_weekly_power_rankings(p_kind text,p_league uuid)
returns table (
 user_id uuid,
 display_name text,
 current_rank bigint,
 previous_rank bigint,
 season_points numeric,
 weekly_points numeric,
 weekly_correct bigint,
 weekly_graded bigint,
 season_graded bigint,
 week_start date
) language plpgsql stable security definer set search_path='' as $$
declare
 v_start timestamptz := date_trunc('week', now() at time zone 'America/Chicago')
                              at time zone 'America/Chicago';
 v_scope record;
begin
 if (select auth.uid()) is null then raise exception 'Log in to view league rankings';end if;
 if p_kind not in ('club','football','basketball','baseball') or p_league is null then
   raise exception 'Invalid league selection';end if;
 if (p_kind='club' and not public.sec_club_is_member(p_league))
   or (p_kind='football' and not public.sec_is_member(p_league))
   or (p_kind in ('basketball','baseball') and not public.sec_sport_is_member(p_league)) then
   raise exception 'This league is private to its members';end if;
 if p_kind='club' then
   select c.football_league as fb,c.basketball_league as bb,c.baseball_league as bs,
          c.enabled_sports as sports into v_scope
   from public.sec_clubs c where c.id=p_league;
 elsif p_kind='football' then
   select p_league as fb,null::uuid as bb,null::uuid as bs,
          array['football']::text[] as sports into v_scope;
 elsif p_kind='basketball' then
   if not exists (select 1 from public.sec_sport_leagues l where l.id=p_league and l.sport='basketball')
   then raise exception 'Basketball league not found';end if;
   select null::uuid as fb,p_league as bb,null::uuid as bs,
          array['basketball']::text[] as sports into v_scope;
 else
   if not exists (select 1 from public.sec_sport_leagues l where l.id=p_league and l.sport='baseball')
   then raise exception 'Baseball league not found';end if;
   select null::uuid as fb,null::uuid as bb,p_league as bs,
          array['baseball']::text[] as sports into v_scope;
 end if;
 return query
 with members as (
  select m.user_id,m.joined_at
  from public.sec_club_members m where p_kind='club' and m.club_id=p_league
  union all
  select m.user_id,m.joined_at
  from public.sec_members m where p_kind='football' and m.league_id=p_league
  union all
  select m.user_id,m.joined_at
  from public.sec_sport_members m where p_kind in('basketball','baseball') and m.league_id=p_league
 ),
 played as (
  select p.user_id,g.id as game_id,g.kickoff_at as played_at,
   (g.game_status='final' and g.kickoff_at<=now()
    and (case when l.mode='spread'
      then g.spread_home is not null and g.away_score is not null and g.home_score is not null
      else g.winner in(g.home_code,g.away_code) end)) as graded,
   (case when l.mode='spread' and g.spread_home is not null
      and g.away_score is not null and g.home_score is not null
     then (g.home_score-g.away_score+g.spread_home<>0
       and ((g.home_score-g.away_score+g.spread_home>0 and p.pick_code=g.home_code)
        or (g.home_score-g.away_score+g.spread_home<0 and p.pick_code=g.away_code)))
     else g.winner=p.pick_code end) as correct,
   (case when l.mode='spread' then
       case when g.spread_home is null or g.away_score is null or g.home_score is null then 0::numeric
            when g.home_score-g.away_score+g.spread_home=0 then .5::numeric
            when (g.home_score-g.away_score+g.spread_home>0 and p.pick_code=g.home_code)
              or (g.home_score-g.away_score+g.spread_home<0 and p.pick_code=g.away_code)
            then 1::numeric else 0::numeric end
     when g.winner=p.pick_code
     then case when l.mode='confidence' then coalesce(p.confidence_points,0)::numeric else 1::numeric end
     else 0::numeric end) as earned
  from public.sec_league_picks p
   join public.sec_games g on g.id=p.game_id
   join public.sec_leagues l on l.id=p.league_id
   join members m on m.user_id=p.user_id
  where 'football'=any(v_scope.sports) and p.league_id=v_scope.fb
  union all
  select p.user_id,g.id,g.kickoff_at,
   (g.game_status='final' and g.kickoff_at<=now()
     and (case when l.mode='spread' and g.spread_home is not null
       then g.home_score is not null and g.away_score is not null
       else g.winner_code in(g.home_code,g.away_code) end)),
   (case when l.mode='spread' and g.spread_home is not null
     and g.home_score is not null and g.away_score is not null
     then (g.home_score-g.away_score+g.spread_home<>0 and
       ((g.home_score-g.away_score+g.spread_home>0 and p.pick_code=g.home_code)
         or (g.home_score-g.away_score+g.spread_home<0 and p.pick_code=g.away_code)))
     else g.winner_code=p.pick_code end),
   (case when l.mode='spread' and g.spread_home is not null
     and g.home_score is not null and g.away_score is not null then
      case when g.home_score-g.away_score+g.spread_home>0 and p.pick_code=g.home_code then 1::numeric
           when g.home_score-g.away_score+g.spread_home<0 and p.pick_code=g.away_code then 1::numeric
           else 0::numeric end
     when g.winner_code=p.pick_code then
       case when l.mode='confidence' then coalesce(p.confidence_points,0)::numeric else 1::numeric end
     else 0::numeric end)
  from public.sec_sport_picks p
    join public.sec_sport_games g on g.id=p.game_id
    join public.sec_sport_leagues l on l.id=p.league_id and l.sport=g.sport and l.season=g.season
    join members m on m.user_id=p.user_id
  where (('basketball'=any(v_scope.sports) and p.league_id=v_scope.bb)
     or ('baseball'=any(v_scope.sports) and p.league_id=v_scope.bs))
 ),
 totals as (
  select m.user_id,m.joined_at,
   coalesce(sum(p.earned) filter(where p.graded),0)::numeric as season_score,
   coalesce(sum(p.earned) filter(where p.graded and p.played_at>=v_start),0)::numeric as week_score,
   count(p.game_id) filter(where p.graded and p.played_at>=v_start and p.correct)::bigint as week_hits,
   count(p.game_id) filter(where p.graded and p.played_at>=v_start)::bigint as week_games,
   count(p.game_id) filter(where p.graded)::bigint as season_games,
   coalesce(sum(p.earned) filter(where p.graded and p.played_at<v_start),0)::numeric as earlier_score
  from members m left join played p on p.user_id=m.user_id
  group by m.user_id,m.joined_at
 ),
 current_positions as(
  select t.*,dense_rank() over(order by t.season_score desc) as now_rank
  from totals t
 ),
 previous_positions as(
  select t.user_id,dense_rank() over(order by t.earlier_score desc) as was_rank
  from totals t where t.joined_at<v_start
 ),
 historical_games as(select count(*) as count_old from played p
   where p.graded and p.played_at<v_start)
 select cp.user_id,coalesce(profile.display_name,'Player')::text,cp.now_rank,
  (case when history.count_old>0 then prev.was_rank else null::bigint end)::bigint,
  cp.season_score,cp.week_score,cp.week_hits,cp.week_games,cp.season_games,
  (v_start at time zone 'America/Chicago')::date
 from current_positions cp
 left join previous_positions prev on prev.user_id=cp.user_id
 left join public.sec_profiles profile on profile.user_id=cp.user_id
 cross join historical_games history
 order by cp.now_rank asc,cp.week_score desc,coalesce(profile.display_name,'Player') asc,cp.user_id;
end;$$;
revoke all on function public.sec_weekly_power_rankings(text,uuid) from public,anon;
grant execute on function public.sec_weekly_power_rankings(text,uuid) to authenticated;
