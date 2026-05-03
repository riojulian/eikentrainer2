## Goal
Extend the "From word list" upload mode so each line carries a **Tier** alongside the word. Persist tier on the `words` table so it can drive filtering and study order later.

## Input format
Two values per line, separated by space, tab, or comma. Tier first, word second:
```
1 ambiguous
1 resilient
2 mitigate
2 ubiquitous
3 profound
4 esoteric
phrases give up
```

Accepted tier tokens (case-insensitive):
- `1`, `t1`, `tier1` → Tier 1
- `2`, `t2`, `tier2` → Tier 2
- `3`, `t3`, `tier3` → Tier 3
- `4`, `t4`, `tier4` → Tier 4
- `p`, `phrase`, `phrases` → Phrases

Lines that don't parse cleanly are skipped with a toast warning showing the count.

## Database change
Migration on `public.words`:
- Add `tier text` (nullable, no default).
- Add CHECK-equivalent **validation trigger** restricting values to `tier1`, `tier2`, `tier3`, `tier4`, `phrases` (per project rule: validation triggers, not CHECK constraints).
- Add index on `tier` for future filtering.

`src/integrations/supabase/types.ts` regenerates automatically — do not edit.

## Edge function: `enrich-words`
- Input shape becomes `{ items: { word: string; tier: string }[] }` (keep accepting old `{ words: string[] }` for back-compat — map to `tier: null`).
- Pass tier to the model only as context ("This word belongs to Eiken study Tier X — adjust example difficulty accordingly") but the model is **not** asked to invent or change tier.
- Returned schema gains `tier` echoed back from input so the UI can display it. If a phrase enters the `phrases` tier, force `part_of_speech = "phrasal verb"`.

## UI: `src/routes/admin.upload.tsx`
- Replace single textarea hint to show the new "tier word" format with examples.
- Parse function: split on newlines → for each line split on whitespace/comma → first token = tier, rest joined as word/phrase. Lowercase word. Dedupe by `(tier, word)`. Show count per tier in a small summary row before enriching.
- Review table gets a new **Tier** column (small colored badge: red/orange/green/purple/blue matching the user's emoji legend) editable via a `<Select>`.
- `saveAll` includes `tier` in the insert payload.

## Visual tier legend
Small legend block above the textarea using the colors from the user's spec:
- 🔴 Tier 1 – Core high-frequency
- 🟠 Tier 2 – Topic-specific
- 🟢 Tier 3 – Reading/Listening
- 🟣 Tier 4 – Lower priority
- 🔵 Phrases – Phrasal verbs

## Files
- **Migration**: add `tier` column + validation trigger + index on `words`.
- **Edit**: `supabase/functions/enrich-words/index.ts` (new input shape, tier in output, phrase POS rule).
- **Edit**: `src/routes/admin.upload.tsx` (parser, legend, tier column in review table, save payload).

## Out of scope (this round)
- Filtering study lists / quizzes by tier.
- Backfilling tier on existing words.
- Updating the image-extraction flow — it stays unchanged; tier remains null for those.
