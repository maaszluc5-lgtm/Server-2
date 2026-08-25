# Einmal-Schlüssel statt Portal-Passwort

Ersetzt das feste Passwort auf `/ssh/` durch einen Schlüssel, den du auf dem
Server mit `key` erzeugst.

> **Der kurze Weg:** `installieren.sh` enthält alles — beide Programmdateien,
> die Rechte, die PowerShell-Einbindung und eine Probe. Eine Datei auf den
> Server, einmal ausführen:
>
> ```bash
> sudo PORTAL_BENUTZER=<benutzer-unter-dem-das-portal-laeuft> bash installieren.sh
> ```
>
> Danach bleibt nur noch der [Einbau ins Portal](#einbau-ins-portal), den
> das Skript zum Schluss auch nochmal ausdruckt. Der Rest dieser Datei ist
> die Handarbeit-Fassung und das Nachschlagewerk.

## Regeln

| Was | Wert |
|-----|------|
| Gültigkeit | 5 Minuten |
| Verwendungen | genau eine — danach ist der Schlüssel weg |
| Ungenutzt abgelaufen | Schlüssel wird gelöscht, Sperre greift trotzdem |
| Falscheingaben | nach 5 Fehlversuchen wird der Schlüssel verworfen, Sperre greift |
| Gleichzeitig offen | immer nur ein Schlüssel |

**Sperrleiter.** Sobald ein Schlüssel sein Leben beendet hat — egal ob
eingelöst, abgelaufen oder verbrannt — läuft eine Sperre, bevor der nächste
geht. Sie wird jedes Mal länger:

```
10 min  →  1 h  →  3 h  →  6 h  →  12 h  →  1 d  →  Dauersperre
```

Die Dauersperre gilt für alle und läuft nicht von selbst ab. Sie muss mit
`key -Entsperren` aufgehoben werden.

> Rechne damit: Ab Werk sind das **sieben Schlüssel insgesamt**, dann ist zu.
> Die Leiter zählt nie von selbst zurück. Wenn du das weicher willst, siehe
> `SCHLUESSEL_RUHE_STUNDEN` unter [Einstellungen](#einstellungen).

## Installation auf dem Server

```bash
sudo mkdir -p /opt/ssh-schluessel /var/lib/ssh-schluessel
sudo cp schluessel.js key.ps1 /opt/ssh-schluessel/
sudo chmod 700 /var/lib/ssh-schluessel
```

`/var/lib/ssh-schluessel` muss dem Benutzer gehören, unter dem **beide**
Seiten laufen (dein `pwsh` und der Portal-Prozess). Laufen sie unter
verschiedenen Benutzern, leg eine gemeinsame Gruppe an:

```bash
sudo groupadd -f sshkey
sudo usermod -aG sshkey <portal-benutzer>
sudo chgrp sshkey /var/lib/ssh-schluessel
sudo chmod 770 /var/lib/ssh-schluessel
```

Wer die Zustandsdatei schreiben darf, kann die Sperren zurücksetzen — also
niemanden sonst hineinlassen.

PowerShell Core einbinden (`pwsh` vorausgesetzt, sonst
`sudo apt install -y powershell`):

```bash
pwsh -c 'if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force }'
pwsh -c 'Add-Content $PROFILE ". /opt/ssh-schluessel/key.ps1"'
```

Danach in einer neuen `pwsh`-Sitzung:

```
PS /root> key

  SSH-Schluessel

      K7QP-3MRT-XZ4B-J9HN-2WCD

  gueltig bis 14:23:07 (5 min), genau ein Login
  danach 10 min Sperre, bevor ein neuer Schluessel geht
```

## Einbau ins Portal

Das Portal hat schon ein Passwortfeld und einen Handler für
`POST /ssh/login-passwort`, der `{ passwort: "..." }` bekommt. Da hängt sich
der Schlüssel ein — **die Weboberfläche muss nicht angefasst werden.**

Oben in der Portal-Datei:

```js
const schluessel = require('/opt/ssh-schluessel/schluessel.js');
```

Im Handler für `/ssh/login-passwort` die Passwortprüfung ersetzen:

```js
// vorher:  if (koerper.passwort === PORTAL_PASSWORT) { ...Sitzung anlegen... }
const versuch = schluessel.einloesen(koerper.passwort);
if (versuch.ok) {
  /* ...Sitzung genau so anlegen wie bisher bei richtigem Passwort... */
  return antwort({ ok: true });
}
return antwort({ ok: false, grund: versuch.text });
```

Willst du das alte Passwort als Notausgang behalten, prüf es **danach**:

```js
const versuch = schluessel.einloesen(koerper.passwort);
if (versuch.ok || koerper.passwort === PORTAL_PASSWORT) { /* Sitzung anlegen */ }
```

Optional die Beschriftung im Portal-HTML anpassen, damit klar ist was rein
soll — im `anonym`-Zweig:

```js
feld.placeholder = 'Einmal-Schlüssel';                       // statt 'Portal-Passwort'
b.append(el('p','hinweis mitte','Mit dem Einmal-Schlüssel anmelden:'));
```

Bindestriche, Leerzeichen und Kleinschreibung sind egal — `KQ7P-3MRT…`,
`kq7p 3mrt…` und `kq7p3mrt…` werden alle akzeptiert.

## Bedienung

| Befehl | Wirkung |
|--------|---------|
| `key` | neuen Schlüssel erzeugen |
| `key -Status` | Stufe, Sperre, offener Schlüssel |
| `key -Entsperren` | Dauersperre aufheben, Stufe zurück auf 0 |
| `key -Json` | rohes JSON, für Skripte |

Ohne PowerShell geht alles genauso direkt:

```bash
node /opt/ssh-schluessel/schluessel.js neu
node /opt/ssh-schluessel/schluessel.js status
node /opt/ssh-schluessel/schluessel.js einloesen K7QP-3MRT-XZ4B-J9HN-2WCD
node /opt/ssh-schluessel/schluessel.js entsperren
```

## Einstellungen

Alles über Umgebungsvariablen, für Portal und `key` gleich setzen:

| Variable | Vorgabe | Bedeutung |
|----------|---------|-----------|
| `SCHLUESSEL_DATEI` | `/var/lib/ssh-schluessel/zustand.json` | Zustandsdatei |
| `SCHLUESSEL_GUELTIG_MIN` | `5` | Gültigkeit in Minuten |
| `SCHLUESSEL_LEITER` | `10m,1h,3h,6h,12h,1d` | Sperrleiter, danach Dauersperre |
| `SCHLUESSEL_FEHLVERSUCHE` | `5` | Fehlversuche bis der Schlüssel verbrennt |
| `SCHLUESSEL_RUHE_STUNDEN` | `0` (aus) | Stufe auf 0 zurücksetzen nach so vielen ruhigen Stunden |
| `SCHLUESSEL_NODE` | `node` | Pfad zu Node, falls nicht im `PATH` |

`SCHLUESSEL_RUHE_STUNDEN=24` heißt: passiert einen Tag lang nichts, fängt die
Leiter wieder bei 10 min an. Die **Dauersperre wird davon nie** aufgehoben.

## Dateien

| Datei | Zweck |
|-------|-------|
| `installieren.sh` | Alles in einem — richtet den Server komplett ein |
| `schluessel.js` | Die Logik, als Node-Modul und als Kommandozeile |
| `key.ps1` | `key` für PowerShell Core |
| `bauen.py` | Baut `installieren.sh` neu aus den beiden Quelldateien |

`installieren.sh` trägt Kopien von `schluessel.js` und `key.ps1` in sich.
Änderst du eine davon, danach `python3 bauen.py` laufen lassen — sonst
installiert das Skript weiter den alten Stand.

## Technisches

- Kein Fremdpaket, nur Node-Bordmittel.
- Gespeichert wird nur der SHA-256-Hash des Schlüssels, nie der Klartext.
  Der Klartext existiert einmal — in der Ausgabe von `key`.
- 20 Zeichen aus einem 32er-Alphabet ohne `0/O/1/I` = 100 Bit Zufall.
- Vergleich läuft über `timingSafeEqual`.
- Schreibende Zugriffe laufen unter einer Dateisperre, Portal und `key`
  können sich also nicht in die Quere kommen. Geschrieben wird über
  `tmp` + `rename`, die Datei ist damit nie halb beschrieben.
- Ablauf wird beim Lesen abgerechnet, kein Hintergrunddienst nötig. Ein
  Neustart des Portals ändert nichts an laufenden Sperren.
- Die Sperre nach einem Ablauf rechnet ab dem Ablaufzeitpunkt, nicht ab dem
  Moment wo es jemand bemerkt.
