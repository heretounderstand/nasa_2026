// Router: free-text question → (scenario, context). The LLM picks from a
// closed list; it never answers the question itself.
import { COMPUTED_CONTEXTS, D } from "@/lib/data";
import { geminiJson } from "@/lib/gemini";
import { routeByKeywords } from "@/lib/route-question";

const SYSTEM = `You are the router of a tool about spacecraft fire safety.
Your only task: match the user's question to the closest scenario and mission context from the lists provided.
You never answer the question. You give no figure, no opinion and no confidence level.
If the question clearly matches none of the scenarios, set "relevant" to false.`;

export async function POST(request: Request) {
  const { question } = (await request.json().catch(() => ({}))) as { question?: string };
  const q = (question ?? "").trim().slice(0, 500);
  if (!q) return Response.json({ error: "empty question" }, { status: 400 });

  const scenarios = D.scenarios.map((s) => `- ${s.scenario_id}: ${s.title} (${s.question})`).join("\n");
  const contexts = D.contexts
    .filter((c) => c.computed)
    .map((c) => `- ${c.context_id}: ${c.label}`)
    .join("\n");

  const out = await geminiJson<{ scenario_id: string; context_id: string; relevant: boolean }>({
    system: SYSTEM,
    prompt: `Scenarios:\n${scenarios}\n\nContexts:\n${contexts}\n\nQuestion: "${q}"`,
    schema: {
      type: "OBJECT",
      properties: {
        scenario_id: { type: "STRING", enum: D.scenarios.map((s) => s.scenario_id) },
        context_id: { type: "STRING", enum: COMPUTED_CONTEXTS },
        relevant: { type: "BOOLEAN" },
      },
      required: ["scenario_id", "context_id", "relevant"],
    },
    temperature: 0,
  });

  if (out && D.scenarios.some((s) => s.scenario_id === out.scenario_id) && COMPUTED_CONTEXTS.includes(out.context_id as never)) {
    return Response.json({ ...out, via: "Gemini" });
  }
  const kw = routeByKeywords(q);
  return Response.json({ scenario_id: kw.scenario_id, context_id: kw.context_id, relevant: kw.matched, via: "keywords" });
}
