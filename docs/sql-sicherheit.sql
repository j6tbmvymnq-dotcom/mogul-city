-- Mogul City · Sicherheit (nach Audit 15.11.): Plausibilitätsprüfung, Admin-PIN mit Sperre, Freunde nur echt.
-- Vorher überall den Platzhalter DEINE-PIN durch deine PIN ersetzen. Kann mehrfach ausgeführt werden, löscht nichts.
-- Stand 16.11. (2): eigenständig ausführbar (alte Funktionsstände werden vorher entfernt). Die Teststadt-Markierung
-- entscheidet nur noch der Server – das Gerät des Spielers kann sie nicht wieder mitschicken (Fehler FloriCity).

create table if not exists deleted_codes (code text primary key, at timestamptz not null default now());
alter table deleted_codes enable row level security;
drop function if exists put_save(text, int, jsonb);
drop function if exists list_cities();
drop function if exists list_cities(text);
drop function if exists my_refs(text);
drop function if exists mc_stats(text);
drop function if exists mc_stats(text, boolean);
drop function if exists admin_city(text, uuid, text);
drop function if exists admin_purge_tests(text);
drop function if exists admin_ok(text);
drop function if exists admin_ok_last();

-- ---------- Admin-PIN: nach 10 Fehlversuchen in 15 Minuten gesperrt ----------
create table if not exists admin_fails (at timestamptz not null default now());
alter table admin_fails enable row level security;
create or replace function admin_ok(p_pin text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from admin_fails where at > now() - interval '15 minutes') >= 10 then
    perform set_config('mc.admin', 'gesperrt (zu viele Fehlversuche, 15 Min. warten)', true); return 'gesperrt';
  end if;
  if p_pin is distinct from 'DEINE-PIN' then
    insert into admin_fails default values;
    perform set_config('mc.admin', 'falsche PIN', true); return 'falsch';
  end if;
  delete from admin_fails where at < now() - interval '1 day';
  return 'ok';
end $$;
create or replace function admin_ok_last() returns text language sql as $$ select coalesce(current_setting('mc.admin', true), 'falsche PIN'); $$;

-- ---------- Speichern mit Plausibilitätsprüfung ----------
-- Unmögliche Sprünge (Level +6 oder Firmenwert x4 auf einen Schlag, neue Stadt mit hohem Level) werden nicht abgelehnt,
-- aber markiert: markierte Städte erscheinen nicht in der Bestenliste und zählen nicht als geworbene Freunde.
alter table saves add column if not exists flag text;
create or replace function put_save(p_code text, p_rev int, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare o record; nl int := coalesce((p_data->>'lvl')::int, 1); nw bigint := coalesce((p_data->>'worthCache')::bigint, 0); f text;
begin
  if exists (select 1 from deleted_codes where code = p_code) then return; end if;
  select lvl, worth, flag, data into o from saves where code = p_code;
  if found then
    f := o.flag;
    if f is null and (nl > coalesce(o.lvl, 1) + 5 or nw > greatest(coalesce(o.worth, 0) * 4, coalesce(o.worth, 0) + 5000000)) then
      f := 'Sprung: Level ' || coalesce(o.lvl, 1) || ' auf ' || nl || ', Wert ' || coalesce(o.worth, 0) || ' auf ' || nw;
    end if;
    update saves set rev = p_rev,
      -- Test-Markierung: nur die des Servers zählt (Admin setzt/entfernt sie); was das Gerät mitschickt, wird ignoriert
      data = case when o.data ? 'test' then (p_data - 'test') || jsonb_build_object('test', o.data->'test') else p_data - 'test' end,
      updated_at = now(), name = p_data->>'name', worth = nw, lvl = nl, advisor = p_data->>'advisor', flag = f
    where code = p_code;
  else
    f := case when nl > 12 or nw > 20000000 then 'Neu angelegt mit Level ' || nl || ', Wert ' || nw end;
    insert into saves(code, rev, data, updated_at, name, worth, lvl, advisor, flag)
    values (p_code, p_rev, p_data, now(), p_data->>'name', nw, nl, p_data->>'advisor', f);
  end if;
end $$;

-- ---------- Bestenliste ohne markierte Städte ----------
create or replace function list_cities(p_code text default null)
returns table(pub_id uuid, name text, worth bigint, lvl int, advisor text) language sql security definer set search_path = public as $$
  select s.pub_id, s.name, s.worth, s.lvl, s.advisor from saves s
  where coalesce(s.name, '') <> '' and s.worth is not null and coalesce(s.lvl, 0) >= 5 and s.flag is null
    and (s.data->>'test' is null or exists (select 1 from saves me where me.code = p_code and me.data->>'test' is not null))
  order by s.worth desc limit 100;
$$;

-- ---------- Freunde: nur unmarkierte Städte mit abgeschlossenem Tutorial ab Level 5 ----------
create or replace function my_refs(p_code text)
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('name', s.data->>'name', 'lvl', (s.data->>'lvl')::int) order by s.updated_at), '[]'::json)
  from saves me join saves s on s.data->>'ref' = me.pub_id::text and s.code <> me.code
  where me.code = p_code
    and coalesce((s.data->>'lvl')::int, 0) >= 5 and s.data->>'tut' = 'done' and s.flag is null
    and (s.data->>'test' is null or me.data->>'test' is not null);
