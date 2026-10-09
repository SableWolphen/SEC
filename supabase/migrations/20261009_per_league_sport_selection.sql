-- Each *league* chooses one, two or three SEC sports independently of the player's account.
-- Disable/re-enable a sport without deleting the linked league, its picks or history.
alter table public.sec_clubs add column if not exists enabled_sports text[]
 not null default array['football','basketball','baseball']::text[];
alter table public.sec_clubs drop constraint if exists sec_clubs_enabled_sports_valid;
alter table public.sec_clubs add constraint sec_clubs_enabled_sports_valid check(
 cardinality(enabled_sports) between 1 and 3
 and enabled_sports <@ array['football','basketball','baseball']::text[]
 and cardinality(enabled_sports) =
  (case when 'football'=any(enabled_sports) then 1 else 0 end)+
  (case when 'basketball'=any(enabled_sports) then 1 else 0 end)+
  (case when 'baseball'=any(enabled_sports) then 1 else 0 end)
);

-- Owner-only, all-or-nothing change. A hidden sport is NOT removed from storage,
-- and is ignored by the composite league leaderboard until it is enabled again.
create or replace function public.sec_club_set_sports(p_club uuid,p_sports text[])
returns text[] language plpgsql security definer set search_path='' as $$
declare clean text[];owner uuid;
begin
 if (select auth.uid()) is null then raise exception 'Log in to edit league settings';end if;
 if p_sports is null or cardinality(p_sports) not between 1 and 3 or
    p_sports && array['football','basketball','baseball']::text[] is not true or
    not(p_sports <@ array['football','basketball','baseball']::text[]) then
   raise exception 'Choose between one and three valid sports';end if;
 select array_agg(sport order by sortkey) into clean from(
  select distinct item as sport,
   case item when 'football' then 1 when 'basketball' then 2 else 3 end as sortkey
  from unnest(p_sports) as item
 ) t;
 if cardinality(clean)<>cardinality(p_sports) then raise exception 'A sport can only be selected once';end if;
 select c.owner_id into owner from public.sec_clubs c where c.id=p_club for update;
 if owner is null or owner<>(select auth.uid()) then
  raise exception 'Only the league owner can change its sports';end if;
 update public.sec_clubs set enabled_sports=clean where id=p_club;
 return clean;
end;$$;
revoke all on function public.sec_club_set_sports(uuid,text[]) from public,anon;
grant execute on function public.sec_club_set_sports(uuid,text[]) to authenticated;

