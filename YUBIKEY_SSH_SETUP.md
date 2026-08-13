# YubiKey SSH Setup für Hetzner Server

Complete Setup-Anleitung für **YubiKey-basierte SSH-Authentifizierung** auf Hetzner Root-Server mit:
- 🖥️ **Windows PowerShell** 
- 📱 **iPad (Termius)**
- 🔐 **Google OAuth 2.0** (optional)

---

## 📋 Überblick

| Komponente | Details |
|-----------|---------|
| **Server** | Hetzner Root-Server (Linux) |
| **SSH-Auth** | YubiKey (FIDO2/WebAuthn) |
| **Windows-Client** | PowerShell + OpenSSH |
| **iPad-Client** | Termius App |
| **Authentifizierung** | YubiKey + Google (optional) |

---

## 🔧 SCHRITT 1: Hetzner Server Vorbereitung

### 1.1 SSH-Server konfigurieren
Verbinde dich mit deinem Hetzner-Server und bearbeite die SSH-Konfiguration:

```bash
# Als root anmelden (via SSH oder Konsole)
sudo nano /etc/ssh/sshd_config
```

Folgende Einstellungen setzen/ändern:

```bash
# SSH auf Standard-Port halten oder ändern
Port 22

# Public Key Authentication aktivieren
PubkeyAuthentication yes

# FIDO2 Keys unterstützen (YubiKey)
PubkeyAcceptedKeyTypes ssh-ed25519-cert-v01@openssh.com,ecdsa-sk-cert-v01@openssh.com,ssh-ed25519,ecdsa-sk,rsa-sha2-512,rsa-sha2-256

# Password-Auth deaktivieren (nach Setup!)
PasswordAuthentication no

# Root-Login deaktivieren (Sicherheit)
PermitRootLogin no

# AllowUsers nur mit Benutzernamen
AllowUsers dein_username
```

SSH-Service neu starten:
```bash
sudo systemctl restart sshd
```

### 1.2 YubiKey SSH-Keys generieren

**Option A: Auf dem Hetzner-Server (wenn SSH bereits funktioniert):**

```bash
# FIDO2 Key generieren (YubiKey als Security Key)
ssh-keygen -t ecdsa-sk -f ~/.ssh/id_ecdsa_sk -C "yubikey@hetzner"

# Oder Ed25519 (schneller)
ssh-keygen -t ed25519-sk -f ~/.ssh/id_ed25519_sk -C "yubikey@hetzner"
```

**Option B: Auf Windows/lokal und dann hochladen:**

Siehe Schritt 2.1

### 1.3 Public Key auf Server hinzufügen

```bash
# Wenn noch nicht vorhanden
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Public Key zur authorized_keys hinzufügen
cat ~/.ssh/id_ed25519_sk.pub >> ~/.ssh/authorized_keys

# Rechte setzen
chmod 600 ~/.ssh/authorized_keys
```

---

## 🖥️ SCHRITT 2: Windows PowerShell Setup

### 2.1 OpenSSH auf Windows installieren

**Option 1: Via Windows Store (empfohlen)**
```powershell
# Als Administrator
winget install OpenSSH.Client
```

**Option 2: Manuell via Settings**
- Settings → Apps → Optional Features
- "OpenSSH Client" suchen und installieren

Überprüfen:
```powershell
ssh -V
```

### 2.2 YubiKey Treiber installieren

**Windows 10/11:**

```powershell
# YubiKey Manager herunterladen:
# https://www.yubico.com/products/yubico-manager/

# Oder via Chocolatey:
choco install yubikey-manager

# YubiKey mit FIDO2 initialisieren:
ykman fido2 reset
```

### 2.3 SSH-Key mit YubiKey generieren

```powershell
# SSH-Verzeichnis erstellen
mkdir ~/.ssh -Force

# YubiKey FIDO2 Key generieren
ssh-keygen -t ecdsa-sk -f $env:USERPROFILE\.ssh\id_ecdsa_sk -C "yubikey-windows"

# Oder Ed25519
ssh-keygen -t ed25519-sk -f $env:USERPROFILE\.ssh\id_ed25519_sk -C "yubikey-windows"
```

**Bei Aufforderung:**
- `Passphrase`: Optional (wird für YubiKey-Touch gefragt)
- YubiKey berühren wenn aufgefordert

### 2.4 Public Key zu Hetzner hochladen

```powershell
# Public Key anzeigen und kopieren
Get-Content $env:USERPROFILE\.ssh\id_ecdsa_sk.pub

# Dann auf Server via SSH:
# Oder manuell in authorized_keys einfügen
```

### 2.5 SSH-Config für Hetzner erstellen

```powershell
# SSH Config-Datei öffnen
notepad $env:USERPROFILE\.ssh\config
```

Folgende Einträge hinzufügen:

```ssh
Host hetzner-root
    HostName <DEINE_HETZNER_IP>
    User <DEIN_BENUTZER>
    IdentityFile ~/.ssh/id_ecdsa_sk
    IdentitiesOnly yes
    AddKeysToAgent yes
    StrictHostKeyChecking accept-new
    Port 22
```

### 2.6 Test: SSH-Verbindung

