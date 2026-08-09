# Mine — Fassung 0.1

Erz graben, einschmelzen, Ringe schmieden, Aufträge erfüllen, Werkzeug
ausbauen. Läuft im Browser, ist auf dem Handy bedienbar und braucht kein
`npm install`.

- Der große Entwurf steht in [PLAN.md](PLAN.md).
- Warum diese Fassung so klein ist, steht in [KRITIK.md](KRITIK.md).

## Starten

```bash
cd mine
PORT=4100 node server.js       # dauerhaft: pm2 start server.js --name mine
```

Dann `http://localhost:4100` öffnen. Node ab Version 22.5 genügt — SQLite ist
dort eingebaut, es gibt keine Abhängigkeiten. Die Datenbank legt sich beim
ersten Start unter `data/mine.db` selbst an.

Port 4100, damit Torjäger auf 4000 unberührt bleibt.

## Was drin ist

| Teil | Umfang |
|---|---|
| Mine | Raster, 7 Spalten, nach unten offen; Kupfer, Silber, Amethyst |
| Zuhause | Ofen, Werkbank, Lager — als Bild, das sich sichtbar verändert |
| Schmuck | Kupferring, Silberring, Amethystring |
| Aufträge | fünf feste, einer nach dem anderen |
| Ausbauten | Spitzhacke, Rucksack, Lampe — je vier Stufen |
| Bestenliste | Wochenwertung, Reset Montag |
| Konto | Wiederherstellungscode, kein Passwort |

Bewusst **nicht** drin: Fabriken, Qualitätsstufen, Tages- und Wochenaufgaben,
weitere Erze. Die kommen erst, wenn sich das hier eine Woche lang gut anfühlt.

## Wie die Mine funktioniert

Du gräbst dich nach unten und kannst nicht zurück. Jeder Block kostet Schläge,
und tiefer Fels kostet mehr. Die Spitzhacke zieht pro Stufe einen Schlag ab,
mindestens einer bleibt. Der Abstieg endet, wenn der Rucksack voll ist oder
kein erreichbarer Block mehr bezahlbar ist.

Es gibt bewusst **keinen Energie-Timer**: nichts sperrt dich aus dem Spiel aus.
Die Grenze ist der Rucksack, und den leerst du sofort, indem du auftauchst.

## Die Zahlen

Alle Werte stehen in [`js/data.js`](js/data.js) und nirgendwo sonst. Sie sind
nicht geschätzt, sondern gemessen — über 400 simulierte Abstiege je
Ausbaustufe:

| Stufe | Tiefe | Kupfer | Silber | Amethyst | Rohwert |
|---|---:|---:|---:|---:|---:|
| Start | 34 m | 5,8 | 1,7 | 0,1 | 68 |
| Rucksack II | 47 m | 6,5 | 3,2 | 0,3 | 109 |
| + Lampe II | 53 m | 6,4 | 3,3 | 0,8 | 146 |
| + Spitzhacke II | 62 m | 6,3 | 3,5 | 1,2 | 176 |
| Alles III | 101 m | 6,1 | 4,1 | 3,3 | 334 |
| Alles IV | 154 m | 6,5 | 3,9 | 6,1 | 528 |

Zwei Werte hängen dabei zusammen und dürfen nicht getrennt geändert werden:
Ein Abstieg wirft rund neun Erz ab, deshalb fasst der Rucksack am Anfang nur
acht. Wäre er größer, hätte die erste Ausbaustufe **keine** Wirkung — genau
das war er vorher, und es ist beim Messen aufgefallen.

Gemessen im Spiel: der erste Auftrag ist nach zwei Abstiegen erfüllt, die erste
Ausbaustufe nach etwa drei.

## Aufbau

```
mine/
├── index.html      Gerüst aller vier Bildschirme
├── css/style.css   Optik
├── js/data.js      alle Zahlen — Erze, Rezepte, Ausbauten, Aufträge
├── js/mine.js      Berg und Abstieg
├── js/game.js      Spielstand, Regeln, Sicherung
├── js/ui.js        zeichnen und auf Tippen reagieren
├── server.js       Dateien + /api
└── data/mine.db    SQLite, legt sich selbst an
```

Der Berg wird nicht gespeichert, sondern aus einem Startwert berechnet: jedes
Feld ergibt sich allein aus `(startwert, spalte, reihe)`. Das hält den
Spielstand winzig — und erlaubt später, dieselbe Mine auf dem Server
nachzurechnen, ohne dem Gerät zu glauben.

## Spielstände

Der Spielstand trägt eine Versionsnummer (`DATA.standVersion`). Wird an den
Zahlen gedreht, sodass alte Stände nicht mehr passen, zählt man sie hoch und
ergänzt in `game.js` unter `migriere()` einen Schritt. Ohne das brechen die
Stände echter Spieler beim ersten Balancing.

Während des Spielens ist das Gerät die Wahrheit; der Server bekommt alle 20
Sekunden einen Schnappschuss. Ohne Netz läuft alles weiter. Beim Start gewinnt
der weiter fortgeschrittene Stand, der andere bleibt unter
`mine.stand.sicherung` liegen.

## Konto

Kein Passwort, sondern ein Wiederherstellungscode der Form `MINE-7K2P-QX4D`.
Er steht jederzeit im Reiter *Liste*. Wer ihn verliert und kein angemeldetes
Gerät mehr hat, verliert den Stand — dafür gibt es kein Passwort zum
Vergessen, nichts zu hashen und nichts zurückzusetzen.

## Zum Schummeln

Offen gesagt: Der Server glaubt dem Gerät. Wer die Konsole öffnet, kann sich
Geld eintragen. Für eine Runde unter Freunden ist das in Ordnung, und eine
Plausibilitätsprüfung wäre nur Theater — sie setzt einem Schummler eine
Obergrenze, statt ihn zu hindern (siehe KRITIK.md, Befund 05).

Soll die Liste ernst gemeint sein, ist der Weg vorgezeichnet: die Mine auf dem
Server würfeln lassen. Der Client meldet nur noch „ich schlage auf Feld 3", der
Server weiß aus `(startwert, spalte, reihe)`, was dort liegt. Ein einziger
Endpunkt, und er deckt fast alles ab, weil aller Wert aus der Mine stammt.

## Nächste Schritte

1. Eine Woche selbst spielen. Trägt der Kreislauf?
2. Wenn ja: Fabriken — aber nur verarbeitend, nie beschaffend, und langsamer
   als ein Spieler nachliefert (KRITIK.md, Befund 02).
3. Danach Qualitätsstufen und Tagesaufgaben.
