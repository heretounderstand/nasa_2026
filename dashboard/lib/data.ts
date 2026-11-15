// Accès typé à la sortie du moteur (data/dashboard.json, écrit par
// `python -m engine.pipeline`). Rien n'est calculé ici à partir de rien.
import raw from "@/data/dashboard.json";

export type ContextId = "earth" | "iss" | "gateway" | "moon" | "mars";
export type ScenarioId = "s1" | "s2" | "s3" | "s4" | "s5" | "s6" | "s7";
export type Confidence = "very_low" | "low" | "medium" | "high";

export interface Conditions {
  gravity_g: number | null;
  gravity_regime: string | null;
  o2_mole_fraction: number | null;
  pressure_kpa: number | null;
}
export interface MissionContext {
  context_id: ContextId;
  label: string;
  conditions: Conditions;
  computed: boolean;
  in_priorities: boolean;
  notes: string | null;
}
export interface Scenario {
  scenario_id: ScenarioId;
  title: string;
  question: string;
  question_type: string;
  risk_level: 1 | 2 | 3;
  assumptions: string[];
}
export interface Answer {
  scenario_id: ScenarioId;
  context_id: ContextId;
  prediction: string | number | null;
  confidence: Confidence;
  evidence_axis: "limited" | "medium" | "robust";
  agreement_axis: "low" | "medium" | "high";
  components: {
    coverage: number;
    gravity_regime: string;
    gravity_factor: number;
    source_quality: number;
    evidence_score: number;
    n_neighbors: number;
    agreement: number;
    n_sources: number;
    features: string[];
  };
  ceilings_applied: string[];
  evidence: { experiment_id: string; source_id: string; relevance_rank: number }[];
  observations: {
    n: number;
    counts?: Record<string, number>;
    min?: number;
    median?: number;
    max?: number;
    delta_o2_pts?: number[];
    comparison?: { by: string; groups: { group: string; n: number; median: number; n_at_ceiling?: number }[] };
  };
  gaps: string[];
  model: {
    name: string | null;
    cv_score: number | null;
    baseline_score: number | null;
    min_improvement: number | null;
    shown: boolean;
  };
}
export interface Experiment {
  experiment_id: string;
  source_id: string;
  dataset: string;
  platform: string;
  gravity_g: number | null;
  gravity_regime: string | null;
  o2_mole_fraction: number | null;
  pressure_kpa: number | null;
  flow_velocity_cm_s: number | null;
  fuel: string | null;
  outcome_type: string;
  is_measured: boolean;
  provenance_file: string;
  provenance_row: number | null;
  provenance_page: number | null;
}
export interface Source {
  source_id: string;
  title: string;
  kind: "psi_dataset" | "article" | "report" | "standard" | "upcoming";
  reference: string | null;
  year: number | null;
  access: "open" | "restricted" | "pending";
}
export interface EvidenceDetail {
  source_id: string;
  platform: string;
  gravity_g: number | null;
  o2_mole_fraction: number | null;
  pressure_kpa: number | null;
  fuel: string | null;
  outcome_type: string;
  provenance_file: string;
  provenance_row: number | null;
  provenance_page: number | null;
  notes: string | null;
}
export interface Priority {
  scenario_id: ScenarioId;
  context_id: ContextId;
  risk_level: number;
  knowledge_rank: number;
  confidence: Confidence;
  blind_spot: boolean;
  next_study: string | null;
}
export interface Upcoming {
  id: string;
  source_id: string;
  gravity_g: number;
  o2_mole_fraction: number;
  pressure_kpa: number;
  provenance: string;
}
export interface LimitBand {
  material: string;
  pressure_kpa: number;
  source_id: string;
  provenance: string;
  flags: string[];
  levels: { gravity_g: number; low: number; high: number }[];
}
export interface FieldNotes {
  rule: string;
  total: number;
  source_id: string;
  items: { experiment_id: string; material: string; o2_mole_fraction: number | null; pressure_kpa: number | null; text: string; provenance: string }[];
}
export interface Dashboard {
  disclaimer: string;
  contexts: MissionContext[];
  scenarios: Scenario[];
  answers: Answer[];
  priorities: Priority[];
  experiments: Experiment[];
  upcoming: Upcoming[];
  sources: Source[];
  evidence_details: Record<string, EvidenceDetail>;
  limit_band: LimitBand;
  field_notes: Record<string, FieldNotes>;
}

export const D = raw as unknown as Dashboard;

export const CONTEXT_ORDER: ContextId[] = ["earth", "iss", "gateway", "moon", "mars"];
export const COMPUTED_CONTEXTS: ContextId[] = ["iss", "gateway", "moon", "mars"];
export const CONFIDENCE_ORDER: Confidence[] = ["very_low", "low", "medium", "high"];

export const contextById = (id: string) => D.contexts.find((c) => c.context_id === id);
export const scenarioById = (id: string) => D.scenarios.find((s) => s.scenario_id === id);
export const sourceById = (id: string) => D.sources.find((s) => s.source_id === id);
export const answerFor = (sid: string, cid: string) =>
  D.answers.find((a) => a.scenario_id === sid && a.context_id === cid);
export const confidenceLevel = (c: Confidence) => CONFIDENCE_ORDER.indexOf(c) + 1;
