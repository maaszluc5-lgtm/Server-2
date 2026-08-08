#!/bin/bash
# Zeigt (1) die Server-Datei vom Fussball-Spiel (fuer den Login-Einbau)
#   und (2) wie der Shop seine Bilder referenziert (fuer den Bild-Fix).

echo "########## 1) TORJAEGER SERVER ##########"
TS=$(pm2 describe torjaeger 2>/dev/null | grep -oE "/[A-Za-z0-9_./-]+\.(js|mjs|cjs)" | head -1)
echo "Datei: $TS"
if [ -f "$TS" ]; then echo "----- Inhalt (max 220 Zeilen) -----"; sed -n '1,220p' "$TS"; else echo "server.js nicht gefunden"; fi

echo ""
echo "########## 2) SHOP: BILD-REFERENZEN ##########"
SS=$(pm2 describe music-shop 2>/dev/null | grep -oE "/[A-Za-z0-9_./-]+\.(js|mjs|cjs)" | head -1)
SDIR=$(dirname "$SS" 2>/dev/null)
echo "Shop-Ordner: $SDIR"
ls "$SDIR" 2>/dev/null
echo "----- Bild-/Upload-Ordner -----"
find "$SDIR" -maxdepth 3 -type d 2>/dev/null | grep -viE "node_modules" | grep -iE "image|upload|public|static|img"
echo "----- wie Bilder referenziert werden (erste Treffer) -----"
grep -rniE "img|image|upload|\.(jpg|jpeg|png|webp)|http://" "$SDIR" 2>/dev/null | grep -viE "node_modules|\.map|package-lock" | grep -iE "src=|http://|/upload|/image|/img|/static|/public|url\(" | head -30
