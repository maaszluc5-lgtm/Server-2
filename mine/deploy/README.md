# minesgames.duckdns.org einrichten

Bringt die Mine unter `https://minesgames.duckdns.org` ins Netz: DuckDNS hält
die Adresse aktuell, Nginx steht davor, Let's Encrypt liefert das Zertifikat.

## Vorweg: das Token ist ein Passwort

Der DuckDNS-Token steht **nie** im Repo. Er landet in `/etc/duckdns/token`,
lesbar nur für root. Wer ihn hat, kann die Adresse auf einen beliebigen Server
umbiegen — wurde er irgendwo geteilt, auf duckdns.org neu erzeugen und hier
erneut hinterlegen:

```bash
printf '%s' 'neues-token' > /etc/duckdns/token && chmod 600 /etc/duckdns/token
systemctl start duckdns.service      # sofort prüfen
```

## Einrichten

Alles als root auf dem Server:

```bash
# 1. Spiel auf den Server holen
cd /tmp && rm -rf s2
git clone -b claude/mining-game-plan-386zip https://github.com/maaszluc5-lgtm/Server-2.git s2
rm -rf /root/mine && cp -r /tmp/s2/mine /root/mine

# 2. Einrichten (fragt nach dem Token, wenn die Variable fehlt)
cd /root/mine/deploy
DUCKDNS_TOKEN='dein-token' ./setup.sh
```

Das Skript darf mehrfach laufen. Es fasst einen bestehenden HTTPS-Block in der
Nginx-Seite nicht an und holt kein zweites Zertifikat.

## Was dabei entsteht

| Was | Wo |
|---|---|
| Token | `/etc/duckdns/token` (600, nur root) |
| Adress-Abgleich | `duckdns.timer`, alle 5 Minuten |
| Spiel als Dienst | `mine.service`, Port 4100, nur lokal |
| Nginx-Seite | `/etc/nginx/sites-available/minesgames` |
| Zertifikat | `/etc/letsencrypt/live/minesgames.duckdns.org` |
| Spielstände | `/root/mine/data` |

Nach außen ist nur Nginx offen. Port 4100 hört auf allen Adressen, sollte aber
von außen per Firewall dicht sein — nötig ist er nur lokal.

## Voraussetzungen, die das Skript nicht schaffen kann

- **Port 80 und 443 müssen von außen erreichbar sein.** Ohne das schlägt die
  Zertifikatsprüfung fehl. Bei einem Anschluss zu Hause heißt das
  Portweiterleitung im Router auf diesen Server.
- **Port 4000 bleibt unberührt**, dort läuft Torjäger weiter.

## Nachsehen, ob alles läuft

```bash
systemctl status mine duckdns.timer   # Dienste
journalctl -u mine -f                 # Spiel-Log
journalctl -u duckdns -n 20           # letzte Adress-Abgleiche
curl -I https://minesgames.duckdns.org
```

## Wenn etwas klemmt

**DuckDNS antwortet `KO`** — Name oder Token stimmt nicht. Der Name ist nur
`minesgames`, nicht die ganze Adresse.

**Certbot scheitert** — von außen kommt niemand auf Port 80. Prüfen mit
`curl -I http://minesgames.duckdns.org` von einem anderen Netz aus, etwa vom
Handy ohne WLAN.

**502 im Browser** — der Spieldienst läuft nicht: `systemctl status mine` und
`journalctl -u mine -n 50`.

**Nach einem Update ist alles beim Alten** — der Browser hält die Dateien fest.
Einmal mit Strg+F5 neu laden.

## Aktualisieren

```bash
cd /tmp && rm -rf s2
git clone -b claude/mining-game-plan-386zip https://github.com/maaszluc5-lgtm/Server-2.git s2
cp -r /tmp/s2/mine/index.html /tmp/s2/mine/js /tmp/s2/mine/css /tmp/s2/mine/server.js /root/mine/
systemctl restart mine
```

`/root/mine/data` wird dabei nicht angefasst — die Spielstände bleiben.
