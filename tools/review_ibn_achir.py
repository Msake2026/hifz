#!/usr/bin/env python3
"""Fiche de relecture d'Ibn ʿĀshir : python3 -I tools/review_ibn_achir.py  ->  RELECTURE-IBN-ACHIR.md
Liste chaque divergence entre les deux transcriptions web (A = texte de l'application, B = contrôle), avec le vers complet,
avec le résultat de la relecture humaine : mots corrigés (B.CORRECTIONS) et mots de la copie A confirmés. L'IA ne tranche rien."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_ibn_achir as B

units, _, sec = B.ibn_ashir()
allrows = [r for r in B.LAST_REVIEW if r["n"]]
def same(r): return B.sk(r["a"]).replace(" ", "") == B.sk(r["b"]).replace(" ", "")   # écriture identique (espaces seulement) ou devenue identique après correction
for r in allrows:   # un vers présent seulement dans A : son numéro est celui qui suit le vers de B auquel il est rattaché
    if r["b"].startswith("(vers"): r["n"] += 1
rows = [r for r in allrows if not same(r) or r["a"] in B.CORRECTIONS.values()]
def chap(n):
    return [s for s in sec if s["from"] <= n][-1]["fr"]
def verse(r):
    t = units[r["n"] - 1]["t"]
    return t
def row(r):
    a = r["a"] or "—"; b = r["b"] or "—"
    return f"| {r['n']} | {chap(r['n'])} | **{a}** | **{b}** | {verse(r)} |"
head = "| N° du vers | Chapitre | Copie A (dans l'appli) | Copie B | Vers complet (copie A) |\n|---|---|---|---|---|"
done = [r for r in rows if r["a"] in B.CORRECTIONS.values()]       # mot corrigé par le relecteur
kept = [r for r in rows if r not in done]                          # le relecteur a confirmé le mot de la copie A
def row(r):
    a = r["a"] or "—"; b = r["b"] or "—"
    return f"| {r['n']} | {chap(r['n'])} | **{a}** | **{b}** | {verse(r)} |"
head = "| N° du vers | Chapitre | Mot dans l'appli | Mot de la copie B | Vers complet (texte de l'appli) |\n|---|---|---|---|---|"
out = f"""# Fiche de relecture : Ibn ʿĀshir, *al-Murshid al-Muʿīn*

Le texte de l'application vient de **deux transcriptions de blogs** (copie A, retenue, et copie B) qui s'accordent à 96,8 %.
Toutes les divergences entre les deux copies ont été **relues et tranchées par une personne le 23 oct. 2026** : {len(done)} mots corrigés (section 1), {len(kept)} mots de la copie A confirmés (section 2). L'IA n'a rien tranché.

**Pas encore relu :** les passages où les deux copies sont d'accord ; les 5 vers d'introduction (n° 1 à 5, seulement dans la copie A) ; le nombre de vers (315 dans l'application, 317 dans les sources) ; les titres des 27 chapitres.

## 1. Mots corrigés par la relecture : {len(done)}
{head}
""" + "\n".join(row(r) for r in done) + f"""

## 2. Divergences où le mot de l'application a été confirmé : {len(kept)}
{head}
""" + "\n".join(row(r) for r in kept) + """

*Fiche générée par `tools/review_ibn_achir.py` à partir des deux sources citées dans `tools/build_ibn_achir.py`.*
"""
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "RELECTURE-IBN-ACHIR.md"), "w", encoding="utf8").write(out)
print(len(rows), "divergences :", len(done), "corrigées,", len(kept), "confirmées")
