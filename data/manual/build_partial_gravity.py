"""Saisie manuelle des données en gravité partielle (et de leurs références à 1 g).

Toutes les valeurs viennent des PDF de data/raw/articles/, avec la page.
Les valeurs lues sur une figure portent le drapeau `digitized_from_figure`.
Relancer ce script régénère data/manual/partial_gravity.csv.

    python data/manual/build_partial_gravity.py
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

OUT = Path(__file__).with_name("partial_gravity.csv")
PSI_KPA = 6.894757
ATM = 101.325

COLS = [
    "experiment_id", "source_id", "dataset", "provenance_file", "provenance_row", "provenance_page",
    "platform", "duration_s", "gravity_g", "o2_mole_fraction", "pressure_kpa", "flow_velocity_cm_s",
    "diluent", "fuel", "fuel_type", "geometry", "extra", "outcome_type", "outcome_value", "outcome_unit",
    "is_measured", "extinction_criterion", "quality_flags", "notes",
]
rows: list[dict] = []


def add(**k) -> None:
    r = {c: "" for c in COLS}
    for key, v in k.items():
        if v is None:
            continue
        if key == "extra":
            v = json.dumps(v, ensure_ascii=False)
        elif key == "quality_flags":
            v = ";".join(v)
        r[key] = v
    r.setdefault("is_measured", "true")
    if not r["is_measured"]:
        r["is_measured"] = "true"
    rows.append(r)


# --------------------------------------------------------------------------- #
# A) Olson & Ferkul (ICES 2012, NTRS 20130010991) — Tableau I, page 6
#    Limites d'O2 de trois matériaux à 1 g, Mars, Lune et 0 g.
#    Contrôle : les ΔO2 recalculés avec l'éq. (1) redonnent ceux du tableau.
# --------------------------------------------------------------------------- #
F = "articles/20130010991.pdf"
TABLE_I = {  # matériau : (pression psia, {limite : % O2})
    "Mylar G": (10.2, {"1g ULOI": 21.2, "1g MOC": 20.0, "Martian ULOI*": 18.0, "Martian MOC*": 17.0,
                       "Lunar ULOI*": 15.6, "Lunar MOC*": 14.1, "0g ULOI*": 17.0, "0g MOC*": 16.0}),
    "Ultem 1000": (10.2, {"1g ULOI": 23.5, "1g MOC": 23.0, "Martian ULOI*": 22.0, "Martian MOC*": 21.1,
                          "Lunar ULOI*": 21.0, "Lunar MOC*": 19.9, "0g ULOI*": 24.0, "0g MOC*": 23.0}),
    "Nomex HT90-40": (14.7, {"1g ULOI": 23.5, "1g MOC": 22.1, "Martian ULOI*": 19.9, "Martian MOC*": 19.0,
                             "Lunar ULOI*": 21.0, "Lunar MOC*": 19.9, "0g ULOI*": 23.0, "0g MOC*": 22.0}),
}
GEOMETRY = {"Mylar G": "film_5mil", "Ultem 1000": "film_10mil", "Nomex HT90-40": "fabric_12mil"}  # p. 2-3
LEVELS = {
    "1g": dict(gravity_g=1.0, platform="ground", duration_s=None, flow_velocity_cm_s=None,
               quality_flags=["ground_reference_test", "nasa_std_6001_test1_modified"]),
    "Martian": dict(gravity_g=0.38, platform="drop_tower_centrifuge", duration_s=5.18, flow_velocity_cm_s=None,
                    quality_flags=["short_duration_drop"]),
    # Valeurs lunaires reprises par les auteurs de leur réf. 8 (Ferkul & Olson 2011) ;
    # niveau lunaire 0,165 g d'après Ferkul LPSC 2026, p. 13.
    "Lunar": dict(gravity_g=0.165, platform="drop_tower_centrifuge", duration_s=5.18, flow_velocity_cm_s=None,
                  quality_flags=["short_duration_drop", "lunar_values_from_cited_ref8"]),
    "0g": dict(gravity_g=0.0, platform="drop_tower", duration_s=5.18, flow_velocity_cm_s=30.0,
               quality_flags=["short_duration_drop", "forced_concurrent_flow", "gravity_nominal_platform"]),
}
for fuel, (psia, limits) in TABLE_I.items():
    for kind, o2 in limits.items():
        level = kind.split()[0]
        lv = LEVELS[level]
        add(
            experiment_id=f"OLSON13-{fuel.split()[0]}-{kind.replace(' ', '_').replace('*', 's')}",
            source_id="olson2013_mars", dataset="limits_vs_gravity", provenance_file=F, provenance_page=6,
            platform=lv["platform"], duration_s=lv["duration_s"], gravity_g=lv["gravity_g"],
            pressure_kpa=round(psia * PSI_KPA, 2), flow_velocity_cm_s=lv["flow_velocity_cm_s"],
            diluent="N2", fuel=fuel, fuel_type="solid", geometry=GEOMETRY[fuel] + "_upward_concurrent",
            extra={"limit_kind": kind,
                   "material_family": "non_charring" if fuel == "Mylar G" else "charring"},
            outcome_type="limit_o2", outcome_value=round(o2 / 100, 4), outcome_unit="o2_mole_fraction",
            extinction_criterion=(
                "1 g : NASA-STD-6001 test 1 modifié (ULOI ≈ 50 % de réussite ; MOC : extinction systématique)"
                if level == "1g" else
                "ULOI* : O2 minimal où la flamme survit à la chute (5,18 s) ; MOC* : O2 maximal où elle s'éteint"),
            quality_flags=lv["quality_flags"],
            notes=f"Tableau I : {kind} = {o2} % O2 à {psia} psia",
        )

# --------------------------------------------------------------------------- #
# B) Konno et al. (Proc. Combust. Inst. 39, 2023) — Fig. 2, page 5 du PDF
#    Frontière d'inflammabilité (trait plein des auteurs) lue sur la grille de 1 % O2.
#    Conditions (p. 3-4) : 1 atm, air + N2, propagation descendante ;
#    vol parabolique : 21 s de microgravité (1e-2 g), 24 s lunaire, 33 s martienne.
# --------------------------------------------------------------------------- #
F = "articles/Konno et al. - 2022 - Experimental study on downwardopposed.pdf"
PANELS = {  # panneau : (fil, âme, diamètre ext. mm, vitesse cm/s, LOC % à G = 0.01 / 0.16 / 0.38 / 1)
    "a": ("Cu#2", "Cu", 0.8, 6.0, [16, 16, 16, 16]),
    "b": ("Cu#3", "Cu", 1.1, 6.0, [16, 16, 16, 16]),
    "c": ("Cu#3", "Cu", 1.1, 15.0, [16, 16, 16, 17]),
    "d": ("NiCr#2", "NiCr", 0.8, 6.0, [15, 16, 18, 18]),
    "e": ("NiCr#3", "NiCr", 1.1, 6.0, [15, 16, 17, 17]),
    "f": ("NiCr#3", "NiCr", 1.1, 15.0, [15, 17, 18, 17.5]),
}
G_LEVELS = [(0.01, "parabolic_flight", 21), (0.16, "parabolic_flight", 24),
            (0.38, "parabolic_flight", 33), (1.0, "ground", None)]
for pan, (wire, core, od, flow, locs) in PANELS.items():
    for (g, plat, dur), loc in zip(G_LEVELS, locs):
        add(
            experiment_id=f"KONNO23-{pan}-{wire}-{int(flow * 10)}mms-G{g}",
            source_id="konno2023_wires", dataset="wire_loc", provenance_file=F, provenance_page=5,
            platform=plat, duration_s=dur, gravity_g=g, pressure_kpa=ATM, flow_velocity_cm_s=flow,
            diluent="N2", fuel="LDPE", fuel_type="solid", geometry=f"wire_{core}_od{od}mm_downward",
            extra={"limit_kind": "LOC_boundary", "wire_core": core, "wire_outer_diameter_mm": od},
            outcome_type="limit_o2", outcome_value=round(loc / 100, 4), outcome_unit="o2_mole_fraction",
            extinction_criterion="Limite de propagation de flamme (l'allumage est toujours obtenu, p. 4)",
            quality_flags=["digitized_from_figure", "read_on_1pct_grid"]
            + (["ground_reference_test"] if g == 1.0 else ["parabolic_g_jitter"]),
            notes=f"Fig. 2({pan}) {wire}, Vg = {int(flow * 10)} mm/s : LOC ≈ {loc} % O2",
        )

# --------------------------------------------------------------------------- #
# C) Olson et al. (Fire Safety Journal 150, 2024) — points de la figure
#    reproduite dans Ferkul, LPSC 2026, page 20. Article payant non consulté.
#    Pression moyenne 57,6 kPa : résumé public de l'article (ScienceDirect).
# --------------------------------------------------------------------------- #
F = "articles/Ferkul-Lunar and Planetary Science Conf 2026 v2.pdf"
POINTS = [  # (résultat, g, % O2) lus sur la figure
    ("steady", 0.04, 14.5), ("steady", 0.16, 14.42), ("steady", 0.16, 13.85), ("steady", 0.38, 14.43),
    ("steady", 0.38, 13.87), ("steady", 0.65, 14.7), ("steady", 1.0, 15.1),
    ("ext", 0.04, 14.1), ("ext", 0.04, 13.6), ("ext", 0.16, 13.67), ("ext", 0.16, 13.13),
    ("ext", 0.38, 14.0), ("ext", 0.38, 13.38), ("ext", 0.65, 14.3), ("ext", 1.0, 14.8), ("ext", 1.0, 14.4),
]
for i, (kind, g, o2) in enumerate(POINTS, 1):
    add(
        experiment_id=f"OLSON24-PMMA-{i:02d}", source_id="olson2024_pmma", dataset="solid_burn",
        provenance_file=F, provenance_page=20, platform="drop_tower_centrifuge", duration_s=5.0,
        gravity_g=g, o2_mole_fraction=round(o2 / 100, 4), pressure_kpa=57.6, diluent="N2",
        fuel="PMMA", fuel_type="solid", geometry="rod_quarter_inch_upward",
        outcome_type="sustained" if kind == "steady" else "extinction",
        extinction_criterion="Flamme stable ou éteinte pendant la chute (~5 s, critère non standard)",
        quality_flags=["digitized_from_figure", "short_duration_drop", "pressure_from_article_abstract"],
        notes=f"« centrifuge {'steady flame' if kind == 'steady' else 'extinction'} » à g ≈ {g}, O2 ≈ {o2} %",
    )

# --------------------------------------------------------------------------- #
# D) Tissu SIBAL en gravité lunaire — Ferkul, LPSC 2026, pages 13, 21 et 22 (texte)
# --------------------------------------------------------------------------- #
add(
    experiment_id="FERKUL26-SIBAL-lunar-aircraft", source_id="ferkul2026_lpsc", dataset="solid_burn",
    provenance_file=F, provenance_page=22, platform="parabolic_flight", duration_s=20, gravity_g=0.165,
    o2_mole_fraction=0.21, pressure_kpa=ATM, diluent="N2", fuel="SIBAL fabric", fuel_type="solid",
    geometry="fabric_5cm_downward", outcome_type="sustained", outcome_value=0.086,
    outcome_unit="cm_s_flame_base_spread",
    extinction_criterion="Propagation stable vers le bas pendant les 20 s de l'essai (p. 21)",
    quality_flags=["parabolic_g_jitter"],
    notes="Essai 2-29, SIBAL 5 cm, 21 % O2, 1 atm (p. 21) ; vitesse de base de flamme 0,086 cm/s (p. 22)",
)
add(
    experiment_id="FERKUL26-SIBAL-lunar-centrifuge", source_id="ferkul2026_lpsc", dataset="solid_burn",
    provenance_file=F, provenance_page=22, platform="drop_tower_centrifuge", duration_s=5.18,
    gravity_g=0.165, o2_mole_fraction=0.21, pressure_kpa=ATM, diluent="N2", fuel="SIBAL fabric",
    fuel_type="solid", geometry="fabric_downward", outcome_type="sustained", outcome_value=0.11,
    outcome_unit="cm_s_flame_base_spread", quality_flags=["short_duration_drop"],
    notes="Tour de chute avec centrifugeuse, propagation descendante : 0,11 cm/s (p. 22) ; air, 1 atm, 0,165 g (p. 13)",
)

# --------------------------------------------------------------------------- #
# E) LUCI (Ferkul, ASGSR 2025) — fusée suborbitale New Shepard en rotation
#    g lunaire calculé depuis p. 12 : 11 tr/min, rayon 1,22 m.
# --------------------------------------------------------------------------- #
F = "articles/ASGSR 2025-LUCI-Ferkul-Presentation-v2-20250010653.pdf"
LUCI_G = round((11 * 2 * math.pi / 60) ** 2 * 1.22 / 9.80665, 3)
for fuel, geo, lunar, val, page, txt in [
    ("SIBAL fabric", "fabric_5cm_downward", True, 0.09, 33,
     "vitesse de base de flamme 0,9 mm/s en gravité partielle (p. 33) ; propagation de plus d'une minute (p. 16)"),
    ("SIBAL fabric", "fabric_5cm_downward", False, 0.15, 33,
     "vitesse de base de flamme 1,5 mm/s à 1 g (p. 33) ; extinction environ 45 s plus tôt qu'en gravité partielle (p. 34)"),
    ("PMMA", "rod_4mm_upward", True, 0.15, 36, "vitesse de pointe de flamme 0,15 cm/s en gravité partielle (p. 36)"),
    ("PMMA", "rod_4mm_upward", False, 0.40, 36, "vitesse de pointe de flamme 0,40 cm/s à 1 g (p. 36)"),
]:
    add(
        experiment_id=f"LUCI25-{fuel.split()[0]}-{'lunar' if lunar else '1g'}", source_id="ferkul2025_luci",
        dataset="solid_burn", provenance_file=F, provenance_page=page,
        platform="suborbital_centrifuge" if lunar else "ground", duration_s=150 if lunar else None,
        gravity_g=LUCI_G if lunar else 1.0, o2_mole_fraction=0.20, pressure_kpa=ATM, diluent="N2",
        fuel=fuel, fuel_type="solid", geometry=geo, outcome_type="sustained", outcome_value=val,
        outcome_unit="cm_s_flame_spread",
        quality_flags=["approximate_value", "o2_initial_about_20pct", "normal_pressure_stated"]
        + (["lunar_g_computed_from_rotation_p12", "duration_lower_bound"] if lunar else ["ground_reference_test"]),
        notes=txt,
    )


if __name__ == "__main__":
    with OUT.open("w", newline="", encoding="utf-8") as h:
        w = csv.DictWriter(h, fieldnames=COLS)
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} lignes écrites dans {OUT.name} (g LUCI = {LUCI_G})")
