# KingStats – iPhone-App (Ernährung & Training)

Kleine Web-App fürs iPhone (Homescreen-Symbol, ohne App Store). Sie trägt Mahlzeiten ins Repo
`garmin-dashboard` ein (`data/ernaehrung/`) und zeigt dazu die Garmin-Werte aus `data/store.json`.
Das Dashboard auf dem Laptop holt dieselben Daten beim Öffnen per `git pull`.

Die Master-Kopie liegt im privaten Repo unter `ernaehrung-app/`, veröffentlicht wird sie über ein
**separates öffentliches Repo** mit GitHub Pages (enthält nur diesen Code, keine Daten).
`kern.js` ist eine Kopie von `src/js/54-ernaehrung-kern.js` – `build.py` hält sie aktuell.

## Einrichtung (einmalig, ca. 5 Minuten)

### 1. Öffentliches Repo für die App
1. github.com → **New repository** → Name `ernaehrung-app`, **Public**, ohne README → *Create*.
2. Claude Bescheid geben – er lädt die App-Dateien hoch.
3. Im neuen Repo: **Settings → Pages** → *Source*: „Deploy from a branch“, *Branch*: `main`, Ordner `/ (root)` → *Save*.
   Nach 1–2 Minuten ist die App unter `https://a28j09j02.github.io/ernaehrung-app/` erreichbar.

### 2. Token für das iPhone
1. github.com → Profilbild → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name: `Ernährung iPhone`, Ablauf: z. B. 1 Jahr.
3. *Repository access*: **Only select repositories** → `garmin-dashboard`.
4. *Permissions → Repository permissions*: **Contents: Read and write**, **Actions: Read and write** (für den Sync-Knopf).
5. *Generate token* und den Wert (`github_pat_…`) kopieren.

### 3. Auf dem iPhone
1. Die App-Adresse in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. App vom Homescreen öffnen, Token einfügen → *Verbinden*.

### 4. Lebensmitteldatenbank laden
Im Repo `garmin-dashboard`: **Actions → „BLS importieren“ → Run workflow**. Danach in der App
*Profil → Datenbank aktualisieren*. (Markenprodukte und Barcodes kommen live von Open Food Facts.)

## Veröffentlichen (automatisch)
Jede Änderung an `ernaehrung-app/` im Branch `main` des privaten Repos wird vom Workflow
`.github/workflows/app-veroeffentlichen.yml` ins öffentliche Repo kopiert (Secret `APP_PUBLISH_TOKEN`).
Dabei wird die Version gestempelt (`APPV` in `index.html`, `version.txt`); die App prüft das beim Öffnen
und lädt sich bei einer neuen Version selbst neu. Nie von Hand ins öffentliche Repo schreiben.

