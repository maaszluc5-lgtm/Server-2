#!/bin/bash
cd /root/bestgame/music-shop || { echo "Shop-Ordner fehlt"; exit 1; }
cat > _diag.js <<'NODE'
const db = require('./database/db.js');
const total = db.prepare('select count(*) c from playlists').get().c;
const empty = db.prepare("select count(*) c from playlists where thumbnail_url is null or thumbnail_url=''").get().c;
console.log('Playlists gesamt:', total, '| davon ohne Bild:', empty);
console.log('--- Beispiele (id | Titel | thumbnail_url) ---');
db.prepare('select id,title,thumbnail_url from playlists limit 12').all()
  .forEach(r => console.log(r.id, '|', String(r.title||'').slice(0,26), '|', JSON.stringify(r.thumbnail_url)));
NODE
node _diag.js 2>&1 | head -40
rm -f _diag.js
