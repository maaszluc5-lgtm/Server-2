#!/bin/bash
# Holt HTTPS fuer den Shop (lucamusicshop.duckdns.org) und stellt ihn auf https um.
echo "== HTTPS fuer den Shop holen =="
certbot --nginx \
  -d lucamusicshop.duckdns.org \
  --non-interactive --agree-tos -m maaszluc5@gmail.com --redirect \
  && echo "   HTTPS eingerichtet." \
  || { echo "   FEHLER - Details oben."; exit 1; }

systemctl reload nginx
echo ""
echo "FERTIG. Shop laeuft jetzt auf:  https://lucamusicshop.duckdns.org"
