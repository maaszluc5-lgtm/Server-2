#!/bin/bash
# YubiKey SSH Setup für Hetzner Root Server
# Automatisierte Serverseitige Konfiguration
# Ausführung: sudo bash setup-hetzner-yubikey.sh

set -e

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================
# HEADER
# ============================================================
clear
echo -e "${CYAN}
╔════════════════════════════════════════════════════════════╗
║    YubiKey SSH Setup für Hetzner Root Server              ║
║             Automatische Serverkonfiguration              ║
╚════════════════════════════════════════════════════════════╝
${NC}"

# ============================================================
# ROOT CHECK
# ============================================================
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Fehler: Dieses Script braucht root-Rechte!${NC}"
   echo -e "${YELLOW}Ausführen mit: sudo bash setup-hetzner-yubikey.sh${NC}"
   exit 1
fi

# ============================================================
# SCHRITT 1: System Update
# ============================================================
echo -e "\n${YELLOW}[1/5] System Update...${NC}"
apt-get update -qq
apt-get upgrade -y -qq
echo -e "${GREEN}✅ System aktualisiert${NC}"

# ============================================================
# SCHRITT 2: SSH-Server konfigurieren
# ============================================================
echo -e "\n${YELLOW}[2/5] SSH-Server für FIDO2 Keys konfigurieren...${NC}"

SSH_CONFIG="/etc/ssh/sshd_config"
SSH_BACKUP="/etc/ssh/sshd_config.backup.$(date +%s)"

# Backup erstellen
cp $SSH_CONFIG $SSH_BACKUP
echo -e "${GREEN}✅ Backup erstellt: $SSH_BACKUP${NC}"

# Wichtige SSH-Config Einstellungen
cat >> $SSH_CONFIG << 'EOF'

# ========================================
# YubiKey FIDO2 SSH Configuration
# ========================================

# FIDO2 Keys akzeptieren
PubkeyAcceptedKeyTypes ssh-ed25519-cert-v01@openssh.com,ecdsa-sk-cert-v01@openssh.com,ssh-ed25519,ecdsa-sk,rsa-sha2-512,rsa-sha2-256

# Public Key Authentication aktivieren
PubkeyAuthentication yes

# Password Authentication deaktivieren (nach Setup!)
# PasswordAuthentication no

# Root Login deaktivieren (Sicherheit)
PermitRootLogin no

# X11 Forwarding optional
X11Forwarding no

# Keep Alive Intervalle
ClientAliveInterval 300
ClientAliveCountMax 2

# Strikte Modi für Sicherheit
StrictModes yes
IgnoreRhosts yes
HostbasedAuthentication no

# Nur sichere Cipher
Ciphers chacha20-poly1305@openssh.com,aes-256-gcm@openssh.com,aes-128-gcm@openssh.com

# SSH auf Standard-Port
Port 22
EOF

# SSH-Config testen
sshd -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ SSH-Config syntaktisch korrekt${NC}"
else
    echo -e "${RED}❌ SSH-Config Fehler!${NC}"
    cp $SSH_BACKUP $SSH_CONFIG
    exit 1
fi

# SSH-Daemon neu starten
systemctl restart sshd
echo -e "${GREEN}✅ SSH-Daemon neu gestartet${NC}"

# ============================================================
# SCHRITT 3: SSH-Verzeichnisse vorbereiten
# ============================================================
echo -e "\n${YELLOW}[3/5] SSH-Verzeichnisse für Benutzer vorbereiten...${NC}"

# Liste aller normalen Benutzer (nicht root, nicht system)
for user in $(awk -F: '$3 >= 1000 {print $1}' /etc/passwd); do
    user_home=$(eval echo ~$user)
    ssh_dir="$user_home/.ssh"

    if [ ! -d "$ssh_dir" ]; then
        mkdir -p "$ssh_dir"
        chown $user:$user "$ssh_dir"
        chmod 700 "$ssh_dir"
        echo -e "${GREEN}✅ SSH-Verzeichnis erstellt für: $user${NC}"
    fi

    # authorized_keys vorbereiten
    if [ ! -f "$ssh_dir/authorized_keys" ]; then
        touch "$ssh_dir/authorized_keys"
        chown $user:$user "$ssh_dir/authorized_keys"
        chmod 600 "$ssh_dir/authorized_keys"
    fi
done

# ============================================================
# SCHRITT 4: Firewall konfigurieren (UFW)
# ============================================================
echo -e "\n${YELLOW}[4/5] Firewall konfigurieren...${NC}"

if command -v ufw &> /dev/null; then
    # SSH Port erlauben
    ufw allow 22/tcp
    echo -e "${GREEN}✅ SSH Port 22 in Firewall erlaubt${NC}"
else
    echo -e "${YELLOW}⚠️  UFW nicht installiert, übersprungen${NC}"
fi

# ============================================================
# SCHRITT 5: Security Hardening
# ============================================================
echo -e "\n${YELLOW}[5/5] Security Hardening...${NC}"

# fail2ban installieren (optional aber empfohlen)
apt-get install -y -qq fail2ban

# fail2ban für SSH konfigurieren
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
maxretry = 5
EOF

systemctl restart fail2ban
echo -e "${GREEN}✅ fail2ban installiert und konfiguriert${NC}"

# SSH Key-Only Tipp
echo -e "\n${YELLOW}⚠️  WICHTIG: Bitte nach Bestätigung folgende Einstellung vornehmen:${NC}"
echo -e "${CYAN}# Editiere /etc/ssh/sshd_config und setze:
PasswordAuthentication no
PermitRootLogin no

# Dann SSH neu starten:
systemctl restart sshd${NC}"

# ============================================================
# FINISH
# ============================================================
echo -e "\n${CYAN}
╔════════════════════════════════════════════════════════════╗
║         ✅ Server Setup erfolgreich abgeschlossen!        ║
╚════════════════════════════════════════════════════════════╝
${NC}"

echo -e "${GREEN}📋 Zusammenfassung:${NC}"
echo -e "  ✅ SSH-Server für FIDO2/YubiKey konfiguriert"
echo -e "  ✅ SSH-Verzeichnisse (.ssh) erstellt"
echo -e "  ✅ Firewall konfiguriert (SSH erlaubt)"
echo -e "  ✅ fail2ban Brute-Force Protection aktiviert"

echo -e "\n${YELLOW}📌 Nächste Schritte:${NC}"
echo -e "  1️⃣  Windows: setup-yubikey-ssh.ps1 ausführen"
echo -e "  2️⃣  Public Key von Windows hier einfügen:"
echo -e "      ~/.ssh/authorized_keys"
echo -e "  3️⃣  Verbindung testen: ssh <user>@<hetzner-ip>"
echo -e "  4️⃣  iPad: Public Key in Termius importieren"

echo -e "\n${RED}⚠️  SICHERHEIT:${NC}"
echo -e "  • Backup von /etc/ssh/sshd_config erstellt:"
echo -e "    $SSH_BACKUP"
echo -e "  • Später PasswordAuthentication deaktivieren"
echo -e "  • Nur YubiKey/SSH Keys erlauben"

echo -e "\n${CYAN}📖 Weitere Infos: YUBIKEY_SSH_SETUP.md${NC}\n"

# ============================================================
# Optional: Benutzer Input
# ============================================================
read -p "Soll PasswordAuthentication jetzt deaktiviert werden? (j/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Jj]$ ]]; then
    sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication no/' $SSH_CONFIG
    sed -i 's/^#PermitRootLogin yes/PermitRootLogin no/' $SSH_CONFIG

    sshd -t
    if [ $? -eq 0 ]; then
        systemctl restart sshd
        echo -e "${GREEN}✅ SSH-Config aktualisiert und neu gestartet${NC}"
    else
        echo -e "${RED}❌ Fehler! SSH-Config zurücksetzen...${NC}"
        cp $SSH_BACKUP $SSH_CONFIG
        systemctl restart sshd
    fi
else
    echo -e "${YELLOW}⚠️  Bitte später manuell einschalten!${NC}"
fi