-- Create a *new league* with its own selected sport(s), not a global user setting.
-- Reuses original club creation in the SAME database transaction.
create or replace function public.sec_club_create(p_name text,p_sports text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare new_club uuid;
begin
 if p_sports is null or cardinality(p_sports)<1 then
   raise exception 'Choose at least one sport';end if;
 new_club:=public.sec_club_create(p_name);
 perform public.sec_club_set_sports(new_club,p_sports);
 return new_club;
end;$$;
revoke all on function public.sec_club_create(text,text[]) from public,anon;
grant execute on function public.sec_club_create(text,text[]) to authenticated;

-- Convert an owned legacy Straight Picks league to a configurable club,
-- *keeping* its original league, members and picks.
create or replace function public.sec_club_upgrade_single(
 p_sport text,p_league uuid,p_sports text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare new_club uuid;
begin
 if p_sport is null or not (p_sport=any(p_sports)) then
  raise exception 'Keep the original sport when upgrading your league';end if;
 new_club:=public.sec_club_upgrade_single(p_sport,p_league);
 perform public.sec_club_set_sports(new_club,p_sports);
 return new_club;
end;$$;
revoke all on function public.sec_club_upgrade_single(text,uuid,text[]) from public,anon;
grant execute on function public.sec_club_upgrade_single(text,uuid,text[]) to authenticated;

-- Join only the sports that this league currently offers; on enabling an
-- additional sport, existing members can opt in by joining the same code again.
create or replace function public.sec_club_join(p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());club record;fcode text;bbcode text;bscode text;
begin
 if me is null then raise exception 'Log in to join your friends';end if;
 if p_code is null or p_code !~ '^[A-Za-z0-9]{10}$' then
  raise exception 'Invalid invite code';end if;
 select * into club from public.sec_clubs where invite_code=upper(btrim(p_code));
 if not found then raise exception 'League invitation not found';end if;
 if 'football'=any(club.enabled_sports) then
  select invite_code into fcode from public.sec_leagues where id=club.football_league;
  if fcode is null then raise exception 'Football league unavailable';end if;
  perform public.sec_join_league(fcode);
 end if;
 if 'basketball'=any(club.enabled_sports) then
  select invite_code into bbcode from public.sec_sport_leagues where id=club.basketball_league;
  if bbcode is null then raise exception 'Basketball league unavailable';end if;
  perform public.sec_sport_join_league(bbcode);
 end if;
 if 'baseball'=any(club.enabled_sports) then
  select invite_code into bscode from public.sec_sport_leagues where id=club.baseball_league;
  if bscode is null then raise exception 'Baseball league unavailable';end if;
  perform public.sec_sport_join_league(bscode);
 end if;
 insert into public.sec_club_members(club_id,user_id)values(club.id,me)
 on conflict do nothing;
 return club.id;
end;$$;
revoke all on function public.sec_club_join(text) from public,anon;
grant execute on function public.sec_club_join(text) to authenticated;

-- Disabled sports contribute *zero* to the active combined leaderboard.
-- Re-enabled sports resume their existing verified totals and history.
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
  select s.user_id,s.season_points,s.correct_picks
  from public.sec_league_standings_v3(c.football_league,1) s
  where 'football'=any(c.enabled_sports)
 ),b as(
  select s.user_id,s.season_points,s.correct_picks
  from public.sec_sport_standings(c.basketball_league,1) s
  where 'basketball'=any(c.enabled_sports)
 ),bs as(
  select s.user_id,s.season_points,s.correct_picks
  from public.sec_sport_standings(c.baseball_league,1) s
  where 'baseball'=any(c.enabled_sports)
 )
 select m.user_id,coalesce(p.display_name,'Player')::text,
  coalesce(f.season_points,0)::numeric,coalesce(b.season_points,0)::numeric,
  coalesce(bs.season_points,0)::numeric,
  (coalesce(f.season_points,0)+coalesce(b.season_points,0)+coalesce(bs.season_points,0))::numeric,
  coalesce(f.correct_picks,0)::bigint,coalesce(b.correct_picks,0)::bigint,
  coalesce(bs.correct_picks,0)::bigint
 from public.sec_club_members m
 left join public.sec_profiles p on p.user_id=m.user_id
 left join f on f.user_id=m.user_id
 left join b on b.user_id=m.user_id
 left join bs on bs.user_id=m.user_id
 where m.club_id=p_club
 order by 6 desc,2 asc;
end;$$;
revoke all on function public.sec_club_standings(uuid) from public,anon;
grant execute on function public.sec_club_standings(uuid) to authenticated;

-- Bracket picking also honors each league's currently enabled sports.
create or replace function public.sec_bracket_save(p_club uuid,p_game text,p_pick text)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());g record;club record;
begin
 if me is null or not public.sec_club_is_member(p_club) then
  raise exception 'Join the league first';end if;
 select * into g from public.sec_bracket_games where id=p_game;
 if not found then raise exception 'Official tournament matchup not published';end if;
 select * into club from public.sec_clubs where id=p_club;
 if not(g.sport=any(club.enabled_sports)) then
  raise exception 'That sport is not enabled for this league';end if;
 if (g.sport='basketball' and g.season<>club.basketball_season) or
    (g.sport='baseball' and g.season<>club.baseball_season) then
  raise exception 'This bracket is not in your league season';end if;
 if g.status<>'scheduled' or clock_timestamp()>=g.kickoff_at then
  raise exception 'Tournament pick is locked';end if;
 if p_pick not in(g.away_code,g.home_code) then
  raise exception 'Pick a verified participant';end if;
 insert into public.sec_bracket_picks(club_id,user_id,game_id,pick_code)
 values(p_club,me,p_game,p_pick)
 on conflict(club_id,user_id,game_id)
 do update set pick_code=excluded.pick_code,updated_at=now();
end;$$;
revoke all on function public.sec_bracket_save(uuid,text,text) from public,anon;
grant execute on function public.sec_bracket_save(uuid,text,text) to authenticated;
