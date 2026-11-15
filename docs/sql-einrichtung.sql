-- Mogul City · Einrichtung Supabase (Bestenliste, Teststädte, Nutzungsstatistik)
-- Komplett in den SQL-Editor kopieren und ausführen. Vorher DEINE-PIN (unten) durch eine eigene PIN ersetzen.
-- Kann gefahrlos mehrfach ausgeführt werden – AUSSER Teil A, der löscht alle bisherigen Spielstände.

-- A) Bisherige Testdaten löschen (alle Spielstände und Ereignisse)
delete from saves;
create table if not exists events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  code text not null,
  ev text not null,
  val text,
  dev text
);
delete from events;

-- B) Bestenliste und Städte besuchen. Teststädte (Spielstand mit "test") sehen nur andere Tester.
alter table saves add column if not exists pub_id uuid not null default gen_random_uuid();
alter table saves add column if not exists name text;
alter table saves add column if not exists worth bigint;
alter table saves add column if not exists lvl int;
alter table saves add column if not exists advisor text;

create or replace function put_save(p_code text, p_rev int, p_data jsonb)
returns void language sql security definer set search_path = public as $$
  insert into saves(code, rev, data, updated_at, name, worth, lvl, advisor)
  values (p_code, p_rev, p_data, now(), p_data->>'name', (p_data->>'worthCache')::bigint, (p_data->>'lvl')::int, p_data->>'advisor')
  on conflict (code) do update set rev = excluded.rev, data = excluded.data, updated_at = now(),
    name = excluded.name, worth = excluded.worth, lvl = excluded.lvl, advisor = excluded.advisor;
$$;

drop function if exists list_cities();
create or replace function list_cities(p_code text default null)
returns table(pub_id uuid, name text, worth bigint, lvl int, advisor text) language sql security definer set search_path = public as $$
  select s.pub_id, s.name, s.worth, s.lvl, s.advisor from saves s
  where coalesce(s.name, '') <> '' and s.worth is not null and coalesce(s.lvl, 0) >= 5
    and (s.data->>'test' is null or exists (select 1 from saves me where me.code = p_code and me.data->>'test' is not null))
  order by s.worth desc limit 100;
$$;

create or replace function get_city(p_pub uuid)
returns jsonb language sql security definer set search_path = public as $$
  select data - 'cloudCode' - 'syncRev' - 'dirty' - 'evs' from saves where pub_id = p_pub;
$$;

create or replace function my_pub(p_code text)
returns uuid language sql security definer set search_path = public as $$
  select pub_id from saves where code = p_code;
$$;

revoke all on function list_cities(text), get_city(uuid), my_pub(text) from public;
grant execute on function list_cities(text), get_city(uuid), my_pub(text) to anon;

-- C) Nutzungsstatistik pro Stadt (statistik.html)
create table if not exists events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  code text not null,
  ev text not null,
  val text,
  dev text
);
create index if not exists events_code_at on events (code, at);
alter table events enable row level security;   -- keine Policies: nur über die Funktionen

create or replace function log_event(p_code text, p_ev text, p_val text default null, p_dev text default null)
returns void language sql security definer set search_path = public as $$
  insert into events (code, ev, val, dev)
  select left(p_code, 12), left(p_ev, 24), left(p_val, 60), left(p_dev, 32)
  where (select count(*) from events where code = left(p_code, 12) and at > now() - interval '1 hour') < 300;
$$;

drop function if exists mc_stats(text);
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
      e.code in (select code from t) as test
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
      'sitzungen', sitzungen, 'tage', tage, 'geraet', geraet, 'letztes', letztes, 'app', app, 'browser', browser, 'test', test) order by zuletzt desc)
      from (select * from stadt order by zuletzt desc limit 200) x)
  ) into r;
  return r;
end $$;

revoke all on function log_event(text, text, text, text), mc_stats(text, boolean) from public;
grant execute on function log_event(text, text, text, text), mc_stats(text, boolean) to anon;
