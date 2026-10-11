"""Importeurs des jeux PSI vers le schéma commun.

Conventions :
- Plateforme ISS : gravity_g = 0.0 nominal (non mesurée), signalé par
  `gravity_nominal_platform`.
- Seules les variables connues avant l'allumage vont dans les conditions ;
  les mesures faites après (durée de combustion, température du brûleur…)
  vont dans le résultat ou dans les notes, jamais dans `extra`.
"""

from __future__ import annotations

import math
import re
import warnings

import pandas as pd
from pydantic import ValidationError

from engine.importers.common import (
    ATM_KPA, BAR_KPA, MMHG_KPA, ImportResult, is_blank, parse_number, raw_path, read_csv, rel,
)
from engine.importers.sources import SOURCES
from engine.schema import Experiment

ISS_FLAGS = ["gravity_nominal_platform"]


def _add(res: ImportResult, where: str, **kw) -> None:
    try:
        res.experiments.append(Experiment(**kw))
    except ValidationError as e:
        res.skip(where, f"validation : {e.errors()[0]['msg']}")


def _f(v) -> float | None:
    p = parse_number(v)
    return p.value


# --------------------------------------------------------------------------- #
# PSI-159 ACME CFI-G — flammes de gaz : auto-extinction ou maintien
# --------------------------------------------------------------------------- #

def import_psi159() -> ImportResult:
    """Flammes normales uniquement (jet de combustible dans une ambiance oxydante),
    ce qui correspond à une fuite de gaz en cabine. Les flammes inverses
    (jet d'oxydant dans une ambiance combustible) ne sont pas importées : leur
    fraction d'O2 décrit le jet, pas l'ambiance, et n'est pas comparable.

    Résultat : SE (auto-extinction) → extinction ; FT (débit coupé, flamme
    encore présente) → sustained ; « - » (pas d'allumage) → écarté.
    """
    res = ImportResult("PSI-159", sources=[SOURCES["PSI-159"]])
    path = raw_path("PSI-159", "PSI-159_Experimental table_CFI-G_Normal Flames.csv")
    df = read_csv(path)
    for row_no, r in df.iterrows():
        where = f"{rel(path)}:{row_no}"
        end = str(r["Self-ext or flow term"]).strip()
        if end not in ("SE", "FT"):
            res.skip(where, f"pas de flamme établie (« {end} »)")
            continue
        fuel_raw = str(r["Fuel"]).strip()
        fuel = fuel_raw.split()[-1]
        flags = list(ISS_FLAGS)
        comment = "" if is_blank(r["Comments"]) else str(r["Comments"])
        if end == "FT" and re.search(r"(?i)limit", comment):
            flags.append("terminated_by_burner_temperature_limit")
        _add(
            res, where,
            experiment_id=f"PSI-159-N-{str(r['Test']).replace(' ', '')}-{row_no}",
            source_id="PSI-159", dataset="PSI-159-normal",
            provenance_file=rel(path), provenance_row=int(row_no),
            platform="iss", gravity_g=0.0,
            o2_mole_fraction=float(r["XO2 before test"]),
            pressure_kpa=float(r["approx p (bar)"]) * BAR_KPA,
            diluent="N2", fuel=fuel, fuel_type="gas", geometry="normal_jet_flame",
            extra={
                "fuel_mole_fraction": float(r["Xf"]),
                "fuel_flow_mg_s": float(r["mHC (mg/s)"]),
            },
            outcome_type="extinction" if end == "SE" else "sustained",
            outcome_value=None,
            is_measured=True,
            extinction_criterion="SE : extinction spontanée ; FT : débit coupé, flamme présente",
            quality_flags=flags,
            notes=(f"combustible « {fuel_raw} » ; durée de combustion {r['burn time (sec)']} s"
                   + (f" ; {comment}" if comment else "")),
        )
    return res


# --------------------------------------------------------------------------- #
# PSI-10 ACME Flame Design — conditions seulement (carte)
# --------------------------------------------------------------------------- #

