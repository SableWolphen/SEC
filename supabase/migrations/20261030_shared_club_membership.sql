-- Keep one existing club membership across every sport, including upgrades.
-- Repair previously upgraded clubs without touching picks or historical scores.
create or replace function public.sec_club_sync_members(p_club uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.sec_clubs%rowtype;
begin
 if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
 select * into c from public.sec_clubs where id=p_club for update;
 if not found then raise exception 'League not found'; end if;
 if c.owner_id <> (select auth.uid()) then raise exception 'Only the league owner can sync membership'; end if;
 insert into public.sec_club_members(club_id,user_id)
 select c.id, members.user_id from (
  select user_id from public.sec_club_members where club_id=c.id
  union select user_id from public.sec_members where league_id=c.football_league
  union select user_id from public.sec_sport_members where league_id=c.basketball_league
  union select user_id from public.sec_sport_members where league_id=c.baseball_league
 ) members on conflict do nothing;
 -- Enabled sports share membership, without altering disabled-sport history.
 if 'football'=any(c.enabled_sports) then
  insert into public.sec_members(league_id,user_id)
  select c.football_league,user_id from public.sec_club_members where club_id=c.id
  on conflict do nothing;
 end if;
 if 'basketball'=any(c.enabled_sports) then
  insert into public.sec_sport_members(league_id,user_id)
  select c.basketball_league,user_id from public.sec_club_members where club_id=c.id
  on conflict do nothing;
 end if;
 if 'baseball'=any(c.enabled_sports) then
  insert into public.sec_sport_members(league_id,user_id)
  select c.baseball_league,user_id from public.sec_club_members where club_id=c.id
  on conflict do nothing;
 end if;
end;
$$;
revoke all on function public.sec_club_sync_members(uuid) from public,anon;
grant execute on function public.sec_club_sync_members(uuid) to authenticated;
-- Backfill current club members from the linked original sports for already upgraded leagues.
insert into public.sec_club_members(club_id,user_id)
select c.id,m.user_id from public.sec_clubs c join public.sec_members m on m.league_id=c.football_league
union
select c.id,m.user_id from public.sec_clubs c join public.sec_sport_members m on m.league_id=c.basketball_league
union
select c.id,m.user_id from public.sec_clubs c join public.sec_sport_members m on m.league_id=c.baseball_league
on conflict do nothing;
insert into public.sec_members(league_id,user_id)
select c.football_league,m.user_id from public.sec_clubs c
join public.sec_club_members m on m.club_id=c.id
where 'football'=any(c.enabled_sports)
on conflict do nothing;
insert into public.sec_sport_members(league_id,user_id)
select c.basketball_league,m.user_id from public.sec_clubs c
join public.sec_club_members m on m.club_id=c.id
where 'basketball'=any(c.enabled_sports)
union
select c.baseball_league,m.user_id from public.sec_clubs c
join public.sec_club_members m on m.club_id=c.id
where 'baseball'=any(c.enabled_sports)
on conflict do nothing;
