"""Contextes de mission (CLAUDE.md, section 3)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from engine.schema import Conditions


class MissionContext(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    context_id: str
    label: str
    conditions: Conditions
    computed: bool = True  # False : référence, non calculée par le moteur
    in_priorities: bool = True  # apparaît dans la vue Priorités
    notes: str | None = None


CONTEXTS: dict[str, MissionContext] = {
    c.context_id: c
    for c in (
        MissionContext(
            context_id="earth",
            label="Earth",
            conditions=Conditions(gravity_g=1.0, o2_mole_fraction=0.21, pressure_kpa=101.0),
            computed=False,
            in_priorities=False,
            notes="Reference: the NASA-STD-6001 certification framework.",
        ),
        MissionContext(
            context_id="iss",
            label="ISS",
            conditions=Conditions(gravity_g=0.0, o2_mole_fraction=0.21, pressure_kpa=101.0),
        ),
        MissionContext(
            context_id="gateway",
            label="Gateway",
            conditions=Conditions(gravity_g=0.0, o2_mole_fraction=0.265, pressure_kpa=73.5),
        ),
        MissionContext(
            context_id="moon",
            label="Lunar habitat",
            conditions=Conditions(gravity_g=0.16, o2_mole_fraction=0.34, pressure_kpa=56.5),
        ),
        MissionContext(
            context_id="mars",
            label="Mars habitat",
            conditions=Conditions(gravity_g=0.38),
            notes="Habitat atmosphere not defined (O2 and pressure unknown).",
        ),
    )
}


def effective_conditions(context: MissionContext, params: Conditions) -> Conditions:
    """Conditions du contexte, surchargées par les paramètres explicites du scénario."""
    merged = context.conditions.model_dump(exclude_none=True)
    explicit = params.model_dump(exclude_none=True)
    if "gravity_g" in explicit:
        merged.pop("gravity_regime", None)
    extra = {**merged.get("extra", {}), **explicit.pop("extra", {})}
    merged.update(explicit)
    merged["extra"] = extra
    return Conditions(**merged)
