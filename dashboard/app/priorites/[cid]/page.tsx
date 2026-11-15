import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Lumens from "@/components/Lumens";
import PriorityMatrix, { type Dot } from "@/components/PriorityMatrix";
import { COMPUTED_CONTEXTS, contextById, D, scenarioById } from "@/lib/data";
import { CONF_WORD, pad2, RISK_WORD } from "@/lib/labels";

export function generateStaticParams() {
  return COMPUTED_CONTEXTS.map((cid) => ({ cid }));
}

// L'URL (params) est lue sous <Suspense> : la navigation affiche aussitôt
// le squelette partagé de la route, puis le contenu propre au lien.
export default function Page({ params }: PageProps<"/priorites/[cid]">) {
  return (
    <Suspense fallback={<p className="eyebrow">Chargement des priorités…</p>}>
      <PrioritesContent params={params} />
    </Suspense>
  );
}

async function PrioritesContent({ params }: Pick<PageProps<"/priorites/[cid]">, "params">) {
  const { cid } = await params;
  if (!COMPUTED_CONTEXTS.includes(cid as never)) notFound();

  const rows = D.priorities
    .filter((p) => p.context_id === cid)
    .sort(
      (x, y) =>
        y.risk_level * (4 - y.knowledge_rank) - x.risk_level * (4 - x.knowledge_rank) || x.scenario_id.localeCompare(y.scenario_id),
    );
  const dots: Dot[] = rows.map((p, i) => ({
    sid: p.scenario_id,
    rank: i + 1,
    short: scenarioById(p.scenario_id)!.title.split(/[:,]/)[0],
    knowledge: p.knowledge_rank,
    risk: p.risk_level,
  }));

  // Quoi étudier ensuite : manques relevés par le moteur pour ce contexte.
  const gaps = new Map<string, { text: string; scen: Set<string>; risk: number }>();
  for (const a of D.answers) {
    if (a.context_id !== cid) continue;
    for (const g of a.gaps) {
      if (/^Pas de modèle|^Le modèle|^Prédiction masquée/.test(g)) continue;
      const key = g.replace(/\s*Première mesure.*$/, "");
      const e = gaps.get(key) ?? { text: g, scen: new Set<string>(), risk: 0 };
      e.scen.add(a.scenario_id);
      e.risk = Math.max(e.risk, scenarioById(a.scenario_id)!.risk_level);
      gaps.set(key, e);
    }
  }
  const studies = [...gaps.values()].sort((x, y) => y.scen.size - x.scen.size || y.risk - x.risk).slice(0, 6);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <h1 className="hero">
          Les angles morts. <span>Ce qu’il faut étudier en premier.</span>
        </h1>
        <nav className="seg" aria-label="Contexte de mission">
          {COMPUTED_CONTEXTS.map((k) => (
            <Link key={k} href={`/priorites/${k}`} aria-current={k === cid ? "true" : undefined} scroll={false}>
              {contextById(k)!.label.toUpperCase()}
            </Link>
          ))}
        </nav>
      </div>

      <div className="row">
        <section className="grow stack" aria-label="Matrice risque et connaissance" style={{ gap: 10 }}>
          <PriorityMatrix dots={dots} cid={cid} />
          <div className="mono small muted" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>← OBSCURITÉ</span>
            <span>CONNAISSANCE (confiance du moteur)</span>
            <span>LUMIÈRE →</span>
          </div>
          <span className="small muted">
            Axe vertical : niveau de risque du scénario (proposition de l’équipe). Axe horizontal : confiance calculée par le moteur.
          </span>
        </section>
        <section className="side stack" aria-label="Classement">
          <div className="eyebrow" style={{ paddingBottom: 10 }}>
            Classement · risque × obscurité
          </div>
          {rows.map((p, i) => (
            <Link key={p.scenario_id} className="rank-row" href={`/scenario/${p.scenario_id}/${cid}`}>
              <b className={i === 0 ? "first" : undefined}>{pad2(i + 1)}</b>
              <span className="stack" style={{ gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{scenarioById(p.scenario_id)!.title}</span>
                <span className="small muted">
                  Risque {RISK_WORD[p.risk_level]} · confiance {CONF_WORD[p.confidence].toLowerCase()}
                  {p.blind_spot ? " · angle mort" : ""}
                </span>
              </span>
            </Link>
          ))}
        </section>
      </div>

      <section aria-label="Quoi étudier ensuite" className="stack" style={{ gap: 4 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12, paddingBottom: 12 }}>
          <h2 className="section">Quoi étudier ensuite</h2>
          <span className="small muted">
            Manques relevés par le moteur pour ce contexte, classés par nombre de scénarios qu’une nouvelle expérience éclairerait.
          </span>
        </div>
        {studies.map((g, i) => (
          <div className="study" key={g.text}>
            <b>{pad2(i + 1)}</b>
            <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.4 }}>{g.text}</span>
            <span className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
              <Lumens level={g.scen.size} total={6} />
              <span className="mono small muted">
                {g.scen.size} scénario{g.scen.size > 1 ? "s" : ""} éclairé{g.scen.size > 1 ? "s" : ""}
              </span>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
