#!/bin/bash
cd /root/bestgame/music-shop || { echo "Shop-Ordner fehlt"; exit 1; }
cat > _d.js <<'NODE'
const db = require('./database/db.js');
db.prepare('select id,title,youtube_link,thumbnail_url from playlists').all()
  .forEach(r => console.log('id ' + r.id + ' | ' + r.title + '\n   youtube: ' + r.youtube_link + '\n   thumb:   ' + JSON.stringify(r.thumbnail_url)));
NODE
node _d.js 2>&1; rm -f _d.js
echo ""
echo "===== views/index.ejs (1-45) ====="
sed -n '1,45p' views/index.ejs
