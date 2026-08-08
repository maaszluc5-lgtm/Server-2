#!/bin/bash
# Spielt das 3D-Fussball-Spiel (echte Menschmodelle) + Konten-Login ein und startet torjaeger neu.
set -e
BASE=https://raw.githubusercontent.com/maaszluc5-lgtm/Server-2/claude/ssh-connection-setup-eotr6i/torjaeger

echo "== 1/5  Torjaeger-Ordner finden =="
SP=$(pm2 describe torjaeger 2>/dev/null | grep -oE "/[A-Za-z0-9_./-]+server\.js" | head -1)
DIR=$(dirname "$SP" 2>/dev/null || true)
[ -z "$DIR" ] && DIR=/root/torjaeger
if [ ! -d "$DIR" ]; then echo "   FEHLER: Ordner nicht gefunden ($DIR)"; exit 1; fi
echo "   Ordner: $DIR"
cd "$DIR"

echo "== 2/5  alte Dateien sichern =="
ts=$(date +%s)
[ -f index.html ] && cp -a index.html "index.html.bak.$ts"
[ -f server.js ] && cp -a server.js "server.js.bak.$ts"
echo "   Backups .bak.$ts"

echo "== 3/5  neue Spielseite + Server holen =="
curl -fsSL "$BASE/index.html" -o index.html
echo "   index.html: $(du -h index.html | cut -f1)"
curl -fsSL "$BASE/server.js" -o server.js
echo "   server.js aktualisiert (mit Konten-Login)"

echo "== 4/5  Menschmodell (nur falls es fehlt) =="
if [ ! -f Xbot.glb ]; then curl -fsSL "$BASE/Xbot.glb" -o Xbot.glb; echo "   Xbot.glb geladen ($(du -h Xbot.glb | cut -f1))"; else echo "   Xbot.glb schon da"; fi

echo "== 5/5  torjaeger neu starten =="
pm2 restart torjaeger --update-env
sleep 1
pm2 logs torjaeger --nostream --lines 4 | grep -i "server on" || true
echo ""
echo "FERTIG! Oeffne dein Spiel neu:  https://bestfussball.duckdns.org"
echo "WICHTIG: Seite HART neu laden. Oben rechts ist jetzt der Knopf 'Anmelden'."
