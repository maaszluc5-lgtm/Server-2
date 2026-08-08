#!/bin/bash
# Spielt die neue 3D-Version des Fussball-Spiels (Three.js eingebettet) ein und startet torjaeger neu.
set -e
RAW=https://raw.githubusercontent.com/maaszluc5-lgtm/Server-2/claude/ssh-connection-setup-eotr6i/torjaeger/index.html

echo "== 1/4  Torjaeger-Ordner finden =="
SP=$(pm2 describe torjaeger 2>/dev/null | grep -oE "/[A-Za-z0-9_./-]+server\.js" | head -1)
DIR=$(dirname "$SP" 2>/dev/null || true)
[ -z "$DIR" ] && DIR=/root/torjaeger
if [ ! -d "$DIR" ]; then echo "   FEHLER: Ordner nicht gefunden ($DIR)"; exit 1; fi
echo "   Ordner: $DIR"
cd "$DIR"

echo "== 2/4  alte index.html sichern =="
if [ -f index.html ]; then cp -a index.html "index.html.bak.$(date +%s)"; echo "   Backup angelegt."; else echo "   (keine alte index.html)"; fi

echo "== 3/4  neue 3D-Version holen =="
curl -fsSL "$RAW" -o index.html
echo "   neue index.html: $(du -h index.html | cut -f1)"

echo "== 4/4  torjaeger neu starten =="
pm2 restart torjaeger --update-env
sleep 1
echo ""
echo "FERTIG! Oeffne dein Spiel neu:  https://bestfussball.duckdns.org"
echo "WICHTIG: Seite HART neu laden (Cache leeren), sonst zeigt der Browser die alte Version."
