/* server.js — liefert das Spiel aus und verwahrt Spielstände.
 *
 * Kein npm install nötig. Ab Node 22 wird das eingebaute SQLite benutzt,
 * unter Node 20 fällt der Server auf eine Datei je Spieler zurück — bei einer
 * Handvoll Freunden ist das völlig ausreichend und spart jede Abhängigkeit.
 *
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

const ROOT = process.env.MINE_DIR || __dirname;
const PORT = parseInt(process.env.PORT || '4100', 10);
const DATEN = process.env.MINE_DATA || path.join(ROOT, 'data');
fs.mkdirSync(DATEN, { recursive: true });

/* ---------------------------------------------------------------
 * Speicher. Beide Varianten können dasselbe: anlegen, holen,
 * sichern, Wochenliste.
 * ------------------------------------------------------------- */
const speicher = (() => {
  try {
    /* MINE_SPEICHER=dateien erzwingt den Dateispeicher — nützlich zum Testen
     * und wenn man die Datenbank lieber im Klartext lesen will. */
    if (process.env.MINE_SPEICHER === 'dateien') throw new Error('erzwungen');
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(process.env.MINE_DB || path.join(DATEN, 'mine.db'));
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
    return {
      art: 'SQLite',
      anlegen(code, name, woche) {
        const jetzt = Date.now();
        db.prepare(`INSERT INTO spieler (code, name, stand, woche_start, woche_verdient,
                    gesamt_verdient, angelegt, gesehen) VALUES (?, ?, NULL, ?, 0, 0, ?, ?)`)
          .run(code, name, woche, jetzt, jetzt);
      },
      holen(code) {
        const z = db.prepare('SELECT * FROM spieler WHERE code = ?').get(code);
        if (!z) return null;
        let stand = null;
        try { stand = z.stand ? JSON.parse(z.stand) : null; } catch (e) {}
        return { name: z.name, stand };
      },
      sichern(code, d) {
        const z = db.prepare('SELECT code FROM spieler WHERE code = ?').get(code);
        if (!z) return false;
        db.prepare(`UPDATE spieler SET name = ?, stand = ?, woche_start = ?, woche_verdient = ?,
                    gesamt_verdient = ?, gesehen = ? WHERE code = ?`)
          .run(d.name, JSON.stringify(d.stand), d.woche, d.wocheVerdient, d.gesamtVerdient, Date.now(), code);
        return true;
      },
      liste(woche) {
        return db.prepare(`SELECT code, name, woche_verdient FROM spieler
                           WHERE woche_start = ? AND woche_verdient > 0
                           ORDER BY woche_verdient DESC LIMIT 20`).all(woche)
          .map((z) => ({ code: z.code, name: z.name, wocheVerdient: z.woche_verdient }));
      },
    };
  } catch (e) {
    /* Node ohne eingebautes SQLite: eine Datei je Spieler. Geschrieben wird
     * erst daneben und dann umbenannt, damit ein Absturz mitten im Schreiben
     * keinen halben Spielstand hinterlässt. */
    const ORDNER = path.join(DATEN, 'spieler');
    fs.mkdirSync(ORDNER, { recursive: true });
    const datei = (code) => path.join(ORDNER, code.replace(/[^A-Z0-9-]/gi, '_') + '.json');
    const lies = (code) => {
      try { return JSON.parse(fs.readFileSync(datei(code), 'utf8')); } catch (e) { return null; }
    };
    const schreib = (code, o) => {
      const ziel = datei(code), zwischen = ziel + '.tmp';
      fs.writeFileSync(zwischen, JSON.stringify(o));
      fs.renameSync(zwischen, ziel);
    };
    return {
      art: 'Dateien (Node ohne eingebautes SQLite)',
      anlegen(code, name, woche) {
        schreib(code, { code, name, stand: null, woche, wocheVerdient: 0, gesamtVerdient: 0, angelegt: Date.now() });
      },
      holen(code) {
        const z = lies(code);
        return z ? { name: z.name, stand: z.stand } : null;
      },
      sichern(code, d) {
        const z = lies(code);
        if (!z) return false;
        schreib(code, { ...z, name: d.name, stand: d.stand, woche: d.woche,
          wocheVerdient: d.wocheVerdient, gesamtVerdient: d.gesamtVerdient, gesehen: Date.now() });
        return true;
      },
      liste(woche) {
        let namen = [];
        try { namen = fs.readdirSync(ORDNER).filter((n) => n.endsWith('.json')); } catch (e) {}
        return namen
          .map((n) => { try { return JSON.parse(fs.readFileSync(path.join(ORDNER, n), 'utf8')); } catch (e) { return null; } })
          .filter((z) => z && z.woche === woche && z.wocheVerdient > 0)
          .sort((a, b) => b.wocheVerdient - a.wocheVerdient)
          .slice(0, 20)
          .map((z) => ({ code: z.code, name: z.name, wocheVerdient: z.wocheVerdient }));
      },
    };
  }
})();

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
    speicher.anlegen(code, kurz(d.name, 18) || 'Bergmann', montag());
    return json(res, 200, { code });
  }

  if (pfad === '/api/laden' && req.method === 'POST') {
    const z = speicher.holen(kurz((await koerperLesen(req)).code, 16));
    if (!z) return json(res, 404, { fehler: 'unbekannt' });
    return json(res, 200, { name: z.name, stand: z.stand });
  }

  if (pfad === '/api/sichern' && req.method === 'POST') {
    const d = await koerperLesen(req);
    const woche = montag();
    const ok = speicher.sichern(kurz(d.code, 16), {
      name: kurz(d.name, 18) || 'Bergmann',
      stand: d.stand || {},
      woche,
      wocheVerdient: d.wocheStart === woche ? Math.max(0, Math.round(d.wocheVerdient || 0)) : 0,
      gesamtVerdient: Math.max(0, Math.round(d.gesamtVerdient || 0)),
    });
    if (!ok) return json(res, 404, { fehler: 'unbekannt' });
    return json(res, 200, { ok: true });
  }

  if (pfad === '/api/liste' && req.method === 'GET') {
    return json(res, 200, { woche: montag(), plaetze: speicher.liste(montag()) });
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
  console.log('Mine läuft auf http://localhost:' + PORT);
  console.log('Node ' + process.versions.node + ' · Speicher: ' + speicher.art + ' in ' + DATEN);
});
