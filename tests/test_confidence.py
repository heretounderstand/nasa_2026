"""Tests du moteur de confiance.

Les jeux d'expériences ci-dessous sont SYNTHÉTIQUES : ils servent uniquement à
tester la logique du moteur, jamais à produire une valeur affichée.
"""

import itertools

import pytest

from engine import confidence as c
from engine.contexts import CONTEXTS
from engine.schema import (
    AgreementLevel as A,
    Confidence as C,
    EvidenceLevel as P,
    Experiment,
    Scenario,
)


def exp(i, g, o2, kpa=101.0, platform="iss", outcome="extinction", source="src_a"):
    return Experiment(
        experiment_id=f"e{i}", source_id=source, provenance_file="synthetic.csv",
        provenance_row=i, platform=platform, gravity_g=g, o2_mole_fraction=o2,
        pressure_kpa=kpa, outcome_type=outcome, is_measured=platform != "simulation",
    )


def scenario(context_id="iss", **params):
    return Scenario(
        scenario_id="sx", question="?", question_type="test", risk_level=2,
        params=params, context_id=context_id,
    )


def dense_micro_df(outcomes=None, sources=("src_a", "src_b")):
    """Grille dense en microgravité autour de 21 % O2 / 101 kPa."""
    exps = []
    for i, (o2, kpa) in enumerate(itertools.product([0.19, 0.20, 0.21, 0.22, 0.23], [95.0, 101.0, 105.0])):
        out = outcomes(i) if outcomes else "extinction"
        exps.append(exp(i, 0.0, o2, kpa, outcome=out, source=sources[i % len(sources)]))
    return c.experiments_to_frame(exps)


# ----------------------------------------------------------------- matrice --

EXPECTED = {
    (P.LIMITEES, A.FAIBLE): C.TRES_FAIBLE, (P.LIMITEES, A.MOYEN): C.TRES_FAIBLE,
    (P.LIMITEES, A.ELEVE): C.FAIBLE, (P.MOYENNES, A.FAIBLE): C.TRES_FAIBLE,
    (P.MOYENNES, A.MOYEN): C.FAIBLE, (P.MOYENNES, A.ELEVE): C.MOYENNE,
    (P.SOLIDES, A.FAIBLE): C.FAIBLE, (P.SOLIDES, A.MOYEN): C.MOYENNE,
    (P.SOLIDES, A.ELEVE): C.ELEVEE,
}


@pytest.mark.parametrize("p, a", list(EXPECTED))
def test_matrix(p, a):
    assert c.combine(p, a) == EXPECTED[(p, a)]


def test_matrix_is_complete():
    assert set(c.MATRIX) == set(itertools.product(P, A))


# ---------------------------------------------------------------- plafonds --

def test_no_ceiling():
    level, applied = c.apply_ceilings(C.ELEVEE, partial_without_long=False, kappa=0.9, n_sources=3)
    assert level == C.ELEVEE and applied == []


def test_ceiling_partial_gravity():
    level, applied = c.apply_ceilings(C.ELEVEE, partial_without_long=True, kappa=0.9, n_sources=3)
    assert level == C.FAIBLE and applied == [c.CEIL_PARTIAL_NO_LONG]


def test_ceiling_out_of_envelope():
    level, applied = c.apply_ceilings(C.ELEVEE, partial_without_long=False, kappa=0.05, n_sources=3)
    assert level == C.FAIBLE and applied == [c.CEIL_OUT_OF_ENVELOPE]


def test_ceiling_single_source():
    level, applied = c.apply_ceilings(C.ELEVEE, partial_without_long=False, kappa=0.9, n_sources=1)
    assert level == C.MOYENNE and applied == [c.CEIL_SINGLE_SOURCE]


def test_ceilings_never_raise_level():
    level, _ = c.apply_ceilings(C.TRES_FAIBLE, partial_without_long=True, kappa=0.1, n_sources=1)
    assert level == C.TRES_FAIBLE


def test_ceilings_combine_to_strictest():
    level, applied = c.apply_ceilings(C.ELEVEE, partial_without_long=True, kappa=0.9, n_sources=1)
    assert level == C.FAIBLE
    assert set(applied) == {c.CEIL_PARTIAL_NO_LONG, c.CEIL_SINGLE_SOURCE}


def test_model_baseline():
    assert c.ModelResult("m", 1, cv_score=0.8, baseline_score=0.7).beats_baseline()
    assert not c.ModelResult("m", 1, cv_score=0.7, baseline_score=0.7).beats_baseline()
    assert not c.ModelResult("m", 1, cv_score=None, baseline_score=0.7).beats_baseline()
    assert c.ModelResult("m", 1, 0.2, 0.3, higher_is_better=False).beats_baseline()


# ------------------------------------------------------------- composantes --

def test_coverage_inside_vs_outside():
    df = dense_micro_df()
    inside = c.coverage(scenario(o2_mole_fraction=0.21, gravity_g=0.0, pressure_kpa=101.0).params, df)
    outside = c.coverage(scenario(o2_mole_fraction=0.60, gravity_g=0.0, pressure_kpa=30.0).params, df)
    assert 0 < outside.kappa < inside.kappa <= 1
    assert outside.kappa < c.DEFAULT_SETTINGS.kappa_min


def test_coverage_no_features():
    df = dense_micro_df()
    assert c.coverage(scenario(fuel="x").params, df).kappa == 0.0