## Funktionen (Auszug)
- **Statusleiste & Scrollbalken (19.11.2026)**: Im Stil „Apple Health“ ist die iPhone-Statusleiste durchsichtig (`black-translucent`, gesetzt in `design.js`) – das Farblicht reicht bis hinter Uhrzeit/Akku, die Kopfzeile zieht sich beim Scrollen darunter. Andere Stile behalten die normale Leiste. Scrollbalken sind ausgeblendet. Damit iOS die neue Leiste übernimmt, muss die App evtl. einmal vom Homescreen entfernt und neu hinzugefügt werden.
- **Schlafphasen (19.11.2026)**: Schlafdauer-Detail zeigt gestapelte Balken je Nacht (Wach · REM · Kern · Tief, umschaltbar auf „Dauer“), für die gewählte Nacht (Antippen im Diagramm) – den Minutenverlauf `hyp` liefert die Garmin-Personal-API nicht (geprüft 19.11.2026; Code dafür in `sync_hypnogram`, abgeschaltet) – je Phase Dauer, Anteil und Einordnung (Garmin-Richtwerte Tief 16–33 %, REM 21–31 %, Leicht 30–64 % der Schlafzeit), dazu den Schnitt im Zeitraum. Neue Kennzahl „Tiefschlaf“ unter Gesundheit → Erholung.
- **Yazio übernehmen**: einmaliger Workflow `.github/workflows/yazio-import.yml` (Secrets `YAZIO_EMAIL`/`YAZIO_PASSWORD`) → `tools/yazio_import.py` legt alle in YAZIO gegessenen Lebensmittel und Rezepte als Quelle „Yazio“ in `lebensmittel.json` an (Reiter „Yazio“ unter Meine Lebensmittel, auch in der Suche). Keine Doppelten, mehrfach ausführbar.
- **Design „Apple Health“ (19.11.2026, Standard)**: nach einer Bildschirmaufnahme der iOS-Health-App nachgebaut – rot-violettes Farblicht oben (mit eigener Akzentfarbe in dieser Farbe), großer linker Titel, der beim Scrollen zur kleinen mittigen Glas-Kopfzeile wird, runder Profilkreis rechts, graue Karten ohne Rand, Kategorie-Titel in Health-Farben (Schlaf #646dff, Herz #ff2d55, Aktivität #ff4f12, Körper #d22ff0), große Werte in runden Apple-Ziffern, Detailseiten schwarz mit Zeitraum-Schalter oben und Abschnitt „Über …“, Seiten gleiten von rechts mit rundem Zurück-Knopf, ruhige graue Hinweise, schwebende Glas-Leiste mit heller Pille. Dunkel (`apple`) und hell (`applehell`), wählbar unter Mehr → Design (Glas, Matt, Classic, Hell bleiben). Der ganze Stil steht als ein gegliederter Block am Ende des `<style>` in `index.html` (Abschnitte 1–12); `design.js` setzt dafür `data-ah` und `data-acc` am `<html>`. Einmalige Umstellung auf Apple Health je Gerät (Merker `ap` in `ern_theme`).
- **Design (11/2026)**: Apple-Stil mit Liquid Glass (schwebende Glas-Leiste unten, Glas-Kopfzeile, Hinweise als Glas-Kapsel oben, Fenster als iOS-Sheet), Schwarz/Weiß mit dem bisherigen Akzentblau.
- **Navigation**: untere Leiste überall gleich (Heute · Training · Todos · Gesundheit · Mehr); „Mehr“ öffnet das Seitenmenü (u. a. Ideen, Statistik). Einkaufsliste und eingebettetes Komplett-Dashboard sind entfallen – Zutaten werden zu Todos in „Einkaufen“, statt des Dashboards gibt es „Statistik“.
- **Todos** (`todos.js`): Formular bewusst einfach (Titel, vier Wiederholungen, Heute/Morgen, Uhrzeit; Rest unter „Mehr Optionen“). Todos mit Uhrzeit (z. B. Wäsche 17:30) melden sich ab dieser Uhrzeit, solange sie offen sind (`tools/mitteilungen.py` → `m_fristen`, Wecker 15:32/16:32 UTC). Kategorien, Wiederholungen (einmalig, täglich, werktags, Wochenende, Wochentage, alle x Tage, monatlich, jährlich), „bis erledigt“ (z. B. Abo kündigen: kommt jeden Monat wieder, bis abgehakt), Vorab-Erinnerung, Uhrzeit, Kalender, Auto-Haken (Kalorien tracken = sobald etwas eingetragen ist, Gewicht = sobald ein Gewicht für heute da ist). Erledigte werden durchgestrichen und wandern nach unten.
- **Training / Gesundheit / Statistik** (`gesund.js`): Training nur noch Training (heute, nächste Einheit, Woche Soll/Ist, Bereitschaft); Gesundheit mit Aktivitätsringen, Schlaf, HRV, Ruhepuls, Body Battery, Stress, Atmung, Körper; Statistik mit Laufen, Bestwerten, Training, Ernährung, Erholung im Vergleich zum Zeitraum davor.
- **Mitteilungen** (`mitteilungen.js`): Web-Push wie bei Kings Movies, Arten einzeln wählbar, Testknopf. Alte Anmeldungen (früherer Schlüssel) werden beim Start still erneuert.
- **Suche** (`suche.js`): Alltagswörter/Synonyme, Mehrzahl und Tippfehler im BLS, Markenprodukte offline (`data/off_de.json`) und automatische Live-Suche in Open Food Facts beim Tippen (gebremst, zwischengespeichert).
- **Sicherheit & Datenverkehr**: Content-Security-Policy (Verbindungen nur zu GitHub/Open Food Facts/CDN), Prüfsummen (SRI) für Fremd-Skripte, kein Referrer; GitHub-Abfragen mit ETag (unveränderte Dateien kommen als 304 ohne Inhalt). Im Tagebuch steht das Datum mit Pfeilen in der Kopfzeile, Tippen aufs Datum = heute.
- **Mahlzeiten wie bei Yazio**: im Tagebuch je Mahlzeit eine Zeile mit Ring (gegessen / Anteil am Tagesziel: Frühstück 30 %, Mittag 40 %, Abend 25 %, Snacks 5 % – `MSHARE`) und „+“. Antippen öffnet die Mahlzeit einzeln (Nährwerte, Einträge, Kopieren, Ideen).
- **Kopieren & Einfügen**: in der Mahlzeit „Kopieren“ → zu einem anderen Tag wechseln → 📋 an der gewünschten Mahlzeit (oder „Einfügen“ in der Mahlzeit). Die Kopie bleibt, bis eine neue kopiert oder sie mit ✕ verworfen wird. Leere Mahlzeit: „Wie gestern übernehmen“. Mit Rückgängig.
- **Einkaufsliste** (Seitenmenü): Freitext („500 g Hähnchen“, „3 Eier“), nach Ladenbereichen sortiert, antippen = abhaken, wischen = löschen.
  In jedem Gericht und bei jeder Idee: „🛒 Zutaten auf die Einkaufsliste“ (mit Portionszahl).
- **Bewertung** von Lebensmitteln und Gerichten (Top/Okay/Sparsam) – Regel in `kern.js` → `EK.bewertung`.
- **Worauf hast du Bock?**: Vorschläge, die noch ins Tagesziel passen, nach Lust (Süß, Herzhaft, Protein, Snack, Warm) –
  aus deinen Gerichten, Favoriten und der eingebauten Ideensammlung (`IDEEN` in `index.html`, Nährwerte Richtwerte je Portion).
  Sortiert danach, was die Proteinlücke am besten schließt. Ideen lassen sich als eigenes Gericht speichern.
  **Mag ich nicht** (dort und unter Profil): Wörter in `profil.json` → `magNicht` filtern Vorschläge nach Name und Zutaten (Mehrzahl und Umlaute egal, Synonyme in `DISL_SYN`, Ausnahmen in `DISL_EXC`, z. B. Erbsen ≠ Kichererbsen); einzelne Ideen ausblenden → `ideeAus`.

- **Wischen zum Schließen**: Jedes Fenster (Mahlzeit, Suche, Menge, Formulare …) geht mit Wischen nach rechts oder – ganz oben – Ziehen nach unten zu; das entspricht dem Knopf oben links (Zurück/Schließen). Formulare mit ungespeicherten Eingaben und ein angefangenes Gericht bleiben offen. Seitenmenü: nach links wischen schließt, vom linken Rand nach rechts wischen öffnet. Im Dashboard schließt Wischen das vergrößerte Diagramm (`src/js/96-wischen.js`).
- **Ausgleich & Cheat Days** (`EK.ausgleich`, `EK.ausSet`): Überschüsse werden auf die Folgetage verteilt. Abschaltbar unter Profil → „Überschuss ausgleichen“ (`profil.json` → `ausgleich:false`) oder je Tag im Tagebuch („Nicht ausgleichen“ / „Doch verteilen“, `ausTage`). Mehrere Cheat Days hintereinander zählen als Block: Ein Cheat Day bekommt selbst kein gesenktes Ziel, verteilt wird erst danach. Heute/künftige Tage lassen sich als Cheat Day markieren (`cheat`, 🍕 im Kalender).
- **Kein Zoom**: `touch-action: pan-x pan-y`, zweiter Finger wird abgebrochen, und falls die Seite doch vergrößert ist, springt sie sofort auf 100 % zurück – auch im Dashboard-Rahmen.
- **Vollständig eingetragen**: Ein Tag zählt erst ab 50 % seines Kalorienziels (`EK.voll` in `kern.js`). Darunter gilt er als „zu wenig eingetragen“: gestrichelt im Kalender, keine Ampel, zählt nicht für Streak, „Tage im Ziel“, Ausgleich und Durchschnitte – auch nicht für Streak-Erinnerung und ntfy-Meldungen (`tools/ern_voll.py`). Die Einträge bleiben sichtbar; im Tagebuch erscheint ein Hinweis.
- **Suche**: Wortsuche überall gleich (Reihenfolge egal, mit/ohne Leerzeichen – `matchWords`). Leere Suche: Favoriten, „Zuletzt gegessen“ (ohne Favoriten, erst 8 + „Mehr“) mit Knopf **↺ wie zuletzt** – trägt die letzte Menge/Einheit mit einem Tipp ein.
- **Meine Lebensmittel**: Suchfeld und Zähler je Reiter (Von dir · Favoriten · Gescannt).
- **Ziehen zum Aktualisieren** (Tagebuch, Mein Tag): oben nach unten ziehen → Repo-Stand prüfen, Warteschlange hochladen, bei Garmin-Werten älter als 30 Min. Cloud-Sync starten.
- **Offline-Start** (`sw.js`): Die App-Dateien werden zwischengespeichert, die App startet auch ohne Netz mit dem letzten Stand. Netz zuerst (max. 3 s), sonst Zwischenspeicher; GitHub-Anfragen und `version.txt` nie aus dem Speicher.
- **Streak-Erinnerung**: Teil der Mitteilungen (Profil → Mitteilungen → „Streak in Gefahr“, Uhrzeit wählbar).
- **Gym-Checkliste**: An Gym-Tagen zeigt „Training“ (und der Trainingsplan) die Übungen aus der Plan-Beschreibung als Checkliste – antippen = abhaken, nochmal = zurück. Sortiert nach Geräte-Reihenfolge im Studio (`GYM_ORDER` in `index.html`: Beinpresse → Rückenstrecker → weitere Beine → Bizeps → Trizeps → Schultern → Butterfly/Brust → Reverse Butterfly/Rudern/Latzug → Finisher → Rad). Gespeichert in `data/ernaehrung/gym.json`.
- **Trainingsplan-Haken**: Lauf zählt nur mit einer Laufaktivität, Gym nur mit Krafttraining (wie im Dashboard). Kurze Radfahrten (Schulweg) zählen nie.

## Daten
- `data/ernaehrung/profil.json` – Profil und Ziele
- `data/ernaehrung/lebensmittel.json` – eigene Lebensmittel, Favoriten, gescannte Produkte
- `data/ernaehrung/ziele.json` – Kalorienziel je Tag (von der App gerechnet), damit die Erinnerungen wissen, ab wann ein Tag zählt
- `data/ernaehrung/todos.json` – Todos · `gewicht.json` – in der App eingetragenes Gewicht · `push.json` – Geräte für Mitteilungen
- `data/ernaehrung/JJJJ-MM.json` – Tagebuch, ein Eintrag enthält die Nährwerte der gegessenen Menge
- `data/bls.json` – Bundeslebensmittelschlüssel (aus dem Workflow)

Offline: Änderungen landen in einer Warteschlange auf dem iPhone und werden beim nächsten Öffnen hochgeladen.

## Quellen
- Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe.
  DOI: 10.25826/Data20251217-134202-0 – Lizenz CC BY 4.0
- Open Food Facts (openfoodfacts.org) – Lizenz ODbL
