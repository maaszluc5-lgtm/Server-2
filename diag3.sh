#!/bin/bash
# Liest Beispiel-Bildadressen (thumbnail_url) aus der Shop-Datenbank per Node.
cd /root/bestgame/music-shop || { echo "Shop-Ordner fehlt"; exit 1; }
cat > /tmp/shopdiag.js <<'NODE'
let Database;
try { Database = require('better-sqlite3'); }
catch (e) { console.log('better-sqlite3 nicht verfuegbar:', e.message); process.exit(0); }
let db;
try { db = new Database('database/shop.db', { readonly: true }); }
catch (e) { console.log('DB oeffnen fehlgeschlagen:', e.message); process.exit(0); }
const tabs = db.prepare("select name from sqlite_master where type='table'").all().map(t => t.name);
console.log('TABELLEN:', tabs.join(', '));
for (const t of tabs) {
  let cols = [];
  try { cols = db.prepare(`pragma table_info(${t})`).all().map(c => c.name); } catch (e) { continue; }
  if (cols.includes('thumbnail_url')) {
    console.log('\n== Tabelle ' + t + ' ==  Spalten: ' + cols.join(','));
    const rows = db.prepare(`select thumbnail_url from ${t} where thumbnail_url is not null and thumbnail_url <> '' limit 8`).all();
    if (!rows.length) console.log('  (keine thumbnail_url-Werte gesetzt)');
    rows.forEach(r => console.log('  ' + r.thumbnail_url));
    const n = db.prepare(`select count(*) c from ${t}`).get().c;
    const nn = db.prepare(`select count(*) c from ${t} where thumbnail_url is null or thumbnail_url=''`).get().c;
    console.log('  Gesamt: ' + n + ' Eintraege, davon ohne Bild: ' + nn);
  }
}
NODE
node /tmp/shopdiag.js 2>&1 | head -50
