#!/usr/bin/env python3
"""Génère ../mutashabihat.js : pour chaque verset, les versets les plus proches du Coran.

Calcul automatique à partir du texte uthmani (api.alquran.cloud) : aucune liste n'est écrite à la main.
Ce n'est PAS la liste classique des mutashābihāt des savants : ce sont des versets dont les mots sont très
proches (rapport de similarité >= 0.55, 4 mots minimum, texte non identique), utiles pour s'entraîner à ne pas
les confondre. Usage : python3 -I tools/build_mutashabihat.py
"""
import json, re, os, urllib.request, difflib, collections, datetime

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "mutashabihat.js")
MARKS = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭـ﻿࣓-ࣿ]")


def norm(w):
    w = MARKS.sub("", w)
    w = re.sub("[إأآٱ]", "ا", w).replace("ى", "ي").replace("ة", "ه")
    return re.sub("[^ء-ي]", "", w)


raw = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://api.alquran.cloud/v1/quran/quran-uthmani", headers={"User-Agent": "TathbitApp/1.0"}), timeout=60).read())
verses = []  # (s, a, tokens)
for s in raw["data"]["surahs"]:
    for i, v in enumerate(s["ayahs"]):
        t = v["text"].replace("﻿", "").strip()
        if i == 0 and s["number"] not in (1, 9):
            t = " ".join(t.split()[4:])  # basmala préfixée par l'API
        toks = [x for x in map(norm, t.split()) if x]
        verses.append((s["number"], i + 1, toks))
assert len(verses) == 6236

index = collections.defaultdict(list)  # trigramme de mots -> versets
for n, (_, _, t) in enumerate(verses):
    for g in {tuple(t[i:i + 2]) for i in range(len(t) - 1)}:
        index[g].append(n)

res = {}
for n, (s, a, t) in enumerate(verses):
    if len(t) < 4:
        continue
    shared = collections.Counter()
    for g in {tuple(t[i:i + 2]) for i in range(len(t) - 1)}:
        if len(index[g]) <= 60:  # on ignore les formules très répétées (ex. refrains)
            for m in index[g]:
                if m != n:
                    shared[m] += 1
    cand = []
    for m, c in shared.most_common(30):
        u = verses[m][2]
        if len(u) < 4 or u == t:
            continue
        r = difflib.SequenceMatcher(None, t, u, autojunk=False).ratio()
        if r >= 0.55:
            cand.append((r, m))
    cand.sort(reverse=True)
    if cand:
        res["%d:%d" % (s, a)] = ["%d:%d:%d" % (verses[m][0], verses[m][1], round(r * 100)) for r, m in cand[:4]]

with open(OUT, "w", encoding="utf8") as f:
    f.write("window.MUTASHABIHAT = ")
    json.dump({"generated": datetime.date.today().isoformat(), "pairs": res}, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print(len(res), "versets avec voisins")
