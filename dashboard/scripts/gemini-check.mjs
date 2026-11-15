// Vérifie la configuration Gemini : liste les modèles accessibles et teste
// un appel minimal avec le modèle choisi.
//   npm run gemini:check
const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
if (!key) {
  console.error("GEMINI_API_KEY absente : copier .env.example en .env.local et y mettre la clé.");
  process.exit(1);
}
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const headers = { "x-goog-api-key": key, "content-type": "application/json" };

const list = await fetch(`${BASE}/models?pageSize=200`, { headers }).then((r) => r.json());
if (list.error) {
  console.error("Clé refusée :", list.error.message);
  process.exit(1);
}
const usable = (list.models ?? [])
  .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
  .map((m) => m.name.replace("models/", ""));
console.log(`Modèles utilisables (${usable.length}) :\n  ${usable.join("\n  ")}`);
console.log(`\nModèle configuré : ${model} ${usable.includes(model) ? "✓" : "✗ (absent de la liste : changer GEMINI_MODEL)"}`);

const test = await fetch(`${BASE}/models/${model}:generateContent`, {
  method: "POST",
  headers,
  body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Réponds seulement : OK" }] }] }),
}).then((r) => r.json());
console.log("Appel de test :", test.error ? `échec — ${test.error.message}` : test.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
