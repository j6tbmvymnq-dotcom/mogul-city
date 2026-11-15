# Cloud-Spielstand einrichten (Supabase, kostenloser Tarif)

Zweck vorerst: dieselbe Stadt auf iPhone, iPad und PC testen. Jede Stadt hat einen Code (8 Zeichen),
der im Link steht: `https://<deine-seite>/?code=K7QM2XPA`.

## 1. Projekt anlegen (machst du selbst)
1. Auf supabase.com ein Konto und ein neues Projekt anlegen (Region Frankfurt).
2. Im Projekt: **SQL Editor > New query**, folgenden Block einfügen und ausführen:

```sql
create table if not exists saves (
  code text primary key,
  rev int not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table saves enable row level security;   -- keine Policies: direkter Tabellenzugriff ist gesperrt

create or replace function get_save(p_code text)
returns table(rev int, data jsonb) language sql security definer set search_path = public as $$
  select rev, data from saves where code = p_code;
$$;

create or replace function put_save(p_code text, p_rev int, p_data jsonb)
returns void language sql security definer set search_path = public as $$
  insert into saves(code, rev, data, updated_at) values (p_code, p_rev, p_data, now())
  on conflict (code) do update set rev = excluded.rev, data = excluded.data, updated_at = now();
$$;

revoke all on function get_save(text), put_save(text, int, jsonb) from public;
grant execute on function get_save(text), put_save(text, int, jsonb) to anon;
```

3. **Project Settings > API**: „Project URL“ und den „anon public“-Schlüssel in `js/config.js` eintragen.

## 2. Bestenliste, Teststädte, Statistik: `docs/sql-einrichtung.sql`
Die Datei enthält alles ab hier in aktueller Form (inklusive Löschen der Testdaten) und ersetzt den Block unten.

### (alt) Bestenliste und Städte besuchen
Jede Stadt bekommt eine öffentliche Kennung (`pub_id`), getrennt vom geheimen Code. Besucher können nur ansehen.

```sql
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

create or replace function list_cities()
returns table(pub_id uuid, name text, worth bigint, lvl int, advisor text) language sql security definer set search_path = public as $$
  select pub_id, name, worth, lvl, advisor from saves where coalesce(name, '') <> '' and worth is not null
  order by worth desc limit 100;
$$;

create or replace function get_city(p_pub uuid)
returns jsonb language sql security definer set search_path = public as $$
  select data - 'cloudCode' - 'syncRev' - 'dirty' from saves where pub_id = p_pub;
$$;

create or replace function my_pub(p_code text)
returns uuid language sql security definer set search_path = public as $$
  select pub_id from saves where code = p_code;
$$;

revoke all on function list_cities(), get_city(uuid), my_pub(text) from public;
grant execute on function list_cities(), get_city(uuid), my_pub(text) to anon;
```
Die Städte von Viktor und Bella liegen fest im Spiel (`assets/staedte/`) und erscheinen immer in der Liste.

## Schritt 3: Nutzungsstatistik
Teil C von `docs/sql-einrichtung.sql` (vorher `DEINE-PIN` ersetzen). Danach zeigt
`statistik.html` (PIN eingeben) Spielerzahlen, Trichter (Name -> Home-Bildschirm -> Tutorial -> Level),
Geräte, Fehler und eine Liste aller Städte mit Level, Ziel, Sitzungen und letztem Ereignis.
Erfasst werden nur Meilensteine (Sitzung, Name, Anleitung, App-Start, Tutorial-Schritte, Level, Ziele,
Land, Skriptfehler), höchstens 300 pro Stadt und Stunde.

## Teststädte
Link einmal mit `?test=1` öffnen (z. B. `…/?test=1`): Die Stadt ist dauerhaft als Teststadt markiert.
Sie erscheint nicht in der Bestenliste normaler Spieler und nicht in der Statistik (dort per Schalter einblendbar).
`?test=0` hebt die Markierung auf. Im Menü steht dann „Teststadt“ neben der Version.

## Sicherheit (für die Testphase ausreichend)
- Die Tabelle selbst ist gesperrt; man kann nur über die zwei Funktionen mit einem bekannten Code lesen/schreiben.
  Niemand kann alle Spielstände auflisten. Ein Code hat ~1 Billion Möglichkeiten.
- Wer deinen Code kennt, kann deine Stadt laden. Für die Online-Phase kommen echte Konten (Supabase Auth).

## Abgleich
- Beim Öffnen und beim Zurückkehren in die App wird der Server-Stand geholt. Ist er neuer, wird er übernommen.
- Änderungen werden 4 Sekunden nach dem letzten Spielzug und beim Verlassen der App hochgeladen.
- Gleichzeitig auf zwei Geräten spielen: Wer zuletzt hochlädt, gewinnt (für Tests ok).

## Später: Benachrichtigungen auf iOS
Ab iOS 16.4 können Web-Apps vom Home-Bildschirm Push-Nachrichten empfangen. Benötigt: VAPID-Schlüssel,
Speichern der Push-Anmeldung in Supabase, eine Edge Function zum Senden und einen zeitgesteuerten Job
(pg_cron), der fällige Mieten erkennt. Gehört in die Online-Phase.
