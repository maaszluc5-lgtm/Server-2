/* Web-Terminal — Shell im Browser (wie Termius), mit Passwortschutz.
 * Installieren:  npm install ws node-pty      (node-pty braucht: apt install -y build-essential python3)
 * Starten:       TERM_PASS='DEIN_STARKES_PASSWORT' PORT=7000 node webterm.js
 * Nur lokal erreichbar (127.0.0.1) – Zugriff ausschliesslich über den Tunnel.
 */
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
let pty = null; try { pty = require('node-pty'); } catch (e) {}
const cp = require('child_process');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || '7000', 10);
const HOST = process.env.TERM_HOST || '127.0.0.1';
const PASS = process.env.TERM_PASS || 'changeme';
const SHELL = process.env.TERM_SHELL || process.env.SHELL || 'bash';
if (PASS === 'changeme') console.log('\x1b[31m!! WARNUNG: Standardpasswort "changeme" aktiv – unbedingt TERM_PASS setzen!\x1b[0m');

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

wss.on('connection', (ws) => {
  let authed = false, shell = null, usingPty = false;
  const kill = () => { try { if (shell) usingPty ? shell.kill() : shell.kill('SIGHUP'); } catch (e) {} shell = null; };
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
    if (!authed) {
      if (m.t === 'auth') {
        if (m.pass !== PASS) { send(ws, { t: 'denied' }); setTimeout(() => { try { ws.close(); } catch (e) {} }, 300); return; }
        authed = true; send(ws, { t: 'ok', pty: !!pty, shell: SHELL });
        start(m.cols || 80, m.rows || 24);
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
      send(ws, { t: 'out', d: '\r\n\x1b[33m(node-pty fehlt – Basis-Modus. Fuer volles Terminal: apt install -y build-essential python3 && npm install node-pty)\x1b[0m\r\n' });
    }
  }
});

server.listen(PORT, HOST, () => console.log('WebTerm auf http://' + HOST + ':' + PORT + '  pty=' + (pty ? 'on' : 'off') + '  shell=' + SHELL));
