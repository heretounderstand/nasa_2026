"""Catalogue des investigations de combustion de PSI.

Récupère les métadonnées publiques (titre, objectif, plateforme…) depuis l'API
du dépôt PSI et les enregistre dans data/manual/psi_catalog.json, versionné :
le pipeline n'a ainsi jamais besoin du réseau.

    python -m engine.importers.psi_catalog
"""

from __future__ import annotations

import datetime as dt
import json
import re
import urllib.request

from engine.importers.common import MANUAL

API = "https://psi.nasa.gov/geode-py/ws/repo/search?q=&data_source=psi&data_type=investigation&size=300"
PAGE = "https://psi.nasa.gov/physci/repo/data/investigations/"
OUT = MANUAL / "psi_catalog.json"


def _clean(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, list):
        v = "; ".join(str(x) for x in v if x)
    v = re.sub(r"<[^>]+>", " ", str(v))
    v = re.sub(r"\s+", " ", v).strip()
    return v or None


def _year(ts) -> int | None:
    try:
        return dt.datetime.fromtimestamp(float(ts), dt.timezone.utc).year
    except (TypeError, ValueError, OSError):
        return None


def fetch() -> list[dict]:
    with urllib.request.urlopen(API, timeout=60) as r:
        hits = json.load(r)["hits"]["hits"]
    out = []
    for h in hits:
        s = h["_source"]
        area = f"{s.get('Research Area')} {s.get('SubResearch Area')}"
        if "ombust" not in area and "ombust" not in str(s.get("Title")):
            continue
        out.append({
            "accession": s["Accession"],
            "acronym": _clean(s.get("Acronym")),
            "title": _clean(s.get("Title")),
            "platform": _clean(s.get("Flight Platform")),
            "sub_area": _clean(s.get("SubResearch Area")),
            "objectives": _clean(s.get("Objectives")),
            "approach": _clean(s.get("Approach")),
            "start_year": _year(s.get("Investigation Start Date")),
            "end_year": _year(s.get("Investigation End Date")),
            "url": PAGE + s["Accession"],
        })
    out.sort(key=lambda x: int(x["accession"].split("-")[1]))
    return out


if __name__ == "__main__":
    items = fetch()
    OUT.write_text(json.dumps(
        {"fetched": dt.date.today().isoformat(), "source": API, "investigations": items},
        indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{len(items)} combustion investigations written to {OUT.name}")
