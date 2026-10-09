-- Expand trophy award catalog to every documented SEC, historic and nonconference rivalry.
-- Non-destructive: existing 15 award IDs are preserved. No pick or score tables changed.
-- Public catalog has only teams and classifications, no player data.
create table if not exists public.sec_rivalry_definitions(
 id text primary key,
 first_team text not null,
 second_team text not null,
 category text not null check(category in ('SEC','Nonconference','Historic')),
 kind text not null check(kind in ('trophy','named','series','historic')),
 constraint sec_rivalry_teams_order check(first_team < second_team)
);
create unique index if not exists sec_rivalry_pair_unique on public.sec_rivalry_definitions(first_team,second_team);
alter table public.sec_rivalry_definitions enable row level security;
revoke all on public.sec_rivalry_definitions from public,anon,authenticated;
grant select on public.sec_rivalry_definitions to anon,authenticated;
drop policy if exists sec_rivalry_definitions_public_read on public.sec_rivalry_definitions;
create policy sec_rivalry_definitions_public_read on public.sec_rivalry_definitions for select to anon,authenticated using(true);
insert into public.sec_rivalry_definitions(id,first_team,second_team,category,kind) values
('iron-bowl','ALA','AUB','SEC','trophy'),
('third-saturday','ALA','TENN','SEC','named'),
('golden-boot','ARK','LSU','SEC','trophy'),
('southwest-classic','ARK','TAMU','SEC','trophy'),
('deep-south','AUB','UGA','SEC','named'),
('cocktail-party','FLA','UGA','SEC','trophy'),
('governors-cup','LOU','UK','Nonconference','trophy'),
('magnolia-bowl','LSU','MISS','SEC','trophy'),
('golden-egg','MISS','MSST','SEC','trophy'),
('battle-line','ARK','MIZ','SEC','trophy'),
('mayors-cup','MIZ','SC','SEC','trophy'),
('red-river','OU','TEX','SEC','trophy'),
('palmetto-showdown','CLEM','SC','Nonconference','trophy'),
('lone-star','TAMU','TEX','SEC','trophy'),
('tennessee-vanderbilt','TENN','VAN','SEC','series'),
('alabama-florida','ALA','FLA','SEC','series'),
('alabama-georgia','ALA','UGA','SEC','series'),
('first-saturday-november','ALA','LSU','SEC','series'),
('highway-82','ALA','MSST','SEC','series'),
('alabama-ole-miss','ALA','MISS','SEC','series'),
('arkansas-ole-miss','ARK','MISS','SEC','series'),
('arkansas-texas','ARK','TEX','SEC','series'),
('auburn-florida','AUB','FLA','SEC','series'),
('tiger-bowl','AUB','LSU','SEC','series'),
('auburn-ole-miss','AUB','MISS','SEC','series'),
('auburn-tennessee','AUB','TENN','SEC','series'),
('florida-kentucky','FLA','UK','SEC','series'),
('florida-lsu','FLA','LSU','SEC','series'),
('florida-tennessee','FLA','TENN','SEC','series'),
('georgia-south-carolina','SC','UGA','SEC','series'),
('georgia-tennessee','TENN','UGA','SEC','series'),
('georgia-vanderbilt','UGA','VAN','SEC','series'),
('beer-barrel','TENN','UK','SEC','trophy'),
('kentucky-vanderbilt','UK','VAN','SEC','series'),
('lsu-mississippi-state','LSU','MSST','SEC','series'),
('lsu-texas-am','LSU','TAMU','SEC','series'),
('tiger-sooner','MIZ','OU','SEC','trophy'),
('ole-miss-vanderbilt','MISS','VAN','SEC','series'),
('south-carolina-tennessee','SC','TENN','SEC','series'),
('alabama-clemson','ALA','CLEM','Nonconference','series'),
('alabama-georgia-tech','ALA','GT','Nonconference','series'),
('alabama-penn-state','ALA','PSU','Nonconference','series'),
('arkansas-texas-tech','ARK','TTU','Nonconference','series'),
('auburn-clemson','AUB','CLEM','Nonconference','series'),
('auburn-georgia-tech','AUB','GT','Nonconference','series'),
('auburn-tulane','AUB','TULANE','Nonconference','series'),
('sunshine-showdown','FLA','FSU','Nonconference','trophy'),
('florida-miami','FLA','MIAMI','Nonconference','trophy'),
('georgia-clemson','CLEM','UGA','Nonconference','series'),
('clean-old-fashioned-hate','GT','UGA','Nonconference','trophy'),
('kentucky-centre','CENTRE','UK','Historic','historic'),
('kentucky-indiana','IND','UK','Nonconference','series'),
('battle-on-broadway','TRANS','UK','Historic','historic'),
('battle-for-rag','LSU','TULANE','Nonconference','trophy'),
('arch-rivalry','ILL','MIZ','Nonconference','named'),
('telephone-trophy','ISU','MIZ','Nonconference','trophy'),
('border-war','KU','MIZ','Nonconference','trophy'),
('missouri-nebraska','MIZ','NEB','Nonconference','trophy'),
('nebraska-oklahoma','NEB','OU','Nonconference','named'),
('bedlam','OKST','OU','Nonconference','trophy'),
('mid-south','MEM','MISS','Nonconference','named'),
('ole-miss-tulane','MISS','TULANE','Nonconference','series'),
('south-carolina-north-carolina','SC','UNC','Nonconference','series'),
('tennessee-georgia-tech','GT','TENN','Nonconference','series'),
('texas-baylor','BAY','TEX','Nonconference','series'),
('texas-rice','RICE','TEX','Nonconference','series'),
('texas-tcu','TCU','TEX','Nonconference','series'),
('chancellors-spurs','TEX','TTU','Nonconference','trophy'),
('battle-brazos','BAY','TAMU','Nonconference','named'),
('texas-am-tcu','TAMU','TCU','Nonconference','series'),
('texas-am-texas-tech','TAMU','TTU','Nonconference','series'),
('gold-cowbell','GT','VAN','Nonconference','trophy'),
('sewanee-vanderbilt','SEWANEE','VAN','Historic','historic')
on conflict(id) do update set first_team=excluded.first_team,second_team=excluded.second_team,
 category=excluded.category,kind=excluded.kind;
alter table public.sec_trophy_history drop constraint if exists sec_trophy_history_trophy_id_check;
alter table public.sec_trophy_history drop constraint if exists sec_trophy_history_rivalry_fkey;
alter table public.sec_trophy_history add constraint sec_trophy_history_rivalry_fkey
 foreign key(trophy_id) references public.sec_rivalry_definitions(id);
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
 select caller,p_league,r.id,g.id,extract(year from g.game_date)::int,p.pick_code,g.winner,(p.pick_code=g.winner)
 from public.sec_league_picks p
 join public.sec_games g on g.id=p.game_id
 join public.sec_rivalry_definitions r
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
revoke all on function public.sec_sync_trophy_history(uuid) from public,anon;
grant execute on function public.sec_sync_trophy_history(uuid) to authenticated;
