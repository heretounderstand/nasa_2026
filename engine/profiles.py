"""Fiche de chaque investigation de combustion de PSI, et classement par habitat.

Une fiche réunit : pilier de sécurité incendie, famille de matériel,
combustibles, plages de conditions testées, ce qui varie d'un essai à
l'autre, type de mesure, et les défauts repérés dans les tableaux.

Sources des attributions :
- piliers, familles de matériel et liens entre investigations : énoncé officiel
  du challenge (rubriques Background et Potential Considerations) ;
- plages et variables : calculées sur les essais importés, ou lues dans les
  tableaux de synthèse PSI (une ligne par journée d'essais).
"""

from __future__ import annotations

import re

import pandas as pd

from engine.importers.common import ATM_KPA, RAW, read_csv

# --------------------------------------------------------------------------- #
# Attributions tirées de l'énoncé du challenge
# --------------------------------------------------------------------------- #
PILLAR = {  # prévention (inflammabilité des matériaux), détection, suppression
    "PSI-25": "prevention", "PSI-26": "prevention", "PSI-98": "prevention", "PSI-99": "prevention",
    "PSI-100": "prevention", "PSI-20": "prevention",
    "PSI-101": "detection", "PSI-102": "detection",
    "PSI-69": "suppression",
}
# 2 : nommée par l'énoncé comme étude de sécurité incendie ; 1 : lien indiqué
# par l'énoncé (matériel partagé, oxygène élevé, gravité partielle imitée) ;
# 0 : « still relevant, just not as strongly or directly ».
DIRECTNESS = {
    **{k: 2 for k in PILLAR},
    "PSI-47": 1, "PSI-159": 1, "PSI-22": 1, "PSI-68": 1, "PSI-39": 1, "PSI-107": 1, "PSI-106": 1,
}
STATEMENT_NOTE = {
    "PSI-20": "The challenge statement describes BRE as a study of materials flammability in still atmospheres, as a function of material properties.",
    "PSI-22": "The challenge statement notes that this experiment mimicked partial gravity through the effect of an electric field on the ions in flames.",
    "PSI-47": "Used, to detect dust, one of the instruments that SAME and SAME-R used for smoke detection (challenge statement).",
    "PSI-159": "Holds the microgravity tests with the highest oxygen concentrations: an oxygen-nitrogen mixture flows from the burner into a fuel atmosphere (inverse flames).",
    "PSI-69": "Suppression studied by diluting the chamber atmosphere with carbon dioxide and helium (challenge statement).",
    "PSI-101": "Fire detection tested in microgravity (challenge statement).",
    "PSI-102": "Fire detection tested in microgravity (challenge statement).",
}
HARDWARE = {
    **{k: "ACME modular hardware, Combustion Integrated Rack (CIR)" for k in ("PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-159")},
    **{k: "Multi-user Droplet Combustion Apparatus (MDCA), CIR" for k in ("PSI-69", "PSI-68", "PSI-39")},
    **{k: "Microgravity Science Glovebox (MSG), SPICE flow duct" for k in ("PSI-26", "PSI-25", "PSI-107", "PSI-106")},
}
MEASUREMENT = {
    "extinction": "whether the flame goes out", "sustained": "whether the flame goes out",
    "detector_signal": "smoke detector signal and particle size", "descriptive": None,
    "limit_o2": "limiting oxygen concentration", "spread_rate": "flame spread rate",
}
CONDITION_LABEL = {
    "o2_mole_fraction": "oxygen", "pressure_kpa": "pressure", "flow_velocity_cm_s": "airflow", "fuel": "fuel",
    "extra.co2_mole_fraction": "CO2 dilution", "extra.he_mole_fraction": "helium dilution",
    "extra.droplet_d0_mm": "droplet size", "extra.fuel_flow_mg_s": "fuel flow",
    "extra.fuel_mole_fraction": "fuel dilution", "extra.heating_ratio_rt_r0": "heating level",
    "extra.aging_s": "smoke ageing time", "extra.oxidizer_o2_mole_fraction": "oxygen in the burner flow",
    "geometry": "sample geometry",
}

