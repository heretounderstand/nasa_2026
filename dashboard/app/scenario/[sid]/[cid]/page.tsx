import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Lumens from "@/components/Lumens";
import { ContextStrip, Explanation, Flame, ScenarioTabs, type StripItem } from "@/components/ScenarioParts";
import { answerFor, CONTEXT_ORDER, confidenceLevel, contextById, D, scenarioById, sourceById } from "@/lib/data";
import { answerFacts, confidenceFacts, fmtVal } from "@/lib/explain";
import { CONF_WORD, GRAV_STATUS, num, pad2, pct, PLATFORM_WORD, RISK_WORD } from "@/lib/labels";

export function generateStaticParams() {
  return D.scenarios.flatMap((s) => CONTEXT_ORDER.map((c) => ({ sid: s.scenario_id, cid: c })));
}

// Flame captions: each sentence cites its source and page.
const CAPTION: Record<string, string> = {
  earth: "At 1 g, hot air rises and cools the flame, so it flickers. In the LUCI comparison, the SIBAL fabric flame went out about 45 s sooner at 1 g than in partial gravity (Ferkul 2025, p. 34).",
  iss: "Microgravity: a blue, spherical flame. Whether it survives depends on ventilation.",
  gateway: "Microgravity, with more oxygen and lower pressure than on the ISS: a combination with few tests.",
  moon: "Parabolic flight: SIBAL fabric burned steadily downward for the full 20 s of lunar gravity, at 0.086 cm/s (Ferkul 2026, pp. 21-22).",
  mars: "Insulated wires: in Martian gravity, the flame-spread limit on a NiCr core rises to 17-18% O₂ (Konno 2023, Fig. 2). Habitat atmosphere: unknown.",
};

// L'URL (params) est lue sous <Suspense> : la navigation affiche aussitôt
// le squelette partagé de la route, puis le contenu propre au lien.
export default function Page({ params }: PageProps<"/scenario/[sid]/[cid]">) {
  return (
    <Suspense fallback={<p className="eyebrow">Loading scenario…</p>}>
      <ScenarioContent params={params} />
    </Suspense>
  );
}

