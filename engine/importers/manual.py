"""Chargeur du tableau manuel data/manual/partial_gravity.csv."""

from __future__ import annotations

import csv
import json

from pydantic import ValidationError

from engine.importers.common import MANUAL, ImportResult
from engine.importers.sources import SOURCES
from engine.schema import Experiment

PATH = MANUAL / "partial_gravity.csv"
_NUMERIC = ("provenance_row", "provenance_page", "duration_s", "gravity_g", "o2_mole_fraction",
            "pressure_kpa", "flow_velocity_cm_s")


def import_manual() -> ImportResult:
    res = ImportResult("manual")
    used: set[str] = set()
    with PATH.open(encoding="utf-8") as h:
        for line_no, r in enumerate(csv.DictReader(h), start=2):
            kw = {k: v for k, v in r.items() if v != ""}
            for k in _NUMERIC:
                if k in kw:
                    kw[k] = float(kw[k]) if k not in ("provenance_row", "provenance_page") else int(kw[k])
            if "outcome_value" in kw:
                try:
                    kw["outcome_value"] = float(kw["outcome_value"])
                except ValueError:
                    pass
            kw["extra"] = json.loads(kw.get("extra", "{}"))
            kw["quality_flags"] = [f for f in kw.get("quality_flags", "").split(";") if f]
            kw["is_measured"] = kw.get("is_measured", "true").lower() == "true"
            try:
                res.experiments.append(Experiment(**kw))
                used.add(kw["source_id"])
            except ValidationError as e:
                res.skip(f"{PATH.name}:{line_no}", f"validation : {e.errors()[0]['msg']}")
    res.sources = [SOURCES[s] for s in sorted(used)]
    return res
