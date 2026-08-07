#!/bin/bash
# Schaltet den Tailscale-Funnel ab (der Port 443 + 8443 belegt) und gibt sie an nginx zurueck.
echo "== 1/3  Tailscale-Funnel abschalten =="
tailscale funnel --https=443 off 2>/dev/null || true
tailscale funnel --https=8443 off 2>/dev/null || true
tailscale serve reset 2>/dev/null || true
sleep 1
echo "   Funnel aus."

echo "== 2/3  nginx neu starten =="
systemctl restart nginx
sleep 2
echo "   nginx neu gestartet."

echo "== 3/3  Wer hat jetzt Port 443? (sollte nginx sein) =="
ss -tlnp sport = :443
