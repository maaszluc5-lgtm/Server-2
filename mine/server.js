/* server.js — liefert das Spiel aus und verwahrt Spielstände.
 *
 * Kein npm install nötig: SQLite ist ab Node 22 eingebaut.
 * Start:  PORT=4100 node server.js
 * Dauer:  pm2 start server.js --name mine
 *
 * Zum Schummeln, offen gesagt: der Server glaubt dem Gerät. Für eine Runde
 * unter Freunden reicht das. Wer die Liste ernst meint, muss die Mine
 * serverseitig würfeln lassen (siehe KRITIK.md, Befund 05) — dafür ist die
 * Mine bewusst aus einem Startwert berechnet und nicht zufällig gestreut.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = process.env.MINE_DIR || __dirname;
const PORT = parseInt(process.env.PORT || '4100', 10);
const DB_DATEI = process.env.MINE_DB || path.join(ROOT, 'data', 'mine.db');

fs.mkdirSync(path.dirname(DB_DATEI), { recursive: true });
const db = new DatabaseSync(DB_DATEI);
db.exec(`
  CREATE TABLE IF NOT EXISTS spieler (
    code            TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    stand           TEXT,
    woche_start     TEXT,
    woche_verdient  INTEGER DEFAULT 0,
    gesamt_verdient INTEGER DEFAULT 0,
    angelegt        INTEGER,
    gesehen         INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_woche ON spieler (woche_start, woche_verdient DESC);
`);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/* Wiederherstellungscode statt Passwort: nichts zu hashen, nichts
 * zurückzusetzen. Ohne mehrdeutige Zeichen, damit man ihn abschreiben kann. */
const ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function neuerCode() {
  const teil = () => Array.from(crypto.randomBytes(4))
    .map((b) => ZEICHEN[b % ZEICHEN.length]).join('');
  return 'MINE-' + teil() + '-' + teil();
}

function montag(d = new Date()) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

function json(res, code, daten) {
  const text = JSON.stringify(daten);
  res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(text);
}

function koerperLesen(req) {
  return new Promise((fertig, fehler) => {
    let roh = '';
    req.on('data', (stueck) => {
      roh += stueck;
      if (roh.length > 512 * 1024) { req.destroy(); fehler(new Error('zu groß')); }
    });
    req.on('end', () => {
      try { fertig(roh ? JSON.parse(roh) : {}); } catch (e) { fehler(e); }
    });
    req.on('error', fehler);
  });
}

const kurz = (t, n) => String(t == null ? '' : t).slice(0, n);

async function api(req, res, pfad) {
  if (pfad === '/api/neu' && req.method === 'POST') {
    const d = await koerperLesen(req);
    const code = neuerCode();
    const jetzt = Date.now();
    db.prepare(`INSERT INTO spieler (code, name, stand, woche_start, woche_verdient,
                gesamt_verdient, angelegt, gesehen) VALUES (?, ?, NULL, ?, 0, 0, ?, ?)`)
      .run(code, kurz(d.name, 18) || 'Bergmann', montag(), jetzt, jetzt);
    return json(res, 200, { code });
  }

  if (pfad === '/api/laden' && req.method === 'POST') {
    const d = await koerperLesen(req);
    const z = db.prepare('SELECT * FROM spieler WHERE code = ?').get(kurz(d.code, 16));
    if (!z) return json(res, 404, { fehler: 'unbekannt' });
    let stand = null;
    try { stand = z.stand ? JSON.parse(z.stand) : null; } catch (e) {}
    return json(res, 200, { name: z.name, stand });
  }

  if (pfad === '/api/sichern' && req.method === 'POST') {
    const d = await koerperLesen(req);
    const code = kurz(d.code, 16);
    const z = db.prepare('SELECT code FROM spieler WHERE code = ?').get(code);
    if (!z) return json(res, 404, { fehler: 'unbekannt' });

    const woche = montag();
    const wocheVerdient = d.wocheStart === woche ? Math.max(0, Math.round(d.wocheVerdient || 0)) : 0;
    db.prepare(`UPDATE spieler SET name = ?, stand = ?, woche_start = ?, woche_verdient = ?,
                gesamt_verdient = ?, gesehen = ? WHERE code = ?`)
      .run(
        kurz(d.name, 18) || 'Bergmann',
        JSON.stringify(d.stand || {}),
        woche,
        wocheVerdient,
        Math.max(0, Math.round(d.gesamtVerdient || 0)),
        Date.now(),
        code
      );
    return json(res, 200, { ok: true });
  }

  if (pfad === '/api/liste' && req.method === 'GET') {
    const zeilen = db.prepare(`SELECT code, name, woche_verdient FROM spieler
                               WHERE woche_start = ? AND woche_verdient > 0
                               ORDER BY woche_verdient DESC LIMIT 20`).all(montag());
    return json(res, 200, {
      woche: montag(),
      plaetze: zeilen.map((z) => ({ code: z.code, name: z.name, wocheVerdient: z.woche_verdient })),
    });
  }

  return json(res, 404, { fehler: 'unbekannt' });
}

const server = http.createServer(async (req, res) => {
  let pfad;
  try { pfad = decodeURIComponent(req.url.split('?')[0]); } catch (e) { pfad = '/'; }

  if (pfad.startsWith('/api/')) {
    try {
      await api(req, res, pfad);
    } catch (e) {
      json(res, 400, { fehler: 'kaputte Anfrage' });
    }
    return;
  }

  if (pfad === '/' || pfad === '') pfad = '/index.html';
  const sicher = path.normalize(pfad).replace(/^(\.\.[/\\])+/, '');
  const datei = path.join(ROOT, sicher);
  if (!datei.startsWith(ROOT)) { res.writeHead(403); res.end('verboten'); return; }

  fs.readFile(datei, (fehler, daten) => {
    if (fehler) { res.writeHead(404); res.end('nicht gefunden'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(datei).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(daten);
  });
});

server.listen(PORT, () => {
  console.log('Mine läuft auf http://localhost:' + PORT + '  (Datenbank: ' + DB_DATEI + ')');
});
