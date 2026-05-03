import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an English vocabulary extractor for Japanese students preparing for Eiken Pre-1.
Analyze the image (mock exam page, vocabulary list, or reading comprehension page) and extract every English vocabulary word that is appropriate for Eiken Pre-1 level (or slightly below/above).
Skip stopwords and trivial words. Use lowercase for the word itself.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) throw new Error("imageUrl required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const tools = [{
      type: "function",
      function: {
        name: "save_words",
        description: "Save extracted vocabulary words.",
        parameters: {
          type: "object",
          properties: {
            words: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  word: { type: "string" },
                  part_of_speech: { type: "string", enum: ["noun","verb","adj","adverb","phrasal verb"] },
                  definition: { type: "string", description: "Clear English definition for an 11-year-old Japanese student." },
                  definition_ja: { type: "string", description: "Japanese definition with appropriate kanji for an 11-year-old." },
                  example_sentence: { type: "string", description: "Natural sentence using the word, target word wrapped in <strong> tags." },
                  category: { type: "string", enum: [
                    "Weather & Nature","Abstract Concepts","Key Adjectives","Business & Career","Law & Society","Medical & Science","Science & Technology","Education & Institutions","Environment","Actions","Communication","Society & Community","Character & Morality","Emotions & States","Phrasal Verbs","Shopping & Commerce","Business & Finance","Health & Wellness","Organization & Planning","Academic & Analytical","Social Issues","Materials & Objects"
                  ] },
                },
                required: ["word","part_of_speech","definition","definition_ja","example_sentence","category"],
                additionalProperties: false,
              }
            }
          },
          required: ["words"],
          additionalProperties: false,
        }
      }
    }];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "Extract Eiken Pre-1 vocabulary from this image." },
            { type: "image_url", image_url: { url: imageUrl } },
          ]},
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
    console.error("extract-words error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});