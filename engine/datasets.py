"""Jeux d'analyse : un par question, construits à partir des expériences importées.

Règle du projet : un modèle par question et par jeu, jamais de fusion de toutes
les sources. Les jeux dérivés (s2, s6) gardent la provenance de chaque ligne.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from engine.schema import Experiment

# Écart de limite d'O2 (en points de %) en deçà duquel deux limites sont jugées
# équivalentes : les essais sont menés par pas de 1 % O2 (Olson 2013 p. 7, Konno Fig. 2).
SIMILAR_DELTA_PTS = 0.5


@dataclass(frozen=True)
class Question:
    question_type: str
    task: str  # "classification" | "regression"
    label: str
    target_label: str
    model_features: tuple[str, ...]  # colonnes candidates (pré-allumage uniquement)


QUESTIONS: dict[str, Question] = {q.question_type: q for q in [
    Question("gas_flame_self_extinction", "classification",
             "Une flamme de gaz en microgravité s'éteint-elle seule ?",
             "extinction spontanée / flamme maintenue",
             ("o2_mole_fraction", "pressure_kpa", "extra.fuel_mole_fraction", "extra.fuel_flow_mg_s")),
    Question("cool_flame_after_extinction", "classification",
             "Une flamme froide invisible persiste-t-elle après l'extinction ?",
             "flamme froide / pas de flamme froide",
             ("o2_mole_fraction", "pressure_kpa", "extra.he_mole_fraction", "extra.droplet_d0_mm")),
    Question("smoke_particle_size", "regression",
             "Quelle taille de particules de fumée (diamètre de masse moyenne) ?",
             "diamètre de masse moyenne (µm)",
             ("flow_velocity_cm_s", "extra.heating_ratio_rt_r0", "extra.aging_s")),
    Question("wire_limiting_oxygen", "regression",
             "Sous quelle teneur en O2 la flamme ne se propage-t-elle plus le long d'un câble ?",
             "O2 limite de propagation (fraction molaire)",
             ("gravity_g", "flow_velocity_cm_s")),
    Question("solid_burns", "classification",
             "Un matériau solide (tissu, plastique) continue-t-il de brûler ?",
             "flamme entretenue / extinction",
             ("gravity_g", "o2_mole_fraction", "pressure_kpa")),
    Question("limit_shift_vs_1g", "classification",
             "Le matériau est-il plus inflammable qu'au test de certification à 1 g ?",
             "plus / aussi / moins inflammable qu'à 1 g",
             ("gravity_g", "pressure_kpa")),
]}


def to_frame(experiments: list[Experiment]) -> pd.DataFrame:
    rows = []
    for e in experiments:
        d = e.model_dump(mode="json")
        extra = d.pop("extra") or {}
        for k, v in extra.items():
            d[f"extra.{k}"] = v
        rows.append(d)
    return pd.DataFrame(rows)


# --------------------------------------------------------------------------- #
# Jeux dérivés
# --------------------------------------------------------------------------- #

def _limits_to_burn_rows(lim: pd.DataFrame) -> pd.DataFrame:
    """ULOI* (flamme survivante) → sustained ; MOC*/MOC (extinction) → extinction.
    La ULOI à 1 g (≈ 50 % de réussite) n'est ni l'un ni l'autre : écartée."""
    out = lim[lim["extra.limit_kind"].str.contains("MOC|ULOI\\*", regex=True)].copy()
    out["o2_mole_fraction"] = out["outcome_value"].astype(float)
    out["outcome_type"] = out["extra.limit_kind"].map(lambda k: "extinction" if "MOC" in k else "sustained")
    out["outcome_value"] = None
    out["notes"] = out["notes"] + " (limite convertie en essai : flamme survivante ou éteinte)"
    out["dataset"] = "solid_burn"
    return out


