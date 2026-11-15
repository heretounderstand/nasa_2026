# Flame in Freefall

NASA Space Apps Challenge 2026 · *Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data*.

A dashboard of spacecraft fire scenarios. For each situation it shows what NASA's combustion data say, **how confident we can be**, and **which experiment is missing**.

The three verbs of the challenge map to three views:

| View | Verb | Question |
|---|---|---|
| Map | summarize | Where does knowledge stand, in oxygen × gravity space? |
| Scenario | interpret | What do we know about this case, and how well? |
| Priorities | rank | Which blind spots should be studied first? |
| Investigations | summarize, rank | What did each of the 24 PSI combustion investigations study, and which matter most for each crewed environment? |

## What makes it different

- **A traceable confidence engine.** Two axes (evidence, agreement) combined in a matrix, then capped by explicit rules. Confidence is always a word, never a percentage.
- **No invented number.** Every value shown traces back to a file and a row or page. Values read from a figure are flagged.
- **The AI is boxed in.** Gemini only routes a question to a scenario and rewrites facts the engine already produced. A text containing a number that is not in the engine's facts is rejected and the rule-based text is shown instead.
- **Partial gravity.** The few existing lunar- and Martian-gravity tests show that less gravity does not mean less fire: the flammability limit of PMMA is lowest near lunar gravity.

## Run it

```bash
pip install pandas numpy scikit-learn pydantic openpyxl pytest
python -m engine.pipeline      # import → models → answers (data/processed/, dashboard/data/)
python -m pytest               # 69 tests

cd dashboard
npm install
cp .env.example .env.local     # then set GEMINI_API_KEY
npm run gemini:check           # checks the key and the model
npm run dev                    # http://localhost:3000
```

Without a Gemini key the app still works: keyword routing and rule-based text.

The PSI files are not versioned. `data/DOWNLOADS.md` lists exactly which files to download into `data/raw/<PSI-id>/`, and `data/raw/manifest.csv` maps each local file to its official PSI path (size, SHA-256).

## Data

| Scenario | Data | Tests |
|---|---|---|
| s6 Material certified at 1 g | Olson & Ferkul 2012 (Table I), Konno et al. 2023 | 27 limit shifts |
| s1 Overheating wire | Konno et al. 2023, Fig. 2 (read from the figure) | 24 limits |
| s2 Fabric in enriched atmosphere | Saffire I/II/III, PMMA (Olson 2024 via Ferkul 2026), SIBAL lunar tests, LUCI | 64 |
| s5 Smoke detection | SAME / SAME-R: ISS smoke detector signal (PSI-101) | 134 |
| s3 Cool flame | CFI (PSI-39) | 146 |
| s4 Gas leak | ACME CFI-G normal flames (PSI-159) | 133 |
| s7 CO₂ extinguisher | FLEX (PSI-69): extinction diameter ratio | 172 |

BASS (PSI-26) test-log observations are quoted verbatim and never classified. The Investigations view states, for each of the 24 PSI combustion investigations, whether it is used and why.

## Layout

| Path | Role |
|---|---|
| `engine/schema.py` | Common schema (pydantic): units, mandatory provenance, anti-leakage rule |
| `engine/importers/` | One importer per PSI dataset family, the manual article table, the PSI catalogue |
| `data/manual/build_partial_gravity.py` | Partial-gravity data entered page by page from the papers |
| `engine/datasets.py` | One analysis set per question (sources are never merged into one model) |
| `engine/models.py` | Classical models, grouped cross-validation, baseline, conformal prediction |
| `engine/confidence.py` | Confidence engine: evidence × agreement, matrix, ceilings |
| `engine/scenarios.py` | The seven scenarios; scenario assumptions listed separately |
| `engine/profiles.py` | Per-investigation profile (pillar, hardware, fuels, ranges) and relevance ranking by habitat |
| `engine/catalog.py` | Use of each investigation, real incidents, spinoffs, official resources |
| `engine/pipeline.py` | Runs everything, writes `answers.json` and `dashboard.json` |
| `dashboard/` | Next.js app; `app/api/` holds the two Gemini routes with guardrails |

An exploration and teaching tool, not a flight-decision tool.
