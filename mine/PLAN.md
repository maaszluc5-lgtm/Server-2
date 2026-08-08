# Minenspiel — Bauplan

Du gräbst dich in die Tiefe, schleppst Erz nach Hause, machst daraus Schmuck,
erfüllst Kundenaufträge — und steckst das Geld in Fabriken und dein Zuhause,
damit du noch tiefer graben kannst.

## Der Kreislauf

```
Mine → Erz → Schmelze → Werkbank → Auftrag → Geld → Ausbau → (tiefer!)
```

Jede Runde muss spürbar schneller werden: bessere Spitzhacke heißt härtere
Blöcke, härtere Blöcke heißen teurere Erze, teurere Erze heißen teurerer
Schmuck. Die Fabriken sorgen dafür, dass auch etwas passiert, während man nicht
spielt — das ist der Grund, am nächsten Tag wieder reinzuschauen.

**Die eine Regel:** Jede neue Sache im Spiel muss entweder Zeit sparen, mehr
Wert erzeugen oder etwas Neues freischalten. Alles andere lassen wir weg.

## Technik

Wie Torjäger: eine Seite, ein kleiner Node-Server, keine Build-Tools. Neu ist
nur die Datenbank, weil Spielstände dauerhaft überleben müssen.

```
mine/
├── index.html        Grundgerüst + alle Bildschirme
├── css/style.css     Optik (dunkel, Handy zuerst)
├── js/data.js        Erze, Rezepte, Fabriken, Ausbauten — nur Tabellen
├── js/game.js        Spiellogik, Ticker, Speichern
├── js/mine.js        Das Grabe-Raster
├── js/ui.js          Bildschirme zeichnen
├── server.js         Dateien + /api (Login, Spielstand, Bestenliste)
└── data/mine.db      SQLite

Start:  cd mine && npm i ws better-sqlite3 && PORT=4100 node server.js
Dauer:  pm2 start server.js --name mine
```

Port 4100, damit Torjäger auf 4000 unangetastet bleibt. Alle Balancing-Zahlen
stehen in `data.js` — das Spiel lässt sich umbauen, ohne Logik anzufassen.

### Server-Routen

| Route | Macht |
|---|---|
| `POST /api/register` | Konto anlegen: Name + Passwort, sonst nichts |
| `POST /api/login` | Anmelden, gibt ein Token zurück |
| `GET /api/state` | Spielstand laden |
| `POST /api/state` | Spielstand sichern, alle 15 s und bei wichtigen Aktionen |
| `GET /api/leaderboard` | Bestenliste, 30 s gecacht |

## Die Mine

Ein Querschnitt durch den Berg, sechs Blöcke breit und nach unten offen. Du
tippst auf einen Block, der Block bricht, du fällst ein Stück tiefer. Jeder
Block hat eine Härte, deine Spitzhacke eine Stärke — ist die Härte höher, geht
der Block nicht kaputt. Das ist die Bremse im Spiel, nicht eine Wartezeit.

- **Energie:** 100 Stück, jeder Block kostet 1. Regeneration 1 alle 30 s (voll
  in 50 min), mit Bett-Ausbau bis auf 8 s runter.
- **Aufzug:** alle 50 m eine Station, einmalig freikaufen, danach Start dort.
- **Gefahren ab 150 m:** Lava, Einstürze, Gasblasen — kosten Energie oder Teile
  der Ladung. Grund für Helm, Stiefel, Lampe.
- **Rucksack:** begrenzt. Voll heißt hoch und abliefern.

### Erze nach Tiefe

| Erz | Tiefe | Härte | Wert roh | Verwendung |
|---|---:|---:|---:|---|
| Kohle | 0–20 m | 1 | 2 | Brennstoff der Schmelze |
| Kupfer | 5–40 m | 2 | 5 | einfache Ringe |
| Eisen | 15–60 m | 3 | 9 | Werkzeug, Fabrikteile |
| Silber | 40–110 m | 4 | 22 | Ketten, Ohrringe |
| Gold | 70–160 m | 5 | 48 | Fassungen |
| Amethyst | 100–220 m | 6 | 90 | erster Edelstein |
| Topas | 140–300 m | 7 | 150 | Schleiferei lohnt sich |
| Smaragd | 200–420 m | 8 | 280 | gehobene Aufträge |
| Rubin | 300–600 m | 9 | 520 | Kronen |
| Saphir | 380–700 m | 10 | 640 | Kronen |
| Diamant | 500–900 m | 12 | 1 200 | Meisterstücke |
| Mondstein | ab 250 m, selten | 11 | 2 500 | Blaupausen, Prestige |

