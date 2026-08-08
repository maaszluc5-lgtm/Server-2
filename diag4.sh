#!/bin/bash
cd /root/bestgame/music-shop || { echo "Shop-Ordner fehlt"; exit 1; }
echo "===== db.js ====="
cat database/db.js
echo ""
echo "===== installierte sqlite-Bibliotheken ====="
ls node_modules 2>/dev/null | grep -iE "sqlite" || echo "(keine sqlite-* im node_modules-Top-Level)"
echo ""
echo "===== node eingebautes sqlite? ====="
node -e 'try{require("node:sqlite");console.log("node:sqlite VERFUEGBAR")}catch(e){console.log("node:sqlite nein:",e.message.split(String.fromCharCode(10))[0])}'