$$;

-- ---------- Statistik (mit Markierung) ----------
create or replace function mc_stats(p_pin text, p_test boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare r json;
begin
  if admin_ok(p_pin) <> 'ok' then return json_build_object('error', admin_ok_last()); end if;
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
      (select s.pub_id from saves s where s.code = e.code) as pub,
      (select s.flag from saves s where s.code = e.code) as flag
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
      'sitzungen', sitzungen, 'tage', tage, 'geraet', geraet, 'letztes', letztes, 'app', app, 'browser', browser, 'test', test, 'pub', pub, 'flag', flag) order by zuletzt desc)
      from (select * from stadt order by zuletzt desc limit 200) x)
  ) into r;
  return r;
end $$;



-- ---------- Admin-Aktionen ----------
-- test / untest: Teststadt an/aus · flag / unflag: Verdacht setzen/aufheben · delete: Stadt löschen.
-- Bei test/untest steigt die Speicher-Version, damit das Gerät des Spielers die Änderung beim nächsten Öffnen übernimmt.
create or replace function admin_city(p_pin text, p_pub uuid, p_action text) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if admin_ok(p_pin) <> 'ok' then return admin_ok_last(); end if;
  select code into c from saves where pub_id = p_pub;
  if c is null then return 'nicht gefunden'; end if;
  if p_action = 'test' then update saves set data = data || '{"test":1}'::jsonb, rev = rev + 1 where code = c;
  elsif p_action = 'untest' then update saves set data = data - 'test', rev = rev + 1 where code = c;
  elsif p_action = 'flag' then update saves set flag = 'von Hand markiert' where code = c;
  elsif p_action = 'unflag' then update saves set flag = null where code = c;
  elsif p_action = 'delete' then
    insert into deleted_codes(code) values (c) on conflict do nothing;
    delete from events where code = c; delete from saves where code = c;
  else return 'unbekannte Aktion'; end if;
  return 'ok';
end $$;

create or replace function admin_purge_tests(p_pin text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if admin_ok(p_pin) <> 'ok' then return -1; end if;
  insert into deleted_codes(code) select code from saves where data->>'test' is not null on conflict do nothing;
  delete from events where code in (select code from saves where data->>'test' is not null);
  delete from saves where data->>'test' is not null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function admin_ok(text), admin_ok_last() from public, anon;
revoke all on function put_save(text, int, jsonb), list_cities(text), my_refs(text), mc_stats(text, boolean), admin_city(text, uuid, text), admin_purge_tests(text) from public;
grant execute on function put_save(text, int, jsonb), list_cities(text), my_refs(text), mc_stats(text, boolean), admin_city(text, uuid, text), admin_purge_tests(text) to anon;
