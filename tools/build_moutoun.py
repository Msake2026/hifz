#!/usr/bin/env python3
"""Génère ../moutoun.js à partir de sources publiques (aucun texte n'est écrit à la main).

Sources :
  - Wikisource arabe (API MediaWiki) : Tuḥfat al-Aṭfāl, Manẓūmat al-Bayqūnī
  - hadith-api (fawazahmed0, via jsDelivr), édition « ara-nawawi » : Al-Arbaʿūn an-Nawawiyya

Usage : python3 -I tools/build_moutoun.py
Contrôles intégrés : nombre de vers attendu (61 / 34) et numérotation continue ; le script s'arrête sinon.
"""
import json, re, time, html, datetime, urllib.request, urllib.parse, os, sys

UA = "HifzApp/1.0 (personal study app)"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "moutoun.js")
TATWEEL = re.compile("ـ")


def http(url):
    for _ in range(6):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read()
        except Exception as e:  # limites de débit de Wikimedia : on patiente
            print("retry", url[:60], e, file=sys.stderr)
            time.sleep(30)
    raise SystemExit("échec réseau")


def wikisource(title):
    q = urllib.parse.urlencode({"action": "query", "prop": "revisions", "rvprop": "content|ids", "rvslots": "main",
                                "titles": title, "format": "json", "formatversion": "2"})
    r = json.loads(http("https://ar.wikisource.org/w/api.php?" + q))["query"]["pages"][0]["revisions"][0]
    time.sleep(10)
    return r["slots"]["main"]["content"], r["revid"]


def clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"\s+", " ", TATWEEL.sub("", s)).strip()


def poem_unit(h1, h2):
    h1, h2 = clean(h1), clean(h2)
    return {"t": h1 + " " + h2, "m": len(h1.split())}


def split_point(words):
    """Prose : coupe près du milieu, de préférence après une ponctuation."""
    n = len(words)
    best = None
    for i in range(int(n * .35), int(n * .65) + 1):
        if i and re.search(r"[،:؛.؟\"”]$", words[i - 1]):
            if best is None or abs(i - n / 2) < abs(best - n / 2):
                best = i
    return best or (n + 1) // 2


def tuhfa():
    c, rev = wikisource("تحفة الأطفال")
    cells = [clean(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", c, re.S)]
    units, nums = [], []
    for i, x in enumerate(cells):
        m = re.fullmatch(r"\((\d+)\)", x)
        if m:
            nums.append(int(m.group(1)))
            units.append(poem_unit(cells[i + 1], cells[i + 2]))
    assert nums == list(range(1, 62)), nums
    return units, rev


def bayquniyya():
    c, rev = wikisource("منظومة البيقوني")
    body = re.search(r"\{\{أبيات\|(.*?)\}\}", c, re.S).group(1)
    units = [poem_unit(*re.split(r"\\\\+", l)) for l in body.split("\n") if l.strip()]
    assert len(units) == 34, len(units)
    return units, rev


def arbain():
    d = json.loads(http("https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-nawawi.json"))["hadiths"]
    units = []
    for h in d:
        t = clean(h["text"])
        t = re.sub(r"\[\s*رقم\s*:?\s*\d*\s*\]", "", t)  # numéros de renvoi (Sunnah.com) : pas dans le texte du matn
        t = re.sub(r"\s*رقم\s*:?\s*[\d/]+", "", t)
        t = t.replace("[", "").replace("]", "")
        t = re.sub(r"\s+([،,.])", r"\1", t)
        t = re.sub(r"\s+", " ", t).strip()
        units.append({"t": t, "m": split_point(t.split())})
    assert [h["hadithnumber"] for h in d] == list(range(1, 43))
    return units, None


def wiki_src(title, rev):
    return {"name": "Wikisource arabe", "url": "https://ar.wikisource.org/w/index.php?oldid=%d" % rev,
            "note": "texte communautaire non relu : à comparer avec ton édition"}


texts = []
u, rev = tuhfa()
texts.append({"id": "tuhfa", "ar": "تحفة الأطفال والغلمان", "fr": "Tuḥfat al-Aṭfāl", "author": "Sulaymān al-Jamzūrī",
              "topic": "Tajwīd", "kind": "poem", "unit": "vers", "source": wiki_src("", rev), "a": u})
u, rev = bayquniyya()
texts.append({"id": "bayquniyya", "ar": "المنظومة البيقونية", "fr": "Al-Manẓūma al-Bayqūniyya", "author": "Al-Bayqūnī",
              "topic": "Muṣṭalaḥ al-ḥadīth", "kind": "poem", "unit": "vers", "source": wiki_src("", rev), "a": u})
u, _ = arbain()
texts.append({"id": "arbain", "ar": "الأربعون النووية", "fr": "Al-Arbaʿūn an-Nawawiyya", "author": "Al-Nawawī",
              "topic": "Ḥadīth", "kind": "prose", "unit": "hadith",
              "source": {"name": "hadith-api (fawazahmed0), édition ara-nawawi",
                         "url": "https://github.com/fawazahmed0/hadith-api",
                         "note": "42 hadiths (les 40 de Nawawī + 2 ajoutés par Ibn Rajab) ; références de transmission (رواه…) conservées, numéros de renvoi retirés"},
              "a": u})

with open(OUT, "w", encoding="utf8") as f:  # .js plutôt que .json : se charge aussi en file:// (pas de fetch)
    f.write("window.MOUTOUN = ")
    json.dump({"generated": datetime.date.today().isoformat(), "texts": texts}, f, ensure_ascii=False)
    f.write(";\n")
print({t["id"]: len(t["a"]) for t in texts})
