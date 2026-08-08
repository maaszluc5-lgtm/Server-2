#!/bin/bash
# Spielt die 3D-Version des Fussball-Spiels mit ECHTEN Menschmodellen ein und startet torjaeger neu.
set -e
BASE=https://raw.githubusercontent.com/maaszluc5-lgtm/Server-2/claude/ssh-connection-setup-eotr6i/torjaeger

echo "== 1/5  Torjaeger-Ordner finden =="
SP=$(pm2 describe torjaeger 2>/dev/null | grep -oE "/[A-Za-z0-9_./-]+server\.js" | head -1)
DIR=$(dirname "$SP" 2>/dev/null || true)
[ -z "$DIR" ] && DIR=/root/torjaeger
if [ ! -d "$DIR" ]; then echo "   FEHLER: Ordner nicht gefunden ($DIR)"; exit 1; fi
echo "   Ordner: $DIR"
cd "$DIR"

echo "== 2/5  alte index.html sichern =="
if [ -f index.html ]; then cp -a index.html "index.html.bak.$(date +%s)"; echo "   Backup angelegt."; fi

echo "== 3/5  neue Spielseite holen =="
curl -fsSL "$BASE/index.html" -o index.html
echo "   index.html: $(du -h index.html | cut -f1)"

echo "== 4/5  Menschmodell holen (~3 MB) =="
curl -fsSL "$BASE/Xbot.glb" -o Xbot.glb
echo "   Xbot.glb: $(du -h Xbot.glb | cut -f1)"
rm -f Soldier.glb 2>/dev/null || true

echo "== 5/5  torjaeger neu starten =="
pm2 restart torjaeger --update-env
sleep 1
echo ""
echo "FERTIG! Oeffne dein Spiel neu:  https://bestfussball.duckdns.org"
echo "WICHTIG: Seite HART neu laden (Cache leeren). Beim ersten Start laedt das Modell kurz (~2 MB)."
