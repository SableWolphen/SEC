-- Member-only, explicit, never-overwrite copy of your own previewed football picks.
-- Server validates identity, source/destination membership, rules, and kickoff.
-- Existing destination picks are immutable to this operation, even under races.
create or replace function public.sec_copy_my_league_picks(
 p_source uuid, p_target uuid, p_week integer, p_expected jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid := (select auth.uid());
 v_mode text;
 v_row record;
 v_points integer;
 v_max integer;
 v_copied integer := 0;
 v_skipped integer := 0;
 v_delta integer := 0;
begin
 if v_user is null or p_source is null or p_target is null or p_source=p_target or
   p_week not between 1 and 22 or p_expected is null or
   jsonb_typeof(p_expected)<>'array' or jsonb_array_length(p_expected)>25
 then raise exception 'Invalid football pick transfer';end if;
 if not public.sec_is_member(p_source) or not public.sec_is_member(p_target)
 then raise exception 'Join both football leagues before copying picks';end if;
 select mode into v_mode from public.sec_leagues where id=p_target;
 if v_mode not in ('straight','confidence','spread','h2h')
 then raise exception 'Destination league mode unavailable';end if;
 -- Serialize confidence assignments with the standard manual-save RPC.
 perform pg_advisory_xact_lock(hashtextextended(v_user::text||p_target::text||p_week::text,0));
 select count(*) into v_max from public.sec_games where week=p_week;
 for v_row in
  select s.game_id,s.pick_code,g.kickoff_at,g.spread_home
   from public.sec_league_picks s
   join public.sec_games g on g.id=s.game_id and g.week=p_week
   where s.league_id=p_source and s.user_id=v_user
   and exists(select 1 from jsonb_array_elements(p_expected) e
     where e->>'game_id'=s.game_id and e->>'pick_code'=s.pick_code)
   order by g.kickoff_at,s.game_id
 loop
  if clock_timestamp()>=v_row.kickoff_at or
     (v_mode='spread' and v_row.spread_home is null) or
     exists(select 1 from public.sec_league_picks p
      where p.league_id=p_target and p.user_id=v_user and p.game_id=v_row.game_id)
  then v_skipped:=v_skipped+1;continue;end if;
  v_points:=null;
  if v_mode='confidence' then
   select n into v_points from generate_series(v_max,1,-1) n
    where not exists(select 1 from public.sec_league_picks p
      join public.sec_games g on g.id=p.game_id and g.week=p_week
      where p.league_id=p_target and p.user_id=v_user and p.confidence_points=n)
    limit 1;
   if v_points is null then v_skipped:=v_skipped+1;continue;end if;
  end if;
  insert into public.sec_league_picks(league_id,user_id,game_id,pick_code,confidence_points)
   values(p_target,v_user,v_row.game_id,v_row.pick_code,v_points)
   on conflict(league_id,user_id,game_id) do nothing;
  get diagnostics v_delta=row_count;
  v_copied:=v_copied+v_delta;
  v_skipped:=v_skipped+(1-v_delta);
 end loop;
 return jsonb_build_object('copied',v_copied,'skipped',v_skipped);
end;$$;
revoke all on function public.sec_copy_my_league_picks(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.sec_copy_my_league_picks(uuid,uuid,integer,jsonb) to authenticated;
