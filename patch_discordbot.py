#!/usr/bin/env python3
# Patcht den /mclist-Befehl in discordbot.js: zeigt jetzt die Spielerliste per RCON-Status an.
import re, sys, os, shutil, time

F = os.environ.get("DISCORDBOT_JS", "/opt/monsterjagd/discordbot.js")
try:
    src = open(F, encoding="utf-8").read()
except Exception as e:
    print("Kann discordbot.js nicht lesen:", e); sys.exit(1)

new_block = (
    "case 'mclist': {\n"
    "        await interaction.deferReply();\n"
    "        const st = await mcbot.getStatus();\n"
    "        if (!st.online) return interaction.editReply('\U0001F534 Server ist offline / nicht erreichbar.');\n"
    "        const names = st.players.length ? st.players.join(', ') : '_niemand online_';\n"
    "        return interaction.editReply(`\U0001F7E2 **${st.count}/${st.max}** Spieler online:\\n${names}`);\n"
    "      }"
)

# Matcht den kompletten mclist-case bis zur ersten schliessenden Klammer auf 6-Space-Ebene.
pat = re.compile(r"case 'mclist': \{.*?\n      \}", re.S)
if not pat.search(src):
    if "await mcbot.getStatus()" in src:
        print("Schon gepatcht – nichts zu tun.")
        sys.exit(0)
    print("Konnte den /mclist-Block nicht finden. Abbruch (nichts geaendert).")
    sys.exit(1)

bak = F + ".bak." + time.strftime("%Y%m%d%H%M%S")
shutil.copy2(F, bak)
src2 = pat.sub(lambda m: new_block, src, count=1)
open(F, "w", encoding="utf-8").write(src2)
print("OK: /mclist gepatcht. Backup:", bak)
