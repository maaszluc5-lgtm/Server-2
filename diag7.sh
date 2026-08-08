#!/bin/bash
cd /root/bestgame/music-shop || { echo "Shop-Ordner fehlt"; exit 1; }
echo "===== routes-Dateien ====="; ls -la routes 2>/dev/null
echo ""
echo "===== views-Dateien ====="; ls -la views 2>/dev/null
echo ""
echo "===== Admin-Route (Datei mit 'admin' oder 'playlist' + POST) ====="
grep -rln "admin\|playlist" routes 2>/dev/null
echo "----- Inhalt der Admin-Route -----"
AF=$(grep -rln "thumbnail_url\|playlists (" routes 2>/dev/null | head -1)
[ -z "$AF" ] && AF=$(ls routes/admin* 2>/dev/null | head -1)
echo "Datei: $AF"
[ -f "$AF" ] && sed -n '1,160p' "$AF"
echo ""
echo "===== Admin-View (mit thumbnail/Formular) ====="
VF=$(grep -rln "thumbnail\|youtube\|price" views 2>/dev/null | grep -i admin | head -1)
[ -z "$VF" ] && VF=$(grep -rln "method=\"POST\"" views 2>/dev/null | grep -i admin | head -1)
echo "Datei: $VF"
[ -f "$VF" ] && cat "$VF"
echo ""
echo "===== multer installiert? (fuer Upload) ====="
ls node_modules | grep -iE "^multer$|^busboy$|^formidable$" || echo "(kein Upload-Paket installiert)"
