"""Moteur de confiance (CLAUDE.md, section 6).

Deux axes inspirés du GIEC, preuves (P) et accord (A), discrétisés en trois
niveaux puis combinés par une matrice, avant application des règles de plafond.
Le résultat est toujours exprimé en mots, jamais en pourcentage.

Tous les seuils et pondérations sont regroupés dans `Settings` : ce sont des
valeurs de départ, à calibrer sur les données réelles et à documenter.
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Iterable

import numpy as np
import pandas as pd

from engine.contexts import MissionContext, effective_conditions
from engine.schema import (
    PARTIAL_REGIMES,
    AgreementLevel,
    Answer,
    Conditions,
    Confidence,
    EvidenceItem,
    EvidenceLevel,
    Experiment,
    GravityRegime,
    ModelInfo,
    Platform,
    Scenario,
)

NUMERIC_FEATURES = ("gravity_g", "o2_mole_fraction", "pressure_kpa", "flow_velocity_cm_s")

# Identifiants des plafonds (repris tels quels dans Answer.ceilings_applied).
CEIL_PARTIAL_NO_LONG = "partial_gravity_no_long_duration"
CEIL_OUT_OF_ENVELOPE = "out_of_data_envelope"
CEIL_SINGLE_SOURCE = "single_source"
CEIL_MODEL_BELOW_BASELINE = "model_below_baseline"

REGIME_FR = {
    GravityRegime.MICRO: "microgravity", GravityRegime.LUNAR: "lunar gravity",
    GravityRegime.MARTIAN: "Martian gravity", GravityRegime.PARTIAL_OTHER: "partial gravity",
    GravityRegime.EARTH: "Earth gravity",
}
MAX_EVIDENCE = 10  # preuves listées ; les observations portent sur toutes les voisines


@dataclass(frozen=True)
class Settings:
    k: int = 5
    # Qualité de source par plateforme : ISS longue durée > tour / vol > simulation.
    platform_quality: dict[Platform, float] = field(
        default_factory=lambda: {
            Platform.ISS: 1.0,
            Platform.LUNAR_SURFACE: 1.0,
            Platform.GROUND: 1.0,
            Platform.SUBORBITAL_CENTRIFUGE: 0.7,
            Platform.DROP_TOWER: 0.6,
            Platform.DROP_TOWER_CENTRIFUGE: 0.6,
            Platform.PARABOLIC_FLIGHT: 0.5,
            Platform.SIMULATION: 0.3,
        }
    )
    # Plateformes considérées comme « longue durée » pour leur régime.
    long_duration_platforms: frozenset[Platform] = frozenset(
        {Platform.ISS, Platform.LUNAR_SURFACE, Platform.GROUND}
    )
    # Pénalité γ selon le statut du régime de gravité du scénario.
    gamma: dict[str, float] = field(
        default_factory=lambda: {"long": 1.0, "short": 0.5, "untested": 0.2}
    )
    # Échelle minimale de standardisation par variable : évite qu'une colonne
    # constante (ex. jeu 100 % microgravité) rende toute extrapolation invisible.
    min_scale: dict[str, float] = field(
        default_factory=lambda: {
            "gravity_g": 0.05, "o2_mole_fraction": 0.01,
            "pressure_kpa": 5.0, "flow_velocity_cm_s": 1.0,
        }
    )
    # Rayon (en multiples de d_ref) pour compter les voisines n.
    neighbor_radius: float = 2.0
    # Axe preuves : score P = κ·γ·w̄, plus un minimum de voisines.
    # Repère : κ = e⁻¹ ≈ 0,37 pour un point aussi bien entouré qu'une
    # expérience typique du jeu (d_k = d_ref).
    evidence_solid: tuple[float, int] = (0.35, 5)
    evidence_medium: tuple[float, int] = (0.15, 3)
    # Axe accord : score A ∈ [0, 1].
    agreement_high: float = 0.75
    agreement_medium: float = 0.45
    # Plafond 2 : κ minimal pour être dans l'enveloppe des données
    # (0,1 ≈ d_k plus de deux fois supérieure à la distance typique).
    kappa_min: float = 0.1


DEFAULT_SETTINGS = Settings()


# --------------------------------------------------------------------------- #
# Conversion
# --------------------------------------------------------------------------- #

def experiments_to_frame(experiments: Iterable[Experiment]) -> pd.DataFrame:
    rows = [e.model_dump(mode="json") for e in experiments]
    return pd.DataFrame(rows)


def target_series(df: pd.DataFrame) -> pd.Series:
    """Cible : colonne « target » si le jeu la définit (cas général, voir
    engine.datasets), sinon outcome_value si renseignée, sinon outcome_type."""
    if "target" in df:
        return df["target"]
    return df["outcome_value"].where(df["outcome_value"].notna(), df["outcome_type"])


# --------------------------------------------------------------------------- #
# Axe preuves
# --------------------------------------------------------------------------- #

@dataclass
class CoverageResult:
    kappa: float
    features: list[str]
    neighbor_index: list[Any]  # index df des k plus proches, du plus proche au plus loin
    neighbor_distances: list[float]
    d_ref: float
    n_within_radius: int


def _xval(x: Conditions, f: str):
    """Valeur d'une variable du scénario ; « extra.<clé> » lit Conditions.extra."""
    if f.startswith("extra."):
        v = x.extra.get(f[6:])
        return v if isinstance(v, (int, float)) else None
    return getattr(x, f)


