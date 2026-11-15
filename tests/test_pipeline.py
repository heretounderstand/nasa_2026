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
    monkeypatch.setattr(pipeline, "NEXT_DATA", tmp_path / "next")
    dash = pipeline.run()
    answers = json.loads((tmp_path / "answers.json").read_text(encoding="utf-8"))
    assert len(answers) == 7 * 4  # la Terre est une référence, non calculée
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


def test_smoke_scenario_uses_real_detector_signal(sets):
    d = sets["smoke_detector_signal"]
    assert (d["outcome_unit"] == "V_iss_detector_scatter").all()
    assert d["target"].between(0, 7).all()
    # Les signaux au plafond de l'instrument sont signalés, pas masqués.
    at_ceiling = d["quality_flags"].map(lambda f: "at_signal_ceiling" in f)
    assert (d.loc[at_ceiling, "target"] >= 6.2).all() and (d.loc[~at_ceiling, "target"] < 6.2).all()
    assert "dbp" not in set(d["fuel"])


def test_flex_extinction_ratio(sets):
    d = sets["suppressant_extinction"]
    assert len(d) > 150
    # Légèrement au-dessus de 1 possible : flamme éteinte aussitôt, bruit de mesure.
    assert d["target"].between(0, 1.05).all()
    assert set(d["outcome_type"]) <= {"extinction", "sustained"}  # gouttes éclatées exclues


def test_bass_observations_are_verbatim_and_clean(frame):
    df, _ = frame
    obs = df[df["dataset"] == "BASS-observations"]
    assert len(obs) > 100
    assert (obs["outcome_type"] == "descriptive").all()
    assert obs["provenance_row"].notna().all()
    # Le classeur « planned » de PSI-26 contient des identifiants : rien ne doit en sortir.
    assert not obs["notes"].str.contains(r"passw|login|Nasaspi|Monday1", case=False, regex=True).any()
    assert not df["provenance_file"].str.contains("050213").any()


def test_question_specific_features_drive_neighbours(sets):
    """La dose de CO2 du scénario doit compter dans le choix des voisines."""
    from engine import confidence as c
    from engine.schema import Conditions
    d = sets["suppressant_extinction"]
    base = dict(gravity_g=0.0, o2_mole_fraction=0.21, pressure_kpa=101.0)
    feats = ("extra.co2_mole_fraction",)
    hi = c.coverage(Conditions(**base, extra={"co2_mole_fraction": 0.4}), d, extra_features=feats)
    lo = c.coverage(Conditions(**base, extra={"co2_mole_fraction": 0.0}), d, extra_features=feats)
    assert "extra.co2_mole_fraction" in hi.features
    co2 = d["extra.co2_mole_fraction"].astype(float)
    assert co2.loc[hi.neighbor_index].mean() > co2.loc[lo.neighbor_index].mean() + 0.2


def test_comparisons_and_field_notes(tmp_path, monkeypatch):
    from engine import pipeline
    monkeypatch.setattr(pipeline, "OUT", tmp_path)
    monkeypatch.setattr(pipeline, "NEXT_DATA", tmp_path / "next")
    dash = pipeline.run()
    by = {(a["scenario_id"], a["context_id"]): a for a in dash["answers"]}
    smoke = {g["group"]: g for g in by[("s5", "iss")]["observations"]["comparison"]["groups"]}
    assert smoke["kapton"]["median"] < smoke["silicone"]["median"]
    co2 = {g["group"]: g for g in by[("s7", "iss")]["observations"]["comparison"]["groups"]}
    assert co2["CO2 30% or more"]["median"] > co2["no CO2"]["median"]
    for sid in ("s2", "s7"):
        fn = dash["field_notes"][sid]
        assert 0 < len(fn["items"]) <= 6 <= fn["total"] or fn["total"] == len(fn["items"])
        assert all("row" in i["provenance"] for i in fn["items"])


def test_catalog_covers_every_psi_combustion_investigation(frame):
    from engine import catalog
    from engine.scenarios import SCENARIOS_BY_ID
    inv = catalog.investigations(frame[0])["items"]
    assert len(inv) == 24
    assert {i["accession"] for i in inv} == set(catalog.USAGE)
    for i in inv:
        assert set(i["scenarios"]) <= set(SCENARIOS_BY_ID)
        # Une investigation qui alimente un scénario doit avoir des essais importés
        # (PSI-102 : ses essais sont dans le classeur combiné de PSI-101).
        if i["status"] == "scenario" and i["accession"] != "PSI-102":
            assert i["n_imported"] > 0
        if i["status"] == "not_used":
            assert i["n_imported"] == 0
    for item in catalog.INCIDENTS + catalog.SPINOFFS:
        assert item["url"].startswith("https://") and set(item["scenarios"]) <= set(SCENARIOS_BY_ID)


def test_inverse_flames_kept_apart(frame, sets):
    df, _ = frame
    inv = df[df["dataset"] == "PSI-159-inverse"]
    assert len(inv) > 100
    # L'O2 du brûleur n'est pas l'O2 ambiant : jamais dans la colonne commune.
    assert inv["o2_mole_fraction"].isna().all()
    assert inv["extra.oxidizer_o2_mole_fraction"].max() == pytest.approx(0.85)
    assert (sets["gas_flame_self_extinction"]["dataset"] == "PSI-159-normal").all()


def test_profiles_and_habitat_ranking(frame):
    from engine import catalog, profiles
    from engine.contexts import CONTEXTS
    items = catalog.investigations(frame[0])["items"]
    by = {i["accession"]: i for i in items}
    bre = by["PSI-20"]["profile"]
    assert bre["pillar"] == "prevention" and bre["o2_percent"] == [21.0, 40.0]
    # Les valeurs aberrantes du tableau sont signalées, pas corrigées.
    assert any("3400%" in q for q in bre["quality"])
    assert any("autofill" in q for q in by["PSI-21"]["profile"]["quality"])
    assert by["PSI-159"]["profile"]["oxidizer_o2_percent"][1] == 85.0
    assert "CO2 dilution" in by["PSI-69"]["profile"]["varies"]
    ranking = {h["id"]: h for h in profiles.rank_for_habitats(items, CONTEXTS)}
    assert set(ranking) == {"iss", "gateway", "moon", "mars"}
    for h in ranking.values():
        assert len(h["ranking"]) == 24
        for r in h["ranking"]:
            assert r["score"] == r["directness"] + r["oxygen"] + r["gravity"] + r["usable"]
            assert 0 <= r["score"] <= 6
    # Atmosphère martienne inconnue : aucun point « oxygène » ne peut être attribué.
    assert all(r["oxygen"] == 0 for r in ranking["mars"]["ranking"])
    moon = {r["accession"]: r for r in ranking["moon"]["ranking"]}
    assert moon["PSI-22"]["gravity"] == 1 and moon["PSI-69"]["gravity"] == 0

