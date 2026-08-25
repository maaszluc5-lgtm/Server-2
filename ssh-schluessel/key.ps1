<#
    key.ps1 — Einmal-Schluessel fuer die SSH-Freigabe, fuer PowerShell Core
    auf dem Server.

    Einbinden (einmalig), in $PROFILE:
        . /opt/ssh-schluessel/key.ps1

    Danach:
        key             neuen Schluessel erzeugen
        key -Status     Stufe, Sperre und offenen Schluessel anzeigen
        key -Entsperren Dauersperre aufheben

    Die ganze Logik steckt in schluessel.js — dieses Skript ruft es nur auf
    und stellt das Ergebnis dar. So gibt es keine zweite Umsetzung derselben
    Regeln, die auseinanderlaufen koennte.
#>

# Beim Dot-Sourcing landen Funktionen und Variablen in der Sitzung des
# Aufrufers. Die Wurzel deshalb global merken — $PSScriptRoot ist spaeter,
# beim Aufruf von `key`, nicht mehr gesetzt.
$global:SchluesselWurzel = $PSScriptRoot

function Get-SchluesselPfad {
    $skript = Join-Path $SchluesselWurzel 'schluessel.js'
    if (-not (Test-Path -LiteralPath $skript)) {
        throw "schluessel.js nicht gefunden: $skript"
    }
    return $skript
}

function Invoke-Schluessel {
    param([string[]]$Argumente)

    $skript = Get-SchluesselPfad
    $node = if ($env:SCHLUESSEL_NODE) { $env:SCHLUESSEL_NODE } else { 'node' }

    # stderr mit einsammeln (das Modul warnt dort), aber nicht als Fehler
    # behandeln — die eigentliche Antwort ist die letzte JSON-Zeile.
    $ErrorActionPreference = 'Continue'
    $zeilen = & $node $skript @Argumente '--json' 2>&1 | ForEach-Object { $_.ToString() }

    $json = $zeilen | Where-Object { $_.TrimStart().StartsWith('{') } | Select-Object -Last 1
    if (-not $json) {
        throw "Unerwartete Ausgabe von schluessel.js:`n$($zeilen -join "`n")"
    }
    return $json | ConvertFrom-Json
}

function Format-SchluesselDauer {
    param([double]$Millisekunden)

    $s = [Math]::Max([Math]::Round($Millisekunden / 1000), 0)
    if ($s -lt 90) { return "$s s" }
    $m = [Math]::Round($s / 60)
    if ($m -lt 90) { return "$m min" }
    $h = [Math]::Round($m / 60)
    if ($h -lt 36) { return "$h h" }
    return "$([Math]::Round($h / 24)) Tage"
}

function ConvertFrom-SchluesselZeit {
    param([double]$Millisekunden)
    return [DateTimeOffset]::FromUnixTimeMilliseconds([long]$Millisekunden).LocalDateTime
}

function key {
    <#
        .SYNOPSIS
            Erzeugt einen Einmal-Schluessel fuer die SSH-Freigabe.
        .DESCRIPTION
            Ohne Schalter wird ein Schluessel erzeugt. Er gilt 5 Minuten und
            genau einmal. Danach — ob benutzt oder verfallen — laeuft eine
            Sperre, die mit jedem Schluessel laenger wird:
            10 min, 1 h, 3 h, 6 h, 12 h, 1 d, danach Dauersperre.
        .EXAMPLE
            key
        .EXAMPLE
            key -Status
    #>
    [CmdletBinding(DefaultParameterSetName = 'Neu')]
    param(
        [Parameter(ParameterSetName = 'Status')][switch]$Status,
        [Parameter(ParameterSetName = 'Entsperren')][switch]$Entsperren,
        [switch]$Json
    )

    $befehl = switch ($PSCmdlet.ParameterSetName) {
        'Status'     { 'status' }
        'Entsperren' { 'entsperren' }
        default      { 'neu' }
    }

    try {
        $a = Invoke-Schluessel -Argumente @($befehl)
    } catch {
        Write-Host ''
        Write-Host "  Fehler: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ''
        return
    }

    if ($Json) { return $a }

    if (-not $a.ok) {
        Write-Host ''
        Write-Host "  $($a.text)" -ForegroundColor Red
        if ($a.grund -eq 'dauersperre') {
            Write-Host '  Aufheben mit:  key -Entsperren' -ForegroundColor DarkGray
        }
        Write-Host ''
        return
    }

    $jetzt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

    switch ($befehl) {
        'neu' {
            $bis = ConvertFrom-SchluesselZeit $a.laeuft_ab
            Write-Host ''
            Write-Host '  SSH-Schluessel' -ForegroundColor DarkGray
            Write-Host ''
            Write-Host "      $($a.schluessel)" -ForegroundColor Green
            Write-Host ''
            Write-Host "  gueltig bis $($bis.ToString('HH:mm:ss')) ($(Format-SchluesselDauer $a.gueltig_ms)), genau ein Login" -ForegroundColor DarkGray
            if ($null -ne $a.naechste_sperre) {
                Write-Host "  danach $(Format-SchluesselDauer $a.naechste_sperre) Sperre, bevor ein neuer Schluessel geht" -ForegroundColor DarkGray
            } else {
                Write-Host '  Achtung: nach diesem Schluessel greift die Dauersperre' -ForegroundColor Yellow
            }
            Write-Host ''
        }
        'status' {
            Write-Host ''
            Write-Host "  Stufe            $($a.stufe) von $($a.leiter.Count)"
            $naechste = if ($null -ne $a.naechste_sperre) {
                Format-SchluesselDauer $a.naechste_sperre
            } else { 'Dauersperre' }
            Write-Host "  naechste Sperre  $naechste"
            if ($a.offen) {
                Write-Host "  offener Sch.     ja, noch $(Format-SchluesselDauer ($a.laeuft_ab - $jetzt))" -ForegroundColor Yellow
            } else {
                Write-Host '  offener Sch.     nein'
            }
            if ($a.dauerhaft_gesperrt) {
                Write-Host '  gesperrt         DAUERHAFT — key -Entsperren' -ForegroundColor Red
            } elseif ($a.gesperrt_bis -gt 0) {
                Write-Host "  gesperrt         noch $(Format-SchluesselDauer ($a.gesperrt_bis - $jetzt))" -ForegroundColor Yellow
            } else {
                Write-Host '  gesperrt         nein' -ForegroundColor Green
            }
            Write-Host ''
        }
        'entsperren' {
            Write-Host ''
            Write-Host "  $($a.text)" -ForegroundColor Green
            Write-Host ''
        }
    }
}
