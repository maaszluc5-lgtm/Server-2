#!/bin/bash
# Traegt zwei feste Adressen in nginx ein und holt HTTPS:
#   bestfussball.duckdns.org    -> 127.0.0.1:4000  (Fussball-Spiel, mit WebSocket fuer Online)
#   lucabestserver.duckdns.org  -> 127.0.0.1:7000  (Server-Terminal, mit WebSocket)
# Der Shop (lucamusicshop) bleibt unangetastet.
set -e

echo "== 1/4  nginx-Konfig schreiben =="
cat > /etc/nginx/sites-available/torjaeger-webterm <<'NGINXEOF'
server {
    listen 80;
    server_name bestfussball.duckdns.org;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}

server {
    listen 80;
    server_name lucabestserver.duckdns.org;

    location / {
        proxy_pass http://localhost:7000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
NGINXEOF
ln -sf /etc/nginx/sites-available/torjaeger-webterm /etc/nginx/sites-enabled/torjaeger-webterm
echo "   geschrieben + aktiviert."

echo "== 2/4  nginx testen und neu laden =="
if nginx -t; then
  systemctl reload nginx
  echo "   nginx neu geladen (HTTP laeuft jetzt)."
else
  echo "   FEHLER in der nginx-Konfig - nichts geaendert am laufenden Betrieb."; exit 1
fi

echo "== 3/4  HTTPS holen (certbot, Let's Encrypt) =="
certbot --nginx \
  -d bestfussball.duckdns.org \
  -d lucabestserver.duckdns.org \
  --non-interactive --agree-tos -m maaszluc5@gmail.com --redirect \
  && echo "   HTTPS eingerichtet." \
  || echo "   HTTPS-Schritt uebersprungen/fehlgeschlagen - HTTP funktioniert trotzdem. (Details oben)"

echo "== 4/4  fertig =="
echo ""
echo "Deine festen Adressen:"
echo "   Fussball: https://bestfussball.duckdns.org"
echo "   Terminal: https://lucabestserver.duckdns.org"
echo "   Shop:     http://lucamusicshop.duckdns.org  (unveraendert)"
