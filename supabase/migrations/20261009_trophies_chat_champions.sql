-- Saturdays Down South: private chat, permanent rivalry history, and season champions.
-- Apply after setup.sql and 20261009_four_modes.sql. Leaves schedules, picks and cron untouched.
create table if not exists public.sec_trophy_history(
 user_id uuid not null references auth.users(id) on delete cascade,
 league_id uuid not null,
 trophy_id text not null check(trophy_id in(
 'iron-bowl','third-saturday','golden-boot','southwest-classic','deep-south',
 'cocktail-party','governors-cup','magnolia-bowl','golden-egg','battle-line',
 'mayors-cup','red-river','palmetto-showdown','lone-star','tennessee-vanderbilt')),
 game_id text not null,
 season integer not null check(season between 2000 and 2100),
 pick_code text not null,winner_code text not null,correct boolean not null,
 recorded_at timestamptz not null default now(),
 primary key(user_id,league_id,game_id,trophy_id)
);
create index if not exists sec_trophy_history_user on public.sec_trophy_history(user_id,season desc);
alter table public.sec_trophy_history enable row level security;
revoke all on public.sec_trophy_history from anon,authenticated;
grant select on public.sec_trophy_history to authenticated;
drop policy if exists trophy_personal_view on public.sec_trophy_history;
create policy trophy_personal_view on public.sec_trophy_history for select to authenticated
 using(user_id=(select auth.uid()));

create table if not exists public.sec_league_messages(
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references public.sec_leagues(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 500),
 created_at timestamptz not null default now()
);
create index if not exists sec_messages_recent on public.sec_league_messages(league_id,created_at desc);
alter table public.sec_league_messages enable row level security;
revoke all on public.sec_league_messages from anon,authenticated;
grant select,insert,delete on public.sec_league_messages to authenticated;
drop policy if exists league_messages_read on public.sec_league_messages;
create policy league_messages_read on public.sec_league_messages for select to authenticated using(public.sec_is_member(league_id));
drop policy if exists league_messages_send on public.sec_league_messages;
create policy league_messages_send on public.sec_league_messages for insert to authenticated
 with check(user_id=(select auth.uid()) and public.sec_is_member(league_id));
drop policy if exists league_messages_remove on public.sec_league_messages;
create policy league_messages_remove on public.sec_league_messages for delete to authenticated
 using(public.sec_is_member(league_id) and (user_id=(select auth.uid()) or
 exists(select 1 from public.sec_leagues l where l.id=league_id and l.owner_id=(select auth.uid()))));

create table if not exists public.sec_league_reactions(
 message_id uuid not null references public.sec_league_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 emoji text not null check(emoji in ('🔥','🏈','😂','👏')),
 primary key(message_id,user_id,emoji)
);
alter table public.sec_league_reactions enable row level security;
revoke all on public.sec_league_reactions from anon,authenticated;
grant select,insert,delete on public.sec_league_reactions to authenticated;
drop policy if exists league_reactions_read on public.sec_league_reactions;
create policy league_reactions_read on public.sec_league_reactions for select to authenticated using(
 exists(select 1 from public.sec_league_messages m where m.id=message_id and public.sec_is_member(m.league_id)));
drop policy if exists league_reactions_insert on public.sec_league_reactions;
create policy league_reactions_insert on public.sec_league_reactions for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from public.sec_league_messages m
 where m.id=message_id and public.sec_is_member(m.league_id)));
drop policy if exists league_reactions_delete on public.sec_league_reactions;
create policy league_reactions_delete on public.sec_league_reactions for delete to authenticated using(
 user_id=(select auth.uid()) and exists(select 1 from public.sec_league_messages m
 where m.id=message_id and public.sec_is_member(m.league_id)));

create table if not exists public.sec_league_champions(
 league_id uuid not null references public.sec_leagues(id) on delete cascade,
 season integer not null check(season between 2000 and 2100),
 champion_user_id uuid not null references auth.users(id),
 points numeric not null default 0,mode text not null,
 crowned_at timestamptz not null default now(),
 primary key(league_id,season)
);
alter table public.sec_league_champions enable row level security;
revoke all on public.sec_league_champions from anon,authenticated;
grant select on public.sec_league_champions to authenticated;
drop policy if exists league_champions_read on public.sec_league_champions;
create policy league_champions_read on public.sec_league_champions for select to authenticated
 using(public.sec_is_member(league_id));

