"""Contenu éditorial rattaché aux données : usage de chaque investigation PSI,
incidents réels, retombées sur Terre et ressources officielles du challenge.

Règle : chaque phrase sur un incident ou une retombée reprend ce que dit la
page NASA citée (lue le 2026-11-15), sans ajout de mémoire.
"""

from __future__ import annotations

import json

import pandas as pd

from engine import profiles
from engine.importers.common import MANUAL

# --------------------------------------------------------------------------- #
# Usage de chaque investigation de combustion de PSI
# --------------------------------------------------------------------------- #
# statut : "scenario" (alimente un scénario), "notes" (observations citées),
# "map" (conditions seulement, sur la carte), "profile" (tableau de synthèse
# résumé dans la fiche), "not_used".
USAGE: dict[str, tuple[str, list[str], str]] = {
    "PSI-159": ("scenario", ["s4"], "Normal flames feed the gas-leak scenario. Inverse flames (oxygen-rich burner flow) are imported and summarised, but kept out of that model."),
    "PSI-39": ("scenario", ["s3"], "Cool-flame burning rate after the hot flame goes out."),
    "PSI-101": ("scenario", ["s5"], "ISS smoke detector signal and particle size, per material."),
    "PSI-102": ("scenario", ["s5"], "Its tests are in the combined SAME / SAME-R results workbook used for the smoke scenario."),
    "PSI-69": ("scenario", ["s7"], "Droplet extinction under CO2 or helium dilution."),
    "PSI-98": ("scenario", ["s2"], "Large fabric samples burned in a Cygnus vehicle."),
    "PSI-99": ("scenario", ["s2"], "Nine samples, each with an in-orbit and a 1 g ground result."),
    "PSI-100": ("scenario", ["s2"], "Large fabric samples burned in a Cygnus vehicle."),
    "PSI-26": ("notes", ["s2", "s7"], "Test outcomes are free text: the verbatim test log is quoted, not classified."),
    "PSI-25": ("map", [], "The PSI table gives test conditions; outcomes are in the free text of the summary report."),
    "PSI-10": ("map", [], "The PSI table gives test conditions only, with no outcome."),
    "PSI-68": ("not_used", [], "The PSI table lists ranges of test conditions, not individual tests."),
    "PSI-107": ("not_used", [], "The PSI table gives fuel and flow settings but no smoke-point outcome."),
    "PSI-117": ("not_used", [], "Time-series files mixing measurements and simulations; they need to be separated by hand first."),
    "PSI-142": ("not_used", [], "Ground-based (1 g) cool-flame data; the summary table points to figures in papers."),
    "PSI-115": ("not_used", [], "Simulation cases only, no measurement."),
    "PSI-60": ("not_used", [], "Modelling study; no data table in PSI."),
    "PSI-62": ("not_used", [], "Modelling study; no data table in PSI."),
    "PSI-47": ("profile", [], "PSI lists two measurement sessions with a dust aerosol: summarised here, not modelled."),
    "PSI-20": ("profile", [], "PSI gives a day-by-day summary (fuel, burner size, oxygen levels, flames ignited), not test-level outcomes: summarised here, not modelled."),
    "PSI-21": ("profile", [], "PSI gives a day-by-day summary (fuel, flow controllers, flames ignited), not test-level outcomes: summarised here, not modelled."),
    "PSI-22": ("profile", [], "PSI gives a day-by-day summary (fuel, electrode polarity, flames ignited), not test-level outcomes: summarised here, not modelled."),
    "PSI-23": ("profile", [], "PSI gives a day-by-day summary (fuel, atmosphere, flames ignited), not test-level outcomes: summarised here, not modelled."),
    "PSI-106": ("profile", [], "PSI lists the test days and the fuel used on each: summarised here, not modelled."),
}


def _excerpt(text: str | None, limit: int = 340) -> str | None:
    """Début du texte PSI, coupé à une fin de phrase (cité tel quel)."""
    if not text:
        return None
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("; "))
    return (cut[: end + 1] if end > 120 else cut.rsplit(" ", 1)[0]) + " …"


def investigations(df: pd.DataFrame) -> dict:
    cat = json.loads((MANUAL / "psi_catalog.json").read_text(encoding="utf-8"))
    counts = df.groupby("source_id").size().to_dict()
    items = []
    for inv in cat["investigations"]:
        status, scenarios, note = USAGE.get(inv["accession"], ("not_used", [], "Not reviewed."))
        items.append({
            "accession": inv["accession"],
            "name": inv["acronym"] or inv["title"],
            "title": inv["title"],
            "platform": inv["platform"],
            "sub_area": inv["sub_area"],
            "objective": _excerpt(inv["objectives"]),
            "url": inv["url"],
            "status": status,
            "scenarios": scenarios,
            "note": note,
            "n_imported": int(counts.get(inv["accession"], 0)),
            "profile": profiles.profile(inv["accession"], df),
        })
    order = {"scenario": 0, "notes": 1, "map": 2, "profile": 3, "not_used": 4}
    items.sort(key=lambda i: (order[i["status"]], -i["n_imported"], int(i["accession"].split("-")[1])))
    return {"fetched": cat["fetched"], "items": items}


