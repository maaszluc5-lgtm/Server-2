#!/usr/bin/env python3
# Holt die neueste ViaVersion + ViaBackwards von Modrinth und ersetzt die alten Jars.
# Alte Versionen werden als *.bak gesichert. Danach: systemctl restart minecraft
import urllib.request, json, os, shutil, sys

PLUGINS = os.environ.get("MC_PLUGINS", "/minecraft-server/plugins")
UA = {"User-Agent": "torjaeger-via-updater/1.0 (server admin)"}

def fetch_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)

def latest(slug):
    data = fetch_json("https://api.modrinth.com/v2/project/%s/version" % slug)
    # Modrinth liefert neueste zuerst. Nimm die erste Release-Version mit einer .jar
    for ver in data:
        if ver.get("version_type") not in (None, "release"):
            # bevorzugt stabile Releases, sonst geht auch beta/alpha weiter unten
            pass
    # 1) stabile Releases bevorzugen
    for want in ("release", "beta", "alpha"):
        for ver in data:
            if ver.get("version_type") == want:
                for f in ver["files"]:
                    if f["filename"].endswith(".jar") and f.get("primary", True):
                        return ver["version_number"], f["url"], f["filename"]
    # fallback: allererste
    ver = data[0]
    f = ver["files"][0]
    return ver["version_number"], f["url"], f["filename"]

def download(url, dest):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as out:
        shutil.copyfileobj(r, out)

def main():
    if not os.path.isdir(PLUGINS):
        print("Plugins-Ordner nicht gefunden:", PLUGINS); sys.exit(1)
    for slug, jar in (("viaversion", "ViaVersion.jar"), ("viabackwards", "ViaBackwards.jar")):
        print("== %s ==" % slug)
        try:
            vnum, url, fname = latest(slug)
        except Exception as e:
            print("  FEHLER beim Abfragen:", e); sys.exit(1)
        print("  neueste Version:", vnum, "(" + fname + ")")
        dest = os.path.join(PLUGINS, jar)
        if os.path.exists(dest):
            shutil.copy2(dest, dest + ".bak")
            print("  altes gesichert:", jar + ".bak")
        try:
            download(url, dest)
        except Exception as e:
            print("  FEHLER beim Download:", e); sys.exit(1)
        print("  gespeichert:", dest, "(%d KB)" % (os.path.getsize(dest) // 1024))
    print("")
    print("FERTIG. Jetzt neu starten mit:  systemctl restart minecraft")

if __name__ == "__main__":
    main()
