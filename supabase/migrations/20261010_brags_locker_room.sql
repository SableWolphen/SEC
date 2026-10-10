-- Brags: member-only post-kickoff receipts and rivalry data.
CREATE OR REPLACE FUNCTION public.sec_brags_locker_room(p_kind text, p_league uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_fb uuid;v_bb uuid;v_bs uuid;v_sports text[];
 v_json jsonb;
begin
 if (select auth.uid()) is null or p_league is null or
    p_kind not in ('club','football','basketball','baseball')
 then raise exception 'Invalid league selection';end if;
 if p_kind='club' then
  if not public.sec_club_is_member(p_league) then raise exception 'League members only';end if;
  select c.football_league,c.basketball_league,c.baseball_league,c.enabled_sports
   into v_fb,v_bb,v_bs,v_sports from public.sec_clubs c where c.id=p_league;
  if not found then raise exception 'League unavailable';end if;
 elsif p_kind='football' then
  if not public.sec_is_member(p_league) then raise exception 'League members only';end if;
  v_fb:=p_league;v_sports:=array['football']::text[];
 elsif p_kind in ('basketball','baseball') then
  if not public.sec_sport_is_member(p_league) then raise exception 'League members only';end if;
  if not exists(select 1 from public.sec_sport_leagues l where l.id=p_league and l.sport=p_kind)
   then raise exception 'League sport unavailable';end if;
  if p_kind='basketball' then v_bb:=p_league; else v_bs:=p_league;end if;
  v_sports:=array[p_kind]::text[];
 end if;
 -- The database applies the kickoff filter before returning any pick, even with
 -- a malicious browser or a made-up game ID. All results are read-only.
 with members as (
  select m.user_id from public.sec_club_members m where p_kind='club' and m.club_id=p_league
  union
  select m.user_id from public.sec_members m where p_kind='football' and m.league_id=p_league
  union
  select m.user_id from public.sec_sport_members m
    where p_kind in ('basketball','baseball') and m.league_id=p_league
 ), eligible as (
  select 'football'::text as sport,g.id,g.week,g.kickoff_at,g.away_code,g.home_code,
   g.game_status,g.away_score,g.home_score,g.winner as winner_code,
   g.spread_home,g.spread_source,'2026'::text as season,
   l.mode as scoring_mode,p.user_id,p.pick_code
  from public.sec_league_picks p
    join members m on m.user_id=p.user_id
    join public.sec_games g on g.id=p.game_id
    join public.sec_leagues l on l.id=p.league_id
  where p.league_id=v_fb and 'football'=any(v_sports) and g.kickoff_at<=now()
  union all
  select g.sport,g.id,g.week,g.kickoff_at,g.away_code,g.home_code,
   g.game_status,g.away_score,g.home_score,g.winner_code,
   g.spread_home,g.source,g.season::text,
   l.mode,p.user_id,p.pick_code
  from public.sec_sport_picks p
    join members m on m.user_id=p.user_id
    join public.sec_sport_games g on g.id=p.game_id
    join public.sec_sport_leagues l on l.id=p.league_id and l.sport=g.sport
      and l.season=g.season
  where ((g.sport='basketball' and p.league_id=v_bb and 'basketball'=any(v_sports))
     or (g.sport='baseball' and p.league_id=v_bs and 'baseball'=any(v_sports)))
    and g.kickoff_at<=now()
 ), limited as (
  select e.* from eligible e order by e.kickoff_at desc,e.id,e.user_id limit 2000
 ), safe as (
  select sport,id,week,kickoff_at,away_code,home_code,game_status,away_score,home_score,
    (case when game_status='final' and winner_code in(away_code,home_code)
      and away_score is not null and home_score is not null and away_score<>home_score
      and ((winner_code=away_code and away_score>home_score)
        or (winner_code=home_code and home_score>away_score))
     then winner_code else null end) as verified_winner,
   spread_home,spread_source,season,scoring_mode,user_id,pick_code
  from limited
 ), by_game as (
  select distinct on (s.id) s.* from safe s order by s.id,s.user_id
 )
 select jsonb_build_object(
   'players', coalesce((select jsonb_agg(jsonb_build_object(
     'user_id',m.user_id,
     'display_name',coalesce(pr.display_name,'Player'),
     'school',pr.favorite_school_code
    ) order by coalesce(pr.display_name,'Player'),m.user_id)
    from members m left join public.sec_profiles pr on pr.user_id=m.user_id),'[]'::jsonb),
   'games',coalesce((select jsonb_agg(jsonb_build_object(
     'id',g.id,'sport',g.sport,'week',g.week,'kickoff_at',g.kickoff_at,
     'away_code',g.away_code,'home_code',g.home_code,'game_status',g.game_status,
     'away_score',g.away_score,'home_score',g.home_score,
     'winner',g.verified_winner,'spread_home',g.spread_home,
     'spread_source',g.spread_source,'season',g.season,'mode',g.scoring_mode
    ) order by g.kickoff_at desc,g.id) from by_game g),'[]'::jsonb),
   'picks',coalesce((select jsonb_agg(jsonb_build_object(
    'user_id',s.user_id,'game_id',s.id,'pick_code',s.pick_code
    ) order by s.kickoff_at desc,s.id,s.user_id) from safe s),'[]'::jsonb),
   'limited', (select count(*)=2000 from limited)
 ) into v_json;
 return coalesce(v_json,'{}'::jsonb);
end;$function$
;
revoke all on function public.sec_brags_locker_room(text,uuid) from public,anon;
grant execute on function public.sec_brags_locker_room(text,uuid) to authenticated;
