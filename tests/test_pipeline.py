"""Tests sur les données réelles. Ignorés si data/raw n'est pas présent
(les fichiers PSI ne sont pas versionnés)."""

import json

import pandas as pd
import pytest

from engine.importers.common import RAW, parse_number

pytestmark = pytest.mark.skipif(
    not (RAW / "PSI-159").exists(), reason="données brutes PSI absentes de data/raw"
)


@pytest.fixture(scope="module")
def frame():
    from engine.datasets import to_frame
    from engine.pipeline import import_all
    exps, report = import_all()
    return to_frame(exps), report


@pytest.fixture(scope="module")
def sets(frame):
    from engine.datasets import build
    return build(frame[0])


def test_parse_number():
    assert parse_number("~ 21.5").value == 21.5
    assert "approximate_value" in parse_number("~ 21.5").flags
    assert parse_number("22.1 to 22.0").value == pytest.approx(22.05)
    assert parse_number("20 cm/s").value == 20
    assert parse_number("Insignificant").value is None


def test_every_row_traceable(frame):
    df, _ = frame
    assert df["provenance_file"].notna().all()
    assert (df["provenance_row"].notna() | df["provenance_page"].notna()).all()
    assert df["experiment_id"].is_unique


def test_units_normalised(frame):
    df, _ = frame
    o2 = df["o2_mole_fraction"].dropna()
    assert o2.between(0, 1).all()
    assert df["pressure_kpa"].dropna().between(10, 600).all()  # CFI monte à 5 atm


def test_nothing_dropped_silently(frame):
    _, report = frame
    for r in report.values():
        assert r["skipped"] == len(r["skipped_rows"])


def test_psi159_counts(sets):
    d = sets["gas_flame_self_extinction"]
    assert len(d) == 133
    assert set(d["target"]) == {"extinction", "sustained"}
    assert (d["platform"] == "iss").all()


def test_flex_impossible_pressure_skipped(frame):
    _, report = frame
    assert any("impossible ambient pressure" in r for r in report["PSI-69"]["reasons"])


def test_saffire_ground_rows_have_no_orbit_o2(frame):
    df, _ = frame
    ground = df[df["experiment_id"].str.startswith("PSI-99") & df["experiment_id"].str.endswith("-1g")]
    assert len(ground) == 8
    assert ground["o2_mole_fraction"].isna().all()


def test_limit_shift_matches_published_table(sets):
    """Les ΔO2 recalculés doivent redonner le Tableau I d'Olson & Ferkul (p. 6)."""
    d = sets["limit_shift_vs_1g"].set_index("experiment_id")
    published = {
        "OLSON13-Mylar-Martian_ULOIs-delta": -3.1, "OLSON13-Mylar-Lunar_ULOIs-delta": -5.75,
        "OLSON13-Mylar-0g_ULOIs-delta": -4.1, "OLSON13-Ultem-Martian_ULOIs-delta": -1.7,
        "OLSON13-Ultem-Lunar_ULOIs-delta": -2.8, "OLSON13-Ultem-0g_ULOIs-delta": 0.25,
        "OLSON13-Nomex-Martian_ULOIs-delta": -3.35, "OLSON13-Nomex-Lunar_ULOIs-delta": -2.35,
        "OLSON13-Nomex-0g_ULOIs-delta": -0.3,
    }
    for eid, delta in published.items():
        assert d.loc[eid, "extra.delta_o2_pts"] == pytest.approx(delta, abs=1e-6)


def test_no_post_ignition_feature_in_models():
    from engine.datasets import QUESTIONS
    from engine.schema import check_model_inputs
    for q in QUESTIONS.values():
        check_model_inputs(q.model_features)


def test_pipeline_outputs(tmp_path, monkeypatch):
    from engine import pipeline
    monkeypatch.setattr(pipeline, "OUT", tmp_path)
    dash = pipeline.run()
    answers = json.loads((tmp_path / "answers.json").read_text(encoding="utf-8"))
    assert len(answers) == 6 * 4  # la Terre est une référence, non calculée
    assert {a["context_id"] for a in answers} == {"iss", "gateway", "moon", "mars"}
    for a in answers:
        assert "%" not in a["confidence"]
        if a["prediction"] is not None:
            assert a["model"]["shown"]
            assert a["model"]["cv_score"] is not None and a["model"]["baseline_score"] is not None
        # Gravité partielle sans mesure longue durée : au mieux « faible »
        if a["context_id"] in ("moon", "mars"):
            assert a["confidence"] in ("very_low", "low")
    assert "earth" not in {p["context_id"] for p in dash["priorities"]}
    pd.read_csv(tmp_path / "experiments.csv")
