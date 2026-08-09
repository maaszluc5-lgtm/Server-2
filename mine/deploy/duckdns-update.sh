#!/bin/bash
# Hält den A-Eintrag von <name>.duckdns.org auf der aktuellen IP dieses Servers.
#
# Das Token steht in /etc/duckdns/token (chmod 600) und niemals im Repo.
# Ohne ip= sucht DuckDNS die Adresse selbst aus der Anfrage — das ist genau
# das, was man bei wechselnder IP zu Hause will.

set -u

DOMAIN="${DUCKDNS_DOMAIN:-minesgames}"
TOKEN_DATEI="${DUCKDNS_TOKEN_DATEI:-/etc/duckdns/token}"

if [ ! -r "$TOKEN_DATEI" ]; then
  echo "$(date -Is) FEHLER: $TOKEN_DATEI nicht lesbar" >&2
  exit 1
fi

TOKEN="$(tr -d '[:space:]' < "$TOKEN_DATEI")"
if [ -z "$TOKEN" ]; then
  echo "$(date -Is) FEHLER: $TOKEN_DATEI ist leer" >&2
  exit 1
fi

ANTWORT="$(curl -fsS --max-time 20 \
  "https://www.duckdns.org/update?domains=${DOMAIN}&token=${TOKEN}&ip=" || echo "KEINE-ANTWORT")"

echo "$(date -Is) ${DOMAIN}.duckdns.org -> ${ANTWORT}"

# DuckDNS antwortet wörtlich "OK" oder "KO". Bei KO stimmt Name oder Token nicht.
[ "$ANTWORT" = "OK" ]