def import_psi10() -> ImportResult:
    """Le tableau ne contient aucun résultat : lignes descriptives pour la carte."""
    res = ImportResult("PSI-10", sources=[SOURCES["PSI-10"]])
    path = raw_path("PSI-10", "PSI-10_Experimental table_Flame Design_Normal Flame.csv")
    df = read_csv(path)
    for row_no, r in df.iterrows():
        where = f"{rel(path)}:{row_no}"
        o2, p = _f(r["XO2 (init)"]), _f(r["pmean (atm)"])
        if o2 is None or p is None:
            res.skip(where, "O2 ou pression absents")
            continue
        _add(
            res, where,
            experiment_id=f"PSI-10-N-{r['Test']}-{row_no}", source_id="PSI-10",
            dataset="PSI-10-normal", provenance_file=rel(path), provenance_row=int(row_no),
            platform="iss", gravity_g=0.0, o2_mole_fraction=o2, pressure_kpa=p * ATM_KPA,
            fuel=str(r["Fuel"]), fuel_type="gas", geometry="normal_jet_flame",
            outcome_type="descriptive", is_measured=True, quality_flags=list(ISS_FLAGS),
            notes="Conditions d'essai seulement : le tableau PSI ne donne pas de résultat.",
        )
    return res


# --------------------------------------------------------------------------- #
# PSI-69 FLEX — gouttelettes : extinction ou combustion complète
# --------------------------------------------------------------------------- #

def import_psi69() -> ImportResult:
    """Extinction → extinction ; Completion → sustained ; Disruption (goutte
    éclatée) → descriptive (issue non interprétable comme extinction)."""
    res = ImportResult("PSI-69", sources=[SOURCES["PSI-69"]])
    path = raw_path("PSI-69", "PSI-69_Experimental table_FLEX.csv")
    df = read_csv(path)
    col = {c.split(";")[0].strip(): c for c in df.columns}
    for row_no, r in df.iterrows():
        where = f"{rel(path)}:{row_no}"
        end = str(r["Test end"]).strip()
        outcome = {"Extinction": "extinction", "Completion": "sustained"}.get(end, "descriptive")
        co2 = _f(r[col["CO initial ambient composition"]]) or 0.0
        he = _f(r[col["He initial ambient composition"]]) or 0.0
        diluent = "CO2" if co2 > 0 else "He" if he > 0 else "N2"
        p_mmhg = _f(r[col["Ambient pressure"]])
        if not p_mmhg or p_mmhg <= 0:
            res.skip(where, f"pression ambiante impossible ({p_mmhg} mmHg)")
            continue
        d0 = _f(r[col["Droplet initial diameter"]])
        extra = {"co2_mole_fraction": co2, "he_mole_fraction": he}
        if d0 is not None:
            extra["droplet_d0_mm"] = d0
        _add(
            res, where,
            experiment_id=f"PSI-69-{r['FLEX Test #']}", source_id="PSI-69", dataset="PSI-69",
            provenance_file=rel(path), provenance_row=int(row_no), platform="iss", gravity_g=0.0,
            o2_mole_fraction=_f(r[col["O initial ambient composition"]]),
            pressure_kpa=p_mmhg * MMHG_KPA,
            diluent=diluent, fuel=str(r["Fuel"]).lower(), fuel_type="liquid_droplet",
            geometry="free_droplet", extra=extra,
            outcome_type=outcome, outcome_value=end if outcome == "descriptive" else None,
            is_measured=True, quality_flags=list(ISS_FLAGS),
            extinction_criterion="Fin d'essai déclarée : Extinction / Completion / Disruption",
            notes=f"diamètre d'extinction visible {r[col['Visible flame extinction diameter']]} mm",
        )
    return res


# --------------------------------------------------------------------------- #
# PSI-39 CFI — flamme froide après extinction de la flamme chaude
# --------------------------------------------------------------------------- #

