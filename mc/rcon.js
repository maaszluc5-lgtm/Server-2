#!/usr/bin/env node
/* Winziger RCON-Client in Node — dieselbe Aufgabe wie rcon.py, nur ohne Python.
 * Liest Port und Passwort aus der server.properties.
 *
 * Benutzung:  node rcon.js "op GrassGlas7797"
 *             node rcon.js "list"
 *
 * Voraussetzung in /minecraft-server/server.properties:
 *   enable-rcon=true
 *   rcon.port=25575
 *   rcon.password=...
 * Nach dem Ändern muss der Server einmal neu starten.
 */

const net = require('net');
const fs = require('fs');

const PROPS = process.env.MC_PROPS || '/minecraft-server/server.properties';
const BEFEHL = process.argv.slice(2).join(' ');

if (!BEFEHL) {
  console.error('Nutzung: node rcon.js "<minecraft-befehl>"');
  process.exit(1);
}

let text = '';
try {
  text = fs.readFileSync(PROPS, 'utf8');
} catch (e) {
  console.error('Kann ' + PROPS + ' nicht lesen: ' + e.message);
  console.error('Anderer Pfad? Dann: MC_PROPS=/pfad/server.properties node rcon.js "..."');
  process.exit(1);
}

const prop = (k, standard) => {
  const m = text.match(new RegExp('^' + k.replace(/\./g, '\\.') + '=(.*)$', 'm'));
  return m ? m[1].trim() : standard;
};

const HOST = process.env.MC_RCON_HOST || '127.0.0.1';
const PORT = parseInt(process.env.MC_RCON_PORT || prop('rcon.port', '25575'), 10);
const PASS = process.env.MC_RCON_PASS || prop('rcon.password', '');

if (prop('enable-rcon', 'false') !== 'true') {
  console.error('In ' + PROPS + ' steht enable-rcon nicht auf true.');
  console.error('Eintragen, Server neu starten, dann noch einmal versuchen.');
  process.exit(1);
}
if (!PASS) {
  console.error('rcon.password ist leer — ohne Passwort nimmt der Server keine Verbindung an.');
  process.exit(1);
}

/* Paketformat: Länge, ID, Typ, Text, zwei Null-Bytes. */
function paket(id, typ, text) {
  const koerper = Buffer.from(text, 'utf8');
  const b = Buffer.alloc(14 + koerper.length);   /* 12 Byte Kopf + Text + zwei Null-Bytes */
  b.writeInt32LE(10 + koerper.length, 0);        /* Länge zählt alles nach diesem Feld */
  b.writeInt32LE(id, 4);
  b.writeInt32LE(typ, 8);
  koerper.copy(b, 12);
  return b;
}

const AUTH = 3, BEFEHL_SENDEN = 2, ANTWORT = 0;
let puffer = Buffer.alloc(0);
let angemeldet = false;
let ausgabe = '';
let fertigUhr = null;

const sock = net.connect({ host: HOST, port: PORT });
sock.setTimeout(8000);

sock.on('connect', () => sock.write(paket(1, AUTH, PASS)));

sock.on('data', (teil) => {
  puffer = Buffer.concat([puffer, teil]);
  while (puffer.length >= 4) {
    const laenge = puffer.readInt32LE(0);
    if (puffer.length < 4 + laenge) break;
    const id = puffer.readInt32LE(4);
    const typ = puffer.readInt32LE(8);
    const koerper = puffer.slice(12, 4 + laenge - 2).toString('utf8');
    puffer = puffer.slice(4 + laenge);

    if (!angemeldet) {
      if (id === -1) {
        console.error('Anmeldung abgelehnt — rcon.password stimmt nicht.');
        sock.destroy();
        process.exit(1);
      }
      if (typ === BEFEHL_SENDEN) {
        angemeldet = true;
        sock.write(paket(2, BEFEHL_SENDEN, BEFEHL));
      }
    } else if (typ === ANTWORT) {
      ausgabe += koerper;
      /* Lange Antworten kommen in mehreren Paketen — kurz warten, ob noch was folgt. */
      clearTimeout(fertigUhr);
      fertigUhr = setTimeout(() => { sock.destroy(); fertig(); }, 150);
    }
  }
});

function fertig() {
  console.log(ausgabe.trim() || '(ok – der Server hat nichts zurückgeschrieben)');
  process.exit(0);
}

sock.on('timeout', () => {
  console.error('Keine Antwort von ' + HOST + ':' + PORT + ' — läuft der Server, und ist enable-rcon=true?');
  sock.destroy();
  process.exit(1);
});

sock.on('error', (e) => {
  console.error('Keine RCON-Verbindung zu ' + HOST + ':' + PORT + ' (' + e.message + ')');
  process.exit(1);
});
