-- =====================================================================
--  PAU Fantasy — load the real roster + reset for the demo season (Step 5C)
--  Run ONCE in Supabase → SQL Editor (new query).
--  ⚠ This WIPES all squads, stats, check-ins and test players.
-- =====================================================================

-- 1. Wipe test data (squads, stats, check-ins)
truncate public.attendance, public.player_stats, public.picks restart identity;

-- 2. Reset every game to not-played
update public.fixtures set status = 'scheduled', home_score = null, away_score = null;

-- 3. Replace placeholder players with the real roster
delete from public.players;
alter sequence public.players_id_seq restart with 1;

-- Prices by tier: Star 12.0 · Starter 10.0 · Rotation 8.5 · Bench 7.0
insert into public.players (name, house_id, position, jersey_number, price)
select v.name, h.id, v.position, v.jersey, v.price
from (values
  ('Stephen', 'TSG', 'Guard', 3, 10.0),
  ('Bryce', 'TSG', 'Forward', 35, 12.0),
  ('Kelechi', 'TSG', 'Forward', 5, 10.0),
  ('Faiz', 'Madiba', 'Center', 23, 12.0),
  ('Lael', 'TSG', 'Guard', 32, 12.0),
  ('Shekinah', 'TSG', 'Center', 8, 10.0),
  ('Raymond', 'TSG', 'Forward', 12, 8.5),
  ('Kobi', 'Cirok', 'Center', 4, 8.5),
  ('Ovaisam', 'TSG', 'Guard', 24, 10.0),
  ('Ayomikun', 'Madiba', 'Guard', 35, 8.5),
  ('James', 'TSG', 'Guard', 23, 7.0),
  ('Adeleke', 'Madiba', 'Guard', 7, 12.0),
  ('Akilis', 'Blue Jays', 'Forward', 7, 7.0),
  ('Emmanuel', 'Madiba', 'Guard', 4, 7.0),
  ('Chibi', 'Madiba', 'Forward', 20, 12.0),
  ('Okpala', 'Madiba', 'Guard', 8, 10.0),
  ('Peter', 'Madiba', 'Forward', 5, 8.5),
  ('Pascal', 'Blue Jays', 'Forward', 32, 8.5),
  ('Kamara', 'TSG', 'Guard', 11, 7.0),
  ('Siri', 'Blue Jays', 'Guard', 8, 8.5),
  ('Teossy', 'Cirok', 'Forward', 0, 8.5),
  ('Edeoghon', 'Blue Jays', 'Guard', 21, 7.0),
  ('Pelumi', 'Madiba', 'Guard', 13, 8.5),
  ('Ose', 'Cirok', 'Forward', 3, 12.0),
  ('Femi', 'Cirok', 'Forward', 7, 12.0),
  ('Ebitimi', 'Cirok', 'Guard', 23, 10.0),
  ('Timmy', 'Cirok', 'Center', 20, 10.0),
  ('Philemon', 'Cirok', 'Guard', 10, 8.5),
  ('Joshua', 'Cirok', 'Forward', 12, 8.5),
  ('Nonye', 'Cirok', 'Guard', 35, 7.0),
  ('Dean', 'Cirok', 'Center', 21, 7.0),
  ('Etom', 'Blue Jays', 'Guard', 35, 12.0),
  ('Pedro', 'Blue Jays', 'Guard', 11, 10.0),
  ('Ayuba', 'Blue Jays', 'Forward', 25, 10.0),
  ('Miracle', 'Blue Jays', 'Guard', 4, 12.0),
  ('Iyin', 'Blue Jays', 'Guard', 12, 10.0),
  ('Isaac', 'Madiba', 'Forward', 0, 10.0),
  ('Alex', 'Blue Jays', 'Forward', 33, 7.0),
  ('Mitch', 'TSG', 'Guard', 20, 8.5),
  ('Roy', 'Madiba', 'Guard', 15, 7.0)
) as v(name, house, position, jersey, price)
join public.houses h on h.name = v.house;

-- 4. Demo-season deadlines
--    GW1 open until Sunday 10pm (classmates pick squads), GW2 open during the presentation
update public.gameweeks set deadline = '2026-11-29 22:00+01', is_finished = false where name = 'Gameweek 1';
update public.gameweeks set deadline = '2026-12-03 16:00+01', is_finished = false where name = 'Gameweek 2';
update public.gameweeks set deadline = '2026-12-10 16:00+01', is_finished = false where name = 'Gameweek 3';

-- 5. Check: should show 40 players — 10 in every house
select h.name as house, count(*) as players, round(avg(p.price), 2) as avg_price
from public.players p join public.houses h on h.id = p.house_id
group by h.name order by h.name;