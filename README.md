# Minecraft Server - 11 Welten (Cheats aktiviert)

Dieser Server verwendet **Multiverse-Core** zur Verwaltung von 10 verschiedenen Welten.
**Cheats sind in allen Welten aktiviert!** Flugmodus, Befehle und Command-Blocks funktionieren überall.

## Welten-Übersicht

| Nr. | Welt | Spielmodus | Schwierigkeit | PvP | Beschreibung |
|-----|------|-----------|---------------|-----|-------------|
| 1 | **Survival** | Survival | Normal | Ja | Hauptwelt zum Überleben und Bauen |
| 2 | **Creative** | Creative | Peaceful | Nein | Flache Kreativwelt zum freien Bauen |
| 3 | **Nether** | Survival | Hard | Ja | Nether-Dimension |
| 4 | **End** | Survival | Hard | Ja | End-Dimension mit Enderdrache |
| 5 | **Skyblock** | Survival | Normal | Nein | Void-Welt für Skyblock-Challenges |
| 6 | **PvP Arena** | Adventure | Normal | Ja | Kampfarena für Spieler vs. Spieler |
| 7 | **Lobby** | Adventure | Peaceful | Nein | Hub/Spawn-Welt für Navigation |
| 8 | **Resource** | Survival | Normal | Ja | Farmwelt zum Ressourcen-Sammeln (resetbar) |
| 9 | **Adventure** | Adventure | Hard | Nein | Abenteuer-Welt mit Quests |
| 10 | **Hardcore** | Survival | Hard | Ja | Hardcore-Modus ohne Auto-Heilung |
| 11 | **Bedwars** | Survival | Normal | Ja | Bedwars-Arena (Void-Welt, kein Hunger) |

## Benötigte Plugins

- [Multiverse-Core](https://github.com/Multiverse/Multiverse-Core) - Welten-Management
- [VoidGenerator](https://www.spigotmc.org/resources/voidgenerator.25void/) - Für Skyblock & Bedwars
- [BedWars1058](https://www.spigotmc.org/resources/bedwars1058.50942/) - Bedwars-Plugin

## Bedwars

Komplett konfiguriert mit deutschem Shop, Upgrades und 3 Arena-Modi:

| Modus | Teams | Spieler pro Team | Max Spieler |
|-------|-------|-----------------|-------------|
| 4x1 (Solo) | 4 | 1 | 4 |
| 4x2 (Duo) | 4 | 2 | 8 |
| 4x4 (Vierer) | 4 | 4 | 16 |

Befehle:
```
/bw join <Arena>    - Arena beitreten
/bw leave           - Arena verlassen
/bw stats           - Statistiken anzeigen
```

## Befehle

```
/mv list                    - Alle Welten anzeigen
/mv tp <Welt>               - Zu einer Welt teleportieren
/mv create <Name> <Typ>     - Neue Welt erstellen
/mv delete <Name>           - Welt löschen
```

## Cheats

Cheats sind in allen Welten aktiviert (`allow-cheats=true`, `allowFlight=true`).
Wichtige Cheat-Befehle:

```
/gamemode creative <Spieler>    - Kreativmodus
/give <Spieler> <Item> <Anzahl> - Items geben
/tp <Spieler> <x> <y> <z>      - Teleportieren
/time set day                   - Tag setzen
/weather clear                  - Wetter klären
/effect give <Spieler> <Effekt> - Effekte geben
/xp add <Spieler> <Menge>      - XP geben
```

Siehe `cheats-setup.txt` fuer alle Setup-Befehle.

## Operatoren (OP)

| Spieler | OP-Level | Beschreibung |
|---------|----------|-------------|
| **GrassGlas7797** | 4 (Max) | Volle Rechte, alle Befehle, bypassed Spielerlimit |
