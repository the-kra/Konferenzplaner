# HTL1 · Klassenkonferenz-Planungstool

> Planung & Live-Anzeige der Klassenkonferenzen an der HTL1 Lastenstraße Klagenfurt.
> Eine einzige `index.html` – kein Build, läuft offline im Browser. Optionale
> geräteübergreifende Live-Spiegelung (Beamer + Handys) über Supabase.

Design & Technik sind bewusst an das Schwesterprojekt
[**Matura-Einteilung**](https://the-kra.github.io/Pruefungseinteilung/) angelehnt
(HTL1-Logo, 7-Segment-Uhr, Master/Client-Live-Spiegelung).

---

## Was das Tool kann

- **4 Abteilungen mit Farbcodierung** – Elektrotechnik (rot), Maschinenbau (blau),
  Mechatronik (grün), Abendschule (dunkelblau). Farben und Startnummer (1–4) frei einstellbar.
- **Chronologische Steuerung** – Abteilungen in Reihenfolge der Startnummer,
  Klassen innerhalb alphabetisch. Startzeit + Dauer je Konferenz frei wählbar.
  Der Plan wird beim Import/Hinzufügen/Ändern **automatisch** aufgebaut.
- **„Plan zurücksetzen"** – sortiert die Liste wieder nach Abteilung (1–4) + Klasse
  und vergibt die geplanten Zeiten ab der Startzeit neu. Nützlich z. B. nachdem man
  per **„Vorverlegen"** manuell umsortiert hat. (Löscht **keine** Daten – dafür ist „Leeren".)
- **Live-Steuerung** (Main) – pro Konferenz **Start**, **Fertig**, **Vorverlegen**;
  dazu „Aktuelle fertig" / „Nächste starten". Die tatsächlichen Uhrzeiten entstehen erst hier.
- **Klassen verwalten** – per **+ Hinzufügen** neue Klasse anlegen, per **✕** entfernen.
- **Klassenvorstand (KV)** – wird importiert, in der Liste angezeigt und ist pro Klasse
  direkt in der Tabelle **editierbar** (Kürzel-Feld). Nur Klassen mit KV werden importiert.
- **Excel-/CSV-Import** – inklusive direktem WebUntis-Export
  (`Abteilung;Klasse;Langname;Klassenvorstand;StellvKV;Lehrer`, mehrere Zeilen pro Klasse werden zusammengeführt).
- **Lehrer-Filter (Zuseher)** – **Kürzel _oder_ Nachname** eingeben (case-insensitive) →
  alle betroffenen Klassen werden hervorgehoben (ganze Zeile farbig).
- **Lehrerliste optional** – standardmäßig ausgeblendet (übersichtlich); per Schalter
  „Lehrer anzeigen" einblendbar. Das Hervorheben funktioniert immer.
- **Live-Timer** – die laufende Konferenz zeigt eine mitlaufende Dauer (Master + Beamer).
- **Mobil-tauglich** – Anzeige/Beamer im Hochformat nutzbar; als Master am Handy gibt es eine
  Steuerleiste unten (Fertig / Nächste / Beamer).
- **Stand sichern / laden** – kompletter Plan als JSON exportier-/importierbar (manuelles Backup).
- **Master/Client-Prinzip** – ein Steuergerät (Master) treibt den Tag, beliebig viele
  Anzeige-Geräte (Beamer, Schülerhandys) sehen den Stand live; Teilen per Link/QR.
- **Beamer-Ansicht** – Vollbild mit großer 7-Segment-Uhr, „Jetzt in Konferenz",
  „Als Nächstes" und Live-Liste.
- **Farbanpassung** – Uhr und HTL1-Logo färben sich nach der aktuell laufenden Abteilung.
- **Stabil über Stunden** – Stand wird lokal gespeichert (`localStorage`), Reload-fest.

## Schnellstart (rein lokal)

1. `index.html` im Browser öffnen.
2. **Excel/CSV laden** (WebUntis-Export) oder **Demo-Daten** klicken.
3. Abteilungs-Reihenfolge/Farben & Startzeit prüfen (der Plan baut sich dabei automatisch auf).
4. Am Konferenztag: per **Start/Fertig** durchsteuern. **🖥 Beamer-Ansicht** für die Projektion.

Ohne weitere Konfiguration läuft alles lokal auf einem Gerät (Tabs im selben Browser
synchronisieren sich automatisch).

## Daten aus WebUntis holen (kompletter Ablauf)

Das Skript [`tools/untis-export.js`](tools/untis-export.js) liest **alle aktiven Klassen
samt Lehrern und Klassenvorstand** über das ganze Sommersemester aus WebUntis – ganz ohne
Sonderrechte (es kommt ohne die gesperrte `getTeachers()`-Funktion aus und baut die
Lehrer-Tabelle live aus den Stundenplänen auf).

1. In WebUntis einloggen (`htl1-klagenfurt.webuntis.com`).
2. **F12** drücken → Tab **Konsole**.
3. Den **kompletten Inhalt** von [`tools/untis-export.js`](tools/untis-export.js) hineinkopieren
   → **Enter**. (Bei Bedarf oben `SEM_START`/`SEM_END` anpassen.)
4. Warten, bis in der Konsole **„✓ Fertig!"** steht (scannt Woche für Woche, dauert etwas).
5. `untisCSV()` in die Konsole tippen → **Enter** → die Datei
   **`webuntis_klassen_lehrer_kv_SS.csv`** wird heruntergeladen.
6. Im Konferenztool (Main) auf **CSV laden** → diese CSV auswählen (der Plan wird automatisch aufgebaut).

Die CSV hat die Spalten:

```
Abteilung;Klasse;Langname;Klassenvorstand;StellvKV;Lehrer
"Mechatronik";"1AHME";"1AHME";"KR (Kraiger)";"";"AL (Albel)"
…
```

- Pro Lehrer eine Zeile – das Tool führt die Zeilen je Klasse automatisch zusammen.
- Lehrer/KV im Format `Kürzel (Nachname)` → daraus werden Kürzel **und** Nachname übernommen
  (für den Zuseher-Filter nach Kürzel oder Nachname).
- **Nur Klassen mit Klassenvorstand** werden importiert; der Rest wird gemeldet und übersprungen.
- `untisCSVTeacher()` liefert zusätzlich eine Lehrer→Klassen-Übersicht (optional).

Eine **anonymisierte Beispiel-CSV** (keine echten Personen) zum Ausprobieren des Formats liegt
unter [`tools/beispiel_klassen_lehrer.csv`](tools/beispiel_klassen_lehrer.csv).

> ⚠️ Die exportierten CSV-/Excel-Dateien enthalten echte Lehrer-/Klassendaten und sind
> per `.gitignore` vom Repository ausgeschlossen.

## Wenn der Master abstürzt – Wiederherstellung

Der Stand ist dreifach abgesichert:

1. **Automatisch, gleiches Gerät:** Jede Änderung wird sofort im Browser gespeichert
   (`localStorage`). Nach Absturz/Reload ist der Stand sofort wieder da; eine laufende
   Live-Session des Tages wird automatisch fortgesetzt.
2. **Automatisch / per Tap, anderes Gerät:** Bei aktiver Supabase-Spiegelung liegt der letzte
   Stand in der Cloud. Öffnet man den **Master-Link auf einem anderen Gerät** (z. B. Handy),
   fragt das Tool beim Start, ob der neuere Cloud-Stand übernommen werden soll – oder man tippt
   jederzeit auf **„📱 Master übernehmen"**. So bereitet man am PC vor und steuert dann am Handy
   weiter, ohne CSV/Datei zu übertragen.
3. **Manuell:** Mit **💾 Stand sichern** jederzeit ein JSON-Backup ziehen und mit
   **↺ Stand laden** auf jedem Gerät wiederherstellen.

## Geräteübergreifende Live-Spiegelung & Deployment

Für echten Beamer-/Handy-Betrieb über mehrere Geräte und das Hosting auf GitHub Pages:
siehe **[DEPLOYMENT.md](DEPLOYMENT.md)** (Supabase-Einrichtung Schritt für Schritt + Deploy).

> **Eigenes Supabase-Projekt nötig?** Nein. Das Tool kann dasselbe Projekt wie die
> Matura-App mitbenutzen – es schreibt in eine **eigene Zeile** (`id='konferenz'`) über eine
> **eigene RPC** (`set_konferenz_state`). Es muss nur diese eine RPC einmalig angelegt werden
> (SQL in [DEPLOYMENT.md](DEPLOYMENT.md), Abschnitt A2). Ein separates Projekt ist optional.

## Autor

**DI Theodor Kranz** · HTL1 Lastenstraße Klagenfurt · [kra@htl1-klu.at](mailto:kra@htl1-klu.at)
