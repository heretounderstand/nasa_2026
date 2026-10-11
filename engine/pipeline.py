"""Pipeline complet : import → jeux d'analyse → modèles → réponses du moteur.

    python -m engine.pipeline

Sorties dans data/processed/ :
- experiments.csv        toutes les expériences au schéma commun (carte, preuves)
- sources.json           catalogue des sources (annexe)
- import_report.json     lignes écartées et raison, par jeu
- answers.json           sorties `Answer` des 6 scénarios × 4 contextes calculés
- dashboard.json         tout ce qu'il faut au front-end (carte, scénarios, priorités)
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import pandas as pd

from engine.confidence import assess
from engine.contexts import CONTEXTS, effective_conditions
from engine.datasets import QUESTIONS, build, to_frame
from engine.importers.manual import import_manual
from engine.importers.psi import ALL as PSI_IMPORTERS
from engine.importers.sources import SOURCES
from engine.models import fit_and_predict
from engine.scenarios import SCENARIOS
from engine.schema import Confidence

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "processed"
WEB_DATA = ROOT / "web" / "data"

CONF_RANK = {c: i for i, c in enumerate(
    [Confidence.TRES_FAIBLE, Confidence.FAIBLE, Confidence.MOYENNE, Confidence.ELEVEE])}

# Essais à venir (marqueurs de la carte). Ferkul, LPSC 2026, p. 10 : 4 essais FM2
# à 8,2 psia, 37 / 33 / 29 / 25 % O2, en gravité lunaire.
UPCOMING = [
    {"id": f"FM2-test{i}", "source_id": "fm2", "gravity_g": 0.165, "o2_mole_fraction": o2,
     "pressure_kpa": round(8.2 * 6.894757, 1),
     "provenance": "articles/Ferkul-Lunar and Planetary Science Conf 2026 v2.pdf, p. 10"}
    for i, o2 in enumerate((0.37, 0.33, 0.29, 0.25), start=1)
]


def import_all():
    results = [fn() for fn in PSI_IMPORTERS] + [import_manual()]
    experiments = [e for r in results for e in r.experiments]
    report = {
        r.dataset: {"imported": len(r.experiments), "skipped": len(r.skipped),
                    "reasons": dict(Counter(reason for _, reason in r.skipped)),
                    "skipped_rows": [{"where": w, "reason": why} for w, why in r.skipped]}
        for r in results
    }
    return experiments, report


def _x_dict(cond) -> dict:
    d = cond.model_dump(mode="json")
    extra = d.pop("extra") or {}
    d.update({f"extra.{k}": v for k, v in extra.items()})
    return d


def run() -> dict:
    experiments, report = import_all()
    df = to_frame(experiments)
    sets = build(df)

    answers, fit_reports = [], {}
    for sdef in SCENARIOS:
        q = QUESTIONS[sdef.question_type]
        for ctx in CONTEXTS.values():
            if not ctx.computed:
                continue
            scenario = sdef.for_context(ctx.context_id)
            d = sets[sdef.question_type]
            if sdef.match_fuel and scenario.params.fuel:
                d = d[d["fuel"].str.lower() == scenario.params.fuel.lower()].reset_index(drop=True)
            x = _x_dict(effective_conditions(ctx, scenario.params))
            model, fit = fit_and_predict(d, q.task, q.model_features, x)
            ans = assess(scenario, ctx, d, q.task, model)
            if model is None:
                ans.gaps.append(f"Pas de modèle : {fit.reason_no_model}.")
            fit_reports[f"{sdef.scenario_id}/{ctx.context_id}"] = fit.__dict__
            answers.append(ans)

    priorities = []
    for a in answers:
        sdef = next(s for s in SCENARIOS if s.scenario_id == a.scenario_id)
        knowledge = CONF_RANK[a.confidence]
        priorities.append({
            "scenario_id": a.scenario_id, "context_id": a.context_id,
            "risk_level": sdef.risk_level, "knowledge_rank": knowledge,
            "confidence": a.confidence.value,
            "blind_spot": sdef.risk_level == 3 and knowledge <= 1,
            "next_study": a.gaps[0] if a.gaps else None,
        })
    priorities.sort(key=lambda p: (-p["risk_level"], p["knowledge_rank"], p["scenario_id"], p["context_id"]))

    OUT.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT / "experiments.csv", index=False)
    (OUT / "sources.json").write_text(
        json.dumps([s.model_dump(mode="json") for s in SOURCES.values()], indent=2, ensure_ascii=False),
        encoding="utf-8")
    (OUT / "import_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    answers_json = [a.model_dump(mode="json") for a in answers]
    (OUT / "answers.json").write_text(json.dumps(answers_json, indent=2, ensure_ascii=False), encoding="utf-8")

    map_points = df[["experiment_id", "source_id", "dataset", "platform", "gravity_g", "gravity_regime",
                     "o2_mole_fraction", "pressure_kpa", "flow_velocity_cm_s", "fuel", "outcome_type",
                     "is_measured", "provenance_file", "provenance_row", "provenance_page"]]
    dashboard = {
        "disclaimer": "Outil d'exploration et de pédagogie, pas un outil de décision de vol.",
        "contexts": [c.model_dump(mode="json") for c in CONTEXTS.values()],
        "questions": {k: v.__dict__ for k, v in QUESTIONS.items()},
        "scenarios": [{**s.__dict__, "assumptions": list(s.assumptions)} for s in SCENARIOS],
        "answers": answers_json,
        "fits": fit_reports,
        "priorities": priorities,
        "experiments": json.loads(map_points.to_json(orient="records")),
        "upcoming": UPCOMING,
        "sources": [s.model_dump(mode="json") for s in SOURCES.values()],
        "evidence_details": _evidence_details(df, answers),
        "limit_band": _limit_band(df),
    }
    text = json.dumps(dashboard, indent=1, ensure_ascii=False)
    (OUT / "dashboard.json").write_text(text, encoding="utf-8")
    # Copie lisible par le front-end, y compris ouvert en file:// (pas de fetch).
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    (WEB_DATA / "dashboard.js").write_text("window.DASHBOARD = " + text + ";\n", encoding="utf-8")
    return dashboard


def _limit_band(df: pd.DataFrame) -> dict:
    """Limite d'inflammabilité de la carte : PMMA, Olson et al. 2024 (figure lue
    dans Ferkul LPSC 2026 p. 20). Pour chaque niveau de gravité : O2 maximal
    où la flamme s'est éteinte et O2 minimal où elle a tenu ; la limite est
    entre les deux (bande d'incertitude)."""
    pts = df[df["source_id"] == "olson2024_pmma"]
    levels = []
    for g, grp in pts.groupby("gravity_g"):
        ext = grp[grp["outcome_type"] == "extinction"]["o2_mole_fraction"]
        ok = grp[grp["outcome_type"] == "sustained"]["o2_mole_fraction"]
        if ext.empty or ok.empty:
            continue
        lo, hi = sorted((float(ext.max()), float(ok.min())))
        levels.append({"gravity_g": float(g), "low": lo, "high": hi})
    return {
        "material": "PMMA (tige de 1/4 po, combustion ascendante)", "pressure_kpa": 57.6,
        "source_id": "olson2024_pmma",
        "provenance": "articles/Ferkul-Lunar and Planetary Science Conf 2026 v2.pdf, p. 20",
        "flags": ["digitized_from_figure", "short_duration_drop"],
        "levels": levels,
    }


def _evidence_details(df: pd.DataFrame, answers) -> dict:
    """Fiche de chaque expérience citée en preuve (avec les lignes dérivées s2/s6)."""
    ids = {e.experiment_id for a in answers for e in a.evidence}
    by_id = df.set_index("experiment_id")
    out = {}
    for i in ids:
        base = i.removesuffix("-delta")
        if base in by_id.index:
            r = by_id.loc[base]
            out[i] = {k: (None if pd.isna(v) else v) for k, v in r[[
                "source_id", "platform", "gravity_g", "o2_mole_fraction", "pressure_kpa", "fuel",
                "outcome_type", "provenance_file", "provenance_row", "provenance_page", "notes"]].items()}
    return out


if __name__ == "__main__":
    dash = run()
    for a in dash["answers"]:
        m = a["model"]
        print(f"{a['scenario_id']}/{a['context_id']:8s} {a['confidence']:12s} P={a['evidence_axis']:9s} "
              f"A={a['agreement_axis']:7s} plafonds={a['ceilings_applied']} "
              f"modèle={'oui' if m['shown'] else 'non'} obs={a['observations'].get('counts') or {k: a['observations'].get(k) for k in ('min', 'median', 'max')}}")
