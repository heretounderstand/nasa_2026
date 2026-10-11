"""Outils communs aux importeurs : lecture, unités, nombres en texte, provenance."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from engine.schema import Experiment, Source

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
MANUAL = ROOT / "data" / "manual"

# Conversions vers le kPa
ATM_KPA = 101.325
BAR_KPA = 100.0
PSI_KPA = 6.894757
MMHG_KPA = 0.1333224


@dataclass
class ImportResult:
    dataset: str
    experiments: list[Experiment] = field(default_factory=list)
    sources: list[Source] = field(default_factory=list)
    # Lignes écartées : (provenance, raison). Rien n'est jeté en silence.
    skipped: list[tuple[str, str]] = field(default_factory=list)

    def skip(self, where: str, reason: str) -> None:
        self.skipped.append((where, reason))


def raw_path(*parts: str) -> Path:
    return RAW.joinpath(*parts)


def rel(path: Path) -> str:
    """Chemin de provenance, relatif à data/raw, en séparateurs POSIX."""
    return path.resolve().relative_to(RAW.resolve()).as_posix()


def read_csv(path: Path) -> pd.DataFrame:
    """Lit un CSV PSI (encodage variable). L'index conserve le numéro de ligne
    du fichier : ligne 1 = en-tête, donc ligne de données i ↔ index i + 2."""
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            df = pd.read_csv(path, encoding=enc)
            break
        except UnicodeDecodeError:
            continue
    else:  # pragma: no cover
        raise ValueError(f"Encodage illisible : {path}")
    df.columns = [re.sub(r"\s+", " ", str(c)).strip() for c in df.columns]
    df.index = df.index + 2
    return df


_NUM = re.compile(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?")


@dataclass(frozen=True)
class Parsed:
    value: float | None
    flags: tuple[str, ...] = ()


def parse_number(raw) -> Parsed:
    """Lit un nombre écrit en texte libre.

    "~ 21.5" → 21.5 (signalé approximate_value) ; "22.1 to 22.0" ou
    "21.5 - 21.7" → milieu (signalé range_midpoint) ; "20 cm/s" → 20.
    Aucune correction de coquille : c'est à l'appelant de la signaler.
    """
    if raw is None or (isinstance(raw, float) and math.isnan(raw)):
        return Parsed(None)
    if isinstance(raw, (int, float)):
        return Parsed(float(raw))
    s = str(raw).strip()
    if not s or s.lower() in {"nan", "n/a", "-", "none", "insignificant"}:
        return Parsed(None)
    flags: list[str] = []
    if "~" in s or "approx" in s.lower():
        flags.append("approximate_value")
    nums = _NUM.findall(s.replace(",", "."))
    if not nums:
        return Parsed(None)
    if len(nums) >= 2 and re.search(r"\d\s*(?:-|to|–)\s*\d", s):
        a, b = float(nums[0]), float(nums[1])
        flags.append("range_midpoint")
        return Parsed((a + b) / 2, tuple(flags))
    return Parsed(float(nums[0]), tuple(flags))


def pct_to_fraction(x: float | None) -> float | None:
    return None if x is None else x / 100.0


def is_blank(v) -> bool:
    return v is None or (isinstance(v, float) and math.isnan(v)) or str(v).strip() in {"", "nan"}