def coverage(
    x: Conditions, df: pd.DataFrame, settings: Settings = DEFAULT_SETTINGS,
    extra_features: tuple[str, ...] = (),
) -> CoverageResult:
    """κ(x) = exp(−d_k / d_ref) dans l'espace standardisé des paramètres.

    `extra_features` : variables pré-allumage propres à la question (ex. dose
    de CO2), prises en compte quand le scénario les renseigne. Sans elles, les
    voisines seraient choisies sans regarder la variable clé du scénario.
    """
    candidates = list(NUMERIC_FEATURES) + [f for f in extra_features if f.startswith("extra.")]
    features = [
        f for f in candidates
        if _xval(x, f) is not None and f in df and df[f].notna().any()
    ]
    empty = CoverageResult(0.0, features, [], [], float("nan"), 0)
    if not features:
        return empty
    data = df[features].apply(pd.to_numeric, errors="coerce").dropna().astype(float)
    if data.empty:
        return empty

    mean = data.mean()
    floor = pd.Series({f: settings.min_scale.get(f, 0.0) for f in features})
    std = data.std(ddof=0).clip(lower=floor).replace(0, 1.0)
    X = ((data - mean) / std).to_numpy()
    q = ((pd.Series({f: float(_xval(x, f)) for f in features}) - mean) / std).to_numpy()

    d = np.linalg.norm(X - q, axis=1)
    order = np.argsort(d, kind="stable")
    k = min(settings.k, len(d))
    d_k = float(d[order[:k]].mean())
    d_ref = _reference_distance(X, k)

    kappa = math.exp(-d_k / d_ref)
    n_within = int((d <= settings.neighbor_radius * d_ref).sum())
    return CoverageResult(
        kappa=kappa,
        features=features,
        # Les ex æquo de la k-ième distance sont inclus : sinon le choix parmi des
        # expériences équidistantes serait arbitraire (ex. Mars, gravité seule connue).
        neighbor_index=list(data.index[order[: _with_ties(d, order, k)]]),
        neighbor_distances=[float(v) for v in d[order[: _with_ties(d, order, k)]]],
        d_ref=d_ref,
        n_within_radius=n_within,
    )


def _with_ties(d: np.ndarray, order: np.ndarray, k: int) -> int:
    if k == 0:
        return 0
    kth = d[order[k - 1]]
    return int(np.searchsorted(d[order], kth + 1e-9, side="right"))


def _reference_distance(X: np.ndarray, k: int) -> float:
    """Distance typique entre expériences : médiane, sur les expériences, de leur
    distance moyenne aux k plus proches autres expériences (même statistique que d_k)."""
    if len(X) < 2:
        return 1.0
    D = np.linalg.norm(X[:, None, :] - X[None, :, :], axis=2)
    np.fill_diagonal(D, np.inf)
    kk = min(k, len(X) - 1)
    d_typ = np.sort(D, axis=1)[:, :kk].mean(axis=1)
    d_typ = d_typ[d_typ > 0]  # répétitions strictement identiques ignorées
    if d_typ.size == 0:
        return 1.0
    return float(np.median(d_typ))


