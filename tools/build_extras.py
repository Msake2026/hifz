#!/usr/bin/env python3
"""Génère data/*.js : tajwīd en couleurs, traductions (français, anglais) et tafsir al-Muyassar pour le lecteur.

Sources (aucun texte écrit à la main) :
  - Tajwīd : édition « quran-tajweed » d'api.alquran.cloud (Islamic Network). Légende officielle :
    https://1x.ax/islamic-network/alquran/tools/~files/master/docs/tajweed.md
  - Traductions : fichiers texte officiels de Tanzil (tanzil.net/trans) : fr.hamidullah (Muhammad Hamidullah),
    en.sahih (Saheeh International). Usage non commercial ; lien vers tanzil.net/trans obligatoire.
  - Tafsir : at-Tafsir al-Muyassar (Complexe du Roi Fahd), édition « ar.muyassar » d'api.alquran.cloud.
Contrôles : 114 sourates, 6236 versets, mêmes nombres de versets par sourate que quran.js, aucun verset vide,
signes de tajwīd bien parenthésés ; empreinte SHA-256 stockée dans chaque fichier. Le script s'arrête si un contrôle échoue.
Usage : python3 -I tools/build_extras.py
"""
import json, os, re, hashlib, datetime, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data")
UA = {"User-Agent": "HifzApp/1.0 (personal study app)"}
TODAY = datetime.date.today().isoformat()


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()


# nombre de versets par sourate (quran.js, déjà contrôlé)
q = open(os.path.join(HERE, "..", "quran.js"), encoding="utf8").read()
Q = json.loads(q[len("window.QURAN = "):].rstrip().rstrip(";"))["surahs"]
COUNTS = [len(s["a"]) for s in Q]
assert len(COUNTS) == 114 and sum(COUNTS) == 6236


def sha(verses):
    return hashlib.sha256("\n".join(v for s in verses for v in s).encode("utf8")).hexdigest()


def cut(flat):
    assert len(flat) == 6236, len(flat)
    out, i = [], 0
    for c in COUNTS:
        out.append(flat[i:i + c]); i += c
    return out


def write(name, var, meta, surahs):
    assert [len(s) for s in surahs] == COUNTS
    assert all(v.strip() for s in surahs for v in s), "verset vide"
    meta = dict(meta, generated=TODAY, verses=6236, sha256=sha(surahs), s=surahs)
    with open(os.path.join(OUT, name), "w", encoding="utf8") as f:
        f.write("window.QX = window.QX || {};\nwindow.QX[%s] = " % json.dumps(var))
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print(name, os.path.getsize(os.path.join(OUT, name)) // 1024, "Ko", meta["sha256"][:12])


def api_edition(ident):
    d = json.loads(get("https://api.alquran.cloud/v1/quran/" + ident))["data"]
    assert d["edition"]["identifier"] == ident and len(d["surahs"]) == 114
    return [[a["text"] for a in s["ayahs"]] for s in d["surahs"]]


# ---- traductions : fichiers officiels Tanzil, recoupés avec api.alquran.cloud ----
def tanzil(ident):
    raw = get("https://tanzil.net/trans/?transID=%s&type=txt" % ident).decode("utf8")
    lines = raw.split("\n")
    body = []
    for l in lines:                                  # un verset par ligne ; la fin du fichier est un en-tête « # … »
        if l.startswith("#"): break
        body.append(l.strip())
    while body and not body[-1]: body.pop()
    return cut(body)


for ident, var, name, label, trans in (
    ("fr.hamidullah", "fr", "tr-fr.js", "Hamidullah", "Muhammad Hamidullah"),
    ("en.sahih", "en", "tr-en.js", "Saheeh International", "Saheeh International")):
    t = tanzil(ident)
    other = api_edition(ident)
    diff = sum(1 for a, b in zip((v for s in t for v in s), (v for s in other for v in s)) if a != b)
    print(ident, "différences Tanzil / alquran.cloud :", diff)
    assert diff < 60, "les deux sources divergent trop"   # écarts mineurs de typographie tolérés, affichés ci-dessus
    write(name, var, {"name": label, "author": trans, "source": "Tanzil", "url": "https://tanzil.net/trans/"}, t)

# ---- tafsir al-Muyassar ----
write("tafsir-ar.js", "muyassar", {"name": "التفسير الميسر", "author": "Complexe du Roi Fahd (مجمع الملك فهد)", "source": "api.alquran.cloud (ar.muyassar)",
      "url": "https://alquran.cloud/"}, api_edition("ar.muyassar"))

# ---- tajwīd ----
DEFECTS = []
MARK = re.compile(r"\[([a-z])(?::\d+)?\[")
CODES = set("hslnpmqcfwiaudbgo")


def parse(t):
    """texte balisé -> liste de (caractère, code de la règle la plus intérieure ou None) ; contrôle le parenthésage
    (quelques balises sont imbriquées, ex. silencieuse dans madd obligatoire : la plus intérieure l'emporte)."""
    out, stack, i = [], [], 0
    while i < len(t):
        m = MARK.match(t, i)
        if m:
            assert m.group(1) in CODES, m.group(1)
            stack.append(m.group(1)); i = m.end(); continue
        if t[i] == "]":
            assert stack, "] sans ["
            stack.pop(); i += 1; continue
        if t[i] == "[":                      # défaut de la source (32:3) : balise sans code → aucune couleur, on ne devine pas
            DEFECTS.append(t[max(0, i - 15):i + 15]); stack.append(None); i += 1; continue
        out.append((t[i], stack[-1] if stack else None)); i += 1
    assert not stack, "balise non fermée"
    return out


def emit(chars):
    s, cur = [], None
    for ch, c in chars:
        if c != cur:
            if cur: s.append("]")
            if c: s.append("[%s[" % c)
            cur = c
        s.append(ch)
    if cur: s.append("]")
    return "".join(s)


raw = api_edition("quran-tajweed")
taj = []
for si, s in enumerate(raw):
    row = []
    for i, t in enumerate(s):
        ch = [(c, k) for c, k in parse(t.replace("﻿", ""))]
        plain = "".join(c for c, _ in ch)
        # contrairement à quran-uthmani, cette édition ne préfixe PAS la basmala au verset 1 : on le vérifie au lieu de le supposer
        assert (i == 0 and si == 0) == plain.startswith("بِسْمِ"), (si + 1, i + 1)
        row.append(emit(ch))
    taj.append(row)
print("balises sans code (laissées sans couleur) :", len(DEFECTS), DEFECTS)
assert len(DEFECTS) <= 3
write("tajweed.js", "tajweed", {"name": "Tajwīd (annotation automatique)", "author": "Islamic Network",
      "source": "api.alquran.cloud (quran-tajweed)", "url": "https://alquran.cloud/tajweed-guide",
      "legend": "https://1x.ax/islamic-network/alquran/tools/~files/master/docs/tajweed.md"}, taj)
