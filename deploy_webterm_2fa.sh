#!/bin/bash
# Spielt die neue Terminal-Version (Passwort + Mail-Code) ein und startet webterm neu.
# Die Geheimnisse (App-Passwort etc.) liegen in /root/webterm/.env und werden NICHT angefasst.
set -e
D=/root/webterm
B=https://raw.githubusercontent.com/maaszluc5-lgtm/Server-2/claude/ssh-connection-setup-eotr6i/webterm

if [ ! -d "$D" ]; then echo "FEHLER: $D gibt es nicht."; exit 1; fi
cd "$D"

echo "== 1/5  .env pruefen =="
if [ ! -f .env ]; then echo "   FEHLER: $D/.env fehlt - bitte zuerst anlegen (siehe Anleitung)."; exit 1; fi
for k in SMTP_USER SMTP_PASS CODE_TO; do
  grep -q "^$k=" .env || { echo "   FEHLER: $k fehlt in .env"; exit 1; }
done
chmod 600 .env
echo "   .env ok."

echo "== 2/5  alte Dateien sichern =="
ts=$(date +%s)
[ -f webterm.js ] && cp -a webterm.js "webterm.js.bak.$ts"
[ -f index.html ] && cp -a index.html "index.html.bak.$ts"
echo "   Backup .bak.$ts angelegt."

echo "== 3/5  neue Dateien holen =="
curl -fsSL "$B/webterm.js" -o webterm.js
curl -fsSL "$B/index.html" -o index.html
echo "   webterm.js + index.html aktualisiert."

echo "== 4/5  nodemailer installieren =="
npm install nodemailer --no-audit --no-fund --loglevel=error
echo "   nodemailer da."

echo "== 5/5  webterm neu starten =="
pm2 restart webterm --update-env
sleep 2
echo ""
echo "=== Log (da sollte 'Mail-Code: AN -> ...' stehen) ==="
pm2 logs webterm --nostream --lines 12 | cat
