#!/usr/bin/env node
'use strict';
/* Einmal-Schluessel fuer die SSH-Freigabe.
 *
 * Ein Schluessel ersetzt das feste Portal-Passwort:
 *   - `key` auf dem Server erzeugt genau einen Schluessel, gueltig 5 Minuten.
 *   - Wird er benutzt, ist er sofort weg (Einmalgebrauch).
 *   - Wird er nicht benutzt, verfaellt er nach 5 Minuten.
 *
 * In beiden Faellen folgt eine Sperre, bevor der naechste Schluessel geht.
 * Die Sperre wird mit jedem Schluessel laenger:
 *   10 min -> 1 h -> 3 h -> 6 h -> 12 h -> 1 d -> Dauersperre.
 * Die Dauersperre gilt fuer alle und loest sich nicht von selbst; sie muss
 * ueber `key -Entsperren` (bzw. `node schluessel.js entsperren`) aufgehoben
 * werden.
 *
 * Benutzung als Modul (im Portal):
 *   const schluessel = require('/opt/ssh-schluessel/schluessel.js');
 *   if (schluessel.einloesen(eingabe).ok) { ...Sitzung anlegen... }
 *
 * Benutzung auf der Kommandozeile:
 *   node schluessel.js neu | status | einloesen <schluessel> | entsperren
 *
 * Ohne Fremdpakete, absichtlich synchron: die Aufrufe sind selten und die
 * Zustandsdatei ist winzig.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ------------------------------------------------------------- Einstellungen

/** Zustandsdatei. Muss root gehoeren und 0600 sein — wer sie schreiben darf,
 *  kann die Sperren zuruecksetzen. */
const DATEI = process.env.SCHLUESSEL_DATEI || '/var/lib/ssh-schluessel/zustand.json';

/** Wie lange ein erzeugter Schluessel gilt. */
const GUELTIG_MS = zahl(process.env.SCHLUESSEL_GUELTIG_MIN, 5) * 60000;

/** Sperrleiter: eine Stufe pro verbrauchtem Schluessel. Ist die Leiter zu
 *  Ende, greift die Dauersperre. */
const LEITER = leiterLesen(process.env.SCHLUESSEL_LEITER || '10m,1h,3h,6h,12h,1d');

/** Fehlversuche, bis der offene Schluessel verbrannt wird. */
const MAX_FEHLVERSUCHE = zahl(process.env.SCHLUESSEL_FEHLVERSUCHE, 5);

/** Optional: Stufe auf 0 zuruecksetzen, wenn so viele Stunden lang nichts
 *  passiert ist. 0 = aus (Vorgabe), die Leiter zaehlt dann fuer immer weiter.
 *  Die Dauersperre wird davon nie aufgehoben. */
const RUHE_MS = zahl(process.env.SCHLUESSEL_RUHE_STUNDEN, 0) * 3600000;

/** Ohne 0/O/1/I — am Telefon und im Chat verwechslungsfrei vorlesbar.
 *  Genau 32 Zeichen, teilt 256 glatt, also keine Modulo-Verzerrung. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GRUPPEN = 5;
const GRUPPENLAENGE = 4;

const LEER = {
  stufe: 0,               // naechste Sperrstufe (Index in LEITER)
  gesperrt_bis: 0,        // Zeitpunkt, ab dem wieder ein Schluessel geht
  dauerhaft_gesperrt: false,
  offen: null,            // { hash, erzeugt, laeuft_ab, fehlversuche }
  letzte_aktivitaet: 0,
  protokoll: [],
};

// ------------------------------------------------------------------ Helfer

function zahl(wert, vorgabe) {
  const n = Number(wert);
  return Number.isFinite(n) && n >= 0 ? n : vorgabe;
}

/** "10m,1h,1d" -> [600000, 3600000, 86400000] */
function leiterLesen(text) {
  const einheit = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const stufen = String(text).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const t = /^(\d+)\s*([smhd])$/.exec(s.toLowerCase());
    if (!t) throw new Error('Ungueltige Stufe in SCHLUESSEL_LEITER: "' + s + '"');
    return Number(t[1]) * einheit[t[2]];
  });
  if (!stufen.length) throw new Error('SCHLUESSEL_LEITER ist leer');
  return stufen;
}

