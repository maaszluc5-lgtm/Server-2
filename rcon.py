#!/usr/bin/env python3
# Winziger RCON-Client (keine Abhaengigkeiten). Liest Port+Passwort aus server.properties.
# Benutzung:  python3 rcon.py "befehl hier"
import socket, struct, sys, re, os

PROPS = os.environ.get("MC_PROPS", "/minecraft-server/server.properties")
try:
    txt = open(PROPS, encoding="utf-8", errors="replace").read()
except Exception as e:
    print("Kann server.properties nicht lesen:", e); sys.exit(1)

def prop(k, d=None):
    m = re.search(r'^' + re.escape(k) + r'=(.*)$', txt, re.M)
    return m.group(1).strip() if m else d

HOST = os.environ.get("MC_RCON_HOST", "127.0.0.1")
PORT = int(prop("rcon.port", "25575"))
PW   = prop("rcon.password", "")

if not sys.argv[1:]:
    print("Nutzung: python3 rcon.py \"<minecraft-befehl>\""); sys.exit(1)
CMD = " ".join(sys.argv[1:])

def pack(pid, ptype, body):
    payload = struct.pack("<ii", pid, ptype) + body.encode("utf-8") + b"\x00\x00"
    return struct.pack("<i", len(payload)) + payload

def read_packet(sock):
    raw_len = b""
    while len(raw_len) < 4:
        c = sock.recv(4 - len(raw_len))
        if not c: raise EOFError("Verbindung geschlossen")
        raw_len += c
    length = struct.unpack("<i", raw_len)[0]
    data = b""
    while len(data) < length:
        c = sock.recv(length - len(data))
        if not c: raise EOFError("Verbindung geschlossen")
        data += c
    pid, ptype = struct.unpack("<ii", data[:8])
    return pid, ptype, data[8:-2].decode("utf-8", "replace")

try:
    s = socket.create_connection((HOST, PORT), timeout=10)
except Exception as e:
    print("Keine RCON-Verbindung zu %s:%d – ist enable-rcon=true und der Server gestartet? (%s)" % (HOST, PORT, e))
    sys.exit(1)

s.sendall(pack(1, 3, PW))          # 3 = AUTH
pid, ptype, _ = read_packet(s)
if pid == -1:
    print("AUTH fehlgeschlagen – rcon.password stimmt nicht."); sys.exit(1)

s.sendall(pack(2, 2, CMD))         # 2 = EXEC COMMAND
_, _, body = read_packet(s)
# Minecraft-Farbcodes (Section-Sign) rausfiltern
body = re.sub("§.", "", body)
print(body if body.strip() else "(ok – keine Textausgabe)")
s.close()
