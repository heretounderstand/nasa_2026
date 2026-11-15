// Explication rédigée par Gemini à partir des faits du moteur.
// Garde-fous : le LLM ne reçoit que des faits déjà rédigés par règles ; tout
// nombre absent de ces faits, ou tout autre niveau de confiance, fait rejeter
// le texte, et l'interface garde la version par règles.
import { answerFor, contextById, scenarioById } from "@/lib/data";
import { answerFacts, confidenceFacts, numbersAllowed } from "@/lib/explain";
import { geminiJson } from "@/lib/gemini";
import { CONF_WORD } from "@/lib/labels";

const SYSTEM = `Tu rédiges, en français, l'explication d'un outil pédagogique sur la sécurité incendie spatiale, pour un public non spécialiste.
Règles strictes :
- Utilise uniquement les faits fournis. N'ajoute aucune connaissance extérieure.
- N'écris aucun nombre qui ne figure pas mot pour mot dans les faits.
- Ne change jamais le niveau de confiance et n'en propose pas d'autre.
- 3 phrases au plus, ton sobre, sans conseil opérationnel. L'outil n'est pas un outil de décision de vol.`;

const cache = new Map<string, string>();

export async function POST(request: Request) {
  const { scenario_id, context_id } = (await request.json().catch(() => ({}))) as {
    scenario_id?: string;
    context_id?: string;
  };
  const sc = scenarioById(scenario_id ?? "");
  const ctx = contextById(context_id ?? "");
  const a = answerFor(scenario_id ?? "", context_id ?? "");
  if (!sc || !ctx || !a) return Response.json({ error: "scénario inconnu" }, { status: 404 });

  const key = `${sc.scenario_id}/${ctx.context_id}`;
  if (cache.has(key)) return Response.json({ text: cache.get(key), via: "gemini" });

  const facts = [
    `Question : ${sc.question}`,
    `Contexte : ${ctx.label}.`,
    ...answerFacts(sc, a, ctx),
    ...confidenceFacts(a),
    ...a.gaps.map((g) => `Manque : ${g}`),
  ].join("\n");

  const out = await geminiJson<{ explication: string }>({
    system: SYSTEM,
    prompt: `Faits :\n${facts}`,
    schema: {
      type: "OBJECT",
      properties: { explication: { type: "STRING" } },
      required: ["explication"],
    },
  });

  const text = out?.explication?.trim();
  const level = CONF_WORD[a.confidence].toLowerCase();
  const otherLevels = Object.values(CONF_WORD)
    .map((w) => w.toLowerCase())
    .filter((w) => w !== level && !level.includes(w));
  const ok =
    text &&
    numbersAllowed(text, facts) &&
    !otherLevels.some((w) => text.toLowerCase().includes(`confiance ${w}`));
  if (!ok) return Response.json({ text: null, via: "règles", reason: text ? "garde-fou" : "indisponible" });
  cache.set(key, text);
  return Response.json({ text, via: "gemini" });
}
