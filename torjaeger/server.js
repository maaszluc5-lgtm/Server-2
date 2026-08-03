/* Torjäger — static file server + realtime multiplayer relay
 * Serves index.html and handles WebSocket rooms for 2-player online matches.
 * Install once:  npm install ws qrcode
 * Run (via pm2): TORJ_DIR=/root/torjaeger PORT=4000 node server.js
 */
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
let QRCode = null; try { QRCode = require('qrcode'); } catch (e) { console.log('(qrcode nicht installiert – QR wird nicht generiert)'); }

const ROOT = process.env.TORJ_DIR || __dirname;
const PORT = parseInt(process.env.PORT || '4000', 10);
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.json':'application/json' };

const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
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

const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map(); // code -> {host, guest}
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
    } else if (m.t === 'bye') {
      cleanup(ws);
    }
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

server.listen(PORT, () => console.log('Torjäger server on :' + PORT + '  root=' + ROOT + '  qr=' + (QRCode ? 'on' : 'off')));
