#!/usr/bin/env python3
"""Fiche de relecture d'Ibn ʿĀshir : python3 -I tools/review_ibn_achir.py  ->  RELECTURE-IBN-ACHIR.md
Liste chaque divergence entre les deux transcriptions web (A = texte de l'application, B = contrôle), avec le vers complet,
pour qu'une personne qui a l'édition imprimée tranche. Aucun choix n'est fait ici."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_ibn_achir as B

# Divergences où le MOT change (pas seulement l'écriture) : à trancher en priorité. Clé = mot de A sans voyelles.
SENSE = {"امكن", "عالما", "الايمان", "حتما", "عن", "بفصل", "ونعم", "السقي", "لرفض", "والاشواط", "بنسج", "كماله ترام", "قبل", "حجه"}
units, _, sec = B.ibn_ashir()
rows = [r for r in B.LAST_REVIEW if B.sk(r["a"]).replace(" ", "") != B.sk(r["b"]).replace(" ", "")]
rows = [r for r in rows if r["n"]]
for r in rows:   # un vers présent seulement dans A : son numéro est celui qui suit le vers de B auquel il est rattaché
    if r["b"].startswith("(vers"): r["n"] += 1
def chap(n):
    return [s for s in sec if s["from"] <= n][-1]["fr"]
def verse(r):
    t = units[r["n"] - 1]["t"]
    return t
def row(r):
    a = r["a"] or "—"; b = r["b"] or "—"
    return f"| {r['n']} | {chap(r['n'])} | **{a}** | **{b}** | {verse(r)} |"
head = "| N° du vers | Chapitre | Copie A (dans l'appli) | Copie B | Vers complet (copie A) |\n|---|---|---|---|---|"
hard = [r for r in rows if B.sk(r["a"]).replace("  ", " ") in SENSE or r["b"].startswith("(vers") or B.sk(r["a"]) in SENSE]
easy = [r for r in rows if r not in hard]
out = f"""# Fiche de relecture : Ibn ʿĀshir, *al-Murshid al-Muʿīn*

Le texte de l'application vient de **deux transcriptions de blogs**. Elles s'accordent à 96,8 %. Cette fiche liste ce qui diffère.
**À faire (avec l'édition imprimée de référence)** : pour chaque ligne, noter si la copie A (celle de l'application) est juste, si c'est la copie B, ou ni l'une ni l'autre (donner alors le mot exact de l'édition).

Les 5 vers d'introduction (n° 1 à 5) n'existent que dans la copie A : à vérifier en entier. L'application compte 315 vers ; les sources en citent 317 : vérifier s'il manque deux vers.
Les titres de chapitres (27 blocs) viennent de la copie A : vérifier aussi qu'ils correspondent à l'édition.

## 1. À trancher en priorité (le mot diffère et le sens peut changer) : {len(hard)} lignes
{head}
""" + "\n".join(row(r) for r in hard) + f"""

## 2. Autres divergences : le plus souvent une coquille de l'une des copies (lettre en trop, en moins ou changée) : {len(easy)} lignes
À parcourir plus vite ; si le mot de la copie A est juste dans l'édition, il n'y a rien à faire.
{head}
""" + "\n".join(row(r) for r in easy) + """

*Fiche générée par `tools/review_ibn_achir.py` à partir des deux sources citées dans `tools/build_ibn_achir.py`. Aucune de ces lignes n'a été tranchée par l'IA.*
"""
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "RELECTURE-IBN-ACHIR.md"), "w", encoding="utf8").write(out)
print(len(rows), "divergences :", len(hard), "à trancher,", len(easy), "orthographe")