function dauerText(ms) {
  const s = Math.max(Math.round(ms / 1000), 0);
  if (s < 90) return s + ' s';
  const m = Math.round(s / 60);
  if (m < 90) return m + ' min';
  const h = Math.round(m / 60);
  if (h < 36) return h + ' h';
  return Math.round(h / 24) + ' Tage';
}

/** Synchron warten, ohne Fremdpakete. */
function warteKurz(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function hashe(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Vergleich in gleichbleibender Zeit. Beide Seiten sind Hex-Hashes, also
 *  immer gleich lang. */
function gleich(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Bindestriche, Leerzeichen und Kleinschreibung sind egal. */
function normiere(eingabe) {
  return String(eingabe == null ? '' : eingabe)
    .toUpperCase()
    .split('')
    .filter((c) => ALPHABET.indexOf(c) >= 0)
    .join('');
}

function erzeugeSchluessel() {
  const roh = crypto.randomBytes(GRUPPEN * GRUPPENLAENGE);
  let text = '';
  for (let i = 0; i < roh.length; i++) {
    if (i > 0 && i % GRUPPENLAENGE === 0) text += '-';
    text += ALPHABET[roh[i] % ALPHABET.length];
  }
  return text;
}

// ------------------------------------------------------------- Zustandsdatei

function lade() {
  let roh = {};
  try {
    roh = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('[schluessel] Zustandsdatei unlesbar (' + e.message + ') – beginne bei Stufe 0.');
    }
  }
  const z = Object.assign({}, LEER, roh);
  // Eigene Liste, sonst haengt der Zustand an der Liste in LEER.
  z.protokoll = Array.isArray(roh.protokoll) ? roh.protokoll.slice() : [];
  return z;
}

function speichere(z) {
  fs.mkdirSync(path.dirname(DATEI), { recursive: true });
  const zwischen = DATEI + '.neu';
  fs.writeFileSync(zwischen, JSON.stringify(z, null, 2), { mode: 0o600 });
  fs.renameSync(zwischen, DATEI);
}

/** Alle schreibenden Vorgaenge laufen unter dieser Sperre — Portal und
 *  `key` greifen sonst gleichzeitig auf dieselbe Datei zu. */
function mitSperre(fn) {
  const sperrdatei = DATEI + '.lock';
  fs.mkdirSync(path.dirname(DATEI), { recursive: true });
  let griff = null;
  for (let versuch = 0; versuch < 150 && griff === null; versuch++) {
    try {
      griff = fs.openSync(sperrdatei, 'wx');
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        // Verwaiste Sperre eines abgestuerzten Aufrufs wieder freigeben.
        if (Date.now() - fs.statSync(sperrdatei).mtimeMs > 10000) fs.unlinkSync(sperrdatei);
      } catch (x) { /* schon weg */ }
      warteKurz(20);
    }
  }
  if (griff === null) throw new Error('Zustandsdatei bleibt gesperrt: ' + sperrdatei);
  try {
    return fn();
  } finally {
    try { fs.closeSync(griff); } catch (e) { /* egal */ }
    try { fs.unlinkSync(sperrdatei); } catch (e) { /* egal */ }
  }
}

function eintrag(z, art, text) {
  z.protokoll.push({ zeit: Date.now(), art: art, text: text });
  if (z.protokoll.length > 50) z.protokoll = z.protokoll.slice(-50);
}

// ---------------------------------------------------------------- Sperrlogik

/** Ein Schluessel ist verbraucht — naechste Stufe der Leiter anwenden.
 *  `basis` ist der Zeitpunkt, ab dem die Sperre laeuft (Einloesung: jetzt,
 *  Ablauf: der Ablaufzeitpunkt, damit eine spaet bemerkte Verfallszeit die
 *  Sperre nicht nach hinten schiebt). */
function strafe(z, basis, anlass) {
  z.letzte_aktivitaet = Math.max(z.letzte_aktivitaet, basis);
  const dauer = LEITER[z.stufe];
  if (dauer === undefined) {
    z.dauerhaft_gesperrt = true;
    z.gesperrt_bis = 0;
    eintrag(z, 'dauersperre', anlass + ' – Leiter zu Ende');
    return;
  }
  z.gesperrt_bis = Math.max(z.gesperrt_bis, basis + dauer);
  z.stufe += 1;
  eintrag(z, 'sperre', anlass + ' – ' + dauerText(dauer) + ' gesperrt');
}

/** Bringt den Zustand auf den aktuellen Stand. Gibt true zurueck, wenn sich
 *  etwas geaendert hat und gespeichert werden muss. */
function aufraeumen(z, jetzt) {
  let geaendert = false;

  if (z.offen && z.offen.laeuft_ab <= jetzt) {
    const abgelaufen = z.offen.laeuft_ab;
    z.offen = null;
    strafe(z, abgelaufen, 'ungenutzt abgelaufen');
    geaendert = true;
  }

  if (RUHE_MS > 0 && !z.dauerhaft_gesperrt && !z.offen && z.stufe > 0
      && z.gesperrt_bis <= jetzt && z.letzte_aktivitaet > 0
      && jetzt - z.letzte_aktivitaet >= RUHE_MS) {
    z.stufe = 0;
    eintrag(z, 'zurueckgesetzt', 'Ruhezeit von ' + dauerText(RUHE_MS) + ' abgelaufen');
    geaendert = true;
  }

  return geaendert;
}

// ------------------------------------------------------------------- Aktionen

/** Erzeugt einen Schluessel. Der Klartext steht nur hier einmal drin —
 *  gespeichert wird ausschliesslich sein Hash. */
function neu() {
  return mitSperre(() => {
    const jetzt = Date.now();
    const z = lade();
    aufraeumen(z, jetzt);

    if (z.dauerhaft_gesperrt) {
      speichere(z);
      return { ok: false, grund: 'dauersperre',
        text: 'Dauersperre aktiv. Die Funktion muss erst wieder entsperrt werden.' };
    }
    if (z.gesperrt_bis > jetzt) {
      speichere(z);
      return { ok: false, grund: 'gesperrt', gesperrt_bis: z.gesperrt_bis,
        text: 'Gesperrt – noch ' + dauerText(z.gesperrt_bis - jetzt) + '.' };
    }
    if (z.offen) {
      speichere(z);
      return { ok: false, grund: 'offen', laeuft_ab: z.offen.laeuft_ab,
        text: 'Es laeuft noch ein Schluessel (noch ' + dauerText(z.offen.laeuft_ab - jetzt) + ').' };
    }

    // Gehasht wird immer die normierte Form, sonst scheitert der Vergleich an
    // den Bindestrichen, die der Benutzer gar nicht mit eintippen muss.
    const klartext = erzeugeSchluessel();
    z.offen = { hash: hashe(normiere(klartext)), erzeugt: jetzt, laeuft_ab: jetzt + GUELTIG_MS, fehlversuche: 0 };
    z.letzte_aktivitaet = jetzt;
    eintrag(z, 'erzeugt', 'gueltig ' + dauerText(GUELTIG_MS));
    speichere(z);

    return {
      ok: true,
      schluessel: klartext,
      laeuft_ab: z.offen.laeuft_ab,
      gueltig_ms: GUELTIG_MS,
      stufe: z.stufe,
      naechste_sperre: LEITER[z.stufe] === undefined ? null : LEITER[z.stufe],
    };
  });
}

/** Prueft eine Eingabe. Bei Erfolg ist der Schluessel danach weg und die
 *  naechste Sperrstufe laeuft. */
function einloesen(eingabe) {
  return mitSperre(() => {
    const jetzt = Date.now();
    const z = lade();
    aufraeumen(z, jetzt);

    if (!z.offen) {
      speichere(z);
      return { ok: false, grund: 'keiner', text: 'Kein gueltiger Schluessel vorhanden.' };
    }

    const versuch = normiere(eingabe);
    if (!versuch || !gleich(hashe(versuch), z.offen.hash)) {
      z.offen.fehlversuche += 1;
      if (z.offen.fehlversuche >= MAX_FEHLVERSUCHE) {
        z.offen = null;
        strafe(z, jetzt, 'zu viele Fehlversuche');
        speichere(z);
        return { ok: false, grund: 'verbrannt',
          text: 'Zu viele Fehlversuche – der Schluessel wurde verworfen.' };
      }
      speichere(z);
      return { ok: false, grund: 'falsch', rest: MAX_FEHLVERSUCHE - z.offen.fehlversuche,
        text: 'Schluessel falsch.' };
    }

    z.offen = null;
    strafe(z, jetzt, 'eingeloest');
    speichere(z);
    return { ok: true, text: 'Schluessel akzeptiert.' };
  });
}

function stand() {
  // Auch das Lesen laeuft unter der Sperre: aufraeumen() rechnet einen
  // abgelaufenen Schluessel ab, das ist ein Schreibvorgang.
  const { z, jetzt } = mitSperre(() => {
    const augenblick = Date.now();
    const zustand = lade();
    if (aufraeumen(zustand, augenblick)) speichere(zustand);
    return { z: zustand, jetzt: augenblick };
  });
  return {
    offen: !!z.offen,
    laeuft_ab: z.offen ? z.offen.laeuft_ab : 0,
    stufe: z.stufe,
    naechste_sperre: LEITER[z.stufe] === undefined ? null : LEITER[z.stufe],
    gesperrt_bis: z.gesperrt_bis > jetzt ? z.gesperrt_bis : 0,
    dauerhaft_gesperrt: z.dauerhaft_gesperrt,
    leiter: LEITER,
    protokoll: z.protokoll.slice(-20),
  };
}

/** Hebt Dauersperre und Sperrstufe auf. */
function entsperren() {
  return mitSperre(() => {
    const z = lade();
    z.stufe = 0;
    z.gesperrt_bis = 0;
    z.dauerhaft_gesperrt = false;
    z.offen = null;
    eintrag(z, 'entsperrt', 'Sperre manuell aufgehoben');
    speichere(z);
    return { ok: true, text: 'Entsperrt, Stufe zurueck auf 0.' };
  });
}

module.exports = { neu, einloesen, stand, entsperren, dauerText, DATEI, LEITER, GUELTIG_MS };

// ------------------------------------------------------------- Kommandozeile

if (require.main === module) {
  const args = process.argv.slice(2).filter((a) => a !== '--json');
  const alsJson = process.argv.includes('--json');
  const befehl = args[0] || 'status';

  let ergebnis;
  try {
    if (befehl === 'neu') ergebnis = neu();
    else if (befehl === 'status') ergebnis = Object.assign({ ok: true }, stand());
    else if (befehl === 'einloesen') ergebnis = einloesen(args[1]);
    else if (befehl === 'entsperren') ergebnis = entsperren();
    else ergebnis = { ok: false, grund: 'befehl',
      text: 'Bekannt: neu | status | einloesen <schluessel> | entsperren' };
  } catch (e) {
    ergebnis = { ok: false, grund: 'fehler', text: e.message };
  }

  if (alsJson) {
    process.stdout.write(JSON.stringify(ergebnis) + '\n');
  } else if (befehl === 'status' && ergebnis.ok) {
    const jetzt = Date.now();
    console.log('Stufe:            ' + ergebnis.stufe + ' von ' + ergebnis.leiter.length);
    console.log('Naechste Sperre:  ' + (ergebnis.naechste_sperre === null
      ? 'Dauersperre' : dauerText(ergebnis.naechste_sperre)));
    console.log('Offener Sch.:     ' + (ergebnis.offen
      ? 'ja, noch ' + dauerText(ergebnis.laeuft_ab - jetzt) : 'nein'));
    console.log('Gesperrt:         ' + (ergebnis.dauerhaft_gesperrt ? 'DAUERHAFT'
      : ergebnis.gesperrt_bis ? 'noch ' + dauerText(ergebnis.gesperrt_bis - jetzt) : 'nein'));
  } else {
    console.log(ergebnis.schluessel ? ergebnis.schluessel : ergebnis.text);
  }

  process.exit(ergebnis.ok ? 0 : 1);
}