def import_psi39() -> ImportResult:
    """Classeur « CFI_DataSummary » : feuille Master (conditions) + DATA (résultats).

    Résultat : flamme froide établie (kcool renseignée) → sustained, avec
    outcome_value="cool_flame" ; pas de flamme froide → extinction.
    Seuls les essais dont l'analyse est terminée (« Completed Analysis? » = Yes)
    sont classés ; les autres sont écartés.
    """
    res = ImportResult("PSI-39", sources=[SOURCES["PSI-39"]])
    path = raw_path("PSI-39", "CFI_DataSummary_Spreadsheet_Jan2021.xlsx")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        m = pd.read_excel(path, sheet_name="Master Sheet")
        d = pd.read_excel(path, sheet_name="DATA")
    for t in (m, d):
        t.columns = [re.sub(r"\s+", " ", str(c)).strip() for c in t.columns]
        t.index = t.index + 2  # ligne Excel
    m = m.dropna(subset=["Flex Number"])
    d = d.dropna(subset=["Flex Number"]).set_index("Flex Number", drop=False)
    for row_no, r in m.iterrows():
        where = f"{rel(path)}#Master Sheet:{row_no}"
        flex = r["Flex Number"]
        if flex not in d.index:
            res.skip(where, "absent de la feuille DATA")
            continue
        dr = d.loc[flex]
        if isinstance(dr, pd.DataFrame):
            res.skip(where, "numéro FLEX en double dans DATA")
            continue
        if str(dr["Completed Analysis?"]).strip() != "Yes":
            res.skip(where, "analyse non terminée")
            continue
        p_atm = _f(r["Pressure"])
        cool = not is_blank(dr["kcool ( mm^2/s )"])
        d0 = _f(dr["D0 ( mm )"])
        extra = {"he_mole_fraction": float(r["Helium"])}
        if d0 is not None:
            extra["droplet_d0_mm"] = d0
        _add(
            res, where,
            experiment_id=f"PSI-39-{str(flex).strip()}", source_id="PSI-39", dataset="PSI-39",
            provenance_file=rel(path), provenance_row=int(row_no), platform="iss", gravity_g=0.0,
            o2_mole_fraction=float(r["Oxygen"]), pressure_kpa=p_atm * ATM_KPA,
            diluent="He" if float(r["Helium"]) > 0 else "N2",
            fuel=str(r["Fuel"]).strip(), fuel_type="liquid_droplet",
            geometry="tethered_droplet" if str(r["Fiber"]).strip() == "Yes" else "free_droplet",
            extra=extra,
            outcome_type="sustained" if cool else "extinction",
            outcome_value="cool_flame" if cool else "no_cool_flame",
            is_measured=True, quality_flags=list(ISS_FLAGS),
            extinction_criterion="Flamme froide = vitesse de combustion kcool mesurée après "
                                 "extinction de la flamme chaude (feuille DATA)",
            notes=None if is_blank(dr["kcool ( mm^2/s )"]) else f"kcool {dr['kcool ( mm^2/s )']} mm²/s",
        )
    return res


# --------------------------------------------------------------------------- #
# Saffire I, II, III — grands échantillons dans un Cygnus
# --------------------------------------------------------------------------- #

def _saffire_material(raw, previous: str | None) -> tuple[str | None, list[str]]:
    if is_blank(raw):
        # Cellule fusionnée dans la source : le matériau est celui de la ligne précédente.
        return previous, ["material_from_merged_cell"]
    return str(raw).strip(), []


