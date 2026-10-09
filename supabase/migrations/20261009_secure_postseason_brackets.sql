-- Verified-only SEC postseason tournament brackets. No fictional seeds or games.
-- Fixtures are maintained by an authorized server admin/importer (no browser writes).
create table if not exists public.sec_bracket_games(
 id text primary key check(length(id) between 8 and 100),
 sport text not null check(sport in('basketball','baseball')),
 season integer not null check(season between 2025 and 2100),
 round_label text not null check(length(round_label) between 2 and 70),
 away_code text not null,
 home_code text not null,
 away_name text not null,
 home_name text not null,
 kickoff_at timestamptz not null,
 winner_code text,
 status text not null default 'scheduled' check(status in('scheduled','live','final','postponed','canceled')),
 source_url text not null check(source_url like 'https://www.secsports.com/%'),
 verified_at timestamptz not null default now(),
 check(away_code<>home_code),
 check(winner_code is null or winner_code in(away_code,home_code)),
 unique(sport,season,round_label,away_code,home_code)
);
alter table public.sec_bracket_games enable row level security;
revoke all on public.sec_bracket_games from public,anon,authenticated;
grant select on public.sec_bracket_games to anon,authenticated;
create policy sec_bracket_games_verified_read on public.sec_bracket_games for select to anon,authenticated using(true);
create index if not exists sec_bracket_games_by_start on public.sec_bracket_games(sport,season,kickoff_at);

create table if not exists public.sec_bracket_picks(
 club_id uuid not null references public.sec_clubs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 game_id text not null references public.sec_bracket_games(id) on delete cascade,
 pick_code text not null,
 updated_at timestamptz not null default now(),
 primary key(club_id,user_id,game_id)
);
alter table public.sec_bracket_picks enable row level security;
revoke all on public.sec_bracket_picks from public,anon,authenticated;
grant select on public.sec_bracket_picks to authenticated;
create policy sec_bracket_own_select on public.sec_bracket_picks for select to authenticated
 using(user_id=auth.uid() and public.sec_club_is_member(club_id));

create or replace function public.sec_bracket_save(p_club uuid,p_game text,p_pick text)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); g record; club record;
begin
 if me is null or not public.sec_club_is_member(p_club) then raise exception 'Join the all-sports club first';end if;
 select * into g from public.sec_bracket_games where id=p_game;
 if not found then raise exception 'Official tournament matchup not published';end if;
 select * into club from public.sec_clubs where id=p_club;
 if (g.sport='basketball' and g.season<>club.basketball_season) or
    (g.sport='baseball' and g.season<>club.baseball_season) then
   raise exception 'This bracket is not in your league season';end if;
 if g.status<>'scheduled' or clock_timestamp()>=g.kickoff_at then
  raise exception 'Tournament pick is locked';end if;
 if p_pick not in(g.away_code,g.home_code) then raise exception 'Pick a verified participant';end if;
 insert into public.sec_bracket_picks(club_id,user_id,game_id,pick_code)
 values(p_club,me,p_game,p_pick)
 on conflict(club_id,user_id,game_id) do update set pick_code=excluded.pick_code,updated_at=now();
end;$$;

create or replace function public.sec_bracket_standings(p_club uuid,p_sport text)
returns table(user_id uuid,display_name text,correct bigint,picked bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.sec_club_is_member(p_club) then raise exception 'League members only';end if;
 if p_sport not in('basketball','baseball') then raise exception 'Invalid tournament sport';end if;
 return query select m.user_id,coalesce(pr.display_name,'Player')::text,
  count(*) filter(where g.status='final' and p.pick_code=g.winner_code)::bigint,
  count(g.id)::bigint
 from public.sec_club_members m
 left join public.sec_profiles pr on pr.user_id=m.user_id
 left join public.sec_bracket_picks p on p.club_id=p_club and p.user_id=m.user_id
 left join public.sec_bracket_games g on g.id=p.game_id and g.sport=p_sport
 where m.club_id=p_club
 group by m.user_id,pr.display_name order by 3 desc,4 desc,2 asc;
end;$$;
revoke all on function public.sec_bracket_save(uuid,text,text),
 public.sec_bracket_standings(uuid,text) from public,anon;
grant execute on function public.sec_bracket_save(uuid,text,text),
 public.sec_bracket_standings(uuid,text) to authenticated;
