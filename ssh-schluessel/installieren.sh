#!/usr/bin/env bash
#
# Einmal-Schluessel fuer die SSH-Freigabe — alles in einer Datei.
#
# Ein Schluessel gilt 5 Minuten und genau ein Login. Danach — ob eingeloest
# oder ungenutzt verfallen — laeuft eine Sperre, bevor der naechste geht,
# und die wird jedes Mal laenger:
#
#     10 min  ->  1 h  ->  3 h  ->  6 h  ->  12 h  ->  1 d  ->  Dauersperre
#
# Die Dauersperre gilt fuer alle und laeuft nicht von selbst ab.
#
# Benutzung:
#     sudo bash installieren.sh                      # installieren
#     sudo PORTAL_BENUTZER=www-data bash installieren.sh
#
# Umgebungsvariablen:
#     ZIEL             wohin die Programmdateien (Vorgabe /opt/ssh-schluessel)
#     DATEN            wohin der Zustand    (Vorgabe /var/lib/ssh-schluessel)
#     PORTAL_BENUTZER  Benutzer, unter dem das Portal laeuft (fuer die Rechte)
#
set -euo pipefail

ZIEL="${ZIEL:-/opt/ssh-schluessel}"
DATEN="${DATEN:-/var/lib/ssh-schluessel}"
PORTAL_BENUTZER="${PORTAL_BENUTZER:-}"

rot()   { printf '\033[31m%s\033[0m\n' "$*"; }
gruen() { printf '\033[32m%s\033[0m\n' "$*"; }
grau()  { printf '\033[90m%s\033[0m\n' "$*"; }
titel() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ------------------------------------------------------------ Voraussetzungen

titel '1/5  Voraussetzungen'

if ! command -v node >/dev/null 2>&1; then
  rot 'node nicht gefunden. Node.js installieren, dann nochmal.'
  exit 1
fi
grau "     node          $(node --version)  ($(command -v node))"

if command -v pwsh >/dev/null 2>&1; then
  grau "     pwsh          gefunden  ($(command -v pwsh))"
  HAT_PWSH=ja
else
  grau '     pwsh          nicht gefunden — key.ps1 wird trotzdem abgelegt'
  HAT_PWSH=nein
fi

if [ -n "$PORTAL_BENUTZER" ] && ! id "$PORTAL_BENUTZER" >/dev/null 2>&1; then
  rot "Benutzer '$PORTAL_BENUTZER' gibt es nicht."
  exit 1
fi

# --------------------------------------------------------------- Dateien

titel '2/5  Dateien ablegen'

mkdir -p "$ZIEL" "$DATEN"

sichern() {
  if [ -f "$1" ]; then
    cp -p "$1" "$1.alt.$(date +%Y%m%d%H%M%S)"
    grau "     Vorherige Fassung gesichert: $1.alt.*"
  fi
}

sichern "$ZIEL/schluessel.js"
cat > "$ZIEL/schluessel.js" <<'ENDE_SCHLUESSEL_JS'
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
ENDE_SCHLUESSEL_JS

sichern "$ZIEL/key.ps1"
cat > "$ZIEL/key.ps1" <<'ENDE_KEY_PS1'
<#
    key.ps1 — Einmal-Schluessel fuer die SSH-Freigabe, fuer PowerShell Core
    auf dem Server.

    Einbinden (einmalig), in $PROFILE:
        . /opt/ssh-schluessel/key.ps1

    Danach:
        key             neuen Schluessel erzeugen
        key -Status     Stufe, Sperre und offenen Schluessel anzeigen
        key -Entsperren Dauersperre aufheben

    Die ganze Logik steckt in schluessel.js — dieses Skript ruft es nur auf
    und stellt das Ergebnis dar. So gibt es keine zweite Umsetzung derselben
    Regeln, die auseinanderlaufen koennte.
#>

