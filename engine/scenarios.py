"""Les six scénarios de départ (CLAUDE.md, section 3).

Les contextes fournissent gravité, O2 et pression ; le scénario n'ajoute que
ce qui le caractérise. Toute valeur choisie pour le scénario (et non tirée des
données) est listée dans `assumptions` et affichée comme hypothèse.
Niveaux de risque : proposition à valider par l'équipe.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from engine.schema import Conditions, Scenario


@dataclass(frozen=True)
class ScenarioDef:
    scenario_id: str
    title: str
    question: str
    question_type: str
    risk_level: int
    params: dict = field(default_factory=dict)
    assumptions: tuple[str, ...] = ()
    # Restreint le jeu aux essais du même combustible (comparaison pertinente).
    match_fuel: bool = False
    # Comparaison affichée à côté de la réponse : "fuel" (médiane par matériau)
    # ou "co2" (médiane par dose de CO2, même combustible).
    compare: str | None = None

    def for_context(self, context_id: str) -> Scenario:
        return Scenario(
            scenario_id=self.scenario_id, question=self.question,
            question_type=self.question_type, risk_level=self.risk_level,
            params=Conditions(**self.params), context_id=context_id,
            assumptions=list(self.assumptions),
        )


SCENARIOS: list[ScenarioDef] = [
    ScenarioDef(
        "s6", "Material certified at 1 g, used away from Earth",
        "Is a material that passes the 1 g certification test just as safe in this setting?",
        "limit_shift_vs_1g", 3, {"fuel_type": "solid"},
    ),
    ScenarioDef(
        "s1", "Overheating electrical wire",
        "If a wire's insulation ignites, can the flame spread along the wire?",
        "wire_limiting_oxygen", 3, {"fuel": "LDPE", "fuel_type": "solid"},
        ("Polyethylene (LDPE) insulation, the only insulation tested in partial gravity in our sources.",),
    ),
    ScenarioDef(
        "s2", "Fabric in an oxygen-enriched atmosphere",
        "Does a burning fabric or plastic keep burning in this atmosphere?",
        "solid_burns", 3, {"fuel_type": "solid"},
    ),
    ScenarioDef(
        "s5", "Smoke: will the detector see it?",
        "How strong a signal does the ISS smoke detector give for smoke from overheated Kapton insulation?",
        "smoke_detector_signal", 2, {"fuel": "kapton", "fuel_type": "solid"},
        ("Kapton (a common wire insulation), chosen for the scenario.",),
        match_fuel=True, compare="fuel",
    ),
    ScenarioDef(
        "s3", "Invisible cool flame after extinction",
        "After a fuel droplet's visible flame goes out, does an invisible cool flame keep burning?",
        "cool_flame_after_extinction", 2,
        {"fuel_type": "liquid_droplet", "diluent": "N2", "extra": {"he_mole_fraction": 0.0}},
        ("Helium-free atmosphere (cabin air).",),
    ),
    ScenarioDef(
        "s4", "Gas leak: does the flame go out on its own?",
        "Does a flame on a fuel gas leak go out by itself?",
        "gas_flame_self_extinction", 2,
        {"fuel_type": "gas", "extra": {"fuel_mole_fraction": 1.0, "fuel_flow_mg_s": 1.0}},
        ("Pure, undiluted gas (fuel fraction 1).",
         "Small leak: 1 mg/s flow, the median of the ACME CFI-G tests."),
    ),
    ScenarioDef(
        "s7", "Extinguisher: does CO2 put the flame out?",
        "With CO2 released around a burning fuel droplet, how early does the flame go out?",
        "suppressant_extinction", 2,
        {"fuel": "heptane", "fuel_type": "liquid_droplet",
         "extra": {"co2_mole_fraction": 0.3, "he_mole_fraction": 0.0, "droplet_d0_mm": 3.0}},
        ("CO2 makes up 30% of the gas around the fire (a discharged extinguisher).",
         "Heptane, the hydrocarbon fuel tested in FLEX.",
         "3 mm droplet, close to the median of the FLEX tests."),
        match_fuel=True, compare="co2",
    ),
]
SCENARIOS_BY_ID = {s.scenario_id: s for s in SCENARIOS}
