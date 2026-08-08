# Was am Bauplan nicht stimmt

Gegenprüfung von [PLAN.md](PLAN.md). Der Plan ist zu groß, und in seiner Mitte
steckt ein Widerspruch: die Fabriken machen genau den Teil überflüssig, der
Spaß machen soll. Zehn Befunde, nach Gefährlichkeit sortiert — die ersten drei
entscheiden, ob das Spiel je fertig wird.

**3 × tödlich · 4 × tut später weh · 3 × übersehen**

## Die kurze Antwort

Die Idee trägt, der Zuschnitt nicht. Graben, Schmuck machen, Aufträge
erfüllen, Zuhause ausbauen ist eine in sich geschlossene Spielidee. Was in
PLAN.md steht, ist aber die Vollversion nach einem Jahr — nicht das, was als
Nächstes zu bauen ist. Dazu kommen drei Design-Entscheidungen, die ungeprüft
aus Handy-Spielen übernommen wurden und diesem Projekt aktiv schaden.

---

## 01 · TÖDLICH — Der Plan ist ungefähr fünfmal Torjäger

**Zahlen:** Torjäger ist fertig und hat 708 Zeilen Spiellogik über sieben
Bildschirme, inklusive Sammelalbum und Online-Modus. Der Minenplan enthält
Grabe-Raster, Inventar, Handwerks-Minispiel, fünf Fabriken mit
Offline-Rechnung, vier Aufgabenarten, Konto, vier Bestenlisten und sieben
Ausbaulinien. Realistisch 3 500 bis 5 000 Zeilen Logik.

**Folge:** Phase 2 macht Spaß, Phase 4 zieht sich, Phase 6 kommt nie. Das Spiel
bleibt bei 70 % liegen, und niemand hat es je gespielt.

**Stattdessen:** Ein senkrechter Schnitt durch alles statt sieben Phasen
nacheinander — siehe Empfehlung unten.

## 02 · TÖDLICH — Die Fabriken machen die Mine überflüssig

**Problem:** Im Plan steht: Schmelze Stufe 1 verarbeitet 12 Erz pro Minute. Von
Hand gräbt man in einer aktiven Stunde vielleicht 60–120 Erz. Die Fabrik
schafft in derselben Stunde 720. Sobald sie läuft, ist Graben die schlechteste
Art, Zeit zu investieren.

**Folge:** Der Teil, der das Spiel ausmacht, wird zur Nebensache. Genau daran
gehen Spiele kaputt, die ein aktives Herz mit einem Automatik-System
kombinieren.

**Stattdessen:** Eiserne Regel — **Fabriken verarbeiten, sie beschaffen nie.**
Erz entsteht ausschließlich durch Handarbeit in der Mine. Und der Durchsatz
muss knapp *unter* dem liegen, was ein Spieler heranschafft (etwa 1 Erz alle
20 Sekunden), damit man das Gefühl hat, die Anlage zu füttern, statt ihr
zuzusehen.

## 03 · TÖDLICH — Das Energie-System bestraft die Leute, die spielen wollen

**Problem:** 100 Energie, ein Punkt alle 30 s, 50 Minuten bis voll. Die
Mechanik kommt aus Spielen, die Energie verkaufen. Hier wird nichts verkauft —
übrig bleibt nur der bestrafende Teil.

**Folge:** Wer abends 20 Minuten Zeit hat, spielt vier davon, ist leer und
macht die App zu. Beim zweiten Mal macht er sie nicht mehr auf.

**Stattdessen:** Die Grenze aus der Welt holen, nicht aus der Uhr: Rucksack
wird voll, Lampe brennt herunter, Spitzhacke stumpft ab. Alles drei löst man
mit einem Gang nach Hause — sofort, ohne Warten. Derselbe Rhythmus aus Abstieg
und Rückkehr, aber niemand wird ausgesperrt.

## 04 · TUT WEH — Die Bestenliste friert nach drei Wochen ein

**Problem:** „Insgesamt verdientes Geld“ belohnt den Startzeitpunkt, nicht das
Können. Wer eine Woche später anfängt, erreicht Platz 1 rechnerisch nie.

**Stattdessen:** Wochenliste wird die Hauptliste, sichtbar auf dem ersten
Bildschirm, Reset Montag. Gesamtvermögen bleibt als Ehrentafel daneben.

## 05 · TUT WEH — Die Schummelprüfung ist Theater

**Problem:** Lässt der Server „höchstens X Geld pro Minute“ durch, verdient ein
Schummler eben genau X pro Minute — automatisch, rund um die Uhr. Die Prüfung
setzt nur eine Obergrenze, sie hindert nicht.

**Stattdessen:** Entweder ehrlich sagen „die Liste ist Spaß unter Freunden“ und
die Prüfung weglassen — oder das eine Stück serverseitig machen, das zählt:
**das Grabe-Raster erzeugt der Server.** Der Client meldet „ich schlage auf
Feld 3“, der Server weiß, was dort liegt, und schreibt es gut. Ein einziger
Endpunkt, der fast die gesamte Angriffsfläche abdeckt, weil aller Wert im
Spiel aus der Mine stammt.

## 06 · TUT WEH — Passwörter sind mehr Arbeit, als sie hier wert sind

**Problem:** Konto ohne E-Mail heißt: Passwort vergessen = Konto weg = Handbetrieb
in der Datenbank. Dazu HTTPS als Pflicht, korrektes Hashing, Sicherungen.

**Stattdessen:** Wiederherstellungscode statt Passwort. Beim ersten Start gibt
es `MINE-7K2P-QX4D`, im Gerät gespeichert und jederzeit im Menü einsehbar.
Neues Gerät: Code eingeben. Kein Hashing, kein Zurücksetzen. Ehrlicher Preis:
Wer den Code verliert und kein angemeldetes Gerät mehr hat, ist trotzdem raus —
trifft aber weniger Leute als vergessene Passwörter.

