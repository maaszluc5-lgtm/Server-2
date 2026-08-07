/* Web-Terminal — Shell im Browser (wie Termius), mit Passwort + Mail-Code (2 Schloesser).
 * Ablauf:  Passwort  ->  Server schickt 6-stelligen Code an dein Outlook  ->  Code eingeben  ->  Terminal.
 * Start:   PORT=7000 node webterm.js
 * Secrets kommen aus /root/webterm/.env  (TERM_PASS, SMTP_USER, SMTP_PASS, CODE_TO).
 * Nur lokal erreichbar (127.0.0.1) – Zugriff ausschliesslich ueber nginx/Tunnel.
 */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
let pty = null; try { pty = require('node-pty'); } catch (e) {}
let nodemailer = null; try { nodemailer = require('nodemailer'); } catch (e) {}
const cp = require('child_process');

// ── kleine .env-Datei laden (setzt process.env, ueberschreibt nichts Vorhandenes) ──
(function loadEnv() {
  try {
    const p = path.join(__dirname, '.env');
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (e) {}
})();

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || '7000', 10);
const HOST = process.env.TERM_HOST || '127.0.0.1';
const PASS = process.env.TERM_PASS || 'changeme';
const SHELL = process.env.TERM_SHELL || process.env.SHELL || 'bash';

const SMTP_USER = process.env.SMTP_USER || '';           // Gmail-Adresse (Absender)
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, ''); // App-Passwort (Leerzeichen egal)
const CODE_TO   = process.env.CODE_TO || '';             // Outlook-Adresse (Empfaenger)
const MAIL_ON = !!(nodemailer && SMTP_USER && SMTP_PASS && CODE_TO);

if (PASS === 'changeme') console.log('\x1b[31m!! WARNUNG: Standardpasswort "changeme" aktiv – TERM_PASS setzen!\x1b[0m');
console.log('WebTerm Mail-Code: ' + (MAIL_ON ? ('AN  -> ' + CODE_TO) : 'AUS (nur Passwort) – SMTP_USER/SMTP_PASS/CODE_TO + nodemailer pruefen'));

let transporter = null;
if (MAIL_ON) transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: SMTP_USER, pass: SMTP_PASS }
});

function newCode() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }
function sendCode(code, ip) {
  return transporter.sendMail({
    from: '"Server Terminal" <' + SMTP_USER + '>',
    to: CODE_TO,
    subject: 'Terminal-Code: ' + code,
    text: 'Dein Login-Code fuer das Server-Terminal: ' + code + '\n\n'
        + 'Gueltig 10 Minuten. Anfrage von IP ' + (ip || '?') + '.\n'
        + 'Wenn du dich nicht gerade einloggst, ignoriere diese Mail und aendere dein Passwort.'
  });
}

// Code wird SERVERSEITIG gehalten (nicht pro Verbindung), damit man zwischendurch
// zur Mail-App wechseln darf, ohne dass die Anmeldung abbricht.
const CODE_TTL = 10 * 60 * 1000;   // 10 Minuten gueltig
const RESEND_GAP = 20 * 1000;      // fruehestens alle 20s neu mailen
let pending = null;                // { code, exp, tries, lastSent }

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css' };
const server = http.createServer((req, res) => {
  let u = req.url.split('?')[0]; if (u === '/' || u === '') u = '/index.html';
  const safe = path.normalize(u).replace(/^(\.\.[\/\\])+/, '');
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(d);
  });
});

const wss = new WebSocketServer({ server, path: '/term' });
const send = (ws, o) => { try { ws.send(JSON.stringify(o)); } catch (e) {} };

