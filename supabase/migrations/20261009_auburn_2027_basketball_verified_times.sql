-- SEC men's basketball Auburn official times published October 7, 2026.
-- January 30 and February 27 have two possible tipoffs: keep early 10 AM CT lock.
-- Reuse existing 2027 SEC game IDs so user's stored pick references never change.
-- Source: https://auburntigers.com/news/2026/10/7/dates-times-and-networks-solidified-for-sec-mbb-schedule
insert into public.sec_sport_games(id,sport,season,week,espn_event_id,kickoff_at,away_code,away_name,home_code,home_name,source) values
('basketball-2027-sec-20270102-2-245','basketball',2027,10,'sec-20270102-2-245','2027-01-03T01:30:00.000Z','2','Auburn','245','Texas A&M','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270106-2633-2','basketball',2027,10,'sec-20270106-2633-2','2027-01-07T00:00:00.000Z','2633','Tennessee','2','Auburn','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270109-61-2','basketball',2027,10,'sec-20270109-61-2','2027-01-09T18:00:00.000Z','61','Georgia','2','Auburn','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270112-2-251','basketball',2027,11,'sec-20270112-2-251','2027-01-13T02:00:00.000Z','2','Auburn','251','Texas','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270116-145-2','basketball',2027,12,'sec-20270116-145-2','2027-01-17T01:30:00.000Z','145','Ole Miss','2','Auburn','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270119-2-238','basketball',2027,12,'sec-20270119-2-238','2027-01-20T00:00:00.000Z','2','Auburn','238','Vanderbilt','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270123-2-99','basketball',2027,12,'sec-20270123-2-99','2027-01-23T20:30:00.000Z','2','Auburn','99','LSU','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270126-344-2','basketball',2027,13,'sec-20270126-344-2','2027-01-27T00:00:00.000Z','344','Mississippi State','2','Auburn','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270130-2-333','basketball',2027,13,'sec-20270130-2-333','2027-01-30T16:00:00.000Z','2','Auburn','333','Alabama','Auburn Athletics · time window TBD · provisional lock'),
('basketball-2027-sec-20270206-201-2','basketball',2027,14,'sec-20270206-201-2','2027-02-06T20:30:00.000Z','201','Oklahoma','2','Auburn','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270209-57-2','basketball',2027,15,'sec-20270209-57-2','2027-02-10T00:00:00.000Z','57','Florida','2','Auburn','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270213-2-2579','basketball',2027,15,'sec-20270213-2-2579','2027-02-13T23:00:00.000Z','2','Auburn','2579','South Carolina','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270216-2-8','basketball',2027,16,'sec-20270216-2-8','2027-02-17T02:00:00.000Z','2','Auburn','8','Arkansas','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270220-142-2','basketball',2027,16,'sec-20270220-142-2','2027-02-20T17:00:00.000Z','142','Missouri','2','Auburn','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270224-99-2','basketball',2027,17,'sec-20270224-99-2','2027-02-25T00:00:00.000Z','99','LSU','2','Auburn','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270227-2-96','basketball',2027,17,'sec-20270227-2-96','2027-02-27T16:00:00.000Z','2','Auburn','96','Kentucky','Auburn Athletics · time window TBD · provisional lock'),
('basketball-2027-sec-20270302-2-145','basketball',2027,18,'sec-20270302-2-145','2027-03-03T03:00:00.000Z','2','Auburn','145','Ole Miss','Auburn Athletics · confirmed tipoff'),
('basketball-2027-sec-20270306-333-2','basketball',2027,18,'sec-20270306-333-2','2027-03-06T23:00:00.000Z','333','Alabama','2','Auburn','Auburn Athletics · confirmed tipoff')
on conflict(id) do update set
 kickoff_at=excluded.kickoff_at,
 source=excluded.source,
 updated_at=now()
 where public.sec_sport_games.game_status='scheduled';
