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

    def for_context(self, context_id: str) -> Scenario:
        return Scenario(
            scenario_id=self.scenario_id, question=self.question,
            question_type=self.question_type, risk_level=self.risk_level,
            params=Conditions(**self.params), context_id=context_id,
            assumptions=list(self.assumptions),
        )


SCENARIOS: list[ScenarioDef] = [
    ScenarioDef(
        "s6", "Matériau certifié à 1 g, utilisé hors de la Terre",
        "Un matériau qui passe le test de certification à 1 g est-il aussi sûr dans ce contexte ?",
        "limit_shift_vs_1g", 3, {"fuel_type": "solid"},
    ),
    ScenarioDef(
        "s1", "Câble électrique en surchauffe",
        "Si la gaine d'un câble s'enflamme, la flamme peut-elle se propager le long du câble ?",
        "wire_limiting_oxygen", 3, {"fuel": "LDPE", "fuel_type": "solid"},
        ("Gaine en polyéthylène (LDPE), seul isolant testé en gravité partielle dans nos sources.",),
    ),
    ScenarioDef(
        "s2", "Tissu en atmosphère enrichie",
        "Un tissu ou un plastique enflammé continue-t-il de brûler dans cette atmosphère ?",
        "solid_burns", 3, {"fuel_type": "solid"},
    ),
    ScenarioDef(
        "s5", "Fumée : le détecteur la verra-t-il ?",
        "Quelle taille ont les particules de fumée d'une gaine Kapton qui surchauffe ?",
        "smoke_particle_size", 2, {"fuel": "kapton", "fuel_type": "solid"},
        ("Matériau Kapton (isolant de câble courant), choisi pour le scénario.",),
        match_fuel=True,
    ),
    ScenarioDef(
        "s3", "Flamme froide invisible après extinction",
        "Après l'extinction visible d'une goutte de carburant, une flamme froide invisible persiste-t-elle ?",
        "cool_flame_after_extinction", 2,
        {"fuel_type": "liquid_droplet", "diluent": "N2", "extra": {"he_mole_fraction": 0.0}},
        ("Atmosphère sans hélium (air de cabine).",),
    ),
    ScenarioDef(
        "s4", "Fuite de gaz : la flamme s'éteint-elle seule ?",
        "Une flamme sur une fuite de gaz combustible s'éteint-elle d'elle-même ?",
        "gas_flame_self_extinction", 2,
        {"fuel_type": "gas", "extra": {"fuel_mole_fraction": 1.0, "fuel_flow_mg_s": 1.0}},
        ("Gaz pur non dilué (fraction de combustible 1).",
         "Petite fuite : débit de 1 mg/s, valeur médiane des essais ACME CFI-G."),
    ),
]
SCENARIOS_BY_ID = {s.scenario_id: s for s in SCENARIOS}