def solid_burn(df: pd.DataFrame) -> pd.DataFrame:
    """s2 : essais où un solide brûle ou s'éteint (Saffire, PMMA 2024, SIBAL lunaire,
    LUCI, limites Olson 2013 converties). Les limites de câbles (Konno) n'y sont
    pas : ce ne sont pas des essais mais des frontières estimées."""
    base = df[(df["dataset"].isin(["saffire", "solid_burn"]))
              & df["outcome_type"].isin(["sustained", "extinction"])]
    conv = _limits_to_burn_rows(df[df["dataset"] == "limits_vs_gravity"])
    return pd.concat([base, conv], ignore_index=True)


def limit_shift(df: pd.DataFrame) -> pd.DataFrame:
    """s6 : écart de limite d'O2 entre un niveau de gravité et le test à 1 g,
    même matériau, même source, même configuration.

    Olson 2013 : ΔO2 = (ULOI* + MOC*)/2 − (ULOI + MOC)/2 (éq. 1, p. 6).
    Konno 2023 : ΔO2 = LOC(g) − LOC(1 g).
    Classe : plus inflammable si ΔO2 < −0,5 pt, moins si > +0,5 pt, sinon équivalent.
    """
    lim = df[df["dataset"].isin(["limits_vs_gravity", "wire_loc"])].copy()
    lim["config"] = (lim["source_id"] + "|" + lim["fuel"] + "|" + lim["geometry"] + "|"
                     + lim["flow_velocity_cm_s"].fillna(-1).astype(str))
    # Pour Olson, la configuration 0 g (écoulement forcé) diffère du 1 g : on compare
    # à la référence 1 g du même matériau, comme le font les auteurs.
    lim.loc[lim["source_id"] == "olson2013_mars", "config"] = (
        "olson2013_mars|" + lim["fuel"])
    rows = []
    for config, grp in lim.groupby("config"):
        ref = grp[grp["gravity_g"] == 1.0]
        if ref.empty:
            continue
        ref_val = ref["outcome_value"].astype(float).mean()
        for g, at_g in grp[grp["gravity_g"] != 1.0].groupby("gravity_g"):
            delta_pts = round((at_g["outcome_value"].astype(float).mean() - ref_val) * 100, 2)
            first = at_g.iloc[0].to_dict()
            cls = ("more_flammable_than_1g" if delta_pts < -SIMILAR_DELTA_PTS
                   else "less_flammable_than_1g" if delta_pts > SIMILAR_DELTA_PTS
                   else "similar_to_1g")
            first.update(
                experiment_id=f"{first['experiment_id']}-delta",
                dataset="limit_shift", outcome_type="limit_o2",
                outcome_value=cls, outcome_unit="class",
                o2_mole_fraction=None,
                notes=(f"ΔO2 = {delta_pts:+.2f} pt par rapport à 1 g "
                       f"(lignes {', '.join(at_g['experiment_id'])} vs {', '.join(ref['experiment_id'])})"),
            )
            first["extra.delta_o2_pts"] = round(delta_pts, 2)
            rows.append(first)
    return pd.DataFrame(rows)


TARGET_FROM = {  # colonne qui porte la cible de chaque question
    "gas_flame_self_extinction": "outcome_type",
    "cool_flame_after_extinction": "outcome_value",
    "smoke_particle_size": "outcome_value",
    "wire_limiting_oxygen": "outcome_value",
    "solid_burns": "outcome_type",
    "limit_shift_vs_1g": "outcome_value",
}


def build(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Jeu d'analyse de chaque question, avec une colonne « target » explicite."""
    sets = {
        "gas_flame_self_extinction": df[df["dataset"] == "PSI-159-normal"].copy(),
        "cool_flame_after_extinction": df[df["dataset"] == "PSI-39"].copy(),
        "smoke_particle_size": df[df["dataset"] == "PSI-101"].copy(),
        "wire_limiting_oxygen": df[df["dataset"] == "wire_loc"].copy(),
        "solid_burns": solid_burn(df),
        "limit_shift_vs_1g": limit_shift(df),
    }
    for qt, d in sets.items():
        d["target"] = d[TARGET_FROM[qt]]
        if QUESTIONS[qt].task == "regression":
            d["target"] = d["target"].astype(float)
        sets[qt] = d.reset_index(drop=True)
    return sets