def gravity_status(
    regime: GravityRegime, df: pd.DataFrame, settings: Settings = DEFAULT_SETTINGS
) -> tuple[str, str]:
    """Retourne (étiquette, statut) ; statut ∈ {long, short, untested}."""
    family = (
        "partial" if regime in PARTIAL_REGIMES
        else "micro" if regime == GravityRegime.MICRO
        else "earth"
    )
    same = df[df["gravity_regime"] == regime.value] if "gravity_regime" in df else df.iloc[0:0]
    if same.empty:
        status = "untested"
    elif same["platform"].isin([p.value for p in settings.long_duration_platforms]).any():
        status = "long"
    else:
        status = "short"
    return f"{family}_{status}", status


def source_quality(platforms: Iterable[str], settings: Settings = DEFAULT_SETTINGS) -> float:
    weights = [settings.platform_quality[Platform(p)] for p in platforms]
    return float(np.mean(weights)) if weights else 0.0


def evidence_level(score: float, n: int, settings: Settings = DEFAULT_SETTINGS) -> EvidenceLevel:
    if score >= settings.evidence_solid[0] and n >= settings.evidence_solid[1]:
        return EvidenceLevel.SOLIDES
    if score >= settings.evidence_medium[0] and n >= settings.evidence_medium[1]:
        return EvidenceLevel.MOYENNES
    return EvidenceLevel.LIMITEES


# --------------------------------------------------------------------------- #
# Axe accord
# --------------------------------------------------------------------------- #

def agreement_classification(labels: Iterable[Any], n_classes: int | None = None) -> float:
    """1 − entropie normalisée des résultats des voisines."""
    counts = Counter(labels)
    total = sum(counts.values())
    k = max(n_classes or 0, len(counts))
    if total == 0:
        return 0.0
    if k <= 1:
        return 1.0
    p = np.array(list(counts.values()), dtype=float) / total
    h = float(-(p * np.log(p)).sum())
    return 1.0 - h / math.log(k)


def agreement_regression(values: Iterable[float]) -> float:
    """1 / (1 + CV) des valeurs des voisines."""
    v = np.asarray(list(values), dtype=float)
    v = v[~np.isnan(v)]
    if v.size == 0:
        return 0.0
    if v.size == 1:
        return 1.0
    mean = abs(v.mean())
    if mean == 0:
        return 0.0
    return 1.0 / (1.0 + float(v.std(ddof=1)) / mean)


def conformal_quantile(scores: Iterable[float], alpha: float) -> float:
    """Quantile conforme fractionné avec correction d'échantillon fini.

    Retourne +inf si l'échantillon est trop petit pour garantir 1 − alpha.
    """
    s = np.sort(np.asarray(list(scores), dtype=float))
    n = s.size
    rank = math.ceil((n + 1) * (1 - alpha))
    if n == 0 or rank > n:
        return math.inf
    return float(s[rank - 1])


def agreement_from_conformal(
    *, set_size: int | None = None, n_classes: int | None = None, rel_width: float | None = None
) -> float | None:
    """Score d'accord tiré de l'intervalle (ou de l'ensemble) conforme."""
    if set_size is not None and n_classes:
        if n_classes <= 1:
            return 1.0
        return 1.0 - (set_size - 1) / (n_classes - 1)
    if rel_width is not None:
        return 0.0 if math.isinf(rel_width) else 1.0 / (1.0 + rel_width)
    return None


def agreement_level(score: float, settings: Settings = DEFAULT_SETTINGS) -> AgreementLevel:
    if score >= settings.agreement_high:
        return AgreementLevel.ELEVE
    if score >= settings.agreement_medium:
        return AgreementLevel.MOYEN
    return AgreementLevel.FAIBLE


# --------------------------------------------------------------------------- #
# Combinaison et plafonds
# --------------------------------------------------------------------------- #

_P, _A, _C = EvidenceLevel, AgreementLevel, Confidence
MATRIX: dict[tuple[EvidenceLevel, AgreementLevel], Confidence] = {
    (_P.LIMITEES, _A.FAIBLE): _C.TRES_FAIBLE,
    (_P.LIMITEES, _A.MOYEN): _C.TRES_FAIBLE,
    (_P.LIMITEES, _A.ELEVE): _C.FAIBLE,
    (_P.MOYENNES, _A.FAIBLE): _C.TRES_FAIBLE,
    (_P.MOYENNES, _A.MOYEN): _C.FAIBLE,
    (_P.MOYENNES, _A.ELEVE): _C.MOYENNE,
    (_P.SOLIDES, _A.FAIBLE): _C.FAIBLE,
    (_P.SOLIDES, _A.MOYEN): _C.MOYENNE,
    (_P.SOLIDES, _A.ELEVE): _C.ELEVEE,
}