CREATE OR REPLACE FUNCTION public.sec_chat_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.user_id<>(select auth.uid()) or not public.sec_is_member(new.league_id) then
  raise exception 'League membership is required';
 end if;
 if exists(select 1 from public.sec_league_messages m where m.league_id=new.league_id
  and m.user_id=new.user_id and m.created_at>clock_timestamp()-interval '3 seconds') then
  raise exception 'Please wait a few seconds before sending another message';
 end if;
 new.body=btrim(new.body);
 new.created_at=clock_timestamp();
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.sec_finalize_championship(p_league uuid, p_season integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c uuid; v_mode text; v_points numeric;
begin
 if not exists(select 1 from public.sec_leagues l where l.id=p_league and l.owner_id=(select auth.uid())) then
  raise exception 'Only the league commissioner can crown the champion';
 end if;
 if p_season not between 2000 and 2100 then raise exception 'Invalid season'; end if;
 if not exists(select 1 from public.sec_games g where extract(year from g.game_date)::int=p_season) then
  raise exception 'No season games available to score';
 end if;
 if exists(select 1 from public.sec_games g
  where extract(year from g.game_date)::int=p_season and g.game_status not in ('final','canceled')) then
  raise exception 'Season games must all be final or canceled before crowning';
 end if;
 if exists(select 1 from public.sec_league_champions a where a.league_id=p_league and a.season=p_season) then
  select champion_user_id into c from public.sec_league_champions where league_id=p_league and season=p_season;
  return c;
 end if;
 select mode into v_mode from public.sec_leagues where id=p_league;
 with all_scores as (
  select m.user_id,
   coalesce(sum(case
    when g.game_status<>'final' then 0::numeric
    when v_mode='spread' then
     case when g.spread_home is null or g.home_score is null or g.away_score is null then 0::numeric
      when g.home_score-g.away_score+g.spread_home=0 then 0.5::numeric
      when (g.home_score-g.away_score+g.spread_home>0 and p.pick_code=g.home_code)
        or (g.home_score-g.away_score+g.spread_home<0 and p.pick_code=g.away_code)
      then 1::numeric else 0::numeric end
    when p.pick_code=g.winner then
     (case when v_mode='confidence' then coalesce(p.confidence_points,0) else 1 end)::numeric
    else 0::numeric end),0)::numeric as score
  from public.sec_members m
  left join public.sec_league_picks p on p.league_id=m.league_id and p.user_id=m.user_id
  left join public.sec_games g on g.id=p.game_id and extract(year from g.game_date)::int=p_season
  where m.league_id=p_league
  group by m.user_id
 )
 select user_id,score into c,v_points from all_scores
 order by score desc,user_id asc limit 1;
 if c is null then raise exception 'No eligible league members'; end if;
 insert into public.sec_league_champions(league_id,season,champion_user_id,points,mode)
 values(p_league,p_season,c,v_points)
 on conflict(league_id,season) do nothing;
 return c;
end $function$;

CREATE OR REPLACE FUNCTION public.sec_sync_trophy_history(p_league uuid)
 RETURNS TABLE(trophy_id text, season integer, correct boolean, game_id text, pick_code text, winner_code text, league_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare caller uuid;
begin
 caller := (select auth.uid());
 if caller is null or not exists(select 1 from public.sec_members m where m.league_id=p_league and m.user_id=caller) then
  raise exception 'You must join this league first';
 end if;
 insert into public.sec_trophy_history(user_id,league_id,trophy_id,game_id,season,pick_code,winner_code,correct)
 select caller,p_league,r.trophy_id,g.id,extract(year from g.game_date)::int,p.pick_code,g.winner,(p.pick_code=g.winner)
 from public.sec_league_picks p
 join public.sec_games g on g.id=p.game_id
 join (values
  ('iron-bowl','ALA','AUB'),('third-saturday','ALA','TENN'),
  ('golden-boot','ARK','LSU'),('southwest-classic','ARK','TAMU'),
  ('deep-south','AUB','UGA'),('cocktail-party','FLA','UGA'),
  ('governors-cup','UK','LOU'),('magnolia-bowl','LSU','MISS'),
  ('golden-egg','MISS','MSST'),('battle-line','ARK','MIZ'),
  ('mayors-cup','MIZ','SC'),('red-river','OU','TEX'),
  ('palmetto-showdown','CLEM','SC'),('lone-star','TAMU','TEX'),
  ('tennessee-vanderbilt','TENN','VAN')
 ) as r(trophy_id,first_team,second_team)
 on least(g.away_code,g.home_code)=r.first_team and greatest(g.away_code,g.home_code)=r.second_team
 where p.user_id=caller and p.league_id=p_league
   and g.game_status='final' and g.winner in (g.away_code,g.home_code)
 on conflict(user_id,league_id,game_id,trophy_id) do update
 set winner_code=excluded.winner_code,pick_code=excluded.pick_code,
     correct=excluded.correct
 where public.sec_trophy_history.winner_code is distinct from excluded.winner_code
    or public.sec_trophy_history.correct is distinct from excluded.correct;
 return query select t.trophy_id,t.season,t.correct,t.game_id,t.pick_code,t.winner_code,t.league_id
 from public.sec_trophy_history t where t.user_id=caller order by t.season desc,t.recorded_at desc;
end $function$;

drop trigger if exists sec_chat_guard_insert on public.sec_league_messages;
create trigger sec_chat_guard_insert before insert on public.sec_league_messages
 for each row execute function public.sec_chat_guard();
revoke all on function public.sec_sync_trophy_history(uuid),
 public.sec_finalize_championship(uuid,integer) from public,anon;
grant execute on function public.sec_sync_trophy_history(uuid),
 public.sec_finalize_championship(uuid,integer) to authenticated;
