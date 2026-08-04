try { require('dotenv').config(); } catch (_) {}
const net = require('net');
const { EventEmitter } = require('events');

process.on('uncaughtException', (err) => {
  console.error('[mcbot] Uncaught exception (ignored):', err.message);
});

const emitter = new EventEmitter();
const MAX_LOGS = 200;
const logs = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  logs.push(line);
  if (logs.length > MAX_LOGS) logs.shift();
  console.log(line);
}
function getLogs(n = 30) { return logs.slice(-n).join('\n'); }

// ── RCON-Zugang (Standard passt zu unserer server.properties) ─────────────────
const RCON_HOST = process.env.MC_RCON_HOST || '127.0.0.1';
const RCON_PORT = parseInt(process.env.MC_RCON_PORT || '25575', 10);
const RCON_PASS = process.env.MC_RCON_PASS || 'torj_rcon_2026';

let online = false;
let pollTimer = null;

// ── Minimaler RCON-Client (keine Extra-Pakete) ────────────────────────────────
function rcon(command, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: RCON_HOST, port: RCON_PORT });
    let buf = Buffer.alloc(0);
    let authed = false;
    let done = false;
    const finish = (err, val) => {
      if (done) return; done = true;
      clearTimeout(to);
      try { sock.destroy(); } catch (_) {}
      err ? reject(err) : resolve(val);
    };
    const to = setTimeout(() => finish(new Error('RCON timeout')), timeout);
    const pkt = (id, type, body) => {
      const b = Buffer.from(body, 'utf8');
      const p = Buffer.alloc(4 + 10 + b.length);
      p.writeInt32LE(10 + b.length, 0);
      p.writeInt32LE(id, 4);
      p.writeInt32LE(type, 8);
      b.copy(p, 12);
      p.writeInt16LE(0, 12 + b.length);
      return p;
    };
    sock.on('connect', () => sock.write(pkt(1, 3, RCON_PASS)));   // 3 = AUTH
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 4) {
        const len = buf.readInt32LE(0);
        if (buf.length < 4 + len) break;
        const id = buf.readInt32LE(4);
        const body = buf.slice(12, 4 + len - 2).toString('utf8');
        buf = buf.slice(4 + len);
        if (!authed) {
          if (id === -1) return finish(new Error('RCON auth failed'));
          authed = true;
          sock.write(pkt(2, 2, command));   // 2 = EXEC
        } else {
          return finish(null, body);
        }
      }
    });
    sock.on('error', (e) => finish(e));
    sock.on('close', () => finish(new Error('RCON closed')));
  });
}

async function sendCommand(cmd) {
  const c = (cmd || '').startsWith('/') ? cmd.slice(1) : cmd;
  try {
    const res = await rcon(c);
    log(`RCON> ${c}  =>  ${String(res || '').replace(/§./g, '').replace(/\s+/g, ' ').slice(0, 200)}`);
    return String(res || '').replace(/§./g, '');
  } catch (e) {
    log(`RCON Fehler bei "${c}": ${e.message}`);
    return '';
  }
}

// /list-Ausgabe parsen: "There are 2 of a max of 20 players online: Alice, Bob"
async function getStatus() {
  try {
    const raw = (await rcon('list')).replace(/§./g, '');
    const m = raw.match(/(\d+)\s*of\s*a?\s*max(?:imum)?\s*of\s*(\d+)/i) || raw.match(/(\d+)\s*\/\s*(\d+)/);
    let count = 0, max = 0, players = [];
    if (m) { count = parseInt(m[1], 10); max = parseInt(m[2], 10); }
    const idx = raw.indexOf(':');
    if (idx >= 0) {
      const names = raw.slice(idx + 1).trim();
      if (names) players = names.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return { online: true, count, max, players, raw };
  } catch (e) {
    return { online: false, count: 0, max: 0, players: [], raw: e.message };
  }
}

function isOnline() { return online; }

async function poll() {
  const st = await getStatus();
  if (st.online && !online) { online = true; log('Server erreichbar (RCON)'); emitter.emit('online'); }
  else if (!st.online && online) { online = false; log('Server nicht erreichbar (RCON)'); emitter.emit('offline', st.raw || 'RCON nicht erreichbar'); }
}

function connect() {
  if (!pollTimer) {
    poll();
    pollTimer = setInterval(poll, 30000);
  }
}
function reconnect() { poll(); }

if (require.main === module) connect();

module.exports = { connect, reconnect, sendCommand, isOnline, getLogs, getStatus, emitter };