def import_saffire() -> ImportResult:
    """Saffire-II fournit pour chaque échantillon le résultat en microgravité ET
    à 1 g (essai au sol) : deux lignes par échantillon, même matériau.

    Microgravité : longueur brûlée « ~ 0 » → extinction ; sinon sustained.
    1 g : « Complete » ou longueur > 0 → sustained ; « ~ 0 » → extinction.
    """
    res = ImportResult("Saffire", sources=[SOURCES[s] for s in ("PSI-98", "PSI-99", "PSI-100")])

    # Saffire-I et III : tissu SIBAL, flamme entretenue (durées de combustion longues)
    for sid, fname, o2col in (
        ("PSI-98", "PSI-98_Experimental table_SAFFIRE-1.csv", "Percent O2"),
        ("PSI-100", "PSI-100_Experimental table_SAFFIRE-3.csv", None),
    ):
        path = raw_path(sid, fname)
        df = read_csv(path)
        for row_no, r in df.iterrows():
            where = f"{rel(path)}:{row_no}"
            if not str(r["Sample Number"]).strip().startswith("S"):
                res.skip(where, "ligne de visualisation d'écoulement")
                continue
            o2 = parse_number(r[o2col]) if o2col else None
            flow = parse_number(r[[c for c in df.columns if c.startswith("Air Flow")][0]])
            direction = str(r[[c for c in df.columns if c.startswith("Flow Direction") or c == "Direction"][0]]).strip()
            flags = list(ISS_FLAGS) + list(o2.flags if o2 else ()) + list(flow.flags)
            burn = parse_number(r["Burn Time (s)"]) if "Burn Time (s)" in df else None
            _add(
                res, where,
                experiment_id=f"{sid}-{str(r['Sample Number']).strip()}", source_id=sid,
                dataset="saffire", provenance_file=rel(path), provenance_row=int(row_no),
                platform="iss", gravity_g=0.0,
                o2_mole_fraction=(o2.value / 100) if o2 and o2.value else None,
                flow_velocity_cm_s=flow.value, fuel=str(r["Material"]).strip(), fuel_type="solid",
                geometry=f"fabric_sheet_{direction.lower()}",
                outcome_type="sustained" if (burn is None or (burn.value or 0) > 0) else "extinction",
                is_measured=True, quality_flags=flags + ["platform_cygnus_vehicle"],
                notes=(f"durée de combustion {burn.value:g} s" if burn and burn.value else
                       "échantillon de 94 × 40,6 cm brûlé ; durée non tabulée"),
            )

    path = raw_path("PSI-99", "PSI-99_Experimental table_SAFFIRE-2.csv")
    df = read_csv(path)
    mat_prev: str | None = None
    for row_no, r in df.iterrows():
        where = f"{rel(path)}:{row_no}"
        sample = str(r["Sample Number"]).strip()
        if not re.fullmatch(r"2-\d", sample):
            res.skip(where, "ligne de note ou de visualisation")
            continue
        mat, mflags = _saffire_material(r["Material"], mat_prev)
        mat_prev = mat
        if mat and "&" in mat:
            mflags.append("mixed_sample_pmma_burned_nomex_not_ignited")
        o2 = parse_number(r["Percent O2 (Note 1)"])
        flow = parse_number(r["Air Flow (cm/s)"])
        thick_raw = str(r["Samle Thickness"]).strip()
        flags = mflags + list(o2.flags) + list(flow.flags)
        if thick_raw.startswith("037"):
            flags.append("thickness_typo_in_source_037mm")
        direction = str(r["Flow Direction"]).strip().lower()
        ug_len = str(r["?-g Burn Length"]).strip()
        g1_len = str(r["1-g Burn Length"]).strip()
        common = dict(
            source_id="PSI-99", dataset="saffire", provenance_file=rel(path),
            provenance_row=int(row_no), o2_mole_fraction=o2.value / 100 if o2.value else None,
            fuel=mat, fuel_type="solid", geometry=f"sheet_5cm_{direction}",
            extra={"thickness_raw": thick_raw}, is_measured=True,
        )
        ug_ext = ug_len.startswith("~ 0") or ug_len == "~0"
        _add(
            res, where, experiment_id=f"PSI-99-{sample}-ug", platform="iss", gravity_g=0.0,
            flow_velocity_cm_s=flow.value,
            outcome_type="extinction" if ug_ext else "sustained",
            outcome_value=ug_len, outcome_unit="burn_length_text",
            quality_flags=flags + ISS_FLAGS + ["platform_cygnus_vehicle"],
            notes=f"microgravité, longueur brûlée « {ug_len} », vitesse « {r['?-g Spread Length']} »",
            **common,
        )
        if "Nomex" in g1_len or "n/a" in g1_len:
            res.skip(where + " (1 g)", "résultat 1 g mixte PMMA/Nomex non classable")
            continue
        g1_ext = g1_len.startswith("~ 0")
        # L'O2 du tableau est mesuré en orbite (note 1) : il ne s'applique pas à l'essai au sol.
        common_1g = {**common, "o2_mole_fraction": None}
        _add(
            res, where, experiment_id=f"PSI-99-{sample}-1g", platform="ground", gravity_g=1.0,
            outcome_type="extinction" if g1_ext else "sustained",
            outcome_value=g1_len, outcome_unit="burn_length_text",
            quality_flags=flags + ["ground_reference_test"],
            notes=f"essai au sol à 1 g, longueur brûlée « {g1_len} », propagation « {r['1-g Spread Rate']} »",
            **common_1g,
        )
    return res