def test_agreement_classification():
    assert c.agreement_classification(["ext"] * 5, n_classes=2) == pytest.approx(1.0)
    assert c.agreement_classification(["ext", "sus"] * 2, n_classes=2) == pytest.approx(0.0)
    mixed = c.agreement_classification(["ext"] * 4 + ["sus"], n_classes=2)
    assert 0 < mixed < 1


def test_agreement_regression():
    assert c.agreement_regression([2.0, 2.0, 2.0]) == pytest.approx(1.0)
    assert c.agreement_regression([1.0, 2.0, 3.0]) > c.agreement_regression([0.1, 2.0, 9.0])


def test_conformal_quantile_small_sample():
    assert c.conformal_quantile([1.0, 2.0, 3.0], alpha=0.1) == float("inf")
    assert c.conformal_quantile(range(1, 20), alpha=0.1) == 18.0


def test_gravity_status():
    df = dense_micro_df()
    assert c.gravity_status(CONTEXTS["iss"].conditions.gravity_regime, df)[0] == "micro_long"
    assert c.gravity_status(CONTEXTS["lune"].conditions.gravity_regime, df)[0] == "partial_untested"


# --------------------------------------------------------------- de bout en bout --

def test_assess_well_covered_iss():
    ans = c.assess(scenario("iss"), CONTEXTS["iss"], dense_micro_df(), "classification")
    assert ans.confidence == C.ELEVEE
    assert ans.ceilings_applied == []
    assert ans.evidence[0].relevance_rank == 1


def test_assess_disagreement_lowers_confidence():
    df = dense_micro_df(outcomes=lambda i: "extinction" if i % 2 else "sustained")
    ans = c.assess(scenario("iss"), CONTEXTS["iss"], df, "classification")
    assert ans.agreement_axis != A.ELEVE
    assert ans.confidence != C.ELEVEE


def test_assess_lunar_short_duration_capped():
    exps = [exp(i, 0.16, 0.30 + 0.01 * i, 56.5, platform="drop_tower_centrifuge",
                source="src_a" if i % 2 else "src_b") for i in range(8)]
    df = c.experiments_to_frame(exps)
    ans = c.assess(scenario("lune"), CONTEXTS["lune"], df, "classification")
    assert c.CEIL_PARTIAL_NO_LONG in ans.ceilings_applied
    assert ans.confidence in (C.TRES_FAIBLE, C.FAIBLE)
    assert ans.components["gravity_regime"] == "partial_short"
    assert any("FM2" in g for g in ans.gaps)


def test_assess_single_source_capped():
    ans = c.assess(scenario("iss"), CONTEXTS["iss"], dense_micro_df(sources=("only",)), "classification")
    assert ans.confidence == C.MOYENNE
    assert c.CEIL_SINGLE_SOURCE in ans.ceilings_applied


def test_assess_model_below_baseline_hides_prediction():
    model = c.ModelResult("logreg", prediction="extinction", cv_score=0.6, baseline_score=0.7)
    ans = c.assess(scenario("iss"), CONTEXTS["iss"], dense_micro_df(), "classification", model)
    assert ans.prediction is None and not ans.model.shown
    assert c.CEIL_MODEL_BELOW_BASELINE in ans.ceilings_applied


def test_assess_model_above_baseline_shows_prediction():
    model = c.ModelResult("logreg", prediction="extinction", cv_score=0.8, baseline_score=0.7)
    ans = c.assess(scenario("iss"), CONTEXTS["iss"], dense_micro_df(), "classification", model)
    assert ans.prediction == "extinction" and ans.model.shown


def test_assess_earth_is_reference_only():
    with pytest.raises(ValueError):
        c.assess(scenario("terre"), CONTEXTS["terre"], dense_micro_df(), "classification")


def test_assess_mars_reports_missing_atmosphere():
    ans = c.assess(scenario("mars"), CONTEXTS["mars"], dense_micro_df(), "classification")
    assert ans.components["features"] == ["gravity_g"]
    assert any("Atmosphère de l'habitat à définir" in g for g in ans.gaps)
    assert c.CEIL_OUT_OF_ENVELOPE in ans.ceilings_applied
    assert ans.confidence in (C.TRES_FAIBLE, C.FAIBLE)


def test_answer_has_no_percentage():
    ans = c.assess(scenario("iss"), CONTEXTS["iss"], dense_micro_df(), "classification")
    assert isinstance(ans.confidence, C)
    assert "%" not in ans.model_dump_json()


def test_model_must_beat_baseline_by_standard_error():
    m = c.ModelResult("m", 1, cv_score=0.556, baseline_score=0.537, min_improvement=0.068)
    assert not m.beats_baseline()
    m.min_improvement = 0.01
    assert m.beats_baseline()


def test_prediction_hidden_out_of_envelope():
    df = dense_micro_df()
    model = c.ModelResult("logreg", prediction="extinction", cv_score=0.9, baseline_score=0.5)
    far = scenario("iss", o2_mole_fraction=0.60, pressure_kpa=30.0)
    ans = c.assess(far, CONTEXTS["iss"], df, "classification", model)
    assert ans.prediction is None and not ans.model.shown
    assert c.CEIL_OUT_OF_ENVELOPE in ans.ceilings_applied
    assert c.CEIL_MODEL_BELOW_BASELINE not in ans.ceilings_applied


def test_tied_neighbors_all_included():
    """Si seule la gravité est connue (Mars), toutes les expériences équidistantes comptent."""
    df = dense_micro_df()
    ans = c.assess(scenario("mars"), CONTEXTS["mars"], df, "classification")
    assert ans.observations["n"] == len(df)
    assert len(ans.evidence) <= c.MAX_EVIDENCE

