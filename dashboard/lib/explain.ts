// Rédaction de la réponse à partir de la sortie du moteur.
// 1. `facts()` : phrases construites par règles, chiffres tirés du JSON.
//    C'est le texte affiché par défaut, et la seule matière donnée au LLM.
// 2. `numbersAllowed()` : garde-fou. Un texte du LLM n'est accepté que si
//    chacun de ses nombres figure déjà dans les faits.
import type { Answer, MissionContext, Scenario } from "./data";
import { AGR_WORD, CEIL_WORD, CLASS_WORD, CONF_WORD, EVID_WORD, num, pct } from "./labels";

function fmtVal(qt: string, v: number) {
  if (qt === "wire_limiting_oxygen") return pct(v);
  return num(v, 3) + (qt === "smoke_particle_size" ? " µm" : "");
}

export function answerFacts(sc: Scenario, a: Answer, ctx: MissionContext): string[] {
  const qt = sc.question_type;
  const o = a.observations;
  const out: string[] = [];
  if (a.prediction != null) {
    const p = typeof a.prediction === "string" ? CLASS_WORD[a.prediction] ?? a.prediction : fmtVal(qt, a.prediction);
    out.push(`Modèle (${a.model.name}) : ${p}.`);
  }
  if (o.counts) {
    const total = Object.values(o.counts).reduce((s, v) => s + v, 0);
    const parts = Object.entries(o.counts)
      .sort((x, y) => y[1] - x[1])
      .map(([k, v]) => `${v} « ${CLASS_WORD[k] ?? k} »`);
    out.push(`Parmi les ${total} expériences les plus proches de ce cas : ${parts.join(", ")}.`);
  } else if (o.median != null && o.min != null && o.max != null) {
    out.push(
      `Les expériences les plus proches donnent ${fmtVal(qt, o.min)} à ${fmtVal(qt, o.max)} (médiane ${fmtVal(qt, o.median)}).`,
    );
  }
  if (qt === "wire_limiting_oxygen" && ctx.conditions.o2_mole_fraction != null && o.max != null) {
    const above = ctx.conditions.o2_mole_fraction > o.max;
    out.push(
      `L'oxygène de ce contexte (${pct(ctx.conditions.o2_mole_fraction)}) est ${above ? "au-dessus de" : "dans"} cette plage : ${
        above ? "une flamme peut se propager le long du câble." : "la marge est incertaine."
      }`,
    );
  }
  if (o.delta_o2_pts?.length) {
    const d = [...o.delta_o2_pts].sort((x, y) => x - y);
    out.push(
      `Écart de limite d'oxygène par rapport au test à 1 g : de ${num(d[0])} à ${num(d[d.length - 1])} point(s) (négatif : brûle avec moins d'oxygène qu'à 1 g).`,
    );
  }
  if (qt === "smoke_particle_size" && o.median != null) {
    out.push(
      "Des particules de quelques dixièmes de micromètre sont mal vues par les détecteurs optiques réglés pour la fumée terrestre ; aucun déclenchement d'alarme n'est enregistré dans ces données.",
    );
  }
  if (!o.n) out.push("Aucune expérience exploitable pour ce cas.");
  return out;
}

export function confidenceFacts(a: Answer): string[] {
  const out = [
    `Confiance ${CONF_WORD[a.confidence].toLowerCase()} : preuves ${EVID_WORD[a.evidence_axis]}, accord ${AGR_WORD[a.agreement_axis]}.`,
  ];
  const ceilings = a.ceilings_applied.map((k) => CEIL_WORD[k]).filter(Boolean);
  if (ceilings.length) out.push(`Plafonds : ${ceilings.join(" ; ")}.`);
  if (a.model.name && a.model.cv_score != null && a.model.baseline_score != null) {
    out.push(
      `Modèle ${a.model.name} en validation croisée groupée : ${num(a.model.cv_score, 3)} contre ${num(a.model.baseline_score, 3)} pour la référence (${
        a.model.shown ? "affiché" : "non affiché"
      }).`,
    );
  }
  return out;
}

const NUM = /\d+(?:[.,]\d+)?/g;
const norm = (t: string) => t.replace(",", ".").replace(/^0+(?=\d)/, "");

/** Vrai si chaque nombre de `text` apparaît déjà dans `facts`. */
export function numbersAllowed(text: string, facts: string): boolean {
  const allowed = new Set((facts.match(NUM) ?? []).map(norm));
  return (text.match(NUM) ?? []).every((n) => allowed.has(norm(n)));
}
