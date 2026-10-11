"""Modèles par question (CLAUDE.md, section 6).

- Modèles classiques uniquement : régression logistique / ridge, arbre peu profond.
- Validation croisée groupée par condition physique (jamais par ligne).
- Score de référence (classe majoritaire ou moyenne) calculé sur les mêmes plis.
- Prédiction conforme fractionnée sur les prédictions hors pli.
- Le modèle n'utilise que des variables pré-allumage que le scénario renseigne.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import accuracy_score, mean_absolute_error
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from engine.confidence import ModelResult, conformal_quantile
from engine.schema import check_model_inputs

MIN_ROWS = 20
MIN_GROUPS = 3
ALPHA = 0.1  # couverture visée 90 %


@dataclass
class FitReport:
    """Ce qui est affiché à côté du modèle (ou la raison de son absence)."""

    features: list[str]
    n_rows: int
    n_groups: int
    reason_no_model: str | None = None


def _groups(X: pd.DataFrame) -> np.ndarray:
    """Condition physique = valeurs des entrées arrondies à 3 chiffres significatifs."""
    def sig3(v: float) -> float:
        return 0.0 if v == 0 else round(v, -int(math.floor(math.log10(abs(v)))) + 2)
    keys = X.apply(lambda r: tuple(sig3(float(v)) for v in r), axis=1)
    return pd.factorize(keys)[0]


def _candidates(task: str):
    if task == "classification":
        return {
            "régression logistique": lambda: make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)),
            "arbre de décision (profondeur 3)": lambda: DecisionTreeClassifier(max_depth=3, min_samples_leaf=5, random_state=0),
        }
    return {
        "régression ridge": lambda: make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        "arbre de régression (profondeur 3)": lambda: DecisionTreeRegressor(max_depth=3, min_samples_leaf=5, random_state=0),
    }


def fit_and_predict(
    d: pd.DataFrame, task: str, candidate_features: tuple[str, ...], x: dict[str, float]
) -> tuple[ModelResult | None, FitReport]:
    feats = [
        f for f in candidate_features
        if f in d and x.get(f) is not None and d[f].notna().mean() >= 0.8
        and pd.to_numeric(d[f], errors="coerce").nunique() > 1
    ]
    check_model_inputs(feats)
    data = d[feats + ["target"]].copy()
    data[feats] = data[feats].apply(pd.to_numeric, errors="coerce")
    data = data.dropna()
    report = FitReport(feats, len(data), 0)
    if not feats:
        report.reason_no_model = "aucune variable d'entrée commune au scénario et aux données"
        return None, report
    if len(data) < MIN_ROWS:
        report.reason_no_model = f"trop peu d'essais ({len(data)} < {MIN_ROWS})"
        return None, report
    y = data["target"].to_numpy()
    if task == "classification" and len(set(y)) < 2:
        report.reason_no_model = "une seule classe observée"
        return None, report
    X = data[feats]
    groups = _groups(X)
    report.n_groups = int(groups.max() + 1)
    if report.n_groups < MIN_GROUPS:
        report.reason_no_model = f"trop peu de conditions distinctes ({report.n_groups})"
        return None, report

    cv = GroupKFold(n_splits=min(5, report.n_groups))
    folds = list(cv.split(X, y, groups))
    clf = task == "classification"

    def oof(make) -> np.ndarray:
        out = np.empty(len(y), dtype=object if clf else float)
        proba = np.zeros((len(y), len(np.unique(y)))) if clf else None
        classes = np.unique(y)
        for tr, te in folds:
            m = make().fit(X.iloc[tr], y[tr])
            out[te] = m.predict(X.iloc[te])
            if clf:
                p = m.predict_proba(X.iloc[te])
                for j, c in enumerate(m.classes_):
                    proba[te, np.searchsorted(classes, c)] = p[:, j]
        return out, proba

    def score(pred) -> float:
        return accuracy_score(y, pred) if clf else mean_absolute_error(y, pred.astype(float))

    base_pred, _ = oof(lambda: DummyClassifier(strategy="most_frequent") if clf else DummyRegressor())
    baseline = score(base_pred)
    if clf:  # erreur-type d'une proportion
        baseline_se = math.sqrt(baseline * (1 - baseline) / len(y))
    else:  # erreur-type d'une moyenne d'erreurs absolues
        baseline_se = float(np.std(np.abs(y - base_pred.astype(float)), ddof=1) / math.sqrt(len(y)))
    best = None
    for name, make in _candidates(task).items():
        pred, proba = oof(make)
        s = score(pred)
        better = s > best[1] if (best and clf) else s < best[1] if best else True
        if better:
            best = (name, s, make, pred, proba)
    name, cv_score, make, pred, proba = best

    final = make().fit(X, y)
    xq = pd.DataFrame([{f: x[f] for f in feats}])
    prediction = final.predict(xq)[0]
    result = ModelResult(
        name=name, prediction=prediction.item() if hasattr(prediction, "item") else prediction,
        cv_score=round(float(cv_score), 4), baseline_score=round(float(baseline), 4),
        higher_is_better=clf, min_improvement=round(baseline_se, 4),
    )
    if clf:
        classes = np.unique(y)
        scores = 1 - proba[np.arange(len(y)), np.searchsorted(classes, y)]
        q = conformal_quantile(scores, ALPHA)
        p_x = dict(zip(final.classes_, final.predict_proba(xq)[0]))
        result.conformal_set_size = max(1, sum(1 for c in classes if 1 - p_x.get(c, 0) <= q))
    else:
        q = conformal_quantile(np.abs(y - pred.astype(float)), ALPHA)
        result.conformal_rel_width = math.inf if math.isinf(q) or prediction == 0 else 2 * q / abs(float(prediction))
        result.prediction = round(float(prediction), 4)
    return result, report