wss.on('connection', (ws, req) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
  let authed = false, shell = null, usingPty = false;
  const kill = () => { try { if (shell) usingPty ? shell.kill() : shell.kill('SIGHUP'); } catch (e) {} shell = null; };

  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }

    if (!authed) {
      // Schritt 1: Passwort -> Code anfordern (Code liegt serverseitig, Verbindung darf danach abbrechen)
      if (m.t === 'auth') {
        if (m.pass !== PASS) { send(ws, { t: 'denied' }); setTimeout(() => { try { ws.close(); } catch (e) {} }, 400); return; }
        if (!MAIL_ON) { authed = true; send(ws, { t: 'ok', pty: !!pty, shell: SHELL }); start(m.cols || 80, m.rows || 24); return; }
        const now = Date.now();
        if (pending && now < pending.exp) {
          // gueltiger Code existiert schon: hoechstens alle 20s neu mailen, sonst nur weiter
          if (now - pending.lastSent > RESEND_GAP) {
            pending.lastSent = now;
            sendCode(pending.code, ip).catch((e) => console.error('Mail-Fehler:', e.message));
          }
          send(ws, { t: 'code' });
        } else {
          const c = newCode();
          pending = { code: c, exp: now + CODE_TTL, tries: 0, lastSent: now };
          sendCode(c, ip)
            .then(() => send(ws, { t: 'code' }))
            .catch((err) => { console.error('Mail-Fehler:', err.message); pending = null; send(ws, { t: 'mailerr', msg: 'Code konnte nicht gesendet werden. Spaeter erneut versuchen.' }); });
        }
        return;
      }
      // Schritt 2: Passwort + Code pruefen (frische Verbindung) -> DIESE Verbindung wird das Terminal
      if (m.t === 'verify') {
        if (m.pass !== PASS) { send(ws, { t: 'denied' }); setTimeout(() => { try { ws.close(); } catch (e) {} }, 400); return; }
        if (!pending || Date.now() > pending.exp) { pending = null; send(ws, { t: 'codebad', msg: 'Code abgelaufen – bitte neu anmelden.' }); return; }
        if (++pending.tries > 6) { pending = null; send(ws, { t: 'denied' }); setTimeout(() => { try { ws.close(); } catch (e) {} }, 400); return; }
        if (String(m.code || '').replace(/\s+/g, '') !== pending.code) { send(ws, { t: 'codebad', msg: 'Falscher Code (' + (7 - pending.tries) + ' Versuche uebrig).' }); return; }
        pending = null; authed = true;
        send(ws, { t: 'ok', pty: !!pty, shell: SHELL });
        start(m.cols || 80, m.rows || 24);
        return;
      }
      return;
    }

    if (m.t === 'in') { if (usingPty) shell && shell.write(m.d); else if (shell && shell.stdin.writable) shell.stdin.write(m.d); }
    else if (m.t === 'resize') { if (usingPty && shell) { try { shell.resize(m.cols, m.rows); } catch (e) {} } }
  });
  ws.on('close', kill); ws.on('error', kill);

  function start(cols, rows) {
    if (pty) {
      usingPty = true;
      shell = pty.spawn(SHELL, [], { name: 'xterm-color', cols, rows, cwd: process.env.HOME || ROOT, env: process.env });
      shell.onData(d => send(ws, { t: 'out', d }));
      shell.onExit(() => { send(ws, { t: 'exit' }); try { ws.close(); } catch (e) {} });
    } else {
      usingPty = false;
      shell = cp.spawn(SHELL, ['-i'], { cwd: process.env.HOME || ROOT, env: { ...process.env, TERM: 'xterm-color', PS1: '\\u@\\h:\\w\\$ ' } });
      const fwd = d => send(ws, { t: 'out', d: d.toString() });
      shell.stdout.on('data', fwd); shell.stderr.on('data', fwd);
      shell.on('exit', () => { send(ws, { t: 'exit' }); try { ws.close(); } catch (e) {} });
      send(ws, { t: 'out', d: '\r\n\x1b[33m(node-pty fehlt – Basis-Modus.)\x1b[0m\r\n' });
    }
  }
});

server.listen(PORT, HOST, () => console.log('WebTerm auf http://' + HOST + ':' + PORT + '  pty=' + (pty ? 'on' : 'off')));
