// Writing the answer from the engine's output.
// 1. `answerFacts()` / `confidenceFacts()`: rule-built sentences whose figures
//    come from the JSON. This is the default text, and the only material
//    handed to the LLM.
// 2. `numbersAllowed()`: guardrail. An LLM text is accepted only if every
//    number in it already appears in the facts.
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
    const what =
      qt === "wire_limiting_oxygen" ? `flame spread stops below ${p} oxygen` : qt === "smoke_particle_size" ? `particle size ${p}` : p;
    out.push(`Model (${a.model.name}): ${what}.`);
  }
  if (o.counts) {
    const total = Object.values(o.counts).reduce((s, v) => s + v, 0);
    const parts = Object.entries(o.counts)
      .sort((x, y) => y[1] - x[1])
      .map(([k, v]) => `${v} “${CLASS_WORD[k] ?? k}”`);
    out.push(`Of the ${total} experiments closest to this case: ${parts.join(", ")}.`);
  } else if (o.median != null && o.min != null && o.max != null) {
    const what = qt === "wire_limiting_oxygen" ? "an oxygen limit for flame spread of" : qt === "smoke_particle_size" ? "particle sizes of" : "";
    out.push(`The closest experiments give ${what} ${fmtVal(qt, o.min)} to ${fmtVal(qt, o.max)} (median ${fmtVal(qt, o.median)}).`.replace("  ", " "));
  }
  if (qt === "wire_limiting_oxygen" && ctx.conditions.o2_mole_fraction != null && o.max != null) {
    const above = ctx.conditions.o2_mole_fraction > o.max;
    out.push(
      `The oxygen level in this setting (${pct(ctx.conditions.o2_mole_fraction)}) is ${above ? "above" : "within"} that range: ${
        above ? "a flame can spread along the wire." : "the margin is uncertain."
      }`,
    );
  }
  if (o.delta_o2_pts?.length) {
    const d = [...o.delta_o2_pts].sort((x, y) => x - y);
    out.push(
      `Shift in the oxygen limit relative to the 1 g test: from ${num(d[0])} to ${num(d[d.length - 1])} point(s) (negative: burns with less oxygen than at 1 g).`,
    );
  }
  if (qt === "smoke_particle_size" && o.median != null) {
    out.push(
      "Particles a few tenths of a micrometre across are poorly seen by optical detectors tuned for smoke on Earth; no alarm activation is recorded in these data.",
    );
  }
  if (!o.n) out.push("No usable experiment for this case.");
  return out;
}

export function confidenceFacts(a: Answer): string[] {
  const out = [`${CONF_WORD[a.confidence]} confidence: ${EVID_WORD[a.evidence_axis]} evidence, ${AGR_WORD[a.agreement_axis]} agreement.`];
  const ceilings = a.ceilings_applied.map((k) => CEIL_WORD[k]).filter(Boolean);
  if (ceilings.length) out.push(`Ceilings: ${ceilings.join("; ")}.`);
  if (a.model.name && a.model.cv_score != null && a.model.baseline_score != null) {
    out.push(
      `Model ${a.model.name} in grouped cross-validation: ${num(a.model.cv_score, 3)} against ${num(a.model.baseline_score, 3)} for the baseline (${
        a.model.shown ? "shown" : "not shown"
      }).`,
    );
  }
  return out;
}

const NUM = /\d+(?:[.,]\d+)?/g;
const norm = (t: string) => t.replace(",", ".").replace(/^0+(?=\d)/, "");

/** True if every number in `text` already appears in `facts`. */
export function numbersAllowed(text: string, facts: string): boolean {
  const allowed = new Set((facts.match(NUM) ?? []).map(norm));
  return (text.match(NUM) ?? []).every((n) => allowed.has(norm(n)));
}
