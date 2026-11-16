// =====================================================================
//  Supabase Edge Function „satz-pruefen“
//  Prüft den eigenen französischen Satz eines Kindes (4. Klasse) mit
//  Claude auf Grammatik UND Sinn und gibt kurze, kindgerechte Tipps.
//
//  Einrichten (Supabase-Dashboard):
//   1. Edge Functions → Secrets → ANTHROPIC_API_KEY = sk-ant-…
//   2. Edge Functions → Deploy a new function → Via Editor
//      Name: satz-pruefen → diesen Code einfügen → Deploy
//   3. In den Einstellungen der Funktion „Enforce JWT verification“
//      AUSSCHALTEN (die App meldet sich mit dem Publishable Key, der
//      kein JWT ist). Den Schutz übernimmt der Klassencode unten.
//  Optional: SATZ_LIMIT_PRO_TAG (Standard 400 Prüfungen pro Klasse/Tag)
// =====================================================================
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const client = new Anthropic(); // liest ANTHROPIC_API_KEY aus den Secrets
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const DAILY_LIMIT = Number(Deno.env.get("SATZ_LIMIT_PRO_TAG") ?? 400);

// Antwortformat (strukturierte Ausgabe)
const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["super", "gut", "verbessern"] },
    uses_word: { type: "boolean" },
    grammar_ok: { type: "boolean" },
    meaning_ok: { type: "boolean" },
    praise: { type: "string" },
    tip: { type: "string" },
    corrected: { type: "string" },
    translation: { type: "string" },
  },
  required: ["verdict", "uses_word", "grammar_ok", "meaning_ok", "praise", "tip", "corrected", "translation"],
  additionalProperties: false,
};

const SYSTEM = `Du bist eine warmherzige Französischlehrerin für Kinder der 4. Klasse (9–10 Jahre) in Luxemburg.
Ein Kind hat mit einem Lernwort einen eigenen französischen Satz geschrieben. Beurteile ihn:

- uses_word: Kommt das Lernwort (auch in Mehrzahl oder mit anderem Begleiter) im Satz vor?
- grammar_ok: Stimmen Artikel/Begleiter (le/la/un/une/mon/ma …), Übereinstimmung (männlich/weiblich, Einzahl/Mehrzahl), Verbform und Rechtschreibung? Fehlende Akzente zählen als Fehler. Kleine Satzzeichen-Fehler nicht.
- meaning_ok: Ergibt der Satz Sinn? Fantasievolle Sätze sind erlaubt, wenn sie verständlich und in sich stimmig sind („Mon chat parle français.“ ist ok). Nicht ok: Wörter passen inhaltlich nicht zusammen („Le chat mange la maison.“) oder das Lernwort wird mit falscher Bedeutung benutzt.
- verdict: "super" = alles richtig; "gut" = richtig, nur ein winziger Schönheitsfehler; "verbessern" = Grammatik oder Sinn stimmt nicht oder das Lernwort fehlt.
- praise: ein kurzer, ehrlicher Lob-Satz zu etwas Gelungenem (max. 12 Wörter).
- tip: höchstens zwei kurze Sätze. Bei "verbessern": sag freundlich, WAS das Kind ändern soll (ein Hinweis, keine fertige Lösung), ohne Fachbegriffe wie „Akkusativ“ oder „Kongruenz“. Bei "super"/"gut": eine kleine Idee, wie der Satz noch schöner wird, oder leer.
- corrected: der richtige französische Satz (so nah wie möglich am Satz des Kindes); bei "super" der unveränderte Satz.
- translation: Übersetzung des Kinder-Satzes, so wie das Kind ihn gemeint hat.
Schreibe praise, tip und translation in der angegebenen Hilfssprache, einfach und ermutigend, wie zu einem 9-jährigen Kind.`;

async function rpc(key: string, fn: string, body: unknown) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Datenbank ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nur POST" }, 405);
  try {
    const { code, sentence, word, meaning, lang } = await req.json();
    const s = String(sentence ?? "").trim(), w = String(word ?? "").trim();
    if (!s || s.length > 200 || !w || w.length > 80) return json({ error: "Ungültige Eingabe" }, 400);

    // Schutz: nur bekannte Klassen, begrenzte Anzahl pro Tag
    const key = req.headers.get("apikey") ?? "";
    const rows = (await rpc(key, "vs_get", { p_code: String(code ?? ""), p_kind: "class" })) ?? [];
    if (!rows.some((r: { id: string }) => r.id === "main")) return json({ error: "Unbekannte Klasse" }, 403);
    const dayId = "ai-" + new Date().toISOString().slice(0, 10);
    const used = rows.find((r: { id: string }) => r.id === dayId)?.data?.n ?? 0;
    if (used >= DAILY_LIMIT) return json({ error: "Tageslimit erreicht" }, 429);
    await rpc(key, "vs_put", { p_code: String(code), p_kind: "class", p_id: dayId, p_data: { n: used + 1 } });

    const help = lang === "pt" ? "Portugiesisch" : "Deutsch";
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: `Lernwort: „${w}“ (Bedeutung: ${String(meaning ?? "").slice(0, 80)})\nSatz des Kindes: „${s}“\nHilfssprache: ${help}`,
      }],
    } as never);

    if ((response as { stop_reason?: string }).stop_reason === "refusal") return json({ error: "Keine Bewertung möglich" }, 200);
    const text = (response as { content: { type: string; text?: string }[] }).content.find((b) => b.type === "text")?.text ?? "";
    const result = JSON.parse(text);
    return json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "KI ist gerade ausgelastet" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "API-Schlüssel fehlt oder ist ungültig" }, 500);
    if (e instanceof Anthropic.APIConnectionError) return json({ error: "KI nicht erreichbar" }, 502);
    if (e instanceof Anthropic.APIError) return json({ error: `KI-Fehler ${e.status}` }, 502);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
