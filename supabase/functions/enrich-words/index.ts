import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an English vocabulary enrichment assistant for Japanese students (ages 10–17, non-native English learners) preparing for Eiken Pre-1.
You will receive a list of English words/phrases, each tagged with a study tier. For each item, produce a structured entry suitable for a vocabulary study app.
Use lowercase for the word itself. If a word is misspelled, correct it silently to the most likely intended English word.
Echo the provided tier back unchanged in your output. Items tagged tier "phrases" must have part_of_speech "phrasal verb".

DEFINITION RULES (very important):
- Write the English definition in SIMPLE English a 10–17 year old non-native learner can understand.
- Use common, everyday words (around CEFR A2–B1). Avoid advanced or academic vocabulary.
- Keep it short: ideally 1 sentence, max ~15 words.
- Do NOT define a hard word using other hard words.
- Prefer concrete phrasing ("someone who...", "the feeling of...", "to make something...") over abstract jargon.
- No circular definitions (don't reuse the target word or its forms).
- Japanese definition (definition_ja) stays natural Japanese with kanji appropriate for ~11 year olds.
- Example sentence stays natural and clearly shows the word's meaning in context, with the target word wrapped in <strong> tags.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    // Accept either { items: [{word,tier}] } (new) or { words: string[] } (legacy)
    let items: { word: string; tier: string | null }[] = [];
    if (Array.isArray(body?.items)) {
      items = body.items
        .filter((it: any) => it && typeof it.word === "string")
        .map((it: any) => ({ word: String(it.word), tier: it.tier ?? null }));
    } else if (Array.isArray(body?.words)) {
      items = body.words.map((w: string) => ({ word: String(w), tier: null }));
    }
    if (items.length === 0) throw new Error("items array required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const tools = [{
      type: "function",
      function: {
        name: "save_words",
        description: "Save enriched vocabulary words.",
        parameters: {
          type: "object",
          properties: {
            words: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  word: { type: "string" },
                  tier: { type: "string", enum: ["tier1","tier2","tier3","tier4","phrases",""], description: "Echo the input tier exactly. Empty string if no tier was provided." },
                  part_of_speech: { type: "string", enum: ["noun","verb","adj","adverb","phrasal verb"] },
                  definition: { type: "string", description: "Simple English definition (CEFR A2–B1) understandable by a 10–17 year old non-native learner. ~1 short sentence, no advanced words, no circular definitions." },
                  definition_ja: { type: "string", description: "Japanese definition with appropriate kanji for an 11-year-old." },
                  example_sentence: { type: "string", description: "Natural sentence using the word, target word wrapped in <strong> tags." },
                  category: { type: "string", enum: [
                    "Weather & Nature","Abstract Concepts","Key Adjectives","Business & Career","Law & Society","Medical & Science","Science & Technology","Education & Institutions","Environment","Actions","Communication","Society & Community","Character & Morality","Emotions & States","Phrasal Verbs","Shopping & Commerce","Business & Finance","Health & Wellness","Organization & Planning","Academic & Analytical","Social Issues","Materials & Objects"
                  ] },
                },
                required: ["word","tier","part_of_speech","definition","definition_ja","example_sentence","category"],
                additionalProperties: false,
              }
            }
          },
          required: ["words"],
          additionalProperties: false,
        }
      }
    }];

    const userMsg = `Enrich these English vocabulary items for an Eiken Pre-1 study app. Format: [tier] word\n${items.map((it) => `- [${it.tier ?? ""}] ${it.word}`).join("\n")}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "save_words" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : { words: [] };
    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("enrich-words error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});