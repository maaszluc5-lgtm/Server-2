# 🚀 YubiKey SSH Quick Start

**Schnelle Übersicht für sofortiges Setup**

---

## 📋 Was brauchst du?

- ✅ YubiKey (USB-C oder mit Adapter)
- ✅ Hetzner Server mit Root-Zugang
- ✅ Windows 10+ oder iPad
- ✅ ~15 Minuten Zeit

---

## 🏃 Express Setup (15 min)

### A. Hetzner Server konfigurieren (3 min)

```bash
# SSH auf dem Server:
sudo bash setup-hetzner-yubikey.sh

# → Skript macht alles automatisch!
```

### B. Windows PowerShell Setup (5 min)

```powershell
# Als Administrator:
.\setup-yubikey-ssh.ps1

# → Folge den Fragen:
#   1. Key-Typ wählen (ECDSA oder ED25519)
#   2. Hetzner IP eingeben
#   3. Benutzername eingeben
#   4. SSH-Port eingeben (default: 22)

# → Public Key wird angezeigt!
```

### C. Public Key zum Server hinzufügen (2 min)

```bash
# Auf dem Hetzner Server:
# Windows Public Key kopieren und einfügen:

echo "ssh-ecdsa-sk AAAA... your-public-key" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### D. Verbindung testen (2 min)

```powershell
# Windows PowerShell:
ssh hetzner-root

# → YubiKey berühren wenn aufgefordert ✋
# → Automatisch angemeldet!
```

### E. iPad Setup (3 min)

1. **Termius App** installieren (App Store)
2. **Keys** Tab → `+` → **Import Key**
   - Windows Private Key kopieren
   - In Termius einfügen
3. **Hosts** Tab → `+` → **New Host**
   - Hostname: `<deine-hetzner-ip>`
   - Username: `<dein-user>`
   - SSH Key: `id_ecdsa_sk`
4. **Connect** → YubiKey berühren ✋

---

## ✅ Erfolgs-Checkliste

| Schritt | Status |
|---------|--------|
| Hetzner Setup-Script ausgeführt | ☐ |
| Windows PowerShell Script ausgeführt | ☐ |
| Public Key zum Server hinzugefügt | ☐ |
| SSH-Verbindung von Windows getestet | ☐ |
| Termius auf iPad installiert | ☐ |
| Termius Server konfiguriert | ☐ |
| Von iPad mit YubiKey verbunden | ☐ |

---

## 🔑 Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `setup-hetzner-yubikey.sh` | Server-Setup |
| `setup-yubikey-ssh.ps1` | Windows Setup |
| `YUBIKEY_SSH_SETUP.md` | Vollständige Anleitung |

---

## 💡 Pro-Tipps

**Windows:**
```powershell
# Public Key anzeigen:
cat ~/.ssh/id_ecdsa_sk.pub | Set-Clipboard
```

**iPad:**
- **Termius Settings** → **Connections** → **Keep Alive** = ON
- So bleibt die Verbindung stabil

**Sicherheit:**
```bash
# Auf Hetzner nur SSH-Keys erlauben:
sudo nano /etc/ssh/sshd_config

# Folgende Zeilen ändern:
PasswordAuthentication no
PermitRootLogin no

# Neu starten:
sudo systemctl restart sshd
```

---

## 🆘 Häufige Probleme

| Problem | Lösung |
|---------|--------|
| YubiKey wird nicht erkannt | YubiKey Manager installieren, Treiber aktualisieren |
| "Permission denied" | Public Key-Format überprüfen, authorized_keys Rechte (600) |
| iPad erkennt Key nicht | Key als PEM exportieren: `ssh-keygen -p -m pem -f key` |
| SSH funktioniert, aber keine Termius | Bei Add Host: "SSH Keys" wählen, nicht "Password" |

---

## 📞 Support

- [YubiKey Docs](https://developers.yubico.com/SSH/)
- [Termius Help](https://www.termius.com/support)
- [Hetzner Support](https://docs.hetzner.cloud/)

---

**Fertig! Du kannst dich jetzt automatisch vom iPad oder Windows mit YubiKey anmelden! 🎉**
