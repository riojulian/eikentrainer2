import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  wordIds: z.array(z.string().uuid()).min(1).max(50),
});

type WordRow = {
  id: string;
  word: string;
  part_of_speech: string | null;
  definition: string;
  example_sentence: string | null;
  alt_example_sentence: string | null;
  tier: string | null;
};

async function generateAltSentence(w: WordRow): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const prompt = `Target word: ${w.word}${w.part_of_speech ? ` (${w.part_of_speech})` : ""}
Definition: ${w.definition}
Original sentence (do NOT reuse or paraphrase): ${w.example_sentence ?? "(none)"}

Write ONE new natural English sentence (12-22 words) that:
- uses the target word in a clearly different context from the original
- wraps the target word in <strong>...</strong> exactly once
- is appropriate for an EIKEN learner${w.tier ? ` at level ${w.tier}` : ""}
- does not translate or define the word

Return only the sentence, no quotes, no commentary.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You write concise English example sentences for vocabulary study." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      console.error("alt-sentence gateway error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return null;
    // Ensure target is wrapped in <strong>...</strong>
    if (!/<strong>.*?<\/strong>/i.test(text)) {
      const re = new RegExp(`\\b(${w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`, "i");
      return text.replace(re, "<strong>$1</strong>");
    }
    return text;
  } catch (err) {
    console.error("alt-sentence generation failed", err);
    return null;
  }
}

export const ensureAltSentences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const { data: rows, error } = await supabaseAdmin
      .from("words")
      .select("id,word,part_of_speech,definition,example_sentence,alt_example_sentence,tier")
      .in("id", data.wordIds);
    if (error || !rows) return {};

    const out: Record<string, string> = {};
    const missing: WordRow[] = [];
    for (const r of rows as WordRow[]) {
      if (r.alt_example_sentence) {
        out[r.id] = r.alt_example_sentence;
      } else if (r.example_sentence) {
        missing.push(r);
      }
    }

    // Generate sequentially to avoid rate limits.
    for (const r of missing) {
      const alt = await generateAltSentence(r);
      if (alt) {
        await supabaseAdmin
          .from("words")
          .update({ alt_example_sentence: alt })
          .eq("id", r.id);
        out[r.id] = alt;
      }
    }
    return out;
  });