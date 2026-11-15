// Explanation written by Gemini from the engine's facts.
// Guardrails: the LLM receives only facts already written by rules; any number
// missing from those facts, or any other confidence level, gets the text
// rejected, and the interface keeps the rule-based version.
import { answerFor, contextById, scenarioById } from "@/lib/data";
import { answerFacts, numbersAllowed } from "@/lib/explain";
import { geminiJson } from "@/lib/gemini";
import { CONF_WORD } from "@/lib/labels";

const SYSTEM = `You write the explanation shown by an educational tool about spacecraft fire safety, for a non-specialist reader.
Strict rules:
- Use only the facts provided. Add no outside knowledge.
- Write no number that does not appear verbatim in the facts. Do not spell numbers out in words.
- Never change the confidence level and never suggest another one.
- At most 2 sentences, plain and sober, with no operational advice. This is not a flight-decision tool.
- Say what the experiments show for this case. Do not state or explain the confidence level and do not list what is missing: both are displayed next to your text.`;

const cache = new Map<string, string>();

export async function POST(request: Request) {
  const { scenario_id, context_id } = (await request.json().catch(() => ({}))) as {
    scenario_id?: string;
    context_id?: string;
  };
  const sc = scenarioById(scenario_id ?? "");
  const ctx = contextById(context_id ?? "");
  const a = answerFor(scenario_id ?? "", context_id ?? "");
  if (!sc || !ctx || !a) return Response.json({ error: "unknown scenario" }, { status: 404 });

  const key = `${sc.scenario_id}/${ctx.context_id}`;
  if (cache.has(key)) return Response.json({ text: cache.get(key), via: "gemini" });

  const facts = [
    `Question: ${sc.question}`,
    `Setting: ${ctx.label}.`,
    ...answerFacts(sc, a, ctx),
  ].join("\n");

  const out = await geminiJson<{ explanation: string }>({
    system: SYSTEM,
    prompt: `Facts:\n${facts}`,
    schema: {
      type: "OBJECT",
      properties: { explanation: { type: "STRING" } },
      required: ["explanation"],
    },
  });

  const text = out?.explanation?.trim();
  const level = CONF_WORD[a.confidence].toLowerCase();
  const otherLevels = Object.values(CONF_WORD)
    .map((w) => w.toLowerCase())
    .filter((w) => w !== level && !level.includes(w));
  const ok = text && numbersAllowed(text, facts) && !otherLevels.some((w) => text.toLowerCase().includes(`${w} confidence`));
  if (!ok) return Response.json({ text: null, via: "rules", reason: text ? "guardrail" : "unavailable" });
  cache.set(key, text);
  return Response.json({ text, via: "gemini" });
}
