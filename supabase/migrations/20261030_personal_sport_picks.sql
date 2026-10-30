-- Personal basketball/baseball picks independent of league membership.
create table if not exists public.sec_sport_personal_picks (
 user_id uuid not null references auth.users(id) on delete cascade,
 game_id text not null references public.sec_sport_games(id) on delete cascade,
 pick_code text not null,
 updated_at timestamptz not null default now(),
 primary key (user_id, game_id)
);
create index if not exists sec_sport_personal_picks_game_idx on public.sec_sport_personal_picks(game_id);
alter table public.sec_sport_personal_picks enable row level security;
revoke all on public.sec_sport_personal_picks from public, anon, authenticated;
grant select on public.sec_sport_personal_picks to authenticated;
drop policy if exists sec_personal_picks_read on public.sec_sport_personal_picks;
create policy sec_personal_picks_read on public.sec_sport_personal_picks
 for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.sec_sport_save_personal_pick(p_game text, p_pick text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
 me uuid := auth.uid();
 g public.sec_sport_games%rowtype;
begin
 if me is null then raise exception 'Sign in to save picks'; end if;
 select * into g from public.sec_sport_games where id = p_game;
 if not found then raise exception 'Game not found'; end if;
 if g.sport not in ('basketball','baseball') then raise exception 'Unsupported sport'; end if;
 if g.game_status <> 'scheduled' or g.kickoff_at <= now() then raise exception 'Picks are locked'; end if;
 if p_pick is null or p_pick not in (g.home_code, g.away_code) then
   raise exception 'Invalid team selection';
 end if;
 insert into public.sec_sport_personal_picks(user_id, game_id, pick_code)
 values(me,p_game,p_pick)
 on conflict(user_id,game_id) do update
 set pick_code=excluded.pick_code,updated_at=now();
end;
$$;
revoke all on function public.sec_sport_save_personal_pick(text,text) from public,anon;
grant execute on function public.sec_sport_save_personal_pick(text,text) to authenticated;
