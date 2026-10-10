-- SEC Game Center: privacy-safe aggregate impact after kickoff.
-- Membership and sport scope checked before any counts are returned.
create or replace function public.sec_league_game_pulse(
 p_kind text,p_league uuid,p_sport text,p_game text)
returns table(away_picks bigint,home_picks bigint,total_picks bigint,
 league_members bigint,winner_picks bigint,losing_picks bigint,
 finalized boolean,locked boolean)
language plpgsql stable security definer set search_path=''
as $$
declare v_target uuid;v_allowed boolean:=false;v_kickoff timestamptz;
 v_away text;v_home text;v_winner text;v_final boolean:=false;
begin
 if (select auth.uid()) is null or p_league is null or p_game is null or
   p_kind not in('club','football','basketball','baseball') or
   p_sport not in('football','basketball','baseball')
 then raise exception 'Invalid league or game';end if;
 if p_kind='club' then
  if not public.sec_club_is_member(p_league) then raise exception 'Not a league member';end if;
  select case p_sport when 'football' then c.football_league
   when 'basketball' then c.basketball_league else c.baseball_league end,
   p_sport=any(c.enabled_sports) into v_target,v_allowed
   from public.sec_clubs c where c.id=p_league;
 else
  if p_kind<>p_sport then raise exception 'League sport mismatch';end if;
  v_target:=p_league;
  v_allowed:=case when p_kind='football' then public.sec_is_member(p_league)
   else public.sec_sport_is_member(p_league) end;
 end if;
 if not coalesce(v_allowed,false) or v_target is null then raise exception 'Not permitted for this league or sport';end if;
 if p_sport='football' then
  select g.kickoff_at,g.away_code,g.home_code,g.winner,
   (g.game_status='final' and g.winner in(g.away_code,g.home_code)
    and g.away_score is not null and g.home_score is not null
    and g.away_score<>g.home_score
    and ((g.winner=g.away_code and g.away_score>g.home_score)
         or(g.winner=g.home_code and g.home_score>g.away_score)))
    into v_kickoff,v_away,v_home,v_winner,v_final
    from public.sec_games g where g.id=p_game;
 else
  select g.kickoff_at,g.away_code,g.home_code,g.winner_code,
   (g.game_status='final' and g.winner_code in(g.away_code,g.home_code)
    and g.away_score is not null and g.home_score is not null
    and g.away_score<>g.home_score
    and ((g.winner_code=g.away_code and g.away_score>g.home_score)
         or(g.winner_code=g.home_code and g.home_score>g.away_score)))
   into v_kickoff,v_away,v_home,v_winner,v_final
   from public.sec_sport_games g where g.id=p_game and g.sport=p_sport;
 end if;
 if v_kickoff is null then raise exception 'Unknown game';end if;
 if v_kickoff>now() then return;end if;
 return query
 with members as(
  select m.user_id from public.sec_club_members m
    where p_kind='club' and m.club_id=p_league
  union all
  select m.user_id from public.sec_members m
    where p_kind='football' and m.league_id=p_league
  union all
  select m.user_id from public.sec_sport_members m
    where p_kind in('basketball','baseball') and m.league_id=p_league
 ), picks as(
  select p.user_id,p.pick_code from public.sec_league_picks p
    join members m on m.user_id=p.user_id
    where p_sport='football' and p.league_id=v_target and p.game_id=p_game
  union all
  select p.user_id,p.pick_code from public.sec_sport_picks p
    join members m on m.user_id=p.user_id
    where p_sport in('basketball','baseball') and p.league_id=v_target and p.game_id=p_game
 )
 select count(*) filter(where p.pick_code=v_away)::bigint,
  count(*) filter(where p.pick_code=v_home)::bigint,
  count(*) filter(where p.pick_code in(v_away,v_home))::bigint,
  (select count(*) from members)::bigint,
  count(*) filter(where v_final and p.pick_code=v_winner)::bigint,
  count(*) filter(where v_final and p.pick_code in(v_away,v_home) and p.pick_code<>v_winner)::bigint,
  v_final,true from picks p;
end;$$;
revoke all on function public.sec_league_game_pulse(text,uuid,text,text) from public,anon;
grant execute on function public.sec_league_game_pulse(text,uuid,text,text) to authenticated;