# --------------------------------------------------------------------------- #
# Tableaux de synthèse PSI (une ligne par journée d'essais, sans résultat)
# --------------------------------------------------------------------------- #
SUMMARY_TABLES = {
    "PSI-20": ("PSI-20_Experimental table_ACME BRE.csv", "Fuel Bottle", "Oxygen Conc (percent)"),
    "PSI-21": ("PSI-21_Experimental table_CLD Flame.csv", "Fuel Bottle", None),
    "PSI-22": ("PSI-22_Experimental table_ACME E-FIELD Flames.csv", "Fuel Bottle", None),
    "PSI-23": ("PSI-23_Experimental table_ACME s-Flame.csv", "Fuel Bottle", "Atmosphere*"),
    "PSI-106": ("PSI-106_Experimental table_Slice.csv", "Fuel Type", None),
    "PSI-47": ("PSI-47_Experimental table_DAFT.csv", None, None),
}
_SPECIES = re.compile(r"C2H4|C2H6|C3H8|CH4|H2(?![0-9A-Za-z])")
_AUTOFILL = re.compile(r"\bCH[5-9]\b|\bN[3-9]\b|\bN1\d\b")
_SPECIES_NAME = {"CH4": "methane", "C2H4": "ethylene", "C2H6": "ethane", "C3H8": "propane", "H2": "hydrogen"}


def summary_table(accession: str) -> dict | None:
    """Lit un tableau de synthèse. Ne corrige rien : les valeurs suspectes sont
    écartées des plages et signalées dans `quality`."""
    if accession not in SUMMARY_TABLES:
        return None
    fname, fuel_col, o2_col = SUMMARY_TABLES[accession]
    path = RAW / accession / fname
    if not path.exists():
        return None
    df = read_csv(path).dropna(how="all")
    out: dict = {"file": f"{accession}/{fname}", "n_rows": int(len(df)), "quality": []}
    flames = [c for c in df.columns if c.lower().startswith("flames ignited")]
    if flames:
        out["flames_ignited"] = int(pd.to_numeric(df[flames[0]], errors="coerce").sum())
    if fuel_col and fuel_col in df:
        text = " ".join(df[fuel_col].dropna().astype(str))
        out["fuels"] = sorted({_SPECIES_NAME[m] for m in _SPECIES.findall(text)})
        bad = sorted(set(_AUTOFILL.findall(text)))
        if bad:
            out["quality"].append(
                f"Spreadsheet autofill artefacts in chemical formulas ({', '.join(bad[:4])}…): those cells are not read as fuels.")
    if o2_col and o2_col in df:
        vals, odd = [], []
        for cell in df[o2_col].dropna().astype(str):
            for tok in re.findall(r"\d+(?:\.\d+)?", cell):
                v = float(tok)
                (vals if 5 <= v <= 100 else odd).append(v)
        if vals:
            out["o2_percent"] = sorted(set(vals))
        if odd:
            out["quality"].append(
                f"Out-of-range oxygen value in the table ({', '.join(f'{v:g}%' for v in sorted(set(odd)))}), "
                "probably a formatting error: excluded from the range.")
    if "Burner Size (mm)" in df:
        out["burner_mm"] = sorted({float(v) for v in pd.to_numeric(df["Burner Size (mm)"], errors="coerce").dropna()})
    return out


# --------------------------------------------------------------------------- #
# Fiches
# --------------------------------------------------------------------------- #
def _rng(s: pd.Series, scale: float = 1.0, nd: int = 1):
    v = pd.to_numeric(s, errors="coerce").dropna()
    return None if v.empty else [round(float(v.min()) * scale, nd), round(float(v.max()) * scale, nd)]


