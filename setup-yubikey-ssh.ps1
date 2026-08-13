# YubiKey SSH Setup Script für Windows PowerShell
# Automatisiert die Konfiguration für Hetzner Server Zugriff

# Admin-Check
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ Fehler: Dieses Script braucht Administrator-Rechte!" -ForegroundColor Red
    Write-Host "PowerShell als Administrator ausführen!" -ForegroundColor Yellow
    exit 1
}

Write-Host "
╔════════════════════════════════════════════════════════════╗
║         YubiKey SSH Setup für Hetzner Server              ║
║                  Windows PowerShell                        ║
╚════════════════════════════════════════════════════════════╝
" -ForegroundColor Cyan

# ============================================================
# SCHRITT 1: OpenSSH installieren
# ============================================================
Write-Host "`n[1/5] OpenSSH Client überprüfen..." -ForegroundColor Yellow

$sshCheck = Get-Command ssh -ErrorAction SilentlyContinue
if ($sshCheck) {
    Write-Host "✅ OpenSSH Client ist bereits installiert" -ForegroundColor Green
} else {
    Write-Host "⏳ Installiere OpenSSH Client..." -ForegroundColor Yellow
    Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0 | Out-Null
    Write-Host "✅ OpenSSH Client installiert" -ForegroundColor Green
}

# ============================================================
# SCHRITT 2: .ssh Verzeichnis erstellen
# ============================================================
Write-Host "`n[2/5] SSH-Verzeichnis vorbereiten..." -ForegroundColor Yellow

$sshPath = "$env:USERPROFILE\.ssh"
if (-not (Test-Path $sshPath)) {
    New-Item -ItemType Directory -Path $sshPath -Force | Out-Null
    Write-Host "✅ ~/.ssh Verzeichnis erstellt" -ForegroundColor Green
} else {
    Write-Host "✅ ~/.ssh Verzeichnis existiert bereits" -ForegroundColor Green
}

# ============================================================
# SCHRITT 3: SSH-Key Typ auswählen
# ============================================================
Write-Host "`n[3/5] SSH-Key Typ wählen..." -ForegroundColor Yellow
Write-Host "
1️⃣  ECDSA-SK (empfohlen - schneller)
2️⃣  ED25519-SK (alternativ - sicherer)
" -ForegroundColor Cyan

$choice = Read-Host "Wähle 1 oder 2"

if ($choice -eq "1") {
    $keyType = "ecdsa-sk"
    $keyFile = "id_ecdsa_sk"
} elseif ($choice -eq "2") {
    $keyType = "ed25519-sk"
    $keyFile = "id_ed25519_sk"
} else {
    Write-Host "❌ Ungültige Wahl!" -ForegroundColor Red
    exit 1
}

$keyPath = "$sshPath\$keyFile"

# Check ob Key bereits existiert
if (Test-Path $keyPath) {
    Write-Host "⚠️  Key existiert bereits unter: $keyPath" -ForegroundColor Yellow
    $overwrite = Read-Host "Überschreiben? (j/N)"
    if ($overwrite -ne "j") {
        Write-Host "❌ Abgebrochen" -ForegroundColor Red
        exit 1
    }
}

# ============================================================
# SCHRITT 4: SSH-Key generieren
# ============================================================
Write-Host "`n[4/5] Generiere YubiKey SSH-Key..." -ForegroundColor Yellow
Write-Host "⚠️  Berühre deinen YubiKey wenn aufgefordert!" -ForegroundColor Magenta

$comment = "yubikey-windows-$(Get-Date -Format 'yyyy-MM-dd')"

ssh-keygen -t $keyType -f $keyPath -C $comment -N ""

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ SSH-Key erfolgreich generiert!" -ForegroundColor Green
    Write-Host "   Private Key: $keyPath" -ForegroundColor Green
    Write-Host "   Public Key: $keyPath.pub" -ForegroundColor Green
} else {
    Write-Host "❌ Fehler beim Generieren des SSH-Keys!" -ForegroundColor Red
    exit 1
}

# ============================================================
# SCHRITT 5: SSH-Config erstellen
# ============================================================
Write-Host "`n[5/5] SSH-Config einrichten..." -ForegroundColor Yellow

$configPath = "$sshPath\config"

Write-Host "`nGib deine Hetzner-Daten ein:" -ForegroundColor Cyan
$hetznerIP = Read-Host "Hetzner Server IP"
$hetznerUser = Read-Host "SSH Benutzername (z.B. root)"
$hetznerPort = Read-Host "SSH Port (Standard: 22)"

if ([string]::IsNullOrEmpty($hetznerPort)) {
    $hetznerPort = "22"
}

# SSH Config zusammenstellen
$sshConfig = @"
# YubiKey Hetzner Root Server
Host hetzner-root
    HostName $hetznerIP
    User $hetznerUser
    Port $hetznerPort
    IdentityFile ~/.ssh/$keyFile
    IdentitiesOnly yes
    AddKeysToAgent yes
    StrictHostKeyChecking accept-new
    # YubiKey Touch erforderlich bei jedem Login
    IdentityAgent none
"@

# Config anhängen oder erstellen
if (Test-Path $configPath) {
    Add-Content -Path $configPath -Value "`n$sshConfig"
    Write-Host "✅ SSH-Config erweitert" -ForegroundColor Green
} else {
    Set-Content -Path $configPath -Value $sshConfig
    Write-Host "✅ SSH-Config erstellt" -ForegroundColor Green
}

# ============================================================
# Finish
# ============================================================
Write-Host "
╔════════════════════════════════════════════════════════════╗
║              ✅ Setup erfolgreich abgeschlossen!          ║
╚════════════════════════════════════════════════════════════╝
" -ForegroundColor Green

Write-Host "
📋 Nächste Schritte:

1️⃣  Public Key zu Hetzner hochladen:
   • SSH-Key anzeigen:
     cat ~/.ssh/$keyFile.pub

   • Auf dem Server einfügen:
     cat >> ~/.ssh/authorized_keys

2️⃣  SSH-Verbindung testen:
   ssh hetzner-root
   (YubiKey berühren wenn aufgefordert)

3️⃣  iPad Setup (siehe YUBIKEY_SSH_SETUP.md):
   • Termius installieren
   • Key in Termius importieren
   • Server hinzufügen

📖 Dokumentation: YUBIKEY_SSH_SETUP.md
" -ForegroundColor Cyan

Write-Host "`n💡 Tipps:" -ForegroundColor Yellow
Write-Host "  • Backup des Private Keys: $keyPath" -ForegroundColor Gray
Write-Host "  • Public Key überall verwendbar: $keyPath.pub" -ForegroundColor Gray
Write-Host "  • Niemals Private Key teilen!" -ForegroundColor Red

# ============================================================
# Public Key anzeigen
# ============================================================
Write-Host "`n📋 Dein Public Key:" -ForegroundColor Cyan
Write-Host "─" * 60
Get-Content "$keyPath.pub"
Write-Host "─" * 60

# Optional: In Clipboard kopieren
$copy = Read-Host "`nIn Clipboard kopieren? (j/N)"
if ($copy -eq "j") {
    Get-Content "$keyPath.pub" | Set-Clipboard
    Write-Host "✅ Public Key in Clipboard" -ForegroundColor Green
}
