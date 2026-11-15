// Libellés français et formatage. Aucun chiffre n'est créé ici.
import type { Confidence } from "./data";

export const CONF_WORD: Record<Confidence, string> = {
  tres_faible: "Très faible",
  faible: "Faible",
  moyenne: "Moyenne",
  elevee: "Élevée",
};
export const EVID_WORD = { limitees: "limitées", moyennes: "moyennes", solides: "solides" } as const;
export const AGR_WORD = { faible: "faible", moyen: "moyen", eleve: "élevé" } as const;
export const RISK_WORD = ["", "faible", "modéré", "élevé"];

export const CLASS_WORD: Record<string, string> = {
  extinction: "s'éteint",
  sustained: "continue de brûler",
  cool_flame: "flamme froide persistante",
  no_cool_flame: "pas de flamme froide",
  more_flammable_than_1g: "plus inflammable qu'à 1 g",
  similar_to_1g: "comparable à 1 g",
  less_flammable_than_1g: "moins inflammable qu'à 1 g",
};

export const CEIL_WORD: Record<string, string> = {
  partial_gravity_no_long_duration: "gravité partielle sans mesure de longue durée : au mieux « faible »",
  out_of_data_envelope: "scénario hors de l'enveloppe des données : au mieux « faible »",
  single_source: "une seule source : au mieux « moyenne »",
  model_below_baseline: "le modèle ne bat pas la référence : aucune prédiction affichée",
};

export const PLATFORM_WORD: Record<string, string> = {
  iss: "ISS",
  drop_tower: "tour de chute",
  drop_tower_centrifuge: "tour de chute centrifugée",
  parabolic_flight: "vol parabolique",
  suborbital_centrifuge: "fusée suborbitale en rotation",
  ground: "au sol (1 g)",
  simulation: "simulation",
  lunar_surface: "surface lunaire",
};

export const GRAV_STATUS: Record<string, string> = {
  micro_long: "microgravité, essais longue durée",
  micro_short: "microgravité, essais courts seulement",
  micro_untested: "microgravité, jamais testée",
  partial_long: "gravité partielle, essais longue durée",
  partial_short: "gravité partielle, essais de quelques secondes",
  partial_untested: "gravité partielle, jamais testée",
  earth_long: "1 g, essais au sol",
  earth_short: "1 g",
  earth_untested: "1 g, non testée",
};

const fr = (d: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d });
export function num(x: number | null | undefined, digits = 2): string {
  return x == null || Number.isNaN(x) ? "—" : fr(digits).format(x);
}
export function pct(x: number | null | undefined, digits = 1): string {
  return x == null ? "[à définir]" : `${fr(digits).format(x * 100)} %`;
}
export const pad2 = (n: number) => String(n).padStart(2, "0");
