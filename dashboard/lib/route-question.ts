// Aiguillage par mots-clés : secours quand Gemini n'est pas disponible.
import type { ContextId, ScenarioId } from "./data";

const CTX: [RegExp, ContextId][] = [
  [/lun|moon/i, "lune"],
  [/mars|martien/i, "mars"],
  [/gateway/i, "gateway"],
  [/\biss\b|station/i, "iss"],
];
const SCN: [RegExp, ScenarioId][] = [
  [/c[âa]ble|\bfils?\b|wire|[ée]lectri|gaine/i, "s1"],
  [/fum|d[ée]tect|smoke/i, "s5"],
  [/froide|invisible|goutte|carburant|droplet/i, "s3"],
  [/gaz|fuite|leak/i, "s4"],
  [/tissu|textile|fabric|v[êe]tement|enrichi/i, "s2"],
  [/certifi|mat[ée]riau|norme|s[ée]curit[ée]/i, "s6"],
];

export function routeByKeywords(q: string) {
  const c = CTX.find(([re]) => re.test(q));
  const s = SCN.find(([re]) => re.test(q));
  return {
    scenario_id: s?.[1] ?? ("s6" as ScenarioId),
    context_id: c?.[1] ?? ("lune" as ContextId),
    matched: Boolean(c && s),
  };
}
