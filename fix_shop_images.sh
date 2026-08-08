#!/bin/bash
# Macht die Shop-Bild-Anzeige kugelsicher: echtes Bild wenn vorhanden, sonst schoener Platzhalter.
set -e
cd /root/bestgame/music-shop || { echo "Shop-Ordner fehlt"; exit 1; }

ts=$(date +%s)
cp -a views/index.ejs "views/index.ejs.bak.$ts"
cp -a public/css/style.css "public/css/style.css.bak.$ts"

cat > _patch.js <<'NODE'
const fs = require('fs');
const f = 'views/index.ejs';
let s = fs.readFileSync(f, 'utf8');
const newBlock =
`                <%
                    var _t = (p.thumbnail_url || '').trim();
                    var _tl = _t.toLowerCase();
                    var _isImg = _tl.indexOf('http') === 0 && (_tl.indexOf('.jpg')>0 || _tl.indexOf('.jpeg')>0 || _tl.indexOf('.png')>0 || _tl.indexOf('.webp')>0 || _tl.indexOf('.gif')>0);
                %>
                <% if (_isImg) { %>
                    <img class="thumb" src="<%= _t %>" alt="<%= p.title %>" onerror="this.style.display='none'; var ph=this.parentNode.querySelector('.thumb-ph'); if(ph) ph.style.display='flex';">
                    <div class="thumb-ph" style="display:none">🎵</div>
                <% } else { %>
                    <div class="thumb-ph">🎵</div>
                <% } %>`;
if (s.indexOf('thumb-ph') >= 0) { console.log('index.ejs schon gepatcht - ok'); process.exit(0); }
const re = /<% if \(p\.thumbnail_url\) \{ %>[\s\S]*?<% \} %>/;
if (re.test(s)) { s = s.replace(re, newBlock); fs.writeFileSync(f, s); console.log('index.ejs gepatcht ✓'); }
else { console.log('WARN: Bild-Block nicht gefunden - nichts geaendert.'); process.exit(2); }
NODE
node _patch.js; rc=$?; rm -f _patch.js
[ "$rc" = "2" ] && { echo "Abbruch."; exit 2; }

if ! grep -q "thumb-ph" public/css/style.css; then
cat >> public/css/style.css <<'CSS'

/* Platzhalter fuer fehlende/kaputte Playlist-Bilder */
.card img.thumb{ width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:10px; display:block; }
.card .thumb-ph{ width:100%; aspect-ratio:1/1; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:46px; color:#fff; background:linear-gradient(135deg,#6d28d9,#2563eb); box-shadow:inset 0 0 44px rgba(0,0,0,.25); }
CSS
echo "CSS ergaenzt ✓"
else echo "CSS schon vorhanden - ok"
fi

pm2 restart music-shop >/dev/null 2>&1 && echo "music-shop neu gestartet ✓"
echo ""
echo "FERTIG. Shop hart neu laden:  https://lucamusicshop.duckdns.org"