# Beim Dot-Sourcing landen Funktionen und Variablen in der Sitzung des
# Aufrufers. Die Wurzel deshalb global merken — $PSScriptRoot ist spaeter,
# beim Aufruf von `key`, nicht mehr gesetzt.
$global:SchluesselWurzel = $PSScriptRoot

function Get-SchluesselPfad {
    $skript = Join-Path $SchluesselWurzel 'schluessel.js'
    if (-not (Test-Path -LiteralPath $skript)) {
        throw "schluessel.js nicht gefunden: $skript"
    }
    return $skript
}

function Invoke-Schluessel {
    param([string[]]$Argumente)

    $skript = Get-SchluesselPfad
    $node = if ($env:SCHLUESSEL_NODE) { $env:SCHLUESSEL_NODE } else { 'node' }

    # stderr mit einsammeln (das Modul warnt dort), aber nicht als Fehler
    # behandeln — die eigentliche Antwort ist die letzte JSON-Zeile.
    $ErrorActionPreference = 'Continue'
    $zeilen = & $node $skript @Argumente '--json' 2>&1 | ForEach-Object { $_.ToString() }

    $json = $zeilen | Where-Object { $_.TrimStart().StartsWith('{') } | Select-Object -Last 1
    if (-not $json) {
        throw "Unerwartete Ausgabe von schluessel.js:`n$($zeilen -join "`n")"
    }
    return $json | ConvertFrom-Json
}

function Format-SchluesselDauer {
    param([double]$Millisekunden)

    $s = [Math]::Max([Math]::Round($Millisekunden / 1000), 0)
    if ($s -lt 90) { return "$s s" }
    $m = [Math]::Round($s / 60)
    if ($m -lt 90) { return "$m min" }
    $h = [Math]::Round($m / 60)
    if ($h -lt 36) { return "$h h" }
    return "$([Math]::Round($h / 24)) Tage"
}

function ConvertFrom-SchluesselZeit {
    param([double]$Millisekunden)
    return [DateTimeOffset]::FromUnixTimeMilliseconds([long]$Millisekunden).LocalDateTime
}

function key {
    <#
        .SYNOPSIS
            Erzeugt einen Einmal-Schluessel fuer die SSH-Freigabe.
        .DESCRIPTION
            Ohne Schalter wird ein Schluessel erzeugt. Er gilt 5 Minuten und
            genau einmal. Danach — ob benutzt oder verfallen — laeuft eine
            Sperre, die mit jedem Schluessel laenger wird:
            10 min, 1 h, 3 h, 6 h, 12 h, 1 d, danach Dauersperre.
        .EXAMPLE
            key
        .EXAMPLE
            key -Status
    #>
    [CmdletBinding(DefaultParameterSetName = 'Neu')]
    param(
        [Parameter(ParameterSetName = 'Status')][switch]$Status,
        [Parameter(ParameterSetName = 'Entsperren')][switch]$Entsperren,
        [switch]$Json
    )

    $befehl = switch ($PSCmdlet.ParameterSetName) {
        'Status'     { 'status' }
        'Entsperren' { 'entsperren' }
        default      { 'neu' }
    }

    try {
        $a = Invoke-Schluessel -Argumente @($befehl)
    } catch {
        Write-Host ''
        Write-Host "  Fehler: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ''
        return
    }

    if ($Json) { return $a }

    if (-not $a.ok) {
        Write-Host ''
        Write-Host "  $($a.text)" -ForegroundColor Red
        if ($a.grund -eq 'dauersperre') {
            Write-Host '  Aufheben mit:  key -Entsperren' -ForegroundColor DarkGray
        }
        Write-Host ''
        return
    }

    $jetzt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

    switch ($befehl) {
        'neu' {
            $bis = ConvertFrom-SchluesselZeit $a.laeuft_ab
            Write-Host ''
            Write-Host '  SSH-Schluessel' -ForegroundColor DarkGray
            Write-Host ''
            Write-Host "      $($a.schluessel)" -ForegroundColor Green
            Write-Host ''
            Write-Host "  gueltig bis $($bis.ToString('HH:mm:ss')) ($(Format-SchluesselDauer $a.gueltig_ms)), genau ein Login" -ForegroundColor DarkGray
            if ($null -ne $a.naechste_sperre) {
                Write-Host "  danach $(Format-SchluesselDauer $a.naechste_sperre) Sperre, bevor ein neuer Schluessel geht" -ForegroundColor DarkGray
            } else {
                Write-Host '  Achtung: nach diesem Schluessel greift die Dauersperre' -ForegroundColor Yellow
            }
            Write-Host ''
        }
        'status' {
            Write-Host ''
            Write-Host "  Stufe            $($a.stufe) von $($a.leiter.Count)"
            $naechste = if ($null -ne $a.naechste_sperre) {
                Format-SchluesselDauer $a.naechste_sperre
            } else { 'Dauersperre' }
            Write-Host "  naechste Sperre  $naechste"
            if ($a.offen) {
                Write-Host "  offener Sch.     ja, noch $(Format-SchluesselDauer ($a.laeuft_ab - $jetzt))" -ForegroundColor Yellow
            } else {
                Write-Host '  offener Sch.     nein'
            }
            if ($a.dauerhaft_gesperrt) {
                Write-Host '  gesperrt         DAUERHAFT — key -Entsperren' -ForegroundColor Red
            } elseif ($a.gesperrt_bis -gt 0) {
                Write-Host "  gesperrt         noch $(Format-SchluesselDauer ($a.gesperrt_bis - $jetzt))" -ForegroundColor Yellow
            } else {
                Write-Host '  gesperrt         nein' -ForegroundColor Green
            }
            Write-Host ''
        }
        'entsperren' {
            Write-Host ''
            Write-Host "  $($a.text)" -ForegroundColor Green
            Write-Host ''
        }
    }
}
ENDE_KEY_PS1

chmod 0644 "$ZIEL/schluessel.js" "$ZIEL/key.ps1"

# Der Vorgabepfad im Modul muss zu DATEN passen. Sonst schreiben key und
# Portal in eine ganz andere Datei als die, deren Rechte wir gleich setzen.
# node statt sed: der Pfad wird sauber gequotet, egal was drin steht.
node -e '
  const fs = require("fs");
  const [datei, pfad] = process.argv.slice(1);
  const alt = fs.readFileSync(datei, "utf8");
  const neu = alt.replace(
    /^const DATEI = process\.env\.SCHLUESSEL_DATEI \|\| .*$/m,
    "const DATEI = process.env.SCHLUESSEL_DATEI || " + JSON.stringify(pfad) + ";");
  if (neu === alt) { console.error("Zeile mit dem Vorgabepfad nicht gefunden"); process.exit(1); }
  fs.writeFileSync(datei, neu);
' "$ZIEL/schluessel.js" "$DATEN/zustand.json" || {
  rot "     Vorgabepfad konnte nicht auf $DATEN gesetzt werden."
  exit 1
}

gruen "     $ZIEL/schluessel.js"
gruen "     $ZIEL/key.ps1"
grau  "     Zustand:  $DATEN/zustand.json"

# ----------------------------------------------------------------- Rechte

titel '3/5  Rechte'

chmod 0700 "$DATEN"
if [ -n "$PORTAL_BENUTZER" ]; then
  chown "$PORTAL_BENUTZER" "$DATEN"
  gruen "     $DATEN  gehoert $PORTAL_BENUTZER (0700)"
  grau  '     Erzeuge Schluessel dann mit:'
  grau  "       sudo -u $PORTAL_BENUTZER node $ZIEL/schluessel.js neu"
else
  gruen "     $DATEN  (0700, $(id -un))"
  grau  '     Laeuft das Portal unter einem anderen Benutzer, nochmal mit'
  grau  '     PORTAL_BENUTZER=<benutzer> starten — sonst kann das Portal den'
  grau  '     Schluessel nicht pruefen.'
fi

# ------------------------------------------------------------ PowerShell

titel '4/5  PowerShell'

if [ "$HAT_PWSH" = ja ]; then
  PROFIL="$(pwsh -NoProfile -c '$PROFILE' 2>/dev/null || true)"
  if [ -n "$PROFIL" ]; then
    mkdir -p "$(dirname "$PROFIL")"
    touch "$PROFIL"
    if grep -qF "$ZIEL/key.ps1" "$PROFIL" 2>/dev/null; then
      grau "     schon eingebunden in $PROFIL"
    else
      printf '. %s\n' "$ZIEL/key.ps1" >> "$PROFIL"
      gruen "     eingebunden in $PROFIL"
    fi
    grau '     In einer NEUEN pwsh-Sitzung:  key'
  else
    rot '     $PROFILE nicht ermittelbar — von Hand einbinden:'
    grau "       . $ZIEL/key.ps1"
  fi
else
  grau '     uebersprungen. Ohne pwsh geht alles genauso:'
  grau "       node $ZIEL/schluessel.js neu"
fi

# ------------------------------------------------------------------ Probe

titel '5/5  Probe'

# Ohne SCHLUESSEL_DATEI aufrufen: so wird der eben gesetzte Vorgabepfad
# mitgeprueft. `status` liest nur — verbraucht keinen Schluessel und ruehrt
# die Leiter nicht an.
if PROBE="$(node "$ZIEL/schluessel.js" status 2>&1)"; then
  gruen '     Modul laeuft und kann den Zustand schreiben.'
  printf '%s\n' "$PROBE" | sed 's/^/       /'
else
  rot '     Modul konnte nicht starten:'
  printf '%s\n' "$PROBE" | sed 's/^/       /'
  exit 1
fi

# ------------------------------------------------------------- Was jetzt

cat <<HINWEIS

$(printf '\033[1m%s\033[0m' 'Bleibt noch: der Einbau ins Portal')

  Finde die Datei, in der dein /ssh/-Portal steckt:

      sudo grep -rl "login-passwort" /opt /srv /root /home /var/www 2>/dev/null

  Dort ganz oben zu den anderen require-Zeilen:

      const schluessel = require('$ZIEL/schluessel.js');

  Und im Handler fuer POST /ssh/login-passwort die Passwortpruefung
  ersetzen. Aus:

      if (koerper.passwort === PORTAL_PASSWORT) {
        // ...Sitzung anlegen...
      }

  wird:

      const versuch = schluessel.einloesen(koerper.passwort);
      if (versuch.ok) {
        // ...Sitzung anlegen, genau derselbe Code wie vorher...
      }

  Die Weboberflaeche bleibt unveraendert — ins bestehende Passwortfeld
  tippt man jetzt eben den Schluessel. Bindestriche, Leerzeichen und
  Kleinschreibung sind egal.

  Danach Portal neu starten.

$(printf '\033[1m%s\033[0m' 'Bedienung')

  key                 neuen Schluessel erzeugen
  key -Status         Stufe, Sperre, offener Schluessel
  key -Entsperren     Dauersperre aufheben, Stufe zurueck auf 0

$(printf '\033[1m%s\033[0m' 'Einstellungen')

  Umgebungsvariablen, fuer Portal und key gleich setzen:

  SCHLUESSEL_DATEI          $DATEN/zustand.json
  SCHLUESSEL_GUELTIG_MIN    5
  SCHLUESSEL_LEITER         10m,1h,3h,6h,12h,1d
  SCHLUESSEL_FEHLVERSUCHE   5
  SCHLUESSEL_RUHE_STUNDEN   0 (aus) — z.B. 24: nach einem ruhigen Tag
                            faengt die Leiter wieder bei 10 min an.
                            Die Dauersperre wird davon nie aufgehoben.

$(printf '\033[33m%s\033[0m' 'Achtung: ab Werk sind das sieben Schluessel, dann ist dauerhaft zu.')
$(printf '\033[33m%s\033[0m' 'Die Leiter zaehlt nie von selbst zurueck — siehe SCHLUESSEL_RUHE_STUNDEN.')

HINWEIS
