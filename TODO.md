# Mogul City – ToDo (Stand 16.11.2026)

Grundregeln für alles: Laufende Spielstände müssen ohne Verlust weiterlaufen (Migration statt Neustart).
Alles Optische (Grafik, Licht, Schatten, Klang) macht **Fable** – Claude baut Technik, Steckplätze und Aufträge.
Reihenfolge = Vorschlag: erst Fehler und Bedienung, dann große Umbauten.
**Veröffentlichen:** Fehlerbehebungen sofort. Alles andere erst, wenn es zu 100 % fertig ist (inkl. Fable-Grafiken, Tests).

## A. Fehler (sofort)
1. ~~**Flackern nach der Rakete**~~ – erledigt 16.11. (Nutzer): Teile der Grafik flackern bei jedem Durchlauf eines Fortschrittsbalkens.
   Vermutung: Mond-Liste/Panorama wird bei jedem fertigen Durchgang neu aufgebaut, Bilder laden neu. → Bilder behalten,
   nur Zahlen/Balken ändern. *Claude*

## B. Bedienung (klein, schnell)
2. ~~**Leiste entschlacken (vor allem Handy):**~~ – erledigt 16.11. Grundleiste nur noch Bauen · Ziele · Vermieten · Kassieren.
   Neuer **Baumodus** (Knopf „Bauen“): darin Straße, Laden/Gebäude, 2D/3D-Umschalter. Der 2D-Knopf verschwindet aus der
   normalen Ansicht. **Umsetzen und Abreißen** nur noch aus dem Fenster des jeweiligen Gebäudes. Tutorial und
   Berater-Tipps anpassen (verweisen heute auf die Leisten-Knöpfe). *Claude*

## C. ~~Karte als Küstenstadt~~ – erledigt und veröffentlicht 16.11.
3. **Konzept & Technik:** statt Insel ein Küstenstreifen (Vorbild Kapstadt): eine Seite Meer mit Stränden/Buchten,
   gegenüber Berge/Hügel, dazwischen Bauland. Eine **Autobahn** kommt vom Kartenrand mit **Zollstation/Stadtgrenze**
   und hängt automatisch am Straßennetz (gilt als Netz-Anschluss „nach draußen“).
   - Jede Stadt bekommt einen **Seed** → eigene Küstenform, Strände, Bergkante, Autobahn-Verlauf (im sinnvollen Rahmen,
     keine Wiederholung; Grundstücks-Raster/Preise bleiben gleich).
   - Bestehende Städte: Seed aus dem Stadt-Code, bebaute Grundstücke bleiben bebaubar (Gelände nur auf freien Flächen
     und fremdem Land anders). *Claude*
   - **Stand 16.11.:** Technik fertig (lokal, nicht veröffentlicht): Gelände je Seed (Meer/Strand/Dünen, Bergkette in
     Reihen nach hinten größer, Wald, Autobahn mit Zoll, Leuchtturm, Boote entlang der Küste), Seed im Spielstand
     (`S.seed`, bestehende Städte aus Stadt-Code/Gründungszeit), Bella/Viktor mit festem Seed. Tests grün, ~1 ms Zeichenzeit.
     **Autobahn-Anschluss (Nutzer 16.11.):** Hauptnetz bis zum Randfeld am Zoll = +5 % Miete und Ladenumsatz
     (`MC.HIGHWAY_BONUS`), blaues Zielfeld im Straßenbau, Tipp + Lob (vertont), Auffahrt nahtlos. Ohne Anschluss
     dauerhaft Stau vor dem Zoll, mit Anschluss fließender Verkehr.
     Fable-Nacharbeit geliefert (ausgeschnittene Schatten, `MC.SHADOW_CUT = true`).
4. **Grafik:** Gelände-Kacheln (Fels/Berg, Hang, Strand-Kanten, Klippen, Buchten), Autobahn-Kacheln, Zollstation,
   ggf. Leuchtturm/Hafen-Deko. *Fable* (Auftrag vorbereiten)

