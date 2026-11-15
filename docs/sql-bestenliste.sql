-- Mogul City · Bestenliste: Städte erst ab Level 5 anzeigen (Teststädte sehen nur Tester). Im SQL-Editor ausführen, löscht nichts.
create or replace function list_cities(p_code text default null)
returns table(pub_id uuid, name text, worth bigint, lvl int, advisor text) language sql security definer set search_path = public as $$
  select s.pub_id, s.name, s.worth, s.lvl, s.advisor from saves s
  where coalesce(s.name, '') <> '' and s.worth is not null and coalesce(s.lvl, 0) >= 5
    and (s.data->>'test' is null or exists (select 1 from saves me where me.code = p_code and me.data->>'test' is not null))
  order by s.worth desc limit 100;
$$;
