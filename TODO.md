# Mogul City – ToDo (Stand 16.11.2026)

Grundregeln für alles: Laufende Spielstände müssen ohne Verlust weiterlaufen (Migration statt Neustart).
Alles Optische (Grafik, Licht, Schatten, Klang) macht **Fable** – Claude baut Technik, Steckplätze und Aufträge.
Reihenfolge = Vorschlag: erst Fehler und Bedienung, dann große Umbauten.

## A. Fehler (sofort)
1. **Flackern nach der Rakete** (Nutzer): Teile der Grafik flackern bei jedem Durchlauf eines Fortschrittsbalkens.
   Vermutung: Mond-Liste/Panorama wird bei jedem fertigen Durchgang neu aufgebaut, Bilder laden neu. → Bilder behalten,
   nur Zahlen/Balken ändern. *Claude*

## B. Bedienung (klein, schnell)
2. **Leiste entschlacken (vor allem Handy):** Grundleiste nur noch Bauen · Ziele · Vermieten · Kassieren.
   Neuer **Baumodus** (Knopf „Bauen“): darin Straße, Laden/Gebäude, 2D/3D-Umschalter. Der 2D-Knopf verschwindet aus der
   normalen Ansicht. **Umsetzen und Abreißen** nur noch aus dem Fenster des jeweiligen Gebäudes. Tutorial und
   Berater-Tipps anpassen (verweisen heute auf die Leisten-Knöpfe). *Claude*

## C. Karte als Küstenstadt (großer Umbau)
3. **Konzept & Technik:** statt Insel ein Küstenstreifen (Vorbild Kapstadt): eine Seite Meer mit Stränden/Buchten,
   gegenüber Berge/Hügel, dazwischen Bauland. Eine **Autobahn** kommt vom Kartenrand mit **Zollstation/Stadtgrenze**
   und hängt automatisch am Straßennetz (gilt als Netz-Anschluss „nach draußen“).
   - Jede Stadt bekommt einen **Seed** → eigene Küstenform, Strände, Bergkante, Autobahn-Verlauf (im sinnvollen Rahmen,
     keine Wiederholung; Grundstücks-Raster/Preise bleiben gleich).
   - Bestehende Städte: Seed aus dem Stadt-Code, bebaute Grundstücke bleiben bebaubar (Gelände nur auf freien Flächen
     und fremdem Land anders). *Claude*
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
6. **Balance kritisch prüfen** (Nutzer: Fabrik lohnt sich gegenüber Bagger nicht): Recherche, wie Idle-/Aufbauspiele
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
10. **Mehrfach-Ausbau:** Ausbau Stufe 2/3 gibt es seit gestern. Prüfen, ob weitere Stufen sinnvoll sind (Balance). *Claude*
11. **Forschungszentrum:** neues Gebäude mit Forschungen gegen Geld/Gold und Zeit: Bauzeiten −x %, seltenere Sachen
    häufiger finden, längere Kassier-Frist usw. Stufen mit steigenden Kosten, Late-Game-Senke für Geld. *Claude*,
    Grafik *Fable*

## G. Laufende Fable-Aufträge
12. Leben / Licht / Schatten (`docs/FABLE-LEBEN.md`) – läuft.
13. Haus-Ausbau-Grafiken (`docs/FABLE-AUSBAU.md`) – danach starten.
14. Neue Aufträge vorbereiten für C4, D7, E9, F11 (je `docs/FABLE-*.md` + Gerüst in `tools/svg/`).

## H. Nebenbei
15. Testspieler (`tools/test/teststadt.js`) an die Straßennetz-Regel anpassen, damit Wirtschafts-Messungen vergleichbar sind.
16. Sicherheits-SQL ausführen lassen (`supabase-sicherheit-mit-pin.sql`), dann FloriCity „Test entfernen“, Vocheltown „Verdacht“.
