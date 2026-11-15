# Preparation before the hackathon, and use of AI

This document declares the work done on *Flame in Freefall* **before** the
NASA Space Apps Challenge 2026 hackathon (14–15 November 2026), and how AI
was used. It is kept up to date until submission.

## Agreement with the local event

The Space Apps 2026 participant FAQ states that teams may not begin working on
the challenges before the hackathon. Before going further, Adrien asked the
organizers of our local event. They agreed that the work could continue,
because new data will be released during the hackathon, **on the condition
that it is documented as training for the event and that the use of AI is
declared**. This file is that documentation.

- Local event: [NAME OF LOCAL EVENT]
- Organizer contacted: [NAME / ROLE]
- Date of the agreement: [DATE]

## Timeline

| Dates (2026) | What was done | Who |
|---|---|---|
| Before 6 October | Challenge selection, research on available data, concept, interface architecture and visual mockup, in a conversation with Claude (claude.ai). Specification written to `CLAUDE.md`. | Adrien, with Claude |
| 6 October | Repository structure, data schema, confidence engine with unit tests. | Claude Code, directed by Adrien |
| 9 October | Identification of the PSI files to download (via PSI's public API) and of the partial-gravity articles. Manual download of the files from psi.nasa.gov and NTRS. | Claude Code (identification), Adrien (download) |
| 9 October | Importers for the PSI datasets, manual partial-gravity table, one model per question, pipeline, static dashboard. | Claude Code, directed by Adrien |
| 11 October | Agreement of the local event organizers; this declaration. | Adrien |
| 11 October | Front-end rebuilt in Next.js (`dashboard/`), reading the engine's output. Gemini connected through two server routes, with guardrails. The static version is kept in `web/` as a fallback. | Claude Code, directed by Adrien |
| 17 October | Gemini default model updated to `gemini-3.8-flash`; Next.js navigation fix; phone layout for the map (portrait chart, zoom panel below it). | Claude Code, directed by Adrien |

The repository's git history records the state of the work from its first
commit onward.

## How AI was used

**Tool:** Claude Code (Anthropic), model Claude Opus 5.5, running in VS Code.
The design phase used Claude on claude.ai.

**What the AI did:**
- Wrote all of the code in this repository (Python engine, importers, tests,
  web front-end).
- Searched the web and the PSI public API to identify datasets, files and
  articles, and checked file contents.
- Extracted values from the PDFs. Values read from figures (Konno et al. 2023,
  Fig. 2; Olson et al. 2024 via Ferkul, LPSC 2026, p. 20) are flagged
  `digitized_from_figure` in the data; values copied from tables or text carry
  the page number.
- Proposed calibrations and extensions of the confidence engine (listed in
  `CLAUDE.md`, section 11).

**What the humans did:**
- Chose the challenge and designed the concept, the narrative and the
  interface (Adrien, with Claude during the design phase).
- Downloaded every data file by hand from psi.nasa.gov and NTRS, and decided
  which sources to keep or drop (for example, not buying the paywalled
  Olson et al. 2024 article).
- Directed the work, set the project rules (no invented numbers, full
  traceability, the AI never produces a number or a confidence level shown to
  the user) and validated the results.
- Narrative, pitch and video: [TEAMMATE'S NAME], [TO DO DURING THE HACKATHON].

**AI inside the product:** the dashboard calls Google Gemini (model set in
`GEMINI_MODEL`) for two tasks only:
- routing a free-text question to one of the six scenarios and four contexts,
  chosen from a closed list (the model never answers the question itself);
- rewriting, for a general audience, facts that the engine has already
  written by fixed rules.

No number and no confidence level shown to the user comes from a language
model. They come from the NASA data and from a deterministic engine whose
rules are documented and tested. A Gemini text is rejected, and the
rule-based text is shown instead, if it contains any number that is not
already in the engine's facts or names a different confidence level. The
interface labels which of the two texts is displayed.

## What remains for the hackathon weekend

- Integrate the data released for the hackathon, and any new results (FM2).
- Validate the scenarios' risk levels and assumptions with the team.
- Pitch, video and submission.

The work done during the weekend will be listed here, separately from the
preparation above.