async function ScenarioContent({ params }: Pick<PageProps<"/scenario/[sid]/[cid]">, "params">) {
  const { sid, cid } = await params;
  const sc = scenarioById(sid);
  const ctx = contextById(cid);
  if (!sc || !ctx) notFound();
  const ref = !ctx.computed;
  const a = ref ? null : answerFor(sid, cid)!;
  const c = ctx.conditions;

  const strip: StripItem[] = CONTEXT_ORDER.map((k, i) => {
    const cx = contextById(k)!;
    const aa = cx.computed ? answerFor(sid, k)! : null;
    return {
      id: k,
      label: cx.label,
      step: cx.computed ? pad2(i) : "REF.",
      level: aa ? confidenceLevel(aa.confidence) : null,
      aria: `${cx.label}, ${aa ? `${CONF_WORD[aa.confidence]} confidence` : "reference"}`,
    };
  });

  const shownEvidence = a ? a.evidence.slice(0, 3) : [];
  const moreEvidence = a ? a.evidence.slice(3) : [];

  return (
    <>
      <ScenarioTabs current={sid} cid={cid} items={D.scenarios.map((x) => ({ id: x.scenario_id, title: x.title }))} />

      <div className="stack" style={{ gap: 12 }}>
        <div className="eyebrow">
          Scenario {sid.toUpperCase()} · {RISK_WORD[sc.risk_level]} risk
        </div>
        <h1 className="hero question">{sc.question}</h1>
      </div>

      <section aria-label="Mission context" className="stack" style={{ gap: 10 }}>
        <div className="eyebrow">Move the scenario and watch confidence change</div>
        <ContextStrip sid={sid} current={cid} items={strip} />
      </section>

      {/* The essentials: confidence, answer, flame. */}
      <section className="answer-card" aria-label="Answer">
        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          <div className="level">
            <Lumens level={a ? confidenceLevel(a.confidence) : 4} variant="big" />
            <div className="stack" style={{ gap: 4 }}>
              <span className="eyebrow">{a ? "Confidence" : "Certification framework"}</span>
              <span className="level-word">{a ? CONF_WORD[a.confidence] : "Reference"}</span>
            </div>
          </div>
          {a ? (
            <Explanation sid={sid} cid={cid} facts={answerFacts(sc, a, ctx)} />
          ) : (
            <>
              <p className="answer">
                This is where materials are certified: NASA-STD-6001, Test 1, at 1 g. The material is exposed to a flame; it fails if
                the flame travels more than 15 cm or drops burning debris.
              </p>
              <p className="why">
                The point of comparison, not computed by the engine. The corpus holds {D.experiments.filter((e) => e.gravity_regime === "earth").length}{" "}
                tests at 1 g (Saffire-II and LUCI ground tests, and the 1 g references in the papers), the baseline for the shifts measured elsewhere.
              </p>
            </>
          )}
          <div className="chips">
            <span>g = {c.gravity_g === 0 ? "≈ 0 (microgravity)" : num(c.gravity_g)}</span>
            <span>O₂ = {pct(c.o2_mole_fraction)}</span>
            <span>P = {c.pressure_kpa == null ? "[to be defined]" : `${num(c.pressure_kpa, 1)} kPa`}</span>
          </div>
          {sc.assumptions.length > 0 && (
            <p className="small muted" style={{ margin: 0 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.06em" }}>SCENARIO ASSUMPTIONS, NOT DATA · </span>
              {sc.assumptions.join(" ")}
            </p>
          )}
        </div>
        <Flame ctx={cid} caption={CAPTION[cid]} />
      </section>

      {a && (
        <div className="row">
          <section className="side missing" aria-label="What is missing">
            <span className="eyebrow" style={{ color: "var(--fire)" }}>
              What is missing
            </span>
            <ul>
              {(a.gaps.length ? a.gaps : ["The engine found no blocking gap for this case."]).map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <Link className="btn" href={`/priorities/${cid}`}>
              See the priorities →
            </Link>
          </section>
          <div className="grow stack" style={{ gap: 20 }}>
            {a.observations.comparison && (
              <Comparison a={a} qt={sc.question_type} highlight={sc.scenario_id === "s5" ? "kapton" : "CO2 30% or more"} />
            )}
            <details className="fold">
              <summary>How this confidence was computed</summary>
              <div className="stack" style={{ gap: 20, paddingTop: 16 }}>
                <p className="why">{confidenceFacts(a).join(" ")}</p>
                {a.model.name && a.model.cv_score != null && (
                  <div className="model-card" aria-label="Model and baseline score">
                    <div>
                      <span className="eyebrow">Model</span>
                      <span>{a.model.name}</span>
                    </div>
                    <div>
                      <span className="eyebrow">Score (grouped CV)</span>
                      <b>{num(a.model.cv_score, 3)}</b>
                    </div>
                    <div>
                      <span className="eyebrow">Baseline</span>
                      <b className="muted">{num(a.model.baseline_score, 3)}</b>
                    </div>
                    <div>
                      <span className="eyebrow">Prediction</span>
                      <span>{a.model.shown ? "shown" : "hidden"}</span>
                    </div>
                  </div>
                )}
                <Decomposition a={a} />
              </div>
            </details>
          </div>
        </div>
      )}

      {a && (
        <section className="stack" aria-label="Evidence">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12, paddingBottom: 8 }}>
            <h2 className="section">Evidence</h2>
            <span className="small muted">
              The experiments closest to this case, most relevant first. {a.observations.n} in total.{" "}
              <Link href="/sources">All sources</Link>
            </span>
          </div>
          {a.evidence.length === 0 && <p className="muted">No neighbouring experiment.</p>}
          {shownEvidence.map((ev) => (
            <EvidenceItem key={ev.experiment_id} id={ev.experiment_id} src={ev.source_id} rank={ev.relevance_rank} />
          ))}
          {moreEvidence.length > 0 && (
            <details className="fold">
              <summary>Show {moreEvidence.length} more</summary>
              {moreEvidence.map((ev) => (
                <EvidenceItem key={ev.experiment_id} id={ev.experiment_id} src={ev.source_id} rank={ev.relevance_rank} />
              ))}
            </details>
          )}
        </section>
      )}
      <Incidents sid={sid} />
      {a && D.field_notes[sid] && <FieldNotesBlock sid={sid} />}
    </>
  );
}

function Comparison({ a, qt, highlight }: { a: NonNullable<ReturnType<typeof answerFor>>; qt: string; highlight: string }) {
  const cmp = a.observations.comparison!;
  const max = Math.max(...cmp.groups.map((g) => g.median));
  return (
    <div aria-label={`Median by ${cmp.by}`}>
      <div className="eyebrow" style={{ paddingBottom: 10 }}>
        Across the whole dataset · median by {cmp.by}
      </div>
      {cmp.groups.map((g) => (
        <div className="cmp" key={g.group}>
          <span className={g.group === highlight ? "cmp-name on" : "cmp-name"}>{g.group}</span>
          <span className="cmp-track">
            <i className={g.group === highlight ? "on" : undefined} style={{ width: `${Math.max(2, (g.median / max) * 100)}%` }} />
          </span>
          <span className="val">
            {fmtVal(qt, g.median)} · {g.n} tests
            {g.n_at_ceiling ? ` · ${g.n_at_ceiling} at ceiling` : ""}
          </span>
        </div>
      ))}
      <p className="small muted" style={{ margin: "10px 0 0" }}>
        Observed values, not a prediction. The highlighted row is this scenario’s case.
      </p>
    </div>
  );
}

function Incidents({ sid }: { sid: string }) {
  const list = D.incidents.filter((i) => i.scenarios.includes(sid));
  if (!list.length) return null;
  return (
    <section aria-label="Why it matters" className="stack" style={{ gap: 4 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12, paddingBottom: 12 }}>
        <h2 className="section">Why it matters</h2>
        <span className="small muted">Real spacecraft incidents related to this scenario, as described by NASA.</span>
      </div>
      {list.map((i) => (
        <div className="study incident" key={i.id}>
          <b>{i.year}</b>
          <span className="stack" style={{ gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{i.name}</span>
            <span style={{ fontSize: 15, lineHeight: 1.55, color: "var(--soft)" }}>{i.text}</span>
            <a className="mono small" href={i.url} target="_blank" rel="noopener noreferrer">
              {i.source} ↗
            </a>
          </span>
        </div>
      ))}
    </section>
  );
}

function FieldNotesBlock({ sid }: { sid: string }) {
  const fn = D.field_notes[sid];
  return (
    <section aria-label="Astronaut observations" className="stack" style={{ gap: 4 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12, paddingBottom: 12 }}>
        <h2 className="section">From the test log</h2>
        <span className="small muted">
          Verbatim observations from the BASS experiment on the ISS ({sourceById(fn.source_id)?.title}). Selection rule: {fn.rule}.
          Showing {fn.items.length} of {fn.total}, in file order. Not classified, not used in the confidence score.
        </span>
      </div>
      {fn.items.slice(0, 2).map((n) => (
        <FieldNote key={n.experiment_id} n={n} />
      ))}
      {fn.items.length > 2 && (
        <details className="fold">
          <summary>Show {fn.items.length - 2} more</summary>
          {fn.items.slice(2).map((n) => (
            <FieldNote key={n.experiment_id} n={n} />
          ))}
        </details>
      )}
    </section>
  );
}

function FieldNote({ n }: { n: (typeof D.field_notes)[string]["items"][number] }) {
  return (
    <figure className="note">
      <blockquote>{n.text}</blockquote>
      <figcaption className="m">
        {[n.material, "ISS", n.o2_mole_fraction != null ? `O₂ ${pct(n.o2_mole_fraction)}` : null, n.pressure_kpa != null ? `${num(n.pressure_kpa, 1)} kPa` : null]
          .filter(Boolean)
          .join(" · ")}{" "}
        · {n.provenance}
      </figcaption>
    </figure>
  );
}

function Decomposition({ a }: { a: NonNullable<ReturnType<typeof answerFor>> }) {
  const c = a.components;
  const rows: [string, string, number][] = [
    ["Coverage of the conditions (κ)", num(c.coverage), c.coverage >= 0.35 ? 4 : c.coverage >= 0.2 ? 3 : c.coverage >= 0.1 ? 2 : c.coverage > 0.01 ? 1 : 0],
    [`Gravity regime: ${GRAV_STATUS[c.gravity_regime] ?? c.gravity_regime}`, `γ = ${num(c.gravity_factor)}`, c.gravity_factor >= 1 ? 4 : c.gravity_factor >= 0.5 ? 2 : 1],
    ["Source quality", num(c.source_quality), Math.round(c.source_quality * 4)],
    ["Number of neighbouring experiments", String(c.n_neighbors), c.n_neighbors >= 10 ? 4 : c.n_neighbors >= 5 ? 3 : c.n_neighbors >= 3 ? 2 : c.n_neighbors >= 1 ? 1 : 0],
    ["Agreement among neighbours", num(c.agreement), Math.round(c.agreement * 4)],
  ];
  return (
    <div>
      <div className="eyebrow" style={{ paddingBottom: 10 }}>
        Breakdown
      </div>
      {rows.map(([label, val, lvl]) => (
        <div className="comp" key={label}>
          <span>{label}</span>
          <span className="val">{val}</span>
          <Lumens level={lvl} variant="wide" label={`${label}: ${lvl} out of 4`} />
        </div>
      ))}
    </div>
  );
}

function EvidenceItem({ id, src, rank }: { id: string; src: string; rank: number }) {
  const det = D.evidence_details[id];
  const source = sourceById(src);
  const where = det
    ? `${det.provenance_file}${det.provenance_page ? `, p. ${det.provenance_page}` : ""}${det.provenance_row ? `, row ${det.provenance_row}` : ""}`
    : "";
  const meta = det
    ? [
        PLATFORM_WORD[det.platform] ?? det.platform,
        det.gravity_g != null ? `${num(det.gravity_g, 3)} g` : null,
        det.o2_mole_fraction != null ? `O₂ ${pct(det.o2_mole_fraction)}` : null,
        det.pressure_kpa != null ? `${num(det.pressure_kpa, 1)} kPa` : null,
        det.fuel,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  return (
    <div className="ev">
      <span className="rank">{pad2(rank)}</span>
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        <span className="t">{source?.title ?? src}</span>
        <span className="m">{meta}</span>
        {det?.notes && <span className="f">{det.notes}</span>}
        <span className="m">
          {id}
          {where && ` · ${where}`}
        </span>
      </div>
    </div>
  );
}
