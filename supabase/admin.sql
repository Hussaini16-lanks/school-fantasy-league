-- =====================================================================
--  PAU Fantasy — admin: save a game's result + player stats (Step 4B)
--  Run ONCE in Supabase → SQL Editor (new query).
-- =====================================================================

create or replace function public.admin_save_fixture(
  p_fixture_id int,
  p_status     text,
  p_home_score int,
  p_away_score int,
  p_stats      jsonb   -- [{ player_id, points, rebounds, assists, steals, blocks }, ...] for players who PLAYED
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  if p_status not in ('scheduled', 'live', 'finished') then
    raise exception 'Invalid status';
  end if;

  if p_status = 'finished' and (p_home_score is null or p_away_score is null) then
    raise exception 'Enter both scores before marking the game finished';
  end if;

  -- Every player must belong to one of the two houses in this game
  if exists (
    select 1
    from jsonb_array_elements(p_stats) s
    join public.players  p on p.id = (s->>'player_id')::int
    join public.fixtures f on f.id = p_fixture_id
    where p.house_id not in (f.home_house_id, f.away_house_id)
  ) then
    raise exception 'A player in the stats is not from either house in this game';
  end if;

  -- Result
  update public.fixtures
  set status = p_status, home_score = p_home_score, away_score = p_away_score
  where id = p_fixture_id;

  if not found then
    raise exception 'Game not found';
  end if;

  -- Replace this game's stat lines (players left out = did not play)
  delete from public.player_stats where fixture_id = p_fixture_id;

  insert into public.player_stats (fixture_id, player_id, points, rebounds, assists, steals, blocks)
  select p_fixture_id,
         (s->>'player_id')::int,
         coalesce((s->>'points')::int,   0),
         coalesce((s->>'rebounds')::int, 0),
         coalesce((s->>'assists')::int,  0),
         coalesce((s->>'steals')::int,   0),
         coalesce((s->>'blocks')::int,   0)
  from jsonb_array_elements(p_stats) s;
end;
$$;

revoke execute on function public.admin_save_fixture(int, text, int, int, jsonb) from public, anon;
grant  execute on function public.admin_save_fixture(int, text, int, int, jsonb) to authenticated;