# --------------------------------------------------------------------------- #
# PSI-101 SAME-R — taille des particules de fumée en microgravité
# --------------------------------------------------------------------------- #

def import_psi101() -> ImportResult:
    """Feuille « Reduced data sheet » du classeur combiné SAME / SAME-R.

    Résultat (régression) : diamètre de masse moyenne des particules (µm), qui
    conditionne la réponse des détecteurs (les détecteurs optiques voient mal
    les très petites particules). Le DBP est un aérosol d'étalonnage : écarté.
    Une valeur 0 signifie absence de mesure : écartée.
    Entrées : matériau, vitesse d'entrée d'air, rapport de chauffe Rt/R0,
    durée de vieillissement de la fumée.
    """
    res = ImportResult("PSI-101", sources=[SOURCES["PSI-101"]])
    path = raw_path("PSI-101", "Combined SAMER Results 06 02 14.xlsx")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        df = pd.read_excel(path, sheet_name="Reduced data sheet", header=1)
    df.columns = [re.sub(r"\s+", " ", str(c)).strip() for c in df.columns]
    df.index = df.index + 3  # en-tête en ligne 2 du classeur
    flight_col = df.columns[0]
    target = "Diameter of Average mass (micro-m)"
    for row_no, r in df.iterrows():
        where = f"{rel(path)}#Reduced data sheet:{row_no}"
        mat = r["Sample Type"]
        if is_blank(mat):
            continue
        mat = str(mat).strip()
        if mat == "DBP":
            res.skip(where, "DBP : aérosol d'étalonnage")
            continue
        val = _f(r[target])
        if val is None or val <= 0:
            res.skip(where, "diamètre absent ou nul")
            continue
        flight = str(r[flight_col]).strip()
        aging = _f(r["Net Aging Duration"])
        extra = {"heating_ratio_rt_r0": float(r["Rt/R0"])}
        if aging is not None:
            extra["aging_s"] = aging
        _add(
            res, where,
            experiment_id=f"PSI-101-{flight}-{r['SAME #']}-{row_no}", source_id="PSI-101",
            dataset="PSI-101", provenance_file=rel(path), provenance_row=int(row_no),
            platform="iss", gravity_g=0.0,
            flow_velocity_cm_s=float(r["Inlet Velocity (cm/sec)"]),
            fuel=mat.lower(), fuel_type="solid", geometry="heated_sample_smoke", extra=extra,
            outcome_type="detector_signal", outcome_value=float(val), outcome_unit="um_mass_mean_diameter",
            is_measured=True, quality_flags=list(ISS_FLAGS),
            notes=f"campagne {'SAME' if flight == '1' else 'SAME-R' if flight == '2' else flight} ; {r['Description']}",
        )
    return res


# --------------------------------------------------------------------------- #
# PSI-26 BASS / PSI-25 BASS-II — descriptif (carte, catalogue)
# --------------------------------------------------------------------------- #

def import_bass() -> ImportResult:
    """Pas de résultat structuré : lignes descriptives avec matériau et O2."""
    res = ImportResult("BASS", sources=[SOURCES["PSI-26"], SOURCES["PSI-25"]])
    path = raw_path("PSI-25", "PSI-25_Experimental table_BASS-II.csv")
    df = read_csv(path)
    o2col = [c for c in df.columns if c.startswith("Calibrated initial O2")][0]
    for row_no, r in df.iterrows():
        where = f"{rel(path)}:{row_no}"
        o2 = _f(r[o2col])
        if is_blank(r["Test #"]) or o2 is None:
            res.skip(where, "essai sans numéro ou sans O2")
            continue
        _add(
            res, where, experiment_id=f"PSI-25-{r['Test #']}-{row_no}", source_id="PSI-25",
            dataset="BASS", provenance_file=rel(path), provenance_row=int(row_no),
            platform="iss", gravity_g=0.0, o2_mole_fraction=o2 / 100,
            fuel=str(r["Fuel Sample Material"]).strip(), fuel_type="solid",
            outcome_type="descriptive", is_measured=True, quality_flags=list(ISS_FLAGS),
            notes="Résultat non tabulé (voir BASS-II Summary Report).",
        )
    return res


ALL = [import_psi159, import_psi10, import_psi69, import_psi39, import_saffire, import_psi101, import_bass]