Die Werte verdoppeln sich grob pro Stufe — eine Tiefe tiefer soll sich wie ein
Sprung anfühlen, nicht wie ein Prozent.

## Zuhause

### Schmuck herstellen

Beim Herstellen läuft ein Genauigkeits-Balken; ein guter Treffer hebt die
Qualitätsstufe. Die Werkbank-Stufe verbreitert das Trefferfenster.

| Stück | Barren | Steine | Formfaktor |
|---|---:|---:|---:|
| Ring | 2 | 1 | 1,8× |
| Ohrringe | 2 | 2 | 2,0× |
| Armreif | 4 | 2 | 2,2× |
| Kette | 6 | 2 | 2,4× |
| Krone | 20 | 8 | 3,5× |

`Verkaufspreis = Materialwert × Formfaktor × Qualität`

| Qualität | Faktor | Wann |
|---|---:|---|
| Roh | 0,7× | Balken verfehlt |
| Gut | 1,0× | Standardtreffer |
| Fein | 1,4× | im inneren Feld |
| Meisterwerk | 2,0× | exakt mittig, ab Werkbank III |

### Ausbauten

| Ausbau | Bringt | Stufen |
|---|---|---|
| Werkbank | größeres Trefferfenster, bessere Qualität | I–V |
| Lager | 200 → 5 000 Plätze | I–VI |
| Bett | Energie 30 s → 8 s pro Punkt | I–V |
| Tresor | Offline-Puffer 4 h → 24 h | I–IV |
| Werkstatt | 1 → 4 Stücke gleichzeitig | I–IV |
| Vitrine | Schmuck ausstellen → Prestige für die Bestenliste | I–III |
| Garten & Deko | nur Optik, plus etwas Prestige | frei |

Kosten pro Stufe: `Grundpreis × 1,8^Stufe`.

## Fabriken

Jede Fabrik hat Eingangsstapel, Durchsatz pro Minute und Puffer. Voller Puffer
heißt Stillstand — das hält den Tresor-Ausbau interessant und verhindert
unendliches Geld nach einer Woche Pause.

| Fabrik | Macht | Preis | Stufe 1 |
|---|---|---:|---|
| Schmelze | 3 Erz → 1 Barren, braucht Kohle | 5 000 | 12 Erz/min |
| Schleiferei | Rohstein → geschliffen, +60 % Wert | 16 000 | 4 Steine/min |
| Drahtzieherei | Barren → Draht (für Ketten, Armreifen) | 51 000 | 20 Draht/min |
| Galvanik | Chance auf eine Qualitätsstufe mehr | 164 000 | 2 Stück/min |
| Verpackung | +15 % Verkaufspreis, doppelte Auftragsbelohnung | 524 000 | 6 Stück/min |

Preise wachsen mit `5 000 × 3,2^(n−1)`, Stufen-Ausbau mit `1,7^Stufe`.

## Aufgaben

Schmuck einfach zu verkaufen bringt den Grundwert; über einen Auftrag bringt
dasselbe Stück deutlich mehr. Aufträge lenken damit das Spiel, ohne zu zwingen.

- **Kundenaufträge:** 3 Plätze, Nachschub alle 20 min. „2× Silberring,
  mindestens Gut“ → Geld, Erfahrung, Ruf. Einer darf weggeworfen werden, der
  zweite nur gegen Wartezeit.
- **Tagesaufgaben:** 5 Stück täglich. Alle erledigt gibt eine Kiste.
- **Wochenauftrag:** großer Brocken, Belohnung ist eine Blaupause für
  Sonderstücke, die man nicht kaufen kann.
- **Geschichte:** ~20 verkettete Aufgaben, die alles einführen. Das ist das
  Tutorial — es gibt keinen extra Erklär-Bildschirm.

**Ruf** entscheidet, wie gute Aufträge nachrücken. So kann man nicht ewig
billige Aufträge abgrasen.

