-- Mogul City · Admin-Panel (admin.html): Statistik mit Stadt-Kennung, Teststadt markieren, Städte löschen.
-- Vorher überall den Platzhalter DEINE-PIN durch deine PIN ersetzen. Kann mehrfach ausgeführt werden, löscht beim Ausführen nichts.

-- Gelöschte Städte merken: ein Gerät, das die Stadt noch hat, legt sie dann nicht wieder an
create table if not exists deleted_codes (code text primary key, at timestamptz not null default now());
alter table deleted_codes enable row level security;

-- Speichern: Teststadt-Markierung vom Server bleibt erhalten, gelöschte Städte werden nicht neu angelegt
create or replace function put_save(p_code text, p_rev int, p_data jsonb)
returns void language sql security definer set search_path = public as $$
  insert into saves(code, rev, data, updated_at, name, worth, lvl, advisor)
  select p_code, p_rev, p_data, now(), p_data->>'name', (p_data->>'worthCache')::bigint, (p_data->>'lvl')::int, p_data->>'advisor'
  where not exists (select 1 from deleted_codes where code = p_code)
  on conflict (code) do update set rev = excluded.rev,
    data = case when saves.data ? 'test' then excluded.data || jsonb_build_object('test', saves.data->'test') else excluded.data end,
    updated_at = now(), name = excluded.name, worth = excluded.worth, lvl = excluded.lvl, advisor = excluded.advisor;
$$;

-- Statistik wie bisher, zusätzlich mit öffentlicher Stadt-Kennung (für die Admin-Aktionen)
create or replace function mc_stats(p_pin text, p_test boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare r json;
begin
  if p_pin is distinct from 'DEINE-PIN' then raise exception 'falsche PIN'; end if;
  with t as (select code from saves where data->>'test' is not null),
  k as (select e.*, e.ev || coalesce('_' || e.val, '') as key from events e where p_test or e.code not in (select code from t)),
  stadt as (
    select e.code,
      coalesce((select s.data->>'name' from saves s where s.code = e.code), '(ohne Namen)') as name,
      (select (s.data->>'lvl')::int from saves s where s.code = e.code) as lvl,
      (select (s.data->>'mission')::int from saves s where s.code = e.code) as ziel,
      (select (s.data->>'tut') from saves s where s.code = e.code) as tut,
      min(e.at) as erst, max(e.at) as zuletzt,
      count(*) filter (where e.ev = 'sitzung') as sitzungen,
      count(distinct date(e.at)) as tage,
      (array_agg(e.dev order by e.at desc))[1] as geraet,
      (array_agg(e.key order by e.at desc))[1] as letztes,
      bool_or(e.ev = 'app') as app,
      bool_or(e.ev = 'browser') as browser,
      e.code in (select code from t) as test,
      (select s.pub_id from saves s where s.code = e.code) as pub
    from k e group by e.code
  )
  select json_build_object(
    'stand', now(),
    'teststaedte', (select count(*) from t),
    'spieler', (select count(*) from stadt),
    'neu_24h', (select count(*) from stadt where erst > now() - interval '24 hours'),
    'aktiv_24h', (select count(*) from stadt where zuletzt > now() - interval '24 hours'),
    'aktiv_7d', (select count(*) from stadt where zuletzt > now() - interval '7 days'),
    'wiederkehrer', (select count(*) from stadt where tage >= 2),
    'trichter', (select json_agg(json_build_object('k', s.k, 'n', (select count(distinct code) from k where k.key = s.k)) order by s.o)
      from unnest(array['name_frage','name','anleitung','app','browser','tut_1','tut_3','tut_5','tut_8','tut_fertig',
        'level_3','level_5','level_7','level_10','level_15','level_20','ziel_5','ziel_10','ziel_15','ziel_20','land_2','land_3']) with ordinality as s(k, o)),
    'geraete', (select json_agg(json_build_object('k', g, 'n', n) order by n desc) from (select geraet as g, count(*) as n from stadt group by geraet) x),
    'tage', (select json_agg(json_build_object('k', d, 'spieler', n, 'neu', neu) order by d) from (
      select date(at) as d, count(distinct code) as n,
        count(distinct code) filter (where code in (select code from stadt where date(erst) = date(k.at))) as neu
      from k where at > now() - interval '14 days' group by date(at)) x),
    'fehler', (select json_agg(json_build_object('k', val, 'n', n, 'staedte', c) order by n desc) from (
      select val, count(*) as n, count(distinct code) as c from k where ev = 'fehler' group by val order by n desc limit 10) x),
    'staedte', (select json_agg(json_build_object('name', name, 'lvl', lvl, 'ziel', ziel, 'tut', tut, 'erst', erst, 'zuletzt', zuletzt,
      'sitzungen', sitzungen, 'tage', tage, 'geraet', geraet, 'letztes', letztes, 'app', app, 'browser', browser, 'test', test, 'pub', pub) order by zuletzt desc)
      from (select * from stadt order by zuletzt desc limit 200) x)
  ) into r;
  return r;
end $$;


-- Admin-Aktion für eine Stadt: 'test' = als Teststadt markieren, 'delete' = Stadt samt Ereignissen löschen
create or replace function admin_city(p_pin text, p_pub uuid, p_action text) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if p_pin is distinct from 'DEINE-PIN' then raise exception 'falsche PIN'; end if;
  select code into c from saves where pub_id = p_pub;
  if c is null then return 'nicht gefunden'; end if;
  if p_action = 'test' then
    update saves set data = data || '{"test":1}'::jsonb where code = c;
  elsif p_action = 'delete' then
    insert into deleted_codes(code) values (c) on conflict do nothing;
    delete from events where code = c; delete from saves where code = c;
  else return 'unbekannte Aktion'; end if;
  return 'ok';
end $$;

-- Alle Teststädte löschen
create or replace function admin_purge_tests(p_pin text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_pin is distinct from 'DEINE-PIN' then raise exception 'falsche PIN'; end if;
  insert into deleted_codes(code) select code from saves where data->>'test' is not null on conflict do nothing;
  delete from events where code in (select code from saves where data->>'test' is not null);
  delete from saves where data->>'test' is not null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function put_save(text, int, jsonb), mc_stats(text, boolean), admin_city(text, uuid, text), admin_purge_tests(text) from public;
grant execute on function put_save(text, int, jsonb), mc_stats(text, boolean), admin_city(text, uuid, text), admin_purge_tests(text) to anon;
