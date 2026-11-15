// Client Gemini minimal (API REST), côté serveur uniquement.
// Clé et modèle dans .env.local : GEMINI_API_KEY, GEMINI_MODEL.
import "server-only";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 12_000;

export const geminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

/** Appelle Gemini et renvoie le JSON imposé par `schema`, ou null en cas d'échec. */
export async function geminiJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
}): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  // Les modèles 3.x raisonnent avant de répondre : niveau « low » (le plus bas
  // accepté, « minimal » est refusé) pour garder des réponses rapides.
  const body = (withThinking: boolean) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        responseMimeType: "application/json",
        responseSchema: opts.schema,
        ...(withThinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
      },
    });
  try {
    const call = (withThinking: boolean) =>
      fetch(`${BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: body(withThinking),
      });
    let res = await call(true);
    // Modèle qui ne connaît pas ce réglage : on réessaie sans.
    if (res.status === 400 && /thinking/i.test(await res.clone().text())) res = await call(false);
    if (!res.ok) {
      console.error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const data = await res.json();
    const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.find((p) => p.text && !p.thought)?.text;
    return text ? (JSON.parse(text) as T) : null;
  } catch (err) {
    console.error("Gemini indisponible :", err);
    return null;
  }
}
