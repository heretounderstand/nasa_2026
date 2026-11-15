"""Schéma de données commun (CLAUDE.md, section 5).

Toutes les sources (jeux PSI, articles) sont converties vers ces modèles.
Unités normalisées : gravité en g, O2 en fraction molaire (0-1), pression en kPa,
vitesse d'écoulement en cm/s, durées en s.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


# --------------------------------------------------------------------------- #
# Énumérations
# --------------------------------------------------------------------------- #

class SourceKind(StrEnum):
    PSI_DATASET = "psi_dataset"
    ARTICLE = "article"
    REPORT = "report"
    STANDARD = "standard"
    UPCOMING = "upcoming"


class Access(StrEnum):
    OPEN = "open"
    RESTRICTED = "restricted"
    PENDING = "pending"


class Platform(StrEnum):
    ISS = "iss"
    DROP_TOWER = "drop_tower"
    DROP_TOWER_CENTRIFUGE = "drop_tower_centrifuge"
    PARABOLIC_FLIGHT = "parabolic_flight"
    SUBORBITAL_CENTRIFUGE = "suborbital_centrifuge"
    GROUND = "ground"
    SIMULATION = "simulation"
    LUNAR_SURFACE = "lunar_surface"


class GravityRegime(StrEnum):
    MICRO = "micro"
    LUNAR = "lunar"
    MARTIAN = "martian"
    PARTIAL_OTHER = "partial_other"
    EARTH = "earth"


class FuelType(StrEnum):
    GAS = "gas"
    LIQUID_DROPLET = "liquid_droplet"
    SOLID = "solid"


class OutcomeType(StrEnum):
    EXTINCTION = "extinction"
    SUSTAINED = "sustained"
    SPREAD_RATE = "spread_rate"
    LIMIT_O2 = "limit_o2"
    SOOT = "soot"
    DETECTOR_SIGNAL = "detector_signal"
    DESCRIPTIVE = "descriptive"


class Confidence(StrEnum):
    TRES_FAIBLE = "very_low"
    FAIBLE = "low"
    MOYENNE = "medium"
    ELEVEE = "high"


class EvidenceLevel(StrEnum):
    LIMITEES = "limited"
    MOYENNES = "medium"
    SOLIDES = "robust"


class AgreementLevel(StrEnum):
    FAIBLE = "low"
    MOYEN = "medium"
    ELEVE = "high"


# --------------------------------------------------------------------------- #
# Gravité
# --------------------------------------------------------------------------- #

# Bornes de classement d'une valeur de gravité (en g) vers un régime.
# Valeurs nominales : Lune 0,165 g, Mars 0,38 g. Tolérances choisies pour
# englober les essais « en gravité lunaire / martienne » rapportés comme tels.
MICRO_G_MAX = 0.01
LUNAR_G = (0.13, 0.20)
MARTIAN_G = (0.33, 0.43)
EARTH_G = (0.95, 1.05)

PARTIAL_REGIMES = frozenset(
    {GravityRegime.LUNAR, GravityRegime.MARTIAN, GravityRegime.PARTIAL_OTHER}
)


def regime_from_gravity(gravity_g: float) -> GravityRegime:
    """Classe une gravité (en g) dans un régime."""
    if gravity_g < 0:
        raise ValueError("gravity_g doit être positive ou nulle")
    if gravity_g <= MICRO_G_MAX:
        return GravityRegime.MICRO
    if LUNAR_G[0] <= gravity_g <= LUNAR_G[1]:
        return GravityRegime.LUNAR
    if MARTIAN_G[0] <= gravity_g <= MARTIAN_G[1]:
        return GravityRegime.MARTIAN
    if EARTH_G[0] <= gravity_g <= EARTH_G[1]:
        return GravityRegime.EARTH
    return GravityRegime.PARTIAL_OTHER


# --------------------------------------------------------------------------- #
# Conditions physiques (communes à Experiment et Scenario)
# --------------------------------------------------------------------------- #

class Conditions(BaseModel):
    """Variables connues AVANT l'allumage : seules entrées possibles d'un modèle."""

    model_config = ConfigDict(extra="forbid", use_enum_values=False)

    gravity_g: float | None = Field(None, ge=0, le=3)
    gravity_regime: GravityRegime | None = None
    o2_mole_fraction: float | None = Field(None, ge=0, le=1)
    pressure_kpa: float | None = Field(None, gt=0, le=1000)
    flow_velocity_cm_s: float | None = Field(None, ge=0)
    diluent: str | None = None
    fuel: str | None = None
    fuel_type: FuelType | None = None
    geometry: str | None = None
    # Variables pré-allumage propres à un jeu (unité dans le nom de la clé,
    # ex. "fuel_flow_mg_s", "droplet_d0_mm"). Jamais de mesure post-allumage.
    extra: dict[str, float | str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _regime_consistent(self) -> "Conditions":
        if self.gravity_g is None:
            return self
        derived = regime_from_gravity(self.gravity_g)
        if self.gravity_regime is None:
            self.gravity_regime = derived
        elif self.gravity_regime != derived:
            raise ValueError(
                f"gravity_regime={self.gravity_regime} incohérent avec "
                f"gravity_g={self.gravity_g} (attendu {derived})"
            )
        return self


# Règle anti-fuite : colonnes autorisées en entrée de modèle (connues avant
# l'allumage) et colonnes de résultat (mesurées après, interdites en entrée).
PRE_IGNITION_FIELDS: tuple[str, ...] = tuple(Conditions.model_fields)
POST_IGNITION_FIELDS: tuple[str, ...] = ("outcome_type", "outcome_value", "outcome_unit")


def check_model_inputs(columns: list[str] | tuple[str, ...]) -> None:
    """Lève une erreur si une colonne d'entrée de modèle n'est pas pré-allumage.

    Les variables de `Conditions.extra` sont aplaties en colonnes « extra.<clé> ».
    """
    forbidden = [
        c for c in columns
        if c not in PRE_IGNITION_FIELDS and not c.startswith("extra.")
    ]
    if forbidden:
        raise ValueError(f"Colonnes interdites en entrée de modèle : {forbidden}")


# --------------------------------------------------------------------------- #
# Modèles principaux
# --------------------------------------------------------------------------- #

class Source(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_id: str
    title: str
    kind: SourceKind
    reference: str | None = None
    year: int | None = Field(None, ge=1950, le=2100)
    access: Access


class Experiment(Conditions):
    """Un essai ou une condition. Toute valeur doit être traçable (provenance)."""

    experiment_id: str
    source_id: str
    dataset: str | None = None

    provenance_file: str = Field(min_length=1)
    provenance_row: int | None = Field(None, ge=0)
    provenance_page: int | None = Field(None, ge=1)

    platform: Platform
    duration_s: float | None = Field(None, gt=0)

    outcome_type: OutcomeType
    outcome_value: float | bool | str | None = None
    outcome_unit: str | None = None

    is_measured: bool
    extinction_criterion: str | None = None
    quality_flags: list[str] = Field(default_factory=list)
    notes: str | None = None

    @model_validator(mode="after")
    def _provenance(self) -> "Experiment":
        if self.provenance_row is None and self.provenance_page is None:
            raise ValueError("provenance_row ou provenance_page est obligatoire")
        return self

    @model_validator(mode="after")
    def _simulation_not_measured(self) -> "Experiment":
        if self.platform == Platform.SIMULATION and self.is_measured:
            raise ValueError("Une simulation ne peut pas avoir is_measured=True")
        return self


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario_id: str
    question: str
    question_type: str
    risk_level: int = Field(ge=1, le=3)
    params: Conditions = Field(default_factory=Conditions)
    context_id: str
    # Hypothèses propres au scénario (pas des données) : affichées comme telles.
    assumptions: list[str] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    experiment_id: str
    source_id: str
    relevance_rank: int = Field(ge=1)


class ModelInfo(BaseModel):
    name: str | None = None
    cv_score: float | None = None
    baseline_score: float | None = None
    min_improvement: float | None = None  # gain minimal exigé (erreur-type de la référence)
    shown: bool = False


class Answer(BaseModel):
    """Sortie du moteur. Aucun pourcentage de confiance : niveaux en mots."""

    scenario_id: str
    context_id: str
    prediction: Any = None
    confidence: Confidence
    evidence_axis: EvidenceLevel
    agreement_axis: AgreementLevel
    components: dict[str, Any]
    ceilings_applied: list[str] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    # Ce qu'ont donné les expériences voisines (comptes de classes ou min/médiane/max).
    # Ce sont des données observées, pas une prédiction.
    observations: dict[str, Any] = Field(default_factory=dict)
    gaps: list[str] = Field(default_factory=list)
    model: ModelInfo = Field(default_factory=ModelInfo)
