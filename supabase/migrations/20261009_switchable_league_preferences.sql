-- Player-selected league style, stored on the same authenticated SEC account.
-- Switching views never deletes memberships, picks, scores, or existing leagues.
create table if not exists public.sec_player_league_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 play_format text not null default 'single' check(play_format in ('single','all')),
 single_sport text not null default 'football' check(single_sport in ('football','basketball','baseball')),
 updated_at timestamptz not null default now()
);
alter table public.sec_player_league_preferences enable row level security;
revoke all on public.sec_player_league_preferences from public,anon,authenticated;
grant select,insert,update on public.sec_player_league_preferences to authenticated;
create policy sec_player_league_preferences_select on public.sec_player_league_preferences
 for select to authenticated using(user_id=(select auth.uid()));
create policy sec_player_league_preferences_insert on public.sec_player_league_preferences
 for insert to authenticated with check(user_id=(select auth.uid()));
create policy sec_player_league_preferences_update on public.sec_player_league_preferences
 for update to authenticated using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()));

-- An owner may convert their EXISTING Straight Picks league into a new all-sports
-- club, retaining the exact original league ID, members, picks and history.
-- Existing members are never silently enrolled in other sports: they opt in
-- through the new all-sports invitation. Reverting the UI never deletes a club.
create or replace function public.sec_club_upgrade_single(p_sport text,p_league uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 me uuid:=(select auth.uid());
 yy integer:=extract(year from now())::integer;
 mm integer:=extract(month from now())::integer;
 sport_year integer;
 fb uuid;bb uuid;bs uuid;new_club uuid;
 name text;mode text;owner uuid;existing_season integer;
begin
 if me is null then raise exception 'Sign in to upgrade a league';end if;
 if p_league is null or p_sport not in ('football','basketball','baseball') then
   raise exception 'Choose a valid existing single-sport league';end if;
 if p_sport='football' then
  select l.name,l.mode,l.owner_id into name,mode,owner
  from public.sec_leagues l where l.id=p_league for update;
 else
  select l.name,l.mode,l.owner_id,l.season into name,mode,owner,existing_season
  from public.sec_sport_leagues l where l.id=p_league and l.sport=p_sport for update;
 end if;
 if owner is null or owner<>me then raise exception 'Only the single-sport league owner can upgrade it';end if;
 if mode<>'straight' then
  raise exception 'Grand Champion is Straight Picks only. Create a new all-sports league to keep the existing scoring mode.';end if;
 if exists(select 1 from public.sec_clubs c where
   c.football_league=p_league or c.basketball_league=p_league or c.baseball_league=p_league)
 then raise exception 'This league already belongs to an all-sports competition';end if;
 sport_year:=coalesce(existing_season,yy+(case when mm>=8 then 1 else 0 end));
 if p_sport='football' then
   fb:=p_league;
 else
   select r.league_id into fb from public.sec_create_league_mode(name,'straight') r limit 1;
 end if;
 if p_sport='basketball' then
   bb:=p_league;
 else
   select r.league_id into bb from public.sec_sport_create_league('basketball',sport_year,name,'straight') r limit 1;
 end if;
 if p_sport='baseball' then
   bs:=p_league;
 else
   select r.league_id into bs from public.sec_sport_create_league('baseball',sport_year,name,'straight') r limit 1;
 end if;
 insert into public.sec_clubs(owner_id,name,football_league,basketball_league,baseball_league,
  football_season,basketball_season,baseball_season)
 values(me,name,fb,bb,bs,case when p_sport='football' and mm<8 then yy-1 else sport_year-1 end,
  sport_year,sport_year) returning id into new_club;
 insert into public.sec_club_members(club_id,user_id)values(new_club,me);
 return new_club;
end;$$;
revoke all on function public.sec_club_upgrade_single(text,uuid) from public,anon;
grant execute on function public.sec_club_upgrade_single(text,uuid) to authenticated;