_ORDER = [Confidence.TRES_FAIBLE, Confidence.FAIBLE, Confidence.MOYENNE, Confidence.ELEVEE]


def combine(p: EvidenceLevel, a: AgreementLevel) -> Confidence:
    return MATRIX[(p, a)]


def cap(level: Confidence, ceiling: Confidence) -> Confidence:
    return min(level, ceiling, key=_ORDER.index)


def apply_ceilings(
    level: Confidence,
    *,
    partial_without_long: bool,
    kappa: float,
    n_sources: int,
    settings: Settings = DEFAULT_SETTINGS,
) -> tuple[Confidence, list[str]]:
    """Règles 1 à 3. La règle 4 (modèle vs référence) agit sur la prédiction."""
    applied: list[str] = []
    rules = (
        (partial_without_long, Confidence.FAIBLE, CEIL_PARTIAL_NO_LONG),
        (kappa < settings.kappa_min, Confidence.FAIBLE, CEIL_OUT_OF_ENVELOPE),
        (n_sources <= 1, Confidence.MOYENNE, CEIL_SINGLE_SOURCE),
    )
    for triggered, ceiling, name in rules:
        if triggered:
            applied.append(name)
            level = cap(level, ceiling)
    return level, applied


@dataclass
class ModelResult:
    """Résultat d'un modèle entraîné pour une question et un jeu de données."""

    name: str
    prediction: Any
    cv_score: float | None
    baseline_score: float | None
    higher_is_better: bool = True
    conformal_set_size: int | None = None
    conformal_rel_width: float | None = None
    # Écart minimal exigé : erreur-type du score de référence. Un gain plus
    # petit relève du bruit d'échantillonnage (ex. un seul essai sur 54).
    min_improvement: float = 0.0

    def beats_baseline(self) -> bool:
        if self.cv_score is None or self.baseline_score is None:
            return False
        if self.higher_is_better:
            return self.cv_score > self.baseline_score + self.min_improvement
        return self.cv_score < self.baseline_score - self.min_improvement


# --------------------------------------------------------------------------- #
# Point d'entrée
# --------------------------------------------------------------------------- #

def assess(
    scenario: Scenario,
    context: MissionContext,
    df: pd.DataFrame,
    task: str,
    model: ModelResult | None = None,
    settings: Settings = DEFAULT_SETTINGS,
    extra_features: tuple[str, ...] = (),
) -> Answer:
    """Évalue un scénario dans un contexte à partir des expériences d'UN jeu de données.

    task : "classification" ou "regression".
    """
    if not context.computed:
        raise ValueError(f"Context {context.context_id!r} is a reference and is not computed.")
    if task not in ("classification", "regression"):
        raise ValueError("task doit valoir 'classification' ou 'regression'")

    x = effective_conditions(context, scenario.params)
    if x.gravity_regime is None:
        raise ValueError("La gravité du scénario doit être connue.")

    # Preuves
    cov = coverage(x, df, settings, extra_features)
    neighbors = df.loc[cov.neighbor_index]
    gravity_label, status = gravity_status(x.gravity_regime, df, settings)
    gamma = settings.gamma[status]
    w = source_quality(neighbors["platform"], settings) if not neighbors.empty else 0.0
    p_score = cov.kappa * gamma * w
    p_level = evidence_level(p_score, cov.n_within_radius, settings)

    # Accord
    targets = target_series(neighbors) if not neighbors.empty else pd.Series(dtype=object)
    if task == "classification":
        n_classes = target_series(df).nunique() if not df.empty else None
        a_score = agreement_classification(targets, n_classes)
        # L'incertitude conforme ne compte que si le modèle est affiché (règle 4).
        shown_model = model if model is not None and model.beats_baseline() else None
        conf = agreement_from_conformal(
            set_size=shown_model.conformal_set_size if shown_model else None, n_classes=n_classes
        )
    else:
        a_score = agreement_regression(pd.to_numeric(targets, errors="coerce"))
        shown_model = model if model is not None and model.beats_baseline() else None
        conf = agreement_from_conformal(
            rel_width=shown_model.conformal_rel_width if shown_model else None)
    if conf is not None:
        a_score = min(a_score, conf)
    a_level = agreement_level(a_score, settings)

    # Combinaison et plafonds
    n_sources = neighbors["source_id"].nunique() if not neighbors.empty else 0
    partial_without_long = x.gravity_regime in PARTIAL_REGIMES and status != "long"
    level, ceilings = apply_ceilings(
        combine(p_level, a_level),
        partial_without_long=partial_without_long,
        kappa=cov.kappa,
        n_sources=n_sources,
        settings=settings,
    )

    # Règle 4 : pas de prédiction si le modèle ne bat pas la référence
    model_info = ModelInfo()
    prediction = None
    if model is not None:
        # Règle 4 bis (extension de la spécification) : hors de l'enveloppe des
        # données, le modèle extrapole ; seule l'observation des voisines est montrée.
        out_of_envelope = cov.kappa < settings.kappa_min
        shown = model.beats_baseline() and not out_of_envelope
        model_info = ModelInfo(
            name=model.name, cv_score=model.cv_score, baseline_score=model.baseline_score,
            min_improvement=model.min_improvement, shown=shown,
        )
        if shown:
            prediction = model.prediction
        elif not model.beats_baseline():
            ceilings.append(CEIL_MODEL_BELOW_BASELINE)

    gaps = _gaps(x, status, cov, n_sources, model_info, model is not None, settings)
    observations = _observations(neighbors, targets, task)

    evidence = [
        EvidenceItem(experiment_id=row["experiment_id"], source_id=row["source_id"], relevance_rank=i)
        for i, (_, row) in enumerate(neighbors.head(MAX_EVIDENCE).iterrows(), start=1)
    ]

    return Answer(
        scenario_id=scenario.scenario_id,
        context_id=context.context_id,
        prediction=prediction,
        confidence=level,
        evidence_axis=p_level,
        agreement_axis=a_level,
        components={
            "coverage": round(cov.kappa, 3),
            "gravity_regime": gravity_label,
            "gravity_factor": gamma,
            "source_quality": round(w, 3),
            "evidence_score": round(p_score, 3),
            "n_neighbors": cov.n_within_radius,
            "agreement": round(a_score, 3),
            "n_sources": int(n_sources),
            "features": cov.features,
        },
        ceilings_applied=ceilings,
        evidence=evidence,
        observations=observations,
        gaps=gaps,
        model=model_info,
    )


