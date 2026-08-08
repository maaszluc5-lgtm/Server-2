#!/bin/bash
# Baut Bild-Upload in den Shop-Admin ein: Foto vom Geraet -> Cover pro Playlist (auch bestehende).
set -e
cd /root/bestgame/music-shop || { echo "Shop-Ordner fehlt"; exit 1; }
ts=$(date +%s)
cp -a routes/admin.js "routes/admin.js.bak.$ts"
cp -a views/admin.ejs "views/admin.ejs.bak.$ts"
cp -a views/index.ejs "views/index.ejs.bak2.$ts" 2>/dev/null || true
mkdir -p public/covers

echo "== 1/3  multer installieren =="
npm install multer --no-audit --no-fund --loglevel=error

echo "== 2/3  Dateien patchen =="
cat > _patch.js <<'NODE'
const fs = require('fs');
function edit(file, fn){ let s = fs.readFileSync(file,'utf8'); const o = s; s = fn(s); if (s!==o){ fs.writeFileSync(file,s); console.log('  gepatcht: '+file);} else console.log('  unveraendert: '+file); }

edit('routes/admin.js', s => {
  if (s.indexOf('multer') < 0) {
    s = s.replace("const router = express.Router();",
`const multer = require('multer');
const path = require('path');
const fs = require('fs');
const coversDir = path.join(__dirname, '..', 'public', 'covers');
fs.mkdirSync(coversDir, { recursive: true });
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, coversDir),
        filename: (req, file, cb) => {
            let ext = (path.extname(file.originalname || '') || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
            if (!/\\.(jpg|jpeg|png|webp|gif)$/.test(ext)) ext = '.jpg';
            cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
        }
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^image\\//.test(file.mimetype))
});

const router = express.Router();`);
  }
  s = s.replace("router.post('/playlists', requireAdmin, (req, res) => {",
                "router.post('/playlists', requireAdmin, upload.single('image'), (req, res) => {");
  s = s.replace("const thumbnailUrl = (req.body.thumbnail_url || '').trim();",
                "const thumbnailUrl = req.file ? ('/public/covers/' + req.file.filename) : (req.body.thumbnail_url || '').trim();");
  if (s.indexOf("/playlists/:id/image") < 0) {
    s = s.replace("module.exports = router;",
`router.post('/playlists/:id/image', requireAdmin, upload.single('image'), (req, res) => {
    if (req.file) {
        db.prepare('UPDATE playlists SET thumbnail_url = ? WHERE id = ?')
            .run('/public/covers/' + req.file.filename, req.params.id);
    }
    res.redirect('/admin');
});

module.exports = router;`);
  }
  return s;
});

edit('views/admin.ejs', s => {
  s = s.replace('method="POST" action="/admin/playlists">',
                'method="POST" action="/admin/playlists" enctype="multipart/form-data">');
  if (s.indexOf('name="image"') < 0) {
    s = s.replace('    <input type="url" id="thumbnail_url" name="thumbnail_url">',
`    <input type="url" id="thumbnail_url" name="thumbnail_url">
    <label for="image">…oder Bild vom Gerät hochladen</label>
    <input type="file" id="image" name="image" accept="image/*">`);
  }
  s = s.replace('<tr><th>Titel</th><th>Preis</th><th>Status</th><th></th></tr>',
                '<tr><th>Titel</th><th>Bild</th><th>Preis</th><th>Status</th><th></th></tr>');
  if (s.indexOf('/image"') < 0) {
    s = s.replace('<td><%= p.title %></td>',
`<td><%= p.title %></td>
                <td>
                    <% if (p.thumbnail_url) { %><img src="<%= p.thumbnail_url %>" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:6px" onerror="this.style.display='none'"><% } %>
                    <form method="POST" action="/admin/playlists/<%= p.id %>/image" enctype="multipart/form-data" style="display:inline">
                        <input type="file" name="image" accept="image/*" onchange="this.form.submit()" style="max-width:140px">
                    </form>
                </td>`);
  }
  return s;
});

edit('views/index.ejs', s => {
  return s.replace("var _isImg = _tl.indexOf('http') === 0 &&",
                   "var _isImg = (_tl.indexOf('http') === 0 || _tl.indexOf('/') === 0) &&");
});
NODE
node _patch.js; rm -f _patch.js

echo "== 3/3  Syntax pruefen und neu starten =="
node -e "require('./routes/admin.js')" 2>&1 | head -3 || true
pm2 restart music-shop >/dev/null 2>&1 && echo "music-shop neu gestartet ✓"
echo ""
echo "FERTIG. Geh auf:  https://lucamusicshop.duckdns.org/admin"
echo "Dort bei jeder Playlist unten in der Tabelle auf das Bild-Feld tippen -> Foto vom iPad waehlen -> wird sofort gesetzt."
