-- Broadcast updates to public fixture/score records as soon as the existing
-- private ESPN importer writes them. Picks, players, leagues are NOT published.
-- Existing sec_games read-only RLS still applies to subscribers.
alter publication supabase_realtime add table public.sec_games;
