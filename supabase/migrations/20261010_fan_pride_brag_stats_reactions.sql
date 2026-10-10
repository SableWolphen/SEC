-- Exact currently deployed security-definer functions, captured from the SEC database 2026-10-10.
-- Live migrations: sec_fan_pride_reactions_brags_20261010 and sec_brag_names_member_only_20261010.
alter table public.sec_profiles add column if not exists favorite_school_code text;
alter table public.sec_profiles drop constraint if exists sec_profiles_favorite_school_code_check;
alter table public.sec_profiles add constraint sec_profiles_favorite_school_code_check check(
 favorite_school_code is null or favorite_school_code in ('ALA','ARK','AUB','FLA','UGA','UK','LSU','MISS','MSST','MIZ','OU','SC','TENN','TEX','TAMU','VAN')
);
create table if not exists public.sec_game_reactions(
 game_key text not null,user_id uuid not null references auth.users(id) on delete cascade,
 reaction text not null check(reaction in ('fire','upset','hype','wow','none')),
 changed_at timestamptz not null default now(),
 primary key(game_key,user_id), constraint sec_game_reactions_key_check check(length(game_key) between 8 and 120)
);
create index if not exists sec_game_reactions_game_idx on public.sec_game_reactions(game_key);
alter table public.sec_game_reactions enable row level security;
revoke all on public.sec_game_reactions from public,anon,authenticated;
grant select on public.sec_game_reactions to authenticated;
drop policy if exists sec_game_reactions_owner_read on public.sec_game_reactions;
create policy sec_game_reactions_owner_read on public.sec_game_reactions for select to authenticated
 using (user_id=(select auth.uid()));

