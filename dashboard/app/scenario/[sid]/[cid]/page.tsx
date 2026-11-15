import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Lumens from "@/components/Lumens";
import { ContextStrip, Explanation, Flame, type StripItem } from "@/components/ScenarioParts";
import { answerFor, CONTEXT_ORDER, confidenceLevel, contextById, D, scenarioById, sourceById } from "@/lib/data";
import { answerFacts, confidenceFacts } from "@/lib/explain";
import { CONF_WORD, GRAV_STATUS, num, pad2, pct, PLATFORM_WORD, RISK_WORD } from "@/lib/labels";

export function generateStaticParams() {
  return D.scenarios.flatMap((s) => CONTEXT_ORDER.map((c) => ({ sid: s.scenario_id, cid: c })));
}

// Légendes de la flamme : chaque phrase renvoie à sa source et à sa page.
const CAPTION: Record<string, string> = {
  terre: "À 1 g, l’air chaud monte et refroidit la flamme : elle vacille. Sur LUCI, la flamme du tissu SIBAL s’éteint environ 45 s plus tôt à 1 g qu’en gravité partielle (Ferkul 2025, p. 34).",
  iss: "Microgravité : flamme sphérique et bleue. Sa survie dépend de la ventilation.",
  gateway: "Microgravité, plus d’oxygène et moins de pression qu’à bord de l’ISS : une combinaison peu testée.",
  lune: "Vol parabolique : le tissu SIBAL brûle de façon stable vers le bas pendant les 20 s de gravité lunaire, à 0,086 cm/s (Ferkul 2026, p. 21-22).",
  mars: "Fils gainés : en gravité martienne, la limite de propagation sur âme NiCr remonte à 17-18 % d’O₂ (Konno 2023, fig. 2). Atmosphère d’habitat : inconnue.",
};

// L'URL (params) est lue sous <Suspense> : la navigation affiche aussitôt
// le squelette partagé de la route, puis le contenu propre au lien.
export default function Page({ params }: PageProps<"/scenario/[sid]/[cid]">) {
  return (
    <Suspense fallback={<p className="eyebrow">Chargement du scénario…</p>}>
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
      step: cx.computed ? pad2(i) : "RÉF.",
      level: aa ? confidenceLevel(aa.confidence) : null,
      aria: `${cx.label}, ${aa ? `confiance ${CONF_WORD[aa.confidence]}` : "référence"}`,
    };
  });

  return (
    <>
      <nav className="tabs" aria-label="Scénarios">
        {D.scenarios.map((s) => (
          <Link key={s.scenario_id} href={`/scenario/${s.scenario_id}/${cid}`} aria-current={s.scenario_id === sid ? "true" : undefined} scroll={false}>
            {s.title}
          </Link>
        ))}
      </nav>

      <div className="stack" style={{ gap: 14 }}>
        <div className="eyebrow">
          Scénario {sid.toUpperCase()} · risque {RISK_WORD[sc.risk_level]}
        </div>
        <h1 className="hero">{sc.question}</h1>
        <div className="chips">
          <span>g = {c.gravity_g === 0 ? "≈ 0 (microgravité)" : num(c.gravity_g)}</span>
          <span>O₂ = {pct(c.o2_mole_fraction)}</span>
          <span>P = {c.pressure_kpa == null ? "[à définir]" : `${num(c.pressure_kpa, 1)} kPa`}</span>
          {sc.assumptions.map((h) => (
            <span key={h} className="assume" title="Hypothèse du scénario, pas une donnée">
              hypothèse : {h}
            </span>
          ))}
        </div>
      </div>

      <section aria-label="Contexte de mission" className="stack" style={{ gap: 12 }}>
        <div className="eyebrow">Transporter le scénario · la descente de confiance</div>
        <ContextStrip sid={sid} current={cid} items={strip} />
      </section>

      <div className="row" style={{ alignItems: "stretch" }}>
        <section className="grow stack" aria-label="Réponse" style={{ gap: 24 }}>
          {ref || !a ? (
            <>
              <div className="level">
                <Lumens level={4} variant="big" />
                <div className="stack" style={{ gap: 4 }}>
                  <span className="eyebrow">Cadre de certification</span>
                  <span className="level-word">Référence</span>
                </div>
              </div>
              <p className="answer">
                C’est ici que les matériaux sont certifiés : NASA-STD-6001, test 1, à 1 g. Le matériau est exposé à une flamme ; il échoue
                si la flamme dépasse 15 cm ou produit des débris enflammés.
              </p>
              <p className="why">
                Point de comparaison, non calculé par le moteur. Le corpus contient {D.experiments.filter((e) => e.gravity_regime === "earth").length}{" "}
                essais à 1 g (essais au sol de Saffire-II et LUCI, références des articles), qui servent de base aux écarts mesurés ailleurs.
              </p>
            </>
          ) : (
            <>
              <div className="level">
                <Lumens level={confidenceLevel(a.confidence)} variant="big" />
                <div className="stack" style={{ gap: 4 }}>
                  <span className="eyebrow">Confiance</span>
                  <span className="level-word">{CONF_WORD[a.confidence]}</span>
                </div>
              </div>
              <Explanation sid={sid} cid={cid} facts={answerFacts(sc, a, ctx)} />
              <p className="why">{confidenceFacts(a).join(" ")}</p>
              {a.model.name && a.model.cv_score != null && (
                <div className="model-card" aria-label="Modèle et score de référence">
                  <div>
                    <span className="eyebrow">Modèle</span>
                    <span>{a.model.name}</span>
                  </div>
                  <div>
                    <span className="eyebrow">Score (CV groupée)</span>
                    <b>{num(a.model.cv_score, 3)}</b>
                  </div>
                  <div>
                    <span className="eyebrow">Référence</span>
                    <b className="muted">{num(a.model.baseline_score, 3)}</b>
                  </div>
                  <div>
                    <span className="eyebrow">Prédiction</span>
                    <span>{a.model.shown ? "affichée" : "masquée"}</span>
                  </div>
                </div>
              )}
              <Decomposition a={a} />
            </>
          )}
        </section>
        <Flame ctx={cid} caption={CAPTION[cid]} />
      </div>

      {a && (
        <div className="row">
          <section className="grow stack" aria-label="Preuves">
            <div className="eyebrow" style={{ paddingBottom: 10 }}>
              Preuves, par pertinence
            </div>
            {a.evidence.length === 0 && <p className="muted">Aucune expérience voisine.</p>}
            {a.evidence.map((ev) => (
              <EvidenceItem key={ev.experiment_id} id={ev.experiment_id} src={ev.source_id} rank={ev.relevance_rank} />
            ))}
            {a.observations.n > a.evidence.length && (
              <p className="small muted">
                {a.observations.n} expériences voisines au total, dont les {a.evidence.length} premières sont listées.
              </p>
            )}
            <Link className="mono small" style={{ marginTop: 8, padding: "10px 0" }} href="/sources">
              TOUTES LES SOURCES →
            </Link>
          </section>
          <section className="side missing" aria-label="Ce qui manque">
            <span className="eyebrow" style={{ color: "var(--fire)" }}>
              Ce qui manque
            </span>
            <ul>
              {(a.gaps.length ? a.gaps : ["Rien de bloquant identifié par le moteur pour ce cas."]).map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <Link className="btn" href={`/priorites/${cid}`}>
              Voir les priorités →
            </Link>
          </section>
        </div>
      )}
    </>
  );
}