# --------------------------------------------------------------------------- #
# Incidents réels (pages NASA des ressources officielles du challenge)
# --------------------------------------------------------------------------- #
INCIDENTS = [
    {
        "id": "apollo1", "name": "Apollo 1", "year": 1967, "scenarios": ["s2", "s1"],
        "text": ("On Jan. 27, 1967, a fire swept through the Apollo 1 Command Module during a preflight test, "
                 "killing its three astronauts. The cabin was pressurized with 100% oxygen, and because of the pure "
                 "oxygen atmosphere the fire spread quickly. Investigators could not determine a specific source of "
                 "ignition, but found evidence of arcing in several wires. Afterwards NASA severely restricted and "
                 "controlled the number of combustible materials in the spacecraft."),
        "source": "NASA Safety and Mission Assurance, Apollo 1 (AS-204)",
        "url": "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1",
    },
    {
        "id": "mir1997", "name": "Mir", "year": 1997, "scenarios": ["s5", "s7"],
        "text": ("On Feb. 24, 1997, a solid-fuel oxygen generator canister ignited in Mir's Kvant-1 module. The flame "
                 "lasted several minutes and cut off access to one of the two Soyuz escape vehicles. The crew quickly "
                 "donned oxygen masks and doused the flame with foam from a fire extinguisher; the life support system "
                 "then took several hours to clear the smoke. The lessons learned were passed on in the design and "
                 "operations of the International Space Station."),
        "source": "NASA History, 25 Years Ago: Fire Aboard Space Station Mir",
        "url": "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/",
    },
    {
        "id": "apollo13", "name": "Apollo 13", "year": 1970, "scenarios": ["s1"],
        "text": ("During the crew's third day in space, oxygen tank number two blew up. The thermostatic switches on "
                 "the tank's heaters had not been modified to suit an earlier change, and during the final test on the "
                 "launch pad the heaters were left on for an extended period. The tank, damaged by overheating, was "
                 "left vulnerable the next time it was filled with oxygen. For Apollo 14 and later missions, the "
                 "changes included sheathing all electrical wiring in stainless steel."),
        "source": "NASA Safety and Mission Assurance, Apollo 13 (CSM-109 / LM-7)",
        "url": "https://sma.nasa.gov/sma-disciplines/accllp/apollo-13",
    },
]

# --------------------------------------------------------------------------- #
# Retombées sur Terre (NASA Spinoff)
# --------------------------------------------------------------------------- #
SPINOFFS = [
    {
        "name": "Fire detector", "year": 1978, "scenarios": ["s5"],
        "text": ("A detector originally used in space shuttle orbiters can discriminate between combustion particles "
                 "and extraneous matter such as dust, which makes it less susceptible to false alarms. It was applied "
                 "to large areas such as mines."),
        "url": "https://spinoff.nasa.gov/node/9407",
    },
    {
        "name": "Firefighters' air tanks", "year": 1976, "scenarios": [],
        "text": ("Developed with NASA's Johnson Space Center, a backpack air system weighing 20 pounds for a 30 minute "
                 "air supply, 13 pounds less than conventional firefighting tanks."),
        "url": "https://spinoff.nasa.gov/node/9582",
    },
    {
        "name": "Firefighters' protective clothing", "year": 1982, "scenarios": [],
        "text": ("Project FIRES applied lightweight, fire-resistant, heat-protective materials originally developed "
                 "for astronauts' space suits to firefighter clothing, with the aim of curbing injuries and fatalities."),
        "url": "https://spinoff.nasa.gov/node/9918",
    },
]

# --------------------------------------------------------------------------- #
# Ressources officielles du challenge (RESSOURCES.md) et leur usage ici
# --------------------------------------------------------------------------- #
CHALLENGE_RESOURCES = [
    {"title": "PSI Data Repository: Combustion Science", "url": "https://psi.nasa.gov/physci/repo/search?q=combustion",
     "use": "The source of every dataset in this tool."},
    {"title": "NASA Combustion Science (Glenn Research Center)",
     "url": "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/",
     "use": "Background on the investigations listed in the Investigations view."},
    {"title": "A Researcher's Guide to International Space Station Combustion Science (2015)",
     "url": "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
     "use": "Background on the investigations listed in the Investigations view."},
    {"title": "NASA ScienceCasts: The Power of Studying Combustion on the ISS (2018)",
     "url": "https://www.youtube.com/watch?v=W1oXykoz9zg", "use": "Introduction for a general audience."},
    {"title": "Apollo 1", "url": "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1",
     "use": "Quoted in the fabric and wire scenarios."},
    {"title": "Apollo 13", "url": "https://sma.nasa.gov/sma-disciplines/accllp/apollo-13",
     "use": "Quoted in the wire scenario."},
    {"title": "25 Years Ago: Fire Aboard Space Station Mir",
     "url": "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/",
     "use": "Quoted in the smoke and extinguisher scenarios."},
    {"title": "Spinoff: Fireman's Air Tanks", "url": "https://spinoff.nasa.gov/node/9582", "use": "Back on Earth section."},
    {"title": "Spinoff: Fire Detector", "url": "https://spinoff.nasa.gov/node/9407",
     "use": "Back on Earth section; linked to the smoke scenario."},
    {"title": "Spinoff: New Technology for the Fire Attire", "url": "https://spinoff.nasa.gov/node/9918",
     "use": "Back on Earth section."},
]