## Login und Bestenliste

Name plus Passwort, kein E-Mail-Zwang. Passwort mit `scrypt` gehasht, Token im
Browser. Der Spielstand liegt auf dem Server: gleicher Stand auf Handy und
Rechner, und ein geleerter Browser vernichtet nicht alles.

| Bestenliste | Gewertet wird |
|---|---|
| Vermögen | insgesamt verdientes Geld |
| Zuhause | Wert aller Ausbauten plus Vitrine |
| Tiefe | tiefster je erreichter Punkt |
| Woche | Verdienst seit Montag 00:00, danach Reset |

### Zum Schummeln

Ein Spiel, das im Browser rechnet, ist nie ganz sicher. Vollständig
fälschungssicher wäre nur, jeden Hammerschlag serverseitig nachzurechnen — zu
viel Aufwand für dieses Projekt. Pragmatisch reicht:

- Plausibilitätsprüfung beim Speichern (Geld pro Minute, Tiefensprung pro
  Minute) — Unplausibles wird nicht übernommen.
- Höchstens eine Speicheranfrage alle 5 s pro Konto.
- Auffällige Konten auf eine Prüfliste statt sofortiger Sperre.

## Bildschirme

Fünf Reiter unten: **Mine** (Raster, Tiefe, Energie, Rucksack), **Zuhause**
(Räume, Werkbank, Ausbauten, Vitrine), **Fabrik** (Anlagen, Puffer, Ausbau),
**Aufträge** (Kunden, Tag, Woche, Geschichte), **Rangliste** (vier Listen).

Optik wie Torjäger: dunkler Grund, kräftige Akzentfarbe, große Tippflächen,
eine Spalte bis max. 520 px. Farben diesmal aus dem Berg — Schiefer, Kupfer,
Amethyst.

## Reihenfolge

Sieben Phasen, jede endet mit etwas Spielbarem. Ab Phase 3 kann man es zeigen.

| Phase | Inhalt | Fertig, wenn |
|---|---|---|
| 1 · −10 m | Ordner, `server.js`, Bildschirm-Umschaltung, Speichern lokal, Ticker | die Seite auf Port 4100 läuft und einen Zähler über einen Neustart hinweg behält |
| 2 · −50 m | Blockraster, Spitzhacke, Energie, Rucksack, erste 5 Erze, Aufzug | Graben 15 Minuten am Stück Spaß macht |
| 3 · −100 m | Schmelzofen, Werkbank mit Balken, 4 Schmuckstücke, Verkauf, Lager | der Kreislauf einmal ganz herumläuft |
| 4 · −200 m | Kundenaufträge, Tagesaufgaben, Ruf, Geschichte, erste Ausbauten | ein neuer Spieler ohne Erklärung zurechtkommt |
| 5 · −350 m | 5 Fabriken, Puffer, Offline-Berechnung, Tresor | 8 h Pause eine sinnvolle Menge Material ergeben |
| 6 · −500 m | SQLite, Registrierung, Login, Cloud-Spielstand, 4 Bestenlisten, Prüfung | derselbe Stand auf Handy und Rechner erscheint |
| 7 · −900 m | Töne, Animationen, tiefe Erze, Gefahren, Blaupausen, PWA, Balancing | jemand freiwillig eine zweite Woche spielt |

## Entschieden

- **Grabe-Raster statt Wartebalken.** Ein Klick-und-warte-Spiel wäre schneller
  gebaut, aber die Mine ist der Kern. Ist Graben langweilig, rettet der Rest
  das Spiel nicht.
- **Spielstand auf dem Server, nicht nur im Browser.** Eine Bestenliste ohne
  serverseitigen Stand ist wertlos, und ein verlorener Spielstand nach zwei
  Wochen beendet das Projekt sofort.
- **Kein Framework, kein Build.** Das Repo hat keins, der Server läuft mit pm2,
  Änderungen sollen ein Hochladen sein und kein Neubauen.

Offen: ein späterer Mehrspieler-Teil (gemeinsame Aufträge, Handelsposten unter
Freunden). Die WebSocket-Technik von Torjäger ließe sich dafür fast unverändert
übernehmen — frühestens nach Phase 7.