function Decomposition({ a }: { a: NonNullable<ReturnType<typeof answerFor>> }) {
  const c = a.components;
  const rows: [string, string, number][] = [
    ["Couverture des conditions (κ)", num(c.coverage), c.coverage >= 0.35 ? 4 : c.coverage >= 0.2 ? 3 : c.coverage >= 0.1 ? 2 : c.coverage > 0.01 ? 1 : 0],
    [`Régime de gravité : ${GRAV_STATUS[c.gravity_regime] ?? c.gravity_regime}`, `γ = ${num(c.gravity_factor)}`, c.gravity_factor >= 1 ? 4 : c.gravity_factor >= 0.5 ? 2 : 1],
    ["Qualité des sources", num(c.source_quality), Math.round(c.source_quality * 4)],
    ["Nombre d’expériences voisines", String(c.n_neighbors), c.n_neighbors >= 10 ? 4 : c.n_neighbors >= 5 ? 3 : c.n_neighbors >= 3 ? 2 : c.n_neighbors >= 1 ? 1 : 0],
    ["Accord entre voisines", num(c.agreement), Math.round(c.agreement * 4)],
  ];
  return (
    <div>
      <div className="eyebrow" style={{ paddingBottom: 10 }}>
        Décomposition
      </div>
      {rows.map(([label, val, lvl]) => (
        <div className="comp" key={label}>
          <span>{label}</span>
          <span className="val">{val}</span>
          <Lumens level={lvl} variant="wide" label={`${label} : ${lvl} sur 4`} />
        </div>
      ))}
    </div>
  );
}

function EvidenceItem({ id, src, rank }: { id: string; src: string; rank: number }) {
  const det = D.evidence_details[id];
  const source = sourceById(src);
  const where = det
    ? `${det.provenance_file}${det.provenance_page ? `, p. ${det.provenance_page}` : ""}${det.provenance_row ? `, ligne ${det.provenance_row}` : ""}`
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
