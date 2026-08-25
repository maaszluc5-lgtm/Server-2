#!/usr/bin/env python3
"""Baut installieren.sh aus den echten Quelldateien zusammen."""
import pathlib

wurzel = pathlib.Path('/home/user/Server-2/ssh-schluessel')
js = (wurzel / 'schluessel.js').read_text()
ps = (wurzel / 'key.ps1').read_text()

for name, inhalt in (('schluessel.js', js), ('key.ps1', ps)):
    for marke in ('ENDE_SCHLUESSEL_JS', 'ENDE_KEY_PS1'):
        assert marke not in inhalt, f'{marke} kommt in {name} vor'

kopf = r'''#!/usr/bin/env bash
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
'''

fuss = r'''
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
'''

teile = [
    kopf,
    "cat > \"$ZIEL/schluessel.js\" <<'ENDE_SCHLUESSEL_JS'\n",
    js,
    "ENDE_SCHLUESSEL_JS\n\n",
    'sichern "$ZIEL/key.ps1"\n',
    "cat > \"$ZIEL/key.ps1\" <<'ENDE_KEY_PS1'\n",
    ps,
    "ENDE_KEY_PS1\n",
    fuss,
]

ziel = wurzel / 'installieren.sh'
ziel.write_text(''.join(teile))
ziel.chmod(0o755)
print(f'{ziel} geschrieben, {ziel.stat().st_size} Bytes')
