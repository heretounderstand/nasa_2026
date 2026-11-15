"use client";

// Investigations: ranking by habitat, filter by fire-safety pillar,
// one card per investigation and a side-by-side comparison table.
import Link from "next/link";
import { useState } from "react";
import type { HabitatRanking, Investigation } from "@/lib/data";

const STATUS: Record<string, { label: string; cls: string }> = {
  scenario: { label: "FEEDS A SCENARIO", cls: "lit" },
  notes: { label: "QUOTED, NOT CLASSIFIED", cls: "lit" },
  map: { label: "ON THE MAP ONLY", cls: "dim" },
  profile: { label: "SUMMARY ONLY", cls: "dim" },
  not_used: { label: "NOT USED", cls: "dark" },
};
const PILLARS = [
  ["all", "ALL"],
  ["prevention", "PREVENTION"],
  ["detection", "DETECTION"],
  ["suppression", "SUPPRESSION"],
] as const;
const FUEL_TYPE: Record<string, string> = { gas: "gas", liquid_droplet: "liquid droplet", solid: "solid" };
const fmt = (x: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(x);
const range = (r: number[] | null | undefined, unit: string) =>
  !r ? "—" : r[0] === r[1] ? `${fmt(r[0])}${unit}` : `${fmt(r[0])}–${fmt(r[1])}${unit}`;
const short = (p: string | null) => (p ?? "").replace("International Space Station (ISS)", "ISS");

function Score({ n, max, label }: { n: number; max: number; label: string }) {
  return (
    <span className="chip-score" title={label}>
      {label} {n}/{max}
    </span>
  );
}

export default function InvestigationExplorer({
  items,
  rankings,
  scenarioTitles,
}: {
  items: Investigation[];
  rankings: HabitatRanking[];
  scenarioTitles: Record<string, string>;
}) {
  const [habitat, setHabitat] = useState("moon");
  const [pillar, setPillar] = useState<string>("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [all, setAll] = useState(false);
  const byAcc = Object.fromEntries(items.map((i) => [i.accession, i]));
  const h = rankings.find((r) => r.id === habitat)!;
  const rankOf = Object.fromEntries(h.ranking.map((r, i) => [r.accession, { ...r, rank: i + 1 }]));
  const shown = h.ranking.map((r) => byAcc[r.accession]).filter((i) => pillar === "all" || i.profile.pillar === pillar);
  const FIRST = 6;
  const cards = all ? shown : shown.slice(0, FIRST);

  return (
    <>
      <section aria-label="Ranking by habitat" className="stack" style={{ gap: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
          <div className="stack" style={{ gap: 8 }}>
            <div className="eyebrow">Rank for a crewed environment</div>
            <div className="seg" role="group" aria-label="Habitat">
              {rankings.map((r) => (
                <button key={r.id} type="button" aria-pressed={r.id === habitat} onClick={() => setHabitat(r.id)}>
                  {r.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <div className="eyebrow">Fire-safety pillar</div>
            <div className="seg" role="group" aria-label="Pillar">
              {PILLARS.map(([k, label]) => (
                <button key={k} type="button" aria-pressed={pillar === k} onClick={() => setPillar(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {h.label}: {h.gravity_g === 0 ? "microgravity" : `${(h.gravity_g ?? 0).toFixed(2)} g`},{" "}
          {h.o2_percent == null ? "atmosphere not defined" : `${fmt(h.o2_percent)}% oxygen, ${fmt(h.pressure_kpa ?? 0)} kPa`}.
        </p>
        <div className="seg view-switch" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")}>
            CARDS
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            COMPARE SIDE BY SIDE
          </button>
        </div>
        <details className="fold slim" style={{ maxWidth: 980 }}>
          <summary>How the relevance score works</summary>
          <p className="small muted" style={{ margin: 0 }}>
            Relevance score, 0 to
          6: link to fire safety in the challenge statement (0–2), whether the tests cover this oxygen level (0–2), gravity (1 in microgravity;
          in partial gravity only an investigation that mimics it scores), and whether the tool holds usable outcomes (0–1). PSI holds no
          partial-gravity combustion data, so every investigation loses the gravity point for the Moon and Mars except the one that mimics it.
                  </p>
        </details>
      </section>

      {view === "cards" && (
      <section aria-label="PSI combustion investigations" className="inv-grid">
        {cards.map((i) => {
          const st = STATUS[i.status];
          const p = i.profile;
          const r = rankOf[i.accession];
          return (
            <article key={i.accession} className={`inv ${st.cls}`}>
              <div className="inv-top">
                <span className="mono small muted">
                  #{r.rank} · {i.accession}
                </span>
                <span className={`tag ${st.cls}`}>{st.label}</span>
              </div>
              <h2>{i.name}</h2>
              {i.name !== i.title && (
                <p className="small muted" style={{ margin: 0 }}>
                  {i.title}
                </p>
              )}
              <div className="inv-score" aria-label={`Relevance ${r.score} out of 6`}>
                <span className="lumens wide" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, k) => (
                    <i key={k} className={k < r.score ? "on" : undefined} />
                  ))}
                </span>
                <Score n={r.directness} max={2} label="fire safety" />
                <Score n={r.oxygen} max={2} label="oxygen" />
                <Score n={r.gravity} max={1} label="gravity" />
                <Score n={r.usable} max={1} label="outcomes" />
              </div>
              {p.statement_note && <p className="small inv-note">{p.statement_note}</p>}
              <p className="small" style={{ margin: 0 }}>
                <span className="muted">In this tool: </span>
                {i.note}
              </p>
              <details className="fold slim">
                <summary>Objective, fuels and test conditions</summary>
              {i.objective && <p className="inv-obj">{i.objective}</p>}
              <dl className="inv-facts">
                {p.pillar && (
                  <>
                    <dt>Pillar</dt>
                    <dd>{p.pillar}</dd>
                  </>
                )}
                {p.hardware && (
                  <>
                    <dt>Hardware</dt>
                    <dd>{p.hardware}</dd>
                  </>
                )}
                {p.fuels && p.fuels.length > 0 && (
                  <>
                    <dt>Fuels</dt>
                    <dd>
                      {(p.fuel_types ?? []).map((t) => FUEL_TYPE[t] ?? t).join(", ")}: {p.fuels.join(", ")}
                      {p.n_fuels && p.n_fuels > p.fuels.length ? ` and ${p.n_fuels - p.fuels.length} more` : ""}
                    </dd>
                  </>
                )}
                {(p.o2_percent || p.oxidizer_o2_percent) && (
                  <>
                    <dt>Oxygen</dt>
                    <dd>
                      {p.o2_levels_percent ? `${p.o2_levels_percent.map(fmt).join(", ")}%` : range(p.o2_percent, "%")}
                      {p.oxidizer_o2_percent ? `${p.o2_percent ? "; " : ""}burner flow ${range(p.oxidizer_o2_percent, "%")}` : ""}
                    </dd>
                  </>
                )}
                {p.pressure_kpa && (
                  <>
                    <dt>Pressure</dt>
                    <dd>{range(p.pressure_kpa, " kPa")}</dd>
                  </>
                )}
                {p.flow_cm_s && (
                  <>
                    <dt>Airflow</dt>
                    <dd>{range(p.flow_cm_s, " cm/s")}</dd>
                  </>
                )}
                {p.burner_mm && (
                  <>
                    <dt>Burner</dt>
                    <dd>{p.burner_mm.map(fmt).join(", ")} mm</dd>
                  </>
                )}
                {p.varies && p.varies.length > 0 && (
                  <>
                    <dt>Varies</dt>
                    <dd>{p.varies.join(", ")}</dd>
                  </>
                )}
                {p.measurements && p.measurements.length > 0 && (
                  <>
                    <dt>Measured</dt>
                    <dd>{p.measurements.join("; ")}</dd>
                  </>
                )}
              </dl>
              {p.quality.map((q) => (
                <p key={q} className="small inv-warn">
                  Data caveat: {q}
                </p>
              ))}
              </details>
              <div className="inv-foot">
                <span className="mono small muted">
                  {i.n_imported > 0
                    ? `${i.n_imported} tests imported`
                    : p.flames_ignited
                      ? `${p.flames_ignited} flames over ${p.n_test_days} test days`
                      : p.n_test_days
                        ? `${p.n_test_days} sessions listed`
                        : "no test imported"}
                  {i.platform && i.platform !== "Not Applicable" ? ` · ${short(i.platform)}` : ""}
                </span>
                <span className="inv-links">
                  {i.scenarios.map((s) => (
                    <Link key={s} href={`/scenario/${s}/${habitat}`} title={scenarioTitles[s]}>
                      {s.toUpperCase()}
                    </Link>
                  ))}
                  <a href={i.url} target="_blank" rel="noopener noreferrer">
                    PSI ↗
                  </a>
                </span>
              </div>
            </article>
          );
        })}
      </section>
      )}
      {view === "cards" && shown.length > FIRST && (
        <button type="button" className="more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? "Show the top 6 only" : `Show all ${shown.length} investigations`}
        </button>
      )}


      {view === "table" && (
      <section aria-label="Compare investigations" className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h2 className="section">Compare side by side</h2>
          <span className="small muted">Ranked for the environment selected above. A dash means PSI’s table does not give the value.</span>
        </div>
        <div className="table-scroll">
          <table className="src cmp-table">
            <thead>
              <tr>
                <th>#</th>
                <th>INVESTIGATION</th>
                <th>PILLAR</th>
                <th>HARDWARE</th>
                <th>FUEL</th>
                <th>OXYGEN</th>
                <th>PRESSURE</th>
                <th>AIRFLOW</th>
                <th>TESTS</th>
                <th>SCORE</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const p = i.profile;
                return (
                  <tr key={i.accession}>
                    <td className="mono">{rankOf[i.accession].rank}</td>
                    <td>
                      <a href={i.url} target="_blank" rel="noopener noreferrer">
                        {i.name}
                      </a>
                    </td>
                    <td>{p.pillar ?? "—"}</td>
                    <td>{p.hardware ? p.hardware.split(",")[0].replace(" modular hardware", "").replace("Multi-user Droplet Combustion Apparatus (MDCA)", "MDCA").replace("Microgravity Science Glovebox (MSG)", "MSG") : "—"}</td>
                    <td>{(p.fuel_types ?? []).map((t) => FUEL_TYPE[t] ?? t).join(", ") || "—"}</td>
                    <td className="mono">{range(p.o2_percent ?? p.oxidizer_o2_percent, "%")}</td>
                    <td className="mono">{range(p.pressure_kpa, " kPa")}</td>
                    <td className="mono">{range(p.flow_cm_s, " cm/s")}</td>
                    <td className="mono">{i.n_imported || (p.flames_ignited ? `${p.flames_ignited} flames` : "—")}</td>
                    <td className="mono">{rankOf[i.accession].score}/6</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </>
  );
}
