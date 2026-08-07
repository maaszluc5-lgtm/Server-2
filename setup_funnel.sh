#!/bin/bash
# Macht zwei lokale Dienste ueber Tailscale Funnel oeffentlich erreichbar (feste HTTPS-Adresse):
#   Fussball  127.0.0.1:4000  -> https://<server>.<netz>.ts.net        (Funnel-Port 443)
#   Terminal  127.0.0.1:7000  -> https://<server>.<netz>.ts.net:8443   (Funnel-Port 8443)

echo "== 1/3  Fussball (4000) auf Funnel-Port 443 =="
tailscale funnel --bg --https=443 http://127.0.0.1:4000
echo ""
echo "== 2/3  Terminal (7000) auf Funnel-Port 8443 =="
tailscale funnel --bg --https=8443 http://127.0.0.1:7000
echo ""
echo "== 3/3  Status =="
tailscale funnel status
