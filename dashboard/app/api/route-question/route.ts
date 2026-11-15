// Aiguilleur : question libre → (scénario, contexte). Le LLM choisit dans une
// liste fermée ; il ne répond jamais à la question lui-même.
import { COMPUTED_CONTEXTS, D } from "@/lib/data";
import { geminiJson } from "@/lib/gemini";
import { routeByKeywords } from "@/lib/route-question";

const SYSTEM = `Tu es l'aiguilleur d'un outil sur la sécurité incendie spatiale.
Ta seule tâche : rattacher la question de l'utilisateur au scénario et au contexte de mission les plus proches, parmi les listes fournies.
Tu ne réponds jamais à la question. Tu ne donnes aucun chiffre, aucun avis, aucun niveau de confiance.
Si la question ne correspond clairement à aucun scénario, mets "pertinent" à false.`;

export async function POST(request: Request) {
  const { question } = (await request.json().catch(() => ({}))) as { question?: string };
  const q = (question ?? "").trim().slice(0, 500);
  if (!q) return Response.json({ error: "question vide" }, { status: 400 });

  const scenarios = D.scenarios.map((s) => `- ${s.scenario_id} : ${s.title} (${s.question})`).join("\n");
  const contexts = D.contexts
    .filter((c) => c.computed)
    .map((c) => `- ${c.context_id} : ${c.label}`)
    .join("\n");

  const out = await geminiJson<{ scenario_id: string; context_id: string; pertinent: boolean; reformulation: string }>({
    system: SYSTEM,
    prompt: `Scénarios :\n${scenarios}\n\nContextes :\n${contexts}\n\nQuestion : « ${q} »`,
    schema: {
      type: "OBJECT",
      properties: {
        scenario_id: { type: "STRING", enum: D.scenarios.map((s) => s.scenario_id) },
        context_id: { type: "STRING", enum: COMPUTED_CONTEXTS },
        pertinent: { type: "BOOLEAN" },
        reformulation: { type: "STRING", description: "La question reformulée en une phrase, sans aucun chiffre." },
      },
      required: ["scenario_id", "context_id", "pertinent", "reformulation"],
    },
    temperature: 0,
  });

  if (out && D.scenarios.some((s) => s.scenario_id === out.scenario_id) && COMPUTED_CONTEXTS.includes(out.context_id as never)) {
    return Response.json({ ...out, via: "gemini" });
  }
  const kw = routeByKeywords(q);
  return Response.json({ ...kw, pertinent: kw.matched, reformulation: null, via: "mots-clés" });
}
