// Keyword routing: the fallback when Gemini is unavailable.
import type { ContextId, ScenarioId } from "./data";

const CTX: [RegExp, ContextId][] = [
  [/moon|lunar|\blun/i, "moon"],
  [/mars|martian/i, "mars"],
  [/gateway/i, "gateway"],
  [/\biss\b|station/i, "iss"],
];
const SCN: [RegExp, ScenarioId][] = [
  [/extinguish|suppress|co2|carbon dioxide|put (it|the fire|the flame) out/i, "s7"],
  [/wire|cable|electric|insulation|c[âa]ble/i, "s1"],
  [/smoke|detect|alarm|fum/i, "s5"],
  [/cool flame|invisible|droplet|fuel drop|froide/i, "s3"],
  [/\bgas\b|leak|gaz|fuite/i, "s4"],
  [/fabric|textile|cloth|enriched|tissu/i, "s2"],
  [/certif|material|standard|safe|mat[ée]riau/i, "s6"],
];

export function routeByKeywords(q: string) {
  const c = CTX.find(([re]) => re.test(q));
  const s = SCN.find(([re]) => re.test(q));
  return {
    scenario_id: s?.[1] ?? ("s6" as ScenarioId),
    context_id: c?.[1] ?? ("moon" as ContextId),
    matched: Boolean(c && s),
  };
}
