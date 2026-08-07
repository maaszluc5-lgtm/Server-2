#!/bin/bash
# Richtet Caddy als Reverse-Proxy ein: feste DuckDNS-Adressen -> lokale Dienste, mit automatischem HTTPS.
# Fussball  bestfussball.duckdns.org   -> 127.0.0.1:4000
# Shop      lucamusicshop.duckdns.org  -> 127.0.0.1:3000
# Terminal  lucabestserver.duckdns.org -> 127.0.0.1:7000
set -e

echo "== 1/5  Caddy holen =="
if ! command -v caddy >/dev/null 2>&1 && [ ! -x /usr/local/bin/caddy ]; then
  if curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o /usr/local/bin/caddy; then
    chmod +x /usr/local/bin/caddy
    echo "   Caddy heruntergeladen."
  else
    echo "   FEHLER: Caddy-Download fehlgeschlagen."; exit 1
  fi
else
  echo "   Caddy ist schon da."
fi
CADDY=$(command -v caddy || echo /usr/local/bin/caddy)

echo "== 2/5  Konfiguration schreiben =="
mkdir -p /etc/caddy
cat > /etc/caddy/Caddyfile <<'CADDYEOF'
{
	email admin@duckdns.org
}

bestfussball.duckdns.org {
	reverse_proxy 127.0.0.1:4000
}

lucamusicshop.duckdns.org {
	reverse_proxy 127.0.0.1:3000
}

lucabestserver.duckdns.org {
	reverse_proxy 127.0.0.1:7000
}
CADDYEOF
echo "   /etc/caddy/Caddyfile geschrieben."

echo "== 3/5  Firewall (Port 80 + 443) oeffnen =="
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  echo "   ufw: 80 + 443 erlaubt."
else
  echo "   ufw nicht installiert (ok)."
fi
# iptables direkt (falls kein ufw)
iptables -C INPUT -p tcp --dport 80  -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 80  -j ACCEPT 2>/dev/null || true
iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true

echo "== 4/5  Dienst einrichten =="
cat > /etc/systemd/system/caddy.service <<'SVCEOF'
[Unit]
Description=Caddy Reverse Proxy
After=network.target

[Service]
ExecStart=/usr/local/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile
Restart=on-failure
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy
echo "   caddy.service gestartet."

echo "== 5/5  Kurz warten und pruefen =="
sleep 6
systemctl --no-pager --lines=8 status caddy | sed -n '1,12p' || true
echo ""
echo "FERTIG. Deine festen Adressen (koennen 30-60 Sek bis HTTPS aktiv brauchen):"
echo "   Fussball: https://bestfussball.duckdns.org"
echo "   Shop:     https://lucamusicshop.duckdns.org"
echo "   Terminal: https://lucabestserver.duckdns.org"
