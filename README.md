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
- **Navigation**: untere Leiste überall gleich (Heute · Training · Ideen · Einkauf · Mehr); „Mehr“ öffnet das Seitenmenü. Im Tagebuch steht das Datum mit Pfeilen in der Kopfzeile, Tippen aufs Datum = heute.
- **Mahlzeiten wie bei Yazio**: im Tagebuch je Mahlzeit eine Zeile mit Ring (gegessen / Anteil am Tagesziel: Frühstück 30 %, Mittag 40 %, Abend 25 %, Snacks 5 % – `MSHARE`) und „+“. Antippen öffnet die Mahlzeit einzeln (Nährwerte, Einträge, Kopieren, Ideen).
- **Kopieren & Einfügen**: in der Mahlzeit „Kopieren“ → zu einem anderen Tag wechseln → 📋 an der gewünschten Mahlzeit (oder „Einfügen“ in der Mahlzeit). Die Kopie bleibt, bis eine neue kopiert oder sie mit ✕ verworfen wird. Leere Mahlzeit: „Wie gestern übernehmen“. Mit Rückgängig.
- **Einkaufsliste** (Seitenmenü): Freitext („500 g Hähnchen“, „3 Eier“), nach Ladenbereichen sortiert, antippen = abhaken, wischen = löschen.
  In jedem Gericht und bei jeder Idee: „🛒 Zutaten auf die Einkaufsliste“ (mit Portionszahl).
- **Bewertung** von Lebensmitteln und Gerichten (Top/Okay/Sparsam) – Regel in `kern.js` → `EK.bewertung`.
- **Worauf hast du Bock?**: Vorschläge, die noch ins Tagesziel passen, nach Lust (Süß, Herzhaft, Protein, Snack, Warm) –
  aus deinen Gerichten, Favoriten und der eingebauten Ideensammlung (`IDEEN` in `index.html`, Nährwerte Richtwerte je Portion).
  Sortiert danach, was die Proteinlücke am besten schließt. Ideen lassen sich als eigenes Gericht speichern.
  **Mag ich nicht** (dort und unter Profil): Wörter in `profil.json` → `magNicht` filtern Vorschläge nach Name und Zutaten (Mehrzahl und Umlaute egal, Synonyme in `DISL_SYN`, Ausnahmen in `DISL_EXC`, z. B. Erbsen ≠ Kichererbsen); einzelne Ideen ausblenden → `ideeAus`.

- **Suche**: Wortsuche überall gleich (Reihenfolge egal, mit/ohne Leerzeichen – `matchWords`). Leere Suche: Favoriten, „Zuletzt gegessen“ (ohne Favoriten, erst 8 + „Mehr“) mit Knopf **↺ wie zuletzt** – trägt die letzte Menge/Einheit mit einem Tipp ein.
- **Meine Lebensmittel**: Suchfeld und Zähler je Reiter (Von dir · Favoriten · Gescannt).
- **Ziehen zum Aktualisieren** (Tagebuch, Mein Tag): oben nach unten ziehen → Repo-Stand prüfen, Warteschlange hochladen, bei Garmin-Werten älter als 30 Min. Cloud-Sync starten.
- **Offline-Start** (`sw.js`): Die App-Dateien werden zwischengespeichert, die App startet auch ohne Netz mit dem letzten Stand. Netz zuerst (max. 3 s), sonst Zwischenspeicher; GitHub-Anfragen und `version.txt` nie aus dem Speicher.
- **Streak-Erinnerung** (Profil → 🔥 Streak-Erinnerung): Mitteilung am Abend, wenn heute noch nichts eingetragen ist. Nur in der App vom Homescreen (iOS 16.4+).
  Anmeldung in `data/ernaehrung/push.json`, Einstellung `profil.json` → `erinnerung:{an,uhr}`. Gesendet vom Workflow `streak-erinnerung.yml`
  (stündlich abends, `tools/streak_erinnerung.py`, höchstens 1× pro Tag, Zustand in `push_status.json`). Benötigt einmalig das Secret `VAPID_PRIVATE_KEY`;
  der öffentliche Gegenschlüssel steht als `VAPID` in `index.html`.
- **Trainingsplan-Haken**: Lauf zählt nur mit einer Laufaktivität, Gym nur mit Krafttraining (wie im Dashboard). Kurze Radfahrten (Schulweg) zählen nie.

## Daten
- `data/ernaehrung/profil.json` – Profil und Ziele
- `data/ernaehrung/lebensmittel.json` – eigene Lebensmittel, Favoriten, gescannte Produkte
- `data/ernaehrung/einkauf.json` – Einkaufsliste (gleiche Zutaten werden zusammengerechnet, Kategorie automatisch nach Stichworten)
- `data/ernaehrung/JJJJ-MM.json` – Tagebuch, ein Eintrag enthält die Nährwerte der gegessenen Menge
- `data/bls.json` – Bundeslebensmittelschlüssel (aus dem Workflow)

Offline: Änderungen landen in einer Warteschlange auf dem iPhone und werden beim nächsten Öffnen hochgeladen.

## Quellen
- Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe.
  DOI: 10.25826/Data20251217-134202-0 – Lizenz CC BY 4.0
- Open Food Facts (openfoodfacts.org) – Lizenz ODbL
