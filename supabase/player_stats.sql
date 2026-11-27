-- =====================================================================
--  PAU Fantasy — scoring engine + player stats (Step 3D)
--  Run ONCE in Supabase → SQL Editor (new query).
-- =====================================================================


-- Fantasy points for every player in every game.
-- THE SCORING RULES LIVE HERE:
--   point 1 · rebound 1 · assist 2 · steal 3 · block 3 · house wins +2
create or replace view public.player_fixture_points
with (security_invoker = true) as
select
  ps.fixture_id,
  ps.player_id,
  f.gameweek_id,
  g.name as gameweek_name,
  (p.house_id = f.home_house_id) as is_home,
  case when p.house_id = f.home_house_id
       then f.away_house_id else f.home_house_id end as opponent_house_id,
  ps.points, ps.rebounds, ps.assists, ps.steals, ps.blocks,
  ( ps.points   * 1
  + ps.rebounds * 1
  + ps.assists  * 2
  + ps.steals   * 3
  + ps.blocks   * 3
  + case when f.status = 'finished' and (
          (p.house_id = f.home_house_id and f.home_score > f.away_score) or
          (p.house_id = f.away_house_id and f.away_score > f.home_score))
         then 2 else 0 end
  )::int as fantasy_points
from public.player_stats ps
join public.fixtures  f on f.id = ps.fixture_id
join public.gameweeks g on g.id = f.gameweek_id
join public.players   p on p.id = ps.player_id;

grant select on public.player_fixture_points to anon, authenticated;


-- What % of managers have each player in their current squad
create or replace function public.player_selection()
returns table (player_id int, selected_pct numeric)
language sql stable
set search_path = ''
as $$
  with target as (
    -- the open gameweek, or the last one if the season is over
    select coalesce(
      public.open_gameweek(),
      (select id from public.gameweeks order by deadline desc limit 1)
    ) as id
  ),
  latest as (
    -- each manager's most recent squad up to that gameweek
    select distinct on (pk.user_id) pk.user_id, pk.gameweek_id
    from public.picks pk
    join public.gameweeks g on g.id = pk.gameweek_id
    where g.deadline <= (select deadline from public.gameweeks where id = (select id from target))
    order by pk.user_id, g.deadline desc
  ),
  managers as (
    select count(*)::numeric as n from latest
  )
  select pk.player_id,
         round(100 * count(*) / nullif((select n from managers), 0), 1)
  from public.picks pk
  join latest l on l.user_id = pk.user_id and l.gameweek_id = pk.gameweek_id
  group by pk.player_id;
$$;

grant execute on function public.player_selection() to anon, authenticated;