```powershell
# Verbindung testen
ssh hetzner-root

# YubiKey wird auffordern, berühren zu drücken
# Automatische Anmeldung sollte funktionieren
```

---

## 📱 SCHRITT 3: iPad Termius Setup

### 3.1 Termius App installieren

- **App Store**: "Termius - SSH Client" herunterladen
- Link: https://apps.apple.com/app/termius-ssh-client/id549039908

### 3.2 YubiKey auf iPad verbinden

**Hardware-Anforderungen:**
- iPad mit USB-C (iPad Air, iPad Pro, iPad Mini 6+)
- USB-C to Lightning Adapter (wenn Lightning-iPad)
- YubiKey 5C NFC oder ähnlich (USB-C fähig)

**Verbindung:**
1. USB-C Adapter in iPad einstecken
2. YubiKey in USB-C Adapter einstecken
3. Termius öffnen → "Keys" Tab

### 3.3 SSH-Key zu Termius importieren

**Option A: Von Windows kopieren**
1. Private Key von Windows kopieren (`.ssh/id_ecdsa_sk`)
2. In Termius importieren: `Keys` → `+` → `Import Key`
3. Key paste und speichern

**Option B: Auf Hetzner neu generieren**
```bash
# Auf Server generieren
ssh-keygen -t ecdsa-sk -f ~/.ssh/id_ipad_sk -C "yubikey-ipad"

# Private Key herunterladen und in Termius importieren
```

### 3.4 Hetzner Server in Termius hinzufügen

1. **Hosts Tab** → `+` → **New Host**
2. Folgende Einstellungen:

| Feld | Wert |
|------|------|
| Label | `Hetzner Root` |
| Hostname | `<DEINE_HETZNER_IP>` |
| Port | `22` |
| Username | `<DEIN_BENUTZER>` |
| Authentication | `SSH Keys` |
| SSH Key | `id_ecdsa_sk` (oder importiert) |
| Passphrase | Optional |

3. **Save** drücken

### 3.5 Mit YubiKey verbinden

1. YubiKey ins iPad einstecken
2. Termius öffnen → Host auswählen
3. **Connect** drücken
4. Wenn aufgefordert: **YubiKey berühren**
5. ✅ Automatische Anmeldung

---

## 🔐 SCHRITT 4: Google OAuth 2.0 Setup (Optional)

Falls du auch Google-Authentifizierung möchtest:

### 4.1 Google Cloud Project erstellen

1. https://console.cloud.google.com öffnen
2. **New Project** → Name: `YubiKey-SSH`
3. **APIs & Services** → **OAuth consent screen**
4. **Scopes**: `openid, profile, email` hinzufügen

### 4.2 OAuth Credentials

1. **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
2. **Desktop Application** auswählen
3. **Client ID & Secret** kopieren
4. **Authorized redirect URIs**: `http://localhost:8080/callback`

### 4.3 Server konfigurieren (Advanced)

Auf Hetzner-Server eine PAM-Module für Google-Auth installieren (optional für 2FA):

```bash
sudo apt-get install libpam-google-authenticator

# Für User aktivieren:
google-authenticator
```

---

## 🚀 Automatische Anmeldung - Checkliste

- [x] YubiKey Treiber auf Windows installiert
- [x] SSH-Keys mit YubiKey generiert
- [x] Hetzner Server SSH konfiguriert
- [x] Public Keys auf Server hochgeladen
- [x] SSH-Config auf Windows erstellt
- [x] Termius auf iPad installiert & konfiguriert
- [x] YubiKey ins iPad einstecken & Test

**Test:**
```powershell
# Windows
ssh hetzner-root

# iPad
Termius → Hetzner Root → Connect
```

---

## 🛠️ Troubleshooting

### Problem: "YubiKey not found"
```bash
# YubiKey Check
ykman info

# Rechte überprüfen
sudo ykman list
```

### Problem: "Permission denied (publickey)"
```bash
# Debug-Modus
ssh -vvv hetzner-root

# Überprüfe authorized_keys auf Server
cat ~/.ssh/authorized_keys

# Key-Rechte
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### Problem: "Key not recognized in Termius"
- Key-Format überprüfen (PEM vs OpenSSH)
- Key neu exportieren: `ssh-keygen -p -m pem -f id_key`

---

## 📚 Nützliche Links

- [YubiKey SSH Guide](https://developers.yubico.com/SSH/)
- [Termius Documentation](https://www.termius.com/docs)
- [OpenSSH FIDO2 Support](https://man.openbsd.org/ssh-keygen#FIDO)
- [Hetzner SSH Docs](https://docs.hetzner.cloud/cloud/servers/solutions/secure-access-with-ssh-keys)

---

## 📝 Notizen

- **Security:** Private Keys immer geheim halten
- **Backup:** YubiKey NICHT als einzige Authentifizierung nutzen (Backup-Keys anlegen)
- **Port:** Standard SSH Port = 22, kann für bessere Sicherheit geändert werden
- **Firewall:** Stelle sicher, dass SSH-Port auf Hetzner offen ist

---

**Viel Spaß mit deinem YubiKey SSH Setup! 🔐**