def _observations(neighbors: pd.DataFrame, targets: pd.Series, task: str) -> dict[str, Any]:
    """Résultats observés chez les voisines : données, pas prédiction."""
    if neighbors.empty:
        return {"n": 0}
    obs: dict[str, Any] = {"n": int(len(neighbors))}
    if task == "classification":
        obs["counts"] = {str(k): int(v) for k, v in targets.value_counts().items()}
    else:
        v = pd.to_numeric(targets, errors="coerce").dropna()
        if not v.empty:
            obs.update(min=round(float(v.min()), 4), median=round(float(v.median()), 4),
                       max=round(float(v.max()), 4))
    if "extra.delta_o2_pts" in neighbors:
        obs["delta_o2_pts"] = [float(d) for d in neighbors["extra.delta_o2_pts"]]
    return obs


def _gaps(
    x: Conditions,
    status: str,
    cov: CoverageResult,
    n_sources: int,
    model_info: ModelInfo,
    has_model: bool,
    settings: Settings,
) -> list[str]:
    gaps: list[str] = []
    regime = x.gravity_regime
    regime_fr = REGIME_FR[regime]
    if status == "untested":
        gaps.append(f"No experiment in {regime_fr} for this question.")
    if regime in PARTIAL_REGIMES and status != "long":
        msg = f"No long-duration measurement in {regime_fr}."
        if regime == GravityRegime.LUNAR:
            msg += " First measurement on the Moon expected from FM2 (late 2026)."
        gaps.append(msg)
    missing = [f for f in ("o2_mole_fraction", "pressure_kpa") if getattr(x, f) is None]
    if missing:
        names = {"o2_mole_fraction": "oxygen level", "pressure_kpa": "pressure"}
        gaps.append(f"Habitat atmosphere not yet defined ({', '.join(names[m] for m in missing)}).")
    if cov.kappa < settings.kappa_min:
        gaps.append("Scenario outside the data envelope: no nearby experiment.")
    if n_sources == 1:
        gaps.append("Single source: no independent cross-check.")
    if has_model and not model_info.shown:
        if cov.kappa < settings.kappa_min:
            gaps.append("Prediction hidden: the model would extrapolate beyond the data.")
        else:
            gaps.append("The model does not beat the baseline in validation: only neighbouring experiments are shown.")
    return gaps
