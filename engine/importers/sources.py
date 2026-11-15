"""Catalogue des sources (annexe Sources). Références vérifiées le 2026-10-09."""

from __future__ import annotations

from engine.schema import Access, Source, SourceKind

PSI = "https://psi.nasa.gov/physci/repo/data/investigations/"


def _psi(sid: str, title: str, doi: str | None, year: int | None) -> Source:
    ref = f"doi:{doi} ; {PSI}{sid}" if doi else f"{PSI}{sid}"
    return Source(source_id=sid, title=title, kind=SourceKind.PSI_DATASET,
                  reference=ref, year=year, access=Access.OPEN)


SOURCES: dict[str, Source] = {s.source_id: s for s in [
    _psi("PSI-159", "ACME / Cool Flames Investigation with Gases (CFI-G)", "10.60555/cyt1-kh64", 2021),
    _psi("PSI-10", "ACME / Flame Design", None, 2021),
    _psi("PSI-69", "Flame Extinguishment Experiment (FLEX)", "10.60555/mbq8-0451", 2009),
    _psi("PSI-39", "Cool Flames Investigation (CFI)", None, 2017),
    _psi("PSI-98", "Spacecraft Fire Safety Experiment-I (Saffire-I)", None, 2016),
    _psi("PSI-99", "Spacecraft Fire Experiment-II (Saffire-II)", "10.60555/2chp-m469", 2016),
    _psi("PSI-100", "Spacecraft Fire Experiment-III (Saffire-III)", None, 2017),
    _psi("PSI-101", "Smoke Aerosol Measurement Experiment-Reflight (SAME-R)", None, 2010),
    _psi("PSI-26", "Burning and Suppression of Solids (BASS)", None, 2012),
    _psi("PSI-25", "Burning and Suppression of Solids-II (BASS-II)", None, 2014),
    Source(source_id="olson2013_mars", kind=SourceKind.ARTICLE, year=2012, access=Access.OPEN,
           title="Olson & Ferkul, Evaluating Material Flammability in Microgravity and Martian Gravity "
                 "Compared to the NASA Standard Normal Gravity Test (ICES 2012)",
           reference="NTRS 20130010991 ; https://ntrs.nasa.gov/citations/20130010991"),
    Source(source_id="olson2015_pmma", kind=SourceKind.ARTICLE, year=2015, access=Access.OPEN,
           title="Olson & Ferkul, Microgravity Flammability of PMMA Rods in Concurrent Flow (9th US NCM)",
           reference="NTRS 20150008961 ; https://ntrs.nasa.gov/citations/20150008961"),
    Source(source_id="konno2023_wires", kind=SourceKind.ARTICLE, year=2023, access=Access.OPEN,
           title="Konno et al., Experimental study on downward/opposed flame spread and extinction over "
                 "electric wires in partial gravity environments, Proc. Combust. Inst. 39",
           reference="doi:10.1016/j.proci.2022.07.002 ; https://hdl.handle.net/2115/92809"),
    Source(source_id="olson2024_pmma", kind=SourceKind.ARTICLE, year=2024, access=Access.RESTRICTED,
           title="Olson et al., Partial gravity flammability of cast PMMA rods in concurrent axial "
                 "stagnation flow, Fire Safety Journal 150, 104267 (read from the figure reproduced in Ferkul, LPSC 2026)",
           reference="https://www.sciencedirect.com/science/article/abs/pii/S0379711224001802"),
    Source(source_id="ferkul2026_lpsc", kind=SourceKind.REPORT, year=2026, access=Access.OPEN,
           title="Ferkul et al., Material Flammability at Lunar and Martian Gravity (LPSC 2026)",
           reference="NTRS 20260001966 ; https://ntrs.nasa.gov/citations/20260001966"),
    Source(source_id="ferkul2025_luci", kind=SourceKind.REPORT, year=2025, access=Access.OPEN,
           title="Ferkul et al., Lunar Combustion Investigation (LUCI): Flammability Results from a "
                 "Rotating Sounding Rocket (ASGSR 2025)",
           reference="NTRS 20250010653 ; https://ntrs.nasa.gov/citations/20250010653"),
    Source(source_id="fm2", kind=SourceKind.UPCOMING, year=2026, access=Access.PENDING,
           title="Flammability of Materials on the Moon (FM2): first combustion experiment on the Moon",
           reference="NTRS 20240008623 ; https://www.nasa.gov/flammability-of-materials-on-the-moon-fm2/"),
    Source(source_id="nasa_std_6001", kind=SourceKind.STANDARD, year=None, access=Access.OPEN,
           title="NASA-STD-6001, Test 1: upward flame propagation (1 g certification)",
           reference="NASA-STD-6001"),
]}