## 07 · TUT WEH — Das Zuhause ist im Plan eine Tabelle, kein Zuhause

**Problem:** Gewünscht war „damit kann man sein Zuhause besser machen“.
Geliefert hat der Plan Werkbank I–V und Lager I–VI: eine Verwaltungsmaske mit
Kaufknöpfen.

**Stattdessen:** Das Zuhause muss ein Bild sein, das sich sichtbar verändert —
aus dem Holzschuppen wird eine Goldschmiede, die Vitrine zeigt die tatsächlich
hergestellten Stücke. Erst danach die Zahlen dahinter. Wird das Bild zu
aufwendig, lieber klein halten (ein Raum, vier Stufen) als durch eine Liste
ersetzen.

## 08 · ÜBERSEHEN — Spielstände brechen, sobald am Balancing gedreht wird

Im Plan steht dazu kein Wort. Sobald echte Leute zwei Wochen gespielt haben und
ein Erz umbenannt oder eine Rezeptur geändert wird, sind ihre Stände kaputt.

**Stattdessen:** Von Anfang an eine Versionsnummer im Spielstand plus eine
Funktion, die alte Stände hochzieht. Kostet in Phase 1 zehn Minuten.

## 09 · ÜBERSEHEN — Handy ohne Netz

Der Plan schickt alle 15 s einen Spielstand zum Server. In der Bahn schlägt das
fehl; bei zwei Geräten laufen die Stände auseinander.

**Stattdessen:** Während des Spielens ist das Gerät die Wahrheit, der Server
bekommt Schnappschüsse. Bei Konflikt gewinnt der weiter fortgeschrittene Stand,
der Verlierer wird als Sicherung behalten statt gelöscht.

## 10 · ÜBERSEHEN — Eine Abhängigkeit, die nicht nötig ist

`better-sqlite3` muss beim Installieren kompiliert werden und macht auf kleinen
Servern gern Ärger. Auf dem Server läuft Node **22.22.2** — `node:sqlite` ist
dort bereits eingebaut. Für unter fünfzig Spieler täte es sogar eine
JSON-Datei pro Konto, atomar geschrieben. Null Abhängigkeiten.

---

## Ausgedachte Zahlen

Werte, die sich pro Erz verdoppeln, Fabrikpreise mit `3,2^n`, Ausbaustufen mit
`1,8^Stufe` — das sind plausibel aussehende Platzhalter, keine ausgerechneten
Kurven. Die Zahlen wurden zuerst hingeschrieben und die Spielzeit daraus
gefolgert. Richtig herum wäre andersherum:

| Ziel | Spielzeit |
|---|---:|
| Erster Schmuck verkauft | 5 min |
| Erste Ausbaustufe | 20 min |
| Erste Fabrik | 45 min |
| Zweite Fabrik | 3 h |
| Alles gesehen | 15–20 h |

Diese fünf Zeilen festlegen, dann ergeben sich die Preise daraus.

## Geraten

- **„Aufgaben, die man lösen muss“** — daraus wurden Lieferaufträge („bring mir
  zwei Silberringe“). Gemeint sein könnten Rätsel, bei denen man nachdenkt
  statt sammelt. Zwei völlig verschiedene Spiele; die Entscheidung ändert den
  halben Plan.
- **„App“** — geplant ist eine Webseite, die man zum Startbildschirm hinzufügt:
  eigenes Symbol, Vollbild, offline spielbar, kostet nichts. Eine echte App im
  Play Store oder App Store ist ein anderes Projekt (Entwicklerkonto, bei Apple
  99 $ im Jahr, Prüfung vor jeder Version) und ändert die Technik von Anfang an.
- **Zielgruppe** — angenommen sind Freunde, keine Fremden im Netz. Bei Fremden
  sähen Login, Schummelschutz und Bestenliste anders aus, und Befund 05 wäre
  kein Theater mehr, sondern Pflicht.

## Empfehlung: Fassung 0.1 an einem Wochenende

Ein dünner senkrechter Schnitt durch alles — nicht die Mine perfekt und dann
das Zuhause, sondern von jedem Teil das kleinstmögliche Stück, dafür
vollständig spielbar.

- drei Erze (Kupfer, Silber, Amethyst), Mine bis 60 m
- Graben mit begrenzten Schlägen pro Abstieg, **kein Warte-Timer**
- Zuhause: ein Ofen, eine Werkbank, genau ein Schmuckstück (Ring)
- fünf von Hand geschriebene Aufträge
- eine Bestenliste (diese Woche), Anmeldung per Wiederherstellungscode
- kein Fabriksystem, keine Qualitätsstufen, keine Ausbaustufen

| Aus PLAN.md | In 0.1 |
|---|---|
| 12 Erze | 3 |
| 5 Schmuckformen × 4 Qualitäten | 1 Ring, eine Qualität |
| 5 Fabriken mit Offline-Rechnung | später |
| 7 Ausbaulinien | später |
| 4 Aufgabenarten | 5 feste Aufträge |
| 4 Bestenlisten | 1 |

Dann die Frage, auf die alles ankommt: Spielst du selbst das eine Woche lang
freiwillig? Wenn ja, wird der große Plan Stück für Stück daran festgebaut, und
die Reihenfolge ergibt sich von allein. Wenn nein, sind zwei Abende verloren
statt zwei Monate — und man weiß genau, woran es lag.

PLAN.md bleibt gültig, aber als Zielbild, nicht als Bauanleitung.