def profile(accession: str, df: pd.DataFrame) -> dict:
    d = df[df["source_id"] == accession]
    p: dict = {
        "pillar": PILLAR.get(accession),
        "directness": DIRECTNESS.get(accession, 0),
        "hardware": HARDWARE.get(accession),
        "statement_note": STATEMENT_NOTE.get(accession),
        "quality": [],
    }
    summ = summary_table(accession)
    if not d.empty:
        p["n_tests"] = int(len(d))
        p["fuel_types"] = sorted(d["fuel_type"].dropna().unique())
        fuels = d["fuel"].dropna().astype(str).str.lower()
        p["fuels"] = list(fuels.value_counts().head(6).index)
        p["n_fuels"] = int(fuels.nunique())
        p["o2_percent"] = _rng(d["o2_mole_fraction"], 100)
        p["pressure_kpa"] = _rng(d["pressure_kpa"])
        p["flow_cm_s"] = _rng(d["flow_velocity_cm_s"])
        if "extra.oxidizer_o2_mole_fraction" in d:
            p["oxidizer_o2_percent"] = _rng(d["extra.oxidizer_o2_mole_fraction"], 100)
        varies, fixed = [], []
        for col, label in CONDITION_LABEL.items():
            if col not in d:
                continue
            s = d[col].dropna()
            if s.empty:
                continue
            (varies if s.nunique() > 1 else fixed).append(label)
        p["varies"], p["constant"] = varies, fixed
        p["measurements"] = sorted({m for m in (MEASUREMENT.get(t) for t in d["outcome_type"].unique()) if m})
        flags = d["quality_flags"].explode().dropna()
        if (flags == "at_signal_ceiling").any():
            p["quality"].append(f"{int((flags == 'at_signal_ceiling').sum())} detector readings sit at the top of the recorded range (probable instrument ceiling).")
        if (flags == "free_text_observation").any():
            p["quality"].append("Outcomes exist only as free-text test notes.")
    elif summ:
        p["n_test_days"] = summ["n_rows"]
        p["flames_ignited"] = summ.get("flames_ignited")
        p["fuel_types"] = ["gas"] if summ.get("fuels") else []
        p["fuels"] = summ.get("fuels", [])
        p["n_fuels"] = len(p["fuels"])
        o2 = summ.get("o2_percent")
        p["o2_percent"] = [min(o2), max(o2)] if o2 else None
        p["o2_levels_percent"] = o2
        p["burner_mm"] = summ.get("burner_mm")
        p["summary_file"] = summ["file"]
    if summ:
        p["quality"] += summ["quality"]
    return p


# --------------------------------------------------------------------------- #
# Classement par habitat
# --------------------------------------------------------------------------- #
# Atmosphères : contextes du moteur. Le rover pressurisé partage l'atmosphère
# supposée de la base lunaire (énoncé : 30 % d'O2 ou plus, 10,2 psi ou moins).
HABITATS = [
    {"id": "iss", "label": "ISS", "context_id": "iss", "partial_gravity": False},
    {"id": "gateway", "label": "Gateway", "context_id": "gateway", "partial_gravity": False},
    {"id": "moon", "label": "Lunar habitat and pressurized rover", "context_id": "moon", "partial_gravity": True},
    {"id": "mars", "label": "Mars habitat", "context_id": "mars", "partial_gravity": True},
]
PARTIAL_GRAVITY_PROXY = {"PSI-22"}  # énoncé : E-FIELD Flames imite la gravité partielle


def relevance(item: dict, habitat: dict, o2_fraction: float | None) -> dict:
    """Score transparent (0 à 6) : lien avec la sécurité incendie (0-2),
    oxygène de l'habitat couvert par les essais (0-2), gravité (0-1),
    résultats exploitables dans l'outil (0-1)."""
    prof = item["profile"]
    directness = prof["directness"]
    oxygen = 0
    rng = prof.get("o2_percent") or prof.get("oxidizer_o2_percent")
    if o2_fraction is not None and rng:
        target = o2_fraction * 100
        if rng[0] - 0.5 <= target <= rng[1] + 0.5:
            oxygen = 2
        elif min(abs(target - rng[0]), abs(target - rng[1])) <= 5:
            oxygen = 1
    gravity = 1 if (not habitat["partial_gravity"] or item["accession"] in PARTIAL_GRAVITY_PROXY) else 0
    usable = 1 if item["status"] in ("scenario", "notes") else 0
    return {"score": directness + oxygen + gravity + usable,
            "directness": directness, "oxygen": oxygen, "gravity": gravity, "usable": usable}


def rank_for_habitats(items: list[dict], contexts: dict) -> list[dict]:
    out = []
    for h in HABITATS:
        cond = contexts[h["context_id"]].conditions
        rows = []
        for it in items:
            r = relevance(it, h, cond.o2_mole_fraction)
            rows.append({"accession": it["accession"], **r})
        rows.sort(key=lambda r: (-r["score"], -r["directness"], int(r["accession"].split("-")[1])))
        out.append({
            "id": h["id"], "label": h["label"],
            "o2_percent": None if cond.o2_mole_fraction is None else round(cond.o2_mole_fraction * 100, 1),
            "pressure_kpa": cond.pressure_kpa, "gravity_g": cond.gravity_g,
            "ranking": rows,
        })
    return out


__all__ = ["profile", "rank_for_habitats", "summary_table", "ATM_KPA"]
