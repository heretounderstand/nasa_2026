import Link from "next/link";
import KnowledgeMap, { type MapMarker, type MapPoint } from "@/components/KnowledgeMap";
import Lumens from "@/components/Lumens";
import { answerFor, confidenceLevel, D } from "@/lib/data";
import { CONF_WORD, num } from "@/lib/labels";

const PARTIAL = ["lunar", "martian", "partial_other"];

export default function CartePage() {
  // Données allégées envoyées au navigateur (pas le JSON complet).
  const points: MapPoint[] = D.experiments.map((e) => ({
    id: e.experiment_id,
    src: e.source_id,
    platform: e.platform,
    g: e.gravity_g,
    o2: e.o2_mole_fraction,
    p: e.pressure_kpa,
    flow: e.flow_velocity_cm_s,
    outcome: e.outcome_type,
    where: `${e.experiment_id} · ${e.provenance_file}${e.provenance_page ? `, p. ${e.provenance_page}` : ""}${e.provenance_row ? `, row ${e.provenance_row}` : ""}`,
  }));
  const markers: MapMarker[] = ["earth", "iss", "gateway", "moon"].map((id) => {
    const c = D.contexts.find((x) => x.context_id === id)!;
    return { id, label: c.label, g: c.conditions.gravity_g, o2: c.conditions.o2_mole_fraction, p: c.conditions.pressure_kpa };
  });
  const sourceTitles = Object.fromEntries(D.sources.map((s) => [s.source_id, s.title.split(",")[0].split(" (")[0]]));

  const microSources = new Set(D.experiments.filter((e) => e.gravity_regime === "micro" && e.is_measured).map((e) => e.source_id));
  const partial = D.experiments.filter((e) => PARTIAL.includes(e.gravity_regime ?? ""));
  const partialSources = new Set(partial.map((e) => e.source_id));
  const minLevel = D.limit_band.levels.reduce((m, l) => (l.low < m.low ? l : m));

  return (
    <>
      <h1 className="hero">
        Knowledge is a light. <span>This is where it goes out.</span>
      </h1>
      <div className="row">
        <div className="grow">
          <KnowledgeMap points={points} markers={markers} upcoming={D.upcoming} band={D.limit_band} sourceTitles={sourceTitles} />
        </div>
        <aside className="side stack" style={{ gap: 28 }}>
          <section aria-label="Key readings" className="stack" style={{ gap: 16 }}>
            <div className="eyebrow">Key readings</div>
            <div className="stat">
              <b>{microSources.size}</b>
              <span>sources with microgravity measurements. The left-hand column is lit.</span>
            </div>
            <div className="stat">
              <b>{partial.length}</b>
              <span>
                tests in partial gravity, from {partialSources.size} sources, all in a drop tower, a parabolic flight or a rocket:
                from 5 s to about 2.5 min. Between 0 and 1 g, it is almost dark.
              </span>
            </div>
            <div className="stat">
              <b className="fire">↓</b>
              <span>
                The flammability limit of PMMA is lowest near {num(minLevel.gravity_g)} g, close to lunar gravity: less gravity does
                not mean less fire.
              </span>
            </div>
          </section>
          <section aria-label="Scenarios" className="stack">
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Scenarios · lunar habitat
            </div>
            {D.scenarios.map((s) => {
              const a = answerFor(s.scenario_id, "moon")!;
              return (
                <Link key={s.scenario_id} className="list-link" href={`/scenario/${s.scenario_id}/moon`}>
                  <span>{s.title}</span>
                  <Lumens level={confidenceLevel(a.confidence)} label={`${CONF_WORD[a.confidence]} confidence`} />
                </Link>
              );
            })}
            <Link className="mono small" style={{ marginTop: 16, padding: "10px 0" }} href="/sources">
              DATA SOURCES →
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
