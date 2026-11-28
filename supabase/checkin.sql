-- =====================================================================
--  PAU Fantasy — QR attendance check-in (Step 5B)
--  Run ONCE in Supabase → SQL Editor (new query).
-- =====================================================================

-- A fan scans the QR at the game → this records their attendance (+5 pts)
create or replace function public.check_in(p_fixture_id int, p_code text)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_status   text;
  v_home     text;
  v_away     text;
  v_inserted int;
begin
  if v_user is null then
    raise exception 'Log in to check in';
  end if;

  select f.status, h.name, a.name
    into v_status, v_home, v_away
  from public.fixtures f
  join public.houses h on h.id = f.home_house_id
  join public.houses a on a.id = f.away_house_id
  where f.id = p_fixture_id;

  if not found then
    raise exception 'Game not found';
  end if;

  if not exists (
    select 1 from public.fixture_checkin_codes c
    where c.fixture_id = p_fixture_id and c.code = p_code
  ) then
    raise exception 'This QR code is not valid';
  end if;

  if v_status <> 'live' then
    raise exception 'Check-in only works while the game is live';
  end if;

  insert into public.attendance (user_id, fixture_id)
  values (v_user, p_fixture_id)
  on conflict (user_id, fixture_id) do nothing;

  get diagnostics v_inserted = row_count;

  return json_build_object('new', v_inserted > 0, 'home', v_home, 'away', v_away);
end;
$$;

revoke execute on function public.check_in(int, text) from public, anon;
grant  execute on function public.check_in(int, text) to authenticated;

-- Admins can see everyone's check-ins (for the live attendance count)
create policy "Admins read attendance" on public.attendance
  for select to authenticated
  using ((select public.is_admin()));