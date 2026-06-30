# Deployment & Supabase-Einrichtung (Schritt für Schritt)

Diese Anleitung beschreibt **(A)** die Supabase-Einrichtung für die geräteübergreifende
Live-Spiegelung und **(B)** das Hosting auf GitHub Pages. Wer das Tool nur lokal auf einem
Gerät nutzt, braucht **nichts davon** – `index.html` öffnen genügt.

---

## Überblick: wie die Live-Spiegelung funktioniert

```
  ┌──────────────┐   set_konferenz_state(payload, key)   ┌────────────────────┐
  │   MASTER      │ ───────────  RPC  (schreibt)  ──────► │ Supabase            │
  │  (Steuergerät)│                                       │ Tabelle live_state  │
  └──────────────┘                                        │  id = 'konferenz'   │
                                                          └─────────┬──────────┘
  ┌──────────────┐        Realtime postgres_changes                 │
  │ ANZEIGE       │ ◄──────────  (liest live mit)  ──────────────────┘
  │ Beamer/Handys │
  └──────────────┘
```

- Der **Master** schreibt seinen Stand alle ~0,8 s (nur bei echter Änderung) via
  RPC `set_konferenz_state` in **eine Zeile** `id='konferenz'` der Tabelle `live_state`.
- **Anzeige-Geräte** lesen diese Zeile und abonnieren Änderungen per Supabase-Realtime.
- Geschrieben wird **ausschließlich** über die RPC, die mit einem **Schlüssel** (`LIVE_KEY`)
  abgesichert ist. Anzeige-Geräte dürfen nur lesen.

> **Hinweis zum Schwesterprojekt:** Das Matura-Tool nutzt dieselbe Tabelle `live_state`,
> aber die Zeile `id='matura'` und die RPC `set_live_state`. Das Konferenztool benutzt eine
> **eigene Zeile** `id='konferenz'` und eine **eigene RPC** `set_konferenz_state` – beide
> Tools können also dasselbe Supabase-Projekt teilen, ohne sich gegenseitig zu überschreiben.

---

## A) Supabase einrichten

### A0. Projekt

Entweder das **bestehende** Projekt des Matura-Tools weiterverwenden
(`https://excopftemuwsxmqwyxrn.supabase.co`) – dann existieren Tabelle `live_state` und
Realtime bereits, und es fehlt **nur die neue RPC (Schritt A2)** – oder ein neues Projekt
auf [supabase.com](https://supabase.com) anlegen und A1–A4 komplett ausführen.

### A1. Tabelle + Leserechte (überspringen, falls schon vorhanden)

Supabase Dashboard → **SQL Editor** → neue Query → einfügen → **Run**:

```sql
-- Tabelle für den Live-Stand (gemeinsam für alle Tools, je eine Zeile pro Tool)
create table if not exists public.live_state (
  id         text primary key,
  payload    jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security an
alter table public.live_state enable row level security;

-- JEDER (anon) darf LESEN – nötig, damit Anzeige-Geräte den Stand sehen.
drop policy if exists "live_state read" on public.live_state;
create policy "live_state read" on public.live_state
  for select using (true);

-- KEINE direkte INSERT/UPDATE-Policy! Geschrieben wird nur über die RPC unten.
```

### A2. Schreib-RPC für das Konferenztool (immer ausführen)

```sql
-- Schreibt den Konferenz-Stand, abgesichert durch den Schlüssel.
-- SECURITY DEFINER = läuft mit Tabellenrechten, umgeht RLS gezielt für genau diese Zeile.
create or replace function public.set_konferenz_state(p_payload jsonb, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Dieser Schlüssel = das Admin-Passwort (im Browser per Login eingegeben).
  -- Im index.html steht NUR der SHA-256-Hash davon, nicht das Passwort selbst.
  if p_key <> 'HTL1-Lasten!2026' then
    raise exception 'invalid key';
  end if;

  insert into public.live_state (id, payload, updated_at)
  values ('konferenz', p_payload, now())
  on conflict (id) do update
    set payload = excluded.payload,
        updated_at = now();
end;
$$;

-- Anonyme Clients (der Master im Browser) dürfen die RPC aufrufen:
grant execute on function public.set_konferenz_state(jsonb, text) to anon;
```

### A3. Realtime aktivieren (überspringen, falls schon für `live_state` aktiv)

```sql
-- Macht Änderungen an der Tabelle als Realtime-Events verfügbar.
alter publication supabase_realtime add table public.live_state;
```

> Falls die Meldung *„relation is already member of publication"* kommt: alles gut,
> Realtime war schon aktiv (z. B. durch das Matura-Tool). Einfach ignorieren.

### A4. Schlüssel (URL + anon/publishable key) holen

Dashboard → **Project Settings → API**:

- **Project URL** → in `index.html` bei `SUPABASE_URL`
- **anon / publishable key** → in `index.html` bei `SUPABASE_ANON_KEY`

---

## B) `index.html` konfigurieren

Im **zweiten `<script>`-Block ganz unten** (Abschnitt *LIVE-SPIEGELUNG*) diese Konstanten
prüfen/setzen:

```js
const SUPABASE_URL      = "https://DEINPROJEKT.supabase.co"; // aus A4
const SUPABASE_ANON_KEY = "sb_publishable_…";                // aus A4
const LIVE_KEY          = "HTL1-Lastenstrasse-KONF2026";     // MUSS = Schlüssel in A2
const RPC_NAME          = "set_konferenz_state";             // wie in A2
const ROW_ID            = "konferenz";                       // eigene Zeile
```

> Wichtig: `LIVE_KEY` hier und der Schlüssel in der SQL-Funktion (A2) müssen **identisch**
> sein, sonst schlägt das Schreiben fehl (Statuspunkt bleibt rot/„getrennt").
> Der Schlüssel steht im Client-Code – er verhindert *versehentliches* Steuern, ist aber
> kein echtes Geheimnis. Für den Schuleinsatz ist das wie beim Matura-Tool ausreichend.

---

## C) Rollen & Links

Die Rolle wird über die URL bestimmt:

| Aufruf | Rolle | Verhalten |
| --- | --- | --- |
| `index.html` | **Master (lokal)** | Steuerung, ohne Cloud-Spiegelung (Einzelgerät) |
| `index.html?mode=master&key=HTL1-Lastenstrasse-KONF2026` | **Master (live)** | Steuerung **und** Spiegelung an alle Anzeige-Geräte |
| `index.html?mode=master&key=FALSCH` | **Gesperrt** | nur Anzeige + Warnbanner (falscher Schlüssel) |
| `index.html?mode=anzeige` | **Anzeige** | Nur-Lese-Beamer-/Handy-Ansicht, live |

**Ablauf am Konferenztag:**

1. Master öffnen: `…/index.html?mode=master&key=HTL1-Lastenstrasse-KONF2026`
2. Im Live-Panel (unten rechts) **„▶ Konferenztag starten"** klicken.
3. Den **Anzeige-Link** bzw. **QR-Code** aus dem Panel an Beamer und Lehrer/Schüler verteilen
   (`…/index.html?mode=anzeige`).
4. Auf den Anzeige-Geräten erscheint automatisch die Beamer-Ansicht; Lehrer können unten links
   ihr **Kürzel** eingeben, um die eigenen Klassen hervorzuheben.
5. Am Ende **„■ Konferenztag beenden"** → Anzeige-Geräte gehen in den Ruhe-Bildschirm.

---

## D) Auf GitHub Pages deployen

Repository: <https://github.com/the-kra/Konferenzplaner.git>

```bash
cd /Users/theodor/Projects/Konferenztool

git init
git branch -M main
git remote add origin https://github.com/the-kra/Konferenzplaner.git

# Dank .gitignore landen nur index.html, README.md, DEPLOYMENT.md
# und tools/untis-export.js im Repo – KEINE CSV-/Excel-Daten.
git add .
git status        # kontrollieren: keine *.csv / *.xlsx / .DS_Store dabei
git commit -m "Klassenkonferenz-Planungstool"
git push -u origin main
```

Dann im Repo auf GitHub:

**Settings → Pages → Build and deployment → Source: „Deploy from a branch"
→ Branch: `main` / `/ (root)` → Save.**

Nach ein paar Minuten ist das Tool erreichbar unter:

```
https://the-kra.github.io/Konferenzplaner/
```

> GitHub Pages liefert standardmäßig `index.html` als Startseite – die Datei muss also genau
> so heißen (tut sie).

### Aktualisieren

```bash
git add index.html
git commit -m "Update"
git push
```

---

## E) Schnelltest

1. Master-Link mit gültigem `key` öffnen → unten rechts erscheint das rote Live-Panel.
2. „Konferenztag starten" → Statuspunkt wird **grün** (= Schreiben in Supabase ok).
   - Bleibt er rot: `LIVE_KEY` ↔ SQL-Schlüssel prüfen (A2/B), bzw. RPC/Grant in Supabase.
3. Anzeige-Link in einem zweiten Gerät/Browser öffnen → Beamer-Ansicht erscheint live.
4. Im Master eine Konferenz **Start/Fertig** → die Anzeige zieht innerhalb ~1 s nach.