## D. Mond 2.0: richtig bevölkern (spätes Late Game)
5. **Konzept:** Der Mond als eigene **bebaubare Karte wie die Erde** (Häuser/Kuppeln, Verträge, Gewerbe – angepasst),
   aber Bauen kostet **Rohstoffe** statt Geld.
   - **Anfang teuer und langsam:** Die ersten Rohstoffe kommen per **Rakete von der Erde** (viel Geld, lange Flugzeit,
     kleine Ladung). Später eigene Förderung auf dem Mond, Abhängigkeit von der Erde sinkt.
   - **Raketen sichtbar:** Start von der Raumfähre auf der Erde, Flug, Landung auf dem Mond.
   - **Mond am Himmel:** Nach Freischaltung erscheint der Mond groß über der Karte (bzw. am Horizont) – antippen = hinfliegen.
   - Bisheriger Mond-Stand (Betriebe, Rohstoffe, Sammlungen) wird übernommen, nicht gelöscht. *Claude*
6. **Stand 16.11.:** Simulation `tools/wirtschaft/mond-sim.js` bestätigt: Bagger dominierten (34–52 % Ertrag), Fabrik 10–20 %,
   Raffinerie 1–7 %. Korrektur in `js/mond.js` (veröffentlicht 16.11. nach Freigabe): Bagger-Preisanstieg
   1,07 → 1,09, Fabrik 40 → 120, Raffinerie 25 → 150 je Durchgang → Fabrik/Raffinerie je ~33 %, Bagger 14 %.
   Regeln für Mond 2.0 (Game Developer „Math of Idle Games“, GameAnalytics): Kosten exponentiell 7–15 %/Stück, neue Stufe
   muss sich beim Freischalten besser rechnen als das nächste Stück der Vorstufe.
   **Balance kritisch prüfen** (Nutzer: Fabrik lohnt sich gegenüber Bagger nicht): Recherche, wie Idle-/Aufbauspiele
   Zahlen balancieren (Kostenwachstum, Ertrag je Investition, Amortisationszeit, Meilensteine, Sitzungslängen),
   daraus Zielwerte ableiten, per Simulation prüfen. *Claude*
7. **Grafik Mond 2.0:** Mond-Gelände, Mond-Gebäude im Iso-Stil, Raketen-Animation (Start/Flug/Landung), Mond am Himmel. *Fable*

## E. Late-Game-Schaufenster: der Milliardär
8. **Figur & Stadt:** unsympathischer Tech-Milliardär (eigene Figur, keine reale Person), riesige Stadt, beginnt den Mond
   zu bevölkern. Ab **Level 15** ruft er an („Komm vorbei!“), lädt auf seine Stadt ein und zeigt, was möglich ist.
   Danach steht er in der Bestenliste und ist besuchbar. Stadt per Generator mit echten Regeln (wie Viktor/Bella),
   inkl. Mond-Teil. Stimme lokal vertonen (Hörprobe vorher). *Claude*
9. **Grafik:** Porträt, Anruf-Bild, ggf. besondere Gebäude/Weltwunder für seine Stadt. *Fable*

## F. Spieltiefe (Nutzer-Wünsche)
11. **Forschungszentrum:** neues Gebäude mit Forschungen gegen Geld/Gold und Zeit: Bauzeiten −x %, seltenere Sachen
    häufiger finden, längere Kassier-Frist usw. Stufen mit steigenden Kosten, Late-Game-Senke für Geld. *Claude*,
    Grafik *Fable*

## G. Laufende Fable-Aufträge
12. Leben / Licht / Schatten + Haus-Ausbau – fertig (es fehlen nur `licht_w_freunde`, `schatten_blumenbeet`).
13. Vorbereitet, startet der Nutzer: `docs/FABLE-KUESTE.md`, `FABLE-MOND2.md`, `FABLE-MILLIARDAER.md`, `FABLE-FORSCHUNG.md`.

## H. Nebenbei
14. **Achtung Veröffentlichen:** `release.sh` macht `git add -A` – jede Fehlerbehebung nimmt auch halbfertige
    Funktionen mit. Solange C/D/E/F nicht fertig sind: Fehlerbehebung nur auf sauberem Stand (Zweig) veröffentlichen.
15. ~~Testspieler an die Straßennetz-Regel anpassen~~ – geprüft 16.11.: 0 von 101 Häusern/Läden abgehängt, L17 nach 174 h
    (vorher 168 h), L20 nach 278 h. Bekannt: Ziele „Volles Haus“/„Aufhübschen III“ erreicht der Testspieler nicht (Spielweise des Agenten).
16. Sicherheits-SQL ausführen lassen (`supabase-sicherheit-mit-pin.sql`), dann FloriCity „Test entfernen“, Vocheltown „Verdacht“.
