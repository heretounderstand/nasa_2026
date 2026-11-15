// Display labels and number formatting. No figure is created here.
import type { Confidence } from "./data";

export const CONF_WORD: Record<Confidence, string> = {
  very_low: "Very low",
  low: "Low",
  medium: "Medium",
  high: "High",
};
export const EVID_WORD = { limited: "limited", medium: "medium", robust: "robust" } as const;
export const AGR_WORD = { low: "low", medium: "medium", high: "high" } as const;
export const RISK_WORD = ["", "low", "moderate", "high"];

export const CLASS_WORD: Record<string, string> = {
  extinction: "goes out",
  sustained: "keeps burning",
  cool_flame: "cool flame persists",
  no_cool_flame: "no cool flame",
  more_flammable_than_1g: "more flammable than at 1 g",
  similar_to_1g: "similar to 1 g",
  less_flammable_than_1g: "less flammable than at 1 g",
};

export const CEIL_WORD: Record<string, string> = {
  partial_gravity_no_long_duration: "partial gravity with no long-duration measurement: “low” at best",
  out_of_data_envelope: "scenario outside the data envelope: “low” at best",
  single_source: "single source: “medium” at best",
  model_below_baseline: "the model does not beat the baseline: no prediction shown",
};

export const PLATFORM_WORD: Record<string, string> = {
  iss: "ISS",
  drop_tower: "drop tower",
  drop_tower_centrifuge: "drop tower with centrifuge",
  parabolic_flight: "parabolic flight",
  suborbital_centrifuge: "spinning suborbital rocket",
  ground: "ground (1 g)",
  simulation: "simulation",
  lunar_surface: "lunar surface",
};

export const GRAV_STATUS: Record<string, string> = {
  micro_long: "microgravity, long-duration tests",
  micro_short: "microgravity, short tests only",
  micro_untested: "microgravity, never tested",
  partial_long: "partial gravity, long-duration tests",
  partial_short: "partial gravity, tests lasting seconds",
  partial_untested: "partial gravity, never tested",
  earth_long: "1 g, ground tests",
  earth_short: "1 g",
  earth_untested: "1 g, not tested",
};

const en = (d: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d });
export function num(x: number | null | undefined, digits = 2): string {
  return x == null || Number.isNaN(x) ? "—" : en(digits).format(x);
}
export function pct(x: number | null | undefined, digits = 1): string {
  return x == null ? "[to be defined]" : `${en(digits).format(x * 100)}%`;
}
export const pad2 = (n: number) => String(n).padStart(2, "0");
