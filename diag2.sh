#!/bin/bash
SHOP=/root/bestgame/music-shop
echo "===== 1) DB-Ordner ====="
ls -la "$SHOP/database" 2>/dev/null
echo ""
echo "===== 2) Beispiel-Bildadressen (thumbnail_url) ====="
DB=$(ls "$SHOP/database"/*.db "$SHOP/database"/*.sqlite "$SHOP/database"/*.sqlite3 2>/dev/null | head -1)
if [ -n "$DB" ] && command -v sqlite3 >/dev/null 2>&1; then
  echo "SQLite-DB: $DB"
  sqlite3 "$DB" "select id,substr(title,1,20),thumbnail_url from products limit 6;" 2>/dev/null || sqlite3 "$DB" ".tables"
else
  echo "(kein sqlite3) - suche thumbnail_url in Dateien:"
  grep -rhoE "https?://[^\"' ]+\.(jpg|jpeg|png|webp)" "$SHOP/database" 2>/dev/null | head -6
  grep -rhoE "thumbnail_url[^,}]{0,120}" "$SHOP/database" 2>/dev/null | head -6
fi
echo ""
echo "===== 3) Shop server.js: static/BASE_URL/listen ====="
grep -nE "express.static|app.use|BASE_URL|thumbnail|/public|/upload|listen\(" "$SHOP/server.js" 2>/dev/null | head -25
echo ""
echo "===== 4) TORJAEGER (Fussball) server.js ====="
TS=$(pm2 describe torjaeger 2>/dev/null | grep -oE "/[^ ]+\.(cjs|mjs|js)" | head -1)
[ -z "$TS" ] && TS=/root/torjaeger/server.js
echo "Datei: $TS"
[ -f "$TS" ] && sed -n '1,200p' "$TS" || echo "nicht gefunden"
