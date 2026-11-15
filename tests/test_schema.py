import pytest
from pydantic import ValidationError

from engine.contexts import CONTEXTS, effective_conditions
from engine.schema import (
    Conditions,
    Experiment,
    GravityRegime,
    check_model_inputs,
    regime_from_gravity,
)


def make_exp(**overrides):
    base = dict(
        experiment_id="e1",
        source_id="psi159",
        provenance_file="acme.xlsx",
        provenance_row=3,
        platform="iss",
        gravity_g=0.0,
        o2_mole_fraction=0.21,
        pressure_kpa=101.0,
        outcome_type="extinction",
        is_measured=True,
    )
    base.update(overrides)
    return Experiment(**base)


@pytest.mark.parametrize(
    "g, regime",
    [
        (0.0, GravityRegime.MICRO),
        (1e-4, GravityRegime.MICRO),
        (0.16, GravityRegime.LUNAR),
        (0.38, GravityRegime.MARTIAN),
        (1.0, GravityRegime.EARTH),
        (0.6, GravityRegime.PARTIAL_OTHER),
        (0.04, GravityRegime.PARTIAL_OTHER),
    ],
)
def test_regime_from_gravity(g, regime):
    assert regime_from_gravity(g) == regime


def test_regime_derived_when_absent():
    assert make_exp(gravity_g=0.16).gravity_regime == GravityRegime.LUNAR


def test_regime_mismatch_rejected():
    with pytest.raises(ValidationError):
        make_exp(gravity_g=1.0, gravity_regime="micro")


def test_o2_must_be_fraction():
    with pytest.raises(ValidationError):
        make_exp(o2_mole_fraction=21.0)


def test_provenance_required():
    with pytest.raises(ValidationError):
        make_exp(provenance_row=None)
    with pytest.raises(ValidationError):
        make_exp(provenance_file="")
    assert make_exp(provenance_row=None, provenance_page=4).provenance_page == 4


def test_simulation_cannot_be_measured():
    with pytest.raises(ValidationError):
        make_exp(platform="simulation", is_measured=True)
    assert make_exp(platform="simulation", is_measured=False)


def test_unknown_field_rejected():
    with pytest.raises(ValidationError):
        make_exp(foo=1)


def test_anti_leakage():
    check_model_inputs(["gravity_g", "o2_mole_fraction"])
    with pytest.raises(ValueError):
        check_model_inputs(["gravity_g", "outcome_value"])


def test_contexts():
    assert not CONTEXTS["earth"].computed
    assert not CONTEXTS["earth"].in_priorities
    assert CONTEXTS["moon"].conditions.gravity_regime == GravityRegime.LUNAR
    assert CONTEXTS["mars"].conditions.o2_mole_fraction is None


def test_effective_conditions_override():
    x = effective_conditions(CONTEXTS["moon"], Conditions(o2_mole_fraction=0.30, fuel="PMMA"))
    assert x.o2_mole_fraction == 0.30
    assert x.pressure_kpa == 56.5
    assert x.fuel == "PMMA"
    y = effective_conditions(CONTEXTS["moon"], Conditions(gravity_g=0.38))
    assert y.gravity_regime == GravityRegime.MARTIAN
