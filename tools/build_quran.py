#!/usr/bin/env python3
"""Génère ../quran.js : le texte du Coran (Ḥafṣ, uthmani) embarqué dans le site.

Source : api.alquran.cloud, édition « quran-uthmani » (texte du projet Tanzil). Aucun texte n'est écrit à la main.
Le site n'a ainsi plus besoin d'internet ni du stockage du navigateur pour afficher le Coran, et le texte est
vérifié à chaque chargement (empreinte SHA-256). Le script s'arrête si un contrôle échoue.
Usage : python3 -I tools/build_quran.py
"""
import json, os, re, hashlib, datetime, urllib.request

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "quran.js")
URL = "https://api.alquran.cloud/v1/quran/quran-uthmani"

raw = json.loads(urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "HifzApp/1.0"}), timeout=60).read())
assert raw["code"] == 200 and raw["data"]["edition"]["identifier"] == "quran-uthmani"
surahs = []
for s in raw["data"]["surahs"]:
    ayahs = []
    for i, v in enumerate(s["ayahs"]):
        assert v["numberInSurah"] == i + 1, (s["number"], i)
        t = v["text"].replace("﻿", "").strip()
        # l'API préfixe la basmala au verset 1 (sauf sourates 1 et 9) : on la retire
        if i == 0 and s["number"] not in (1, 9):
            t = " ".join(t.split()[4:])
        assert t, (s["number"], i + 1)
        ayahs.append([t, v["juz"], v["page"]])
    surahs.append({"n": s["number"], "ar": s["name"], "en": s["englishName"], "a": ayahs})

# contrôles de cohérence
assert [s["n"] for s in surahs] == list(range(1, 115))
flat = [v for s in surahs for v in s["a"]]
assert len(flat) == 6236, len(flat)
assert [v[2] for v in flat] == sorted(v[2] for v in flat) and flat[0][2] == 1 and flat[-1][2] == 604   # pages croissantes 1..604
assert [v[1] for v in flat] == sorted(v[1] for v in flat) and flat[0][1] == 1 and flat[-1][1] == 30    # juz croissants 1..30
assert len({v[2] for v in flat}) == 604
assert not any(re.search(r"[A-Za-z0-9]", v[0]) for v in flat)                                            # que de l'arabe

sha = hashlib.sha256("\n".join(v[0] for v in flat).encode("utf8")).hexdigest()
with open(OUT, "w", encoding="utf8") as f:
    f.write("window.QURAN = ")
    json.dump({"generated": datetime.date.today().isoformat(), "source": "api.alquran.cloud quran-uthmani (Tanzil)",
               "verses": len(flat), "sha256": sha, "surahs": surahs}, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print(len(surahs), "sourates,", len(flat), "versets,", sha[:16], os.path.getsize(OUT) // 1024, "Ko")