CREATE OR REPLACE FUNCTION public.sec_game_reaction_totals(p_game text)
 RETURNS TABLE(reaction text, votes bigint, mine boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if p_game is null or length(p_game) not between 8 and 120 then raise exception 'Invalid game';end if;
 return query with kinds as (select unnest(array['fire','upset','hype','wow']) as r)
 select k.r::text,count(gr.user_id)::bigint,
  coalesce(bool_or(gr.user_id=(select auth.uid())),false)::boolean
 from kinds k left join public.sec_game_reactions gr on gr.game_key=p_game and gr.reaction=k.r
 group by k.r order by k.r;
end;$function$;

CREATE OR REPLACE FUNCTION public.sec_league_brag_stats(p_kind text, p_league uuid)
 RETURNS TABLE(user_id uuid, graded_picks bigint, correct_picks bigint, accuracy_pct numeric, upsets_correct bigint, favorite_pick_pct numeric, biggest_upset numeric, favorite_picks bigint, eligible_lines bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c record;
begin
 if (select auth.uid()) is null or p_league is null then raise exception 'Sign in to view league stats';end if;
 if (p_kind='club' and not public.sec_club_is_member(p_league))
  or (p_kind='football' and not public.sec_is_member(p_league))
  or (p_kind in ('basketball','baseball') and not public.sec_sport_is_member(p_league))
  or p_kind not in ('club','football','basketball','baseball')
 then raise exception 'Only members can see league stats';end if;
 if p_kind='club' then
  select cl.football_league fb,cl.basketball_league bb,cl.baseball_league bs,
   cl.enabled_sports sports into c
  from public.sec_clubs cl where cl.id=p_league;
 else
  select (case when p_kind='football' then p_league end)::uuid fb,
   (case when p_kind='basketball' then p_league end)::uuid bb,
   (case when p_kind='baseball' then p_league end)::uuid bs,
   array[p_kind]::text[] sports into c;
 end if;
 return query
 with members as(
  select m.user_id from public.sec_club_members m where p_kind='club' and m.club_id=p_league
  union all select m.user_id from public.sec_members m where p_kind='football' and m.league_id=p_league
  union all select m.user_id from public.sec_sport_members m
    where p_kind in ('basketball','baseball') and m.league_id=p_league
 ), played as(
  select p.user_id,g.spread_home line,g.home_code home,g.away_code away,
   p.pick_code pick,g.winner winner,
   (g.game_status='final' and g.winner in (g.away_code,g.home_code)
     and (l.mode<>'spread' or g.spread_home is not null and g.home_score is not null and g.away_score is not null)) graded,
   (case when l.mode='spread' then
     g.spread_home is not null and g.home_score is not null and g.away_score is not null
       and g.home_score-g.away_score+g.spread_home<>0 and
      ((g.home_score-g.away_score+g.spread_home>0 and p.pick_code=g.home_code)
       or (g.home_score-g.away_score+g.spread_home<0 and p.pick_code=g.away_code))
    else p.pick_code=g.winner end) correct,
   l.mode='spread' spread_mode
   from public.sec_league_picks p
   join public.sec_games g on g.id=p.game_id
   join public.sec_leagues l on l.id=p.league_id
   join members m on m.user_id=p.user_id
   where 'football'=any(c.sports) and p.league_id=c.fb
   union all
   select p.user_id,g.spread_home,g.home_code,g.away_code,p.pick_code,g.winner_code,
   (g.game_status='final' and g.winner_code in(g.away_code,g.home_code)
     and (l.mode<>'spread' or g.spread_home is not null and g.home_score is not null and g.away_score is not null)),
   (case when l.mode='spread' then
     g.spread_home is not null and g.home_score is not null and g.away_score is not null
     and g.home_score-g.away_score+g.spread_home<>0 and
     ((g.home_score-g.away_score+g.spread_home>0 and p.pick_code=g.home_code)
       or (g.home_score-g.away_score+g.spread_home<0 and p.pick_code=g.away_code))
    else p.pick_code=g.winner_code end),
   l.mode='spread'
   from public.sec_sport_picks p
   join public.sec_sport_games g on g.id=p.game_id
   join public.sec_sport_leagues l on l.id=p.league_id and l.sport=g.sport
   join members m on m.user_id=p.user_id
   where (('basketball'=any(c.sports) and p.league_id=c.bb)
       or ('baseball'=any(c.sports) and p.league_id=c.bs))
 ), graded as(
   select p.* from played p where p.graded
 ), totals as(
  select m.user_id,
   count(g.user_id)::bigint graded,
   count(g.user_id) filter(where g.correct)::bigint correct,
   count(g.user_id) filter(where not g.spread_mode and g.correct and
     ((g.pick=g.home and g.line>0) or (g.pick=g.away and g.line<0)))::bigint upset_hits,
   max(abs(g.line)) filter(where not g.spread_mode and g.correct and
     ((g.pick=g.home and g.line>0) or (g.pick=g.away and g.line<0)))::numeric upset_size,
   count(g.user_id) filter(where g.line is not null and g.line<>0)::bigint known_lines,
   count(g.user_id) filter(where g.line is not null and g.line<>0 and
     ((g.pick=g.home and g.line<0) or (g.pick=g.away and g.line>0)))::bigint favorite_choices
  from members m left join graded g on g.user_id=m.user_id group by m.user_id
 )
 select t.user_id,t.graded,t.correct,
  case when t.graded>0 then round(100.0*t.correct/t.graded,1) end,
  t.upset_hits,case when t.known_lines>0 then round(100.0*t.favorite_choices/t.known_lines,1) end,
  t.upset_size,t.favorite_choices,t.known_lines from totals t order by t.correct desc,t.user_id;
end;$function$;

CREATE OR REPLACE FUNCTION public.sec_league_brag_stats_v2(p_kind text, p_league uuid)
 RETURNS TABLE(user_id uuid, display_name text, graded_picks bigint, correct_picks bigint, accuracy_pct numeric, upsets_correct bigint, favorite_pick_pct numeric, biggest_upset numeric, favorite_picks bigint, eligible_lines bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select b.user_id,coalesce(p.display_name,'Player')::text,b.graded_picks,b.correct_picks,
  b.accuracy_pct,b.upsets_correct,b.favorite_pick_pct,b.biggest_upset,b.favorite_picks,b.eligible_lines
 from public.sec_league_brag_stats(p_kind,p_league) b
 left join public.sec_profiles p on p.user_id=b.user_id;
$function$;

CREATE OR REPLACE FUNCTION public.sec_member_pride(p_kind text, p_league uuid)
 RETURNS TABLE(user_id uuid, favorite_school_code text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null or p_league is null then raise exception 'Sign in required'; end if;
 if (p_kind='club' and not public.sec_club_is_member(p_league))
  or (p_kind='football' and not public.sec_is_member(p_league))
  or (p_kind in ('basketball','baseball') and not public.sec_sport_is_member(p_league))
  or p_kind not in ('club','football','basketball','baseball')
 then raise exception 'Not a league member';end if;
 return query select m.user_id,p.favorite_school_code from (
  select cm.user_id from public.sec_club_members cm where p_kind='club' and cm.club_id=p_league
  union all select fm.user_id from public.sec_members fm where p_kind='football' and fm.league_id=p_league
  union all select sm.user_id from public.sec_sport_members sm where p_kind in ('basketball','baseball') and sm.league_id=p_league
 ) m left join public.sec_profiles p on p.user_id=m.user_id;
end;$function$;

CREATE OR REPLACE FUNCTION public.sec_vote_game_reaction(p_game text, p_reaction text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=(select auth.uid()); prior public.sec_game_reactions%rowtype; game_id text;
begin
 if u is null then raise exception 'Log in to react';end if;
 if p_game is null or length(p_game) not between 8 and 120 then raise exception 'Invalid game';end if;
 if p_reaction not in ('fire','upset','hype','wow') or p_reaction is null then raise exception 'Unknown reaction';end if;
 game_id=split_part(p_game,':',2);
 if not (
   (left(p_game,9)='football:' and exists(select 1 from public.sec_games g where g.id=game_id))
   or
   (left(p_game,11)='basketball:' and exists(select 1 from public.sec_sport_games g where g.id=game_id and g.sport='basketball'))
   or
   (left(p_game,9)='baseball:' and exists(select 1 from public.sec_sport_games g where g.id=game_id and g.sport='baseball'))
 ) then raise exception 'Unknown game'; end if;
 -- Serialize rapid double submissions for this player and match.
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_game,0));
 select * into prior from public.sec_game_reactions where game_key=p_game and user_id=u for update;
 if found then
  if prior.changed_at>now()-interval '3 seconds' then raise exception 'Please wait 3 seconds before reacting again'; end if;
  if prior.reaction=p_reaction then p_reaction='none'; end if;
  update public.sec_game_reactions set reaction=p_reaction,changed_at=now() where game_key=p_game and user_id=u;
 else
  insert into public.sec_game_reactions(game_key,user_id,reaction) values (p_game,u,p_reaction);
 end if;
 return p_reaction;
end;$function$;
revoke all on function public.sec_member_pride(text,uuid) from public,anon;
grant execute on function public.sec_member_pride(text,uuid) to authenticated;
revoke all on function public.sec_league_brag_stats(text,uuid) from public,anon;
grant execute on function public.sec_league_brag_stats(text,uuid) to authenticated;
revoke all on function public.sec_league_brag_stats_v2(text,uuid) from public,anon;
grant execute on function public.sec_league_brag_stats_v2(text,uuid) to authenticated;
revoke all on function public.sec_vote_game_reaction(text,text) from public,anon;
grant execute on function public.sec_vote_game_reaction(text,text) to authenticated;
revoke all on function public.sec_game_reaction_totals(text) from public,anon,authenticated;
grant execute on function public.sec_game_reaction_totals(text) to anon,authenticated;
