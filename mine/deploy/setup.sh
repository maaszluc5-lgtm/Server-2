#!/bin/bash
# Richtet minesgames.duckdns.org auf diesem Server ein:
#   1. DuckDNS-Token sicher ablegen und die Adresse alle fünf Minuten melden
#   2. Mine als Dienst starten (Port 4100, nur lokal)
#   3. Nginx davorsetzen und ein HTTPS-Zertifikat holen
#
# Aufruf als root:
#   DUCKDNS_TOKEN=dein-token ./setup.sh
# oder ohne Variable, dann wird danach gefragt.
#
# Das Skript darf mehrfach laufen; es überschreibt nur, was ihm gehört.

set -euo pipefail

DOMAIN_NAME="${DUCKDNS_DOMAIN:-minesgames}"
DOMAIN="${DOMAIN_NAME}.duckdns.org"
ZIEL="${MINE_DIR:-/root/mine}"
PORT="${PORT:-4100}"
MAIL="${CERT_MAIL:-}"

sagen() { echo -e "\n\033[1;35m▸ $*\033[0m"; }
fehler() { echo -e "\033[1;31m✗ $*\033[0m" >&2; exit 1; }

[ "$(id -u)" = "0" ] || fehler "Bitte als root ausführen (sudo -i)."
[ -f "$ZIEL/server.js" ] || fehler "$ZIEL/server.js fehlt. Erst das Spiel dorthin kopieren."
command -v node >/dev/null || fehler "node ist nicht installiert."

# ---------------------------------------------------------------- 1. DuckDNS
sagen "DuckDNS einrichten"

if [ -z "${DUCKDNS_TOKEN:-}" ]; then
  if [ -r /etc/duckdns/token ]; then
    echo "  Token liegt schon in /etc/duckdns/token — wird weiterverwendet."
  else
    read -rsp "  DuckDNS-Token: " DUCKDNS_TOKEN; echo
  fi
fi

if [ -n "${DUCKDNS_TOKEN:-}" ]; then
  install -d -m 700 /etc/duckdns
  printf '%s' "$DUCKDNS_TOKEN" > /etc/duckdns/token
  chmod 600 /etc/duckdns/token
  echo "  Token nach /etc/duckdns/token geschrieben (nur root darf lesen)."
fi

chmod +x "$ZIEL/deploy/duckdns-update.sh"
sed "s#^ExecStart=.*#ExecStart=$ZIEL/deploy/duckdns-update.sh#" \
    "$ZIEL/deploy/duckdns.service" > /etc/systemd/system/duckdns.service
cp "$ZIEL/deploy/duckdns.timer" /etc/systemd/system/duckdns.timer

systemctl daemon-reload
systemctl enable --now duckdns.timer >/dev/null

echo "  Erster Abgleich:"
if DUCKDNS_DOMAIN="$DOMAIN_NAME" "$ZIEL/deploy/duckdns-update.sh"; then
  echo "  DuckDNS meldet OK."
else
  fehler "DuckDNS antwortet nicht mit OK. Stimmen Name ($DOMAIN_NAME) und Token?"
fi

# ------------------------------------------------------------ 2. Spieldienst
sagen "Mine als Dienst einrichten (Port $PORT)"

sed -e "s#^WorkingDirectory=.*#WorkingDirectory=$ZIEL#" \
    -e "s#^Environment=PORT=.*#Environment=PORT=$PORT#" \
    -e "s#^Environment=MINE_DATA=.*#Environment=MINE_DATA=$ZIEL/data#" \
    "$ZIEL/deploy/mine.service" > /etc/systemd/system/mine.service

systemctl daemon-reload
systemctl enable --now mine >/dev/null
sleep 2

if curl -fsS --max-time 5 "http://127.0.0.1:$PORT/" >/dev/null; then
  echo "  Mine läuft auf 127.0.0.1:$PORT."
else
  journalctl -u mine -n 20 --no-pager || true
  fehler "Mine antwortet nicht. Siehe Ausgabe oben."
fi

# ------------------------------------------------------------------ 3. Nginx
sagen "Nginx einrichten"

if ! command -v nginx >/dev/null; then
  # Hört schon etwas anderes auf Port 80, hilft Nginx nicht weiter.
  BELEGT="$(ss -lptnH 'sport = :80' 2>/dev/null | head -1 || true)"
  if [ -n "$BELEGT" ]; then
    echo "  Auf Port 80 läuft bereits: $BELEGT"
    fehler "Port 80 ist belegt. Erst das dortige Programm beenden oder Nginx von Hand einrichten."
  fi
  echo "  Nginx fehlt, wird installiert…"
  apt-get update -qq && apt-get install -y -qq nginx
fi

SEITE=/etc/nginx/sites-available/minesgames
if grep -q "listen 443" "$SEITE" 2>/dev/null; then
  echo "  $SEITE hat schon einen HTTPS-Block — bleibt unverändert."
else
  sed -e "s#server_name .*;#server_name $DOMAIN;#" \
      -e "s#proxy_pass http://127.0.0.1:.*;#proxy_pass http://127.0.0.1:$PORT;#" \
      "$ZIEL/deploy/nginx-minesgames.conf" > "$SEITE"
  ln -sf "$SEITE" /etc/nginx/sites-enabled/minesgames
fi

nginx -t || fehler "Nginx-Konfiguration ist fehlerhaft."
systemctl reload nginx
echo "  http://$DOMAIN zeigt jetzt auf die Mine."

# ------------------------------------------------------------------ 4. HTTPS
sagen "HTTPS-Zertifikat holen"

if ! command -v certbot >/dev/null; then
  echo "  Certbot fehlt, wird installiert…"
  apt-get install -y -qq certbot python3-certbot-nginx
fi

if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "  Zertifikat besteht schon — Erneuerung läuft automatisch."
else
  echo "  Wichtig: Port 80 und 443 müssen von außen erreichbar sein"
  echo "  (Router-Weiterleitung und Firewall), sonst schlägt die Prüfung fehl."
  if [ -n "$MAIL" ]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$MAIL" --redirect
  else
    certbot --nginx -d "$DOMAIN" --register-unsafely-without-email --non-interactive --agree-tos --redirect
  fi
fi

sagen "Fertig"
echo "  Spiel:    https://$DOMAIN"
echo "  Zustand:  systemctl status mine duckdns.timer"
echo "  Log:      journalctl -u mine -f"
echo "  Neustart: systemctl restart mine"
