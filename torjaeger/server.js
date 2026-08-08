/* Torjäger — static file server + realtime multiplayer relay + Benutzer-Konten (Login)
 * Serves index.html, WebSocket rooms for 2-player matches, und /api/* fuer Konten.
 * Install once:  npm install ws qrcode
 * Run (via pm2): TORJ_DIR=/root/torjaeger PORT=4000 node server.js
 */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
let QRCode = null; try { QRCode = require('qrcode'); } catch (e) { console.log('(qrcode nicht installiert – QR wird nicht generiert)'); }

const ROOT = process.env.TORJ_DIR || __dirname;
const PORT = parseInt(process.env.PORT || '4000', 10);
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.json':'application/json', '.glb':'model/gltf-binary' };

// ── Benutzer-Konten ─────────────────────────────────────────────────────────
const USERS_FILE = path.join(ROOT, 'users.json');
let users = {};
try { users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (e) { users = {}; }
let saveTimer = null;
function saveUsers() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { fs.writeFileSync(USERS_FILE, JSON.stringify(users)); } catch (e) { console.error('users save:', e.message); } }, 150); }
let SECRET = process.env.TORJ_SECRET || users.__secret;
if (!SECRET) { SECRET = crypto.randomBytes(32).toString('hex'); users.__secret = SECRET; saveUsers(); }

function hashPw(pw, salt) { return crypto.scryptSync(String(pw), salt, 64).toString('hex'); }
function eq(a, b) { const ba = Buffer.from(String(a)), bb = Buffer.from(String(b)); return ba.length === bb.length && crypto.timingSafeEqual(ba, bb); }
function makeToken(u) { const h = crypto.createHmac('sha256', SECRET).update(u).digest('hex').slice(0, 32); return Buffer.from(u).toString('base64url') + '.' + h; }
function userFromToken(tok) { if (!tok) return null; const i = tok.indexOf('.'); if (i < 0) return null; let u; try { u = Buffer.from(tok.slice(0, i), 'base64url').toString('utf8'); } catch (e) { return null; } const h = crypto.createHmac('sha256', SECRET).update(u).digest('hex').slice(0, 32); return eq(h, tok.slice(i + 1)) ? u : null; }
function readBody(req) { return new Promise((resolve) => { let b = ''; req.on('data', (d) => { b += d; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); }); }
function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
const validName = (u) => typeof u === 'string' && /^[A-Za-z0-9_.-]{3,20}$/.test(u);

async function handleApi(req, res, u) {
  const tokUser = userFromToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  try {
    if (u === '/api/register' && req.method === 'POST') {
      const b = await readBody(req); const un = (b.u || '').trim(); const pw = b.p || '';
      if (!validName(un)) return sendJson(res, 400, { error: 'Name: 3–20 Zeichen (Buchstaben, Zahlen, . _ -)' });
      if (String(pw).length < 4) return sendJson(res, 400, { error: 'Passwort: mindestens 4 Zeichen' });
      if (users[un]) return sendJson(res, 409, { error: 'Name ist schon vergeben' });
      const salt = crypto.randomBytes(16).toString('hex');
      users[un] = { salt, hash: hashPw(pw, salt), state: null, created: Date.now() };
      saveUsers();
      return sendJson(res, 200, { token: makeToken(un), user: un, state: null });
    }
    if (u === '/api/login' && req.method === 'POST') {
      const b = await readBody(req); const un = (b.u || '').trim(); const pw = b.p || '';
      const rec = users[un];
      if (!rec || !eq(rec.hash, hashPw(pw, rec.salt))) return sendJson(res, 401, { error: 'Name oder Passwort falsch' });
      return sendJson(res, 200, { token: makeToken(un), user: un, state: rec.state || null });
    }
    if (u === '/api/state') {
      if (!tokUser || !users[tokUser]) return sendJson(res, 401, { error: 'nicht angemeldet' });
      if (req.method === 'GET') return sendJson(res, 200, { state: users[tokUser].state || null });
      if (req.method === 'POST') { const b = await readBody(req); users[tokUser].state = b.state || null; saveUsers(); return sendJson(res, 200, { ok: true }); }
    }
  } catch (e) { return sendJson(res, 500, { error: 'Serverfehler' }); }
  return sendJson(res, 404, { error: 'unbekannt' });
}

// ── HTTP: erst /api/*, dann statische Dateien ────────────────────────────────
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.startsWith('/api/')) { handleApi(req, res, u); return; }
  if (u === '/' || u === '') u = '/index.html';
  const safe = path.normalize(u).replace(/^(\.\.[\/\\])+/, '');
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

// ── WebSocket: 2-Spieler-Raum-Relay (unveraendert) ───────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map();
const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
const send = (ws, o) => { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} };

wss.on('connection', (ws, req) => {
  ws.hostHeader = req.headers.host || ('localhost:' + PORT);
  ws.proto = (req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')).split(',')[0].trim();
  ws.room = null; ws.role = null;
  ws.on('message', async (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
    if (m.t === 'create') {
      let c; do { c = newCode(); } while (rooms.has(c));
      rooms.set(c, { host: ws, guest: null });
      ws.room = c; ws.role = 'host';
      const link = ws.proto + '://' + ws.hostHeader + '/?room=' + c;
      let qr = null; if (QRCode) { try { qr = await QRCode.toDataURL(link, { margin: 1, width: 260, color: { dark: '#04170d', light: '#eafff3' } }); } catch (e) {} }
      send(ws, { t: 'created', code: c, link, qr });
    } else if (m.t === 'join') {
      const code = (m.code || '').toUpperCase();
      const r = rooms.get(code);
      if (!r) { send(ws, { t: 'error', msg: 'Raum nicht gefunden' }); return; }
      if (r.guest) { send(ws, { t: 'error', msg: 'Raum ist voll' }); return; }
      r.guest = ws; ws.room = code; ws.role = 'guest';
      send(ws, { t: 'joined', code });
      send(r.host, { t: 'peer-joined' });
    } else if (m.t === 'relay') {
      const r = rooms.get(ws.room); if (!r) return;
      const other = ws.role === 'host' ? r.guest : r.host;
      if (other) send(other, m.d);
    } else if (m.t === 'bye') { cleanup(ws); }
  });
  ws.on('close', () => cleanup(ws));
  ws.on('error', () => {});
});

function cleanup(ws) {
  const r = ws.room && rooms.get(ws.room); if (!r) return;
  const other = ws.role === 'host' ? r.guest : r.host;
  if (other) send(other, { t: 'peer-left' });
  rooms.delete(ws.room);
}

server.listen(PORT, () => console.log('Torjäger server on :' + PORT + '  root=' + ROOT + '  qr=' + (QRCode ? 'on' : 'off') + '  konten=' + Object.keys(users).filter(k => k !== '__secret').length));
