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
    where: `${e.experiment_id} · ${e.provenance_file}${e.provenance_page ? `, p. ${e.provenance_page}` : ""}${e.provenance_row ? `, ligne ${e.provenance_row}` : ""}`,
  }));
  const markers: MapMarker[] = ["terre", "iss", "gateway", "lune"].map((id) => {
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
        La connaissance est une lumière. <span>Voici où elle s’éteint.</span>
      </h1>
      <div className="row">
        <div className="grow">
          <KnowledgeMap points={points} markers={markers} upcoming={D.upcoming} band={D.limit_band} sourceTitles={sourceTitles} />
        </div>
        <aside className="side stack" style={{ gap: 28 }}>
          <section aria-label="Lecture" className="stack" style={{ gap: 16 }}>
            <div className="eyebrow">Lecture</div>
            <div className="stat">
              <b>{microSources.size}</b>
              <span>sources avec des mesures en microgravité. La colonne de gauche est éclairée.</span>
            </div>
            <div className="stat">
              <b>{partial.length}</b>
              <span>
                essais en gravité partielle, issus de {partialSources.size} sources, tous en tour de chute, vol parabolique ou fusée :
                de 5 s à environ 2,5 min. Entre 0 et 1 g, presque l’obscurité.
              </span>
            </div>
            <div className="stat">
              <b className="fire">↓</b>
              <span>
                La limite d’inflammabilité du PMMA est au plus bas vers {num(minLevel.gravity_g)} g, près de la gravité lunaire : moins de
                gravité ne veut pas dire moins de feu.
              </span>
            </div>
          </section>
          <section aria-label="Scénarios" className="stack">
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Scénarios · habitat lunaire
            </div>
            {D.scenarios.map((s) => {
              const a = answerFor(s.scenario_id, "lune")!;
              return (
                <Link key={s.scenario_id} className="list-link" href={`/scenario/${s.scenario_id}/lune`}>
                  <span>{s.title}</span>
                  <Lumens level={confidenceLevel(a.confidence)} label={`Confiance ${CONF_WORD[a.confidence]}`} />
                </Link>
              );
            })}
            <Link className="mono small" style={{ marginTop: 16, padding: "10px 0" }} href="/sources">
              SOURCES DE DONNÉES →
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
