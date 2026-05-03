## Goal
Add a second upload mode to the admin upload page: **paste a list of words** (one per line, or separated by spaces/commas). The AI then fills in part of speech, simple-English definition, Japanese definition, example sentence, and category — same shape as the image flow.

The existing **image upload** mode stays exactly as it is.

## Changes

### 1. New edge function: `enrich-words`
`supabase/functions/enrich-words/index.ts`
- Input: `{ words: string[] }`
- Calls Lovable AI (`google/gemini-2.5-pro`) using the same `save_words` tool schema and the same simple-English definition rules already in `extract-words` (CEFR A2–B1, ~15 words, no circular definitions, kid-friendly Japanese with appropriate kanji).
- System prompt: "Enrich this given list of English words for a Japanese learner aged 10–17 (Eiken Pre-1 level)."
- Returns `{ words: Extracted[] }` — exact same shape the UI already consumes, so the existing review/edit/save table works untouched.

### 2. Update `src/routes/admin.upload.tsx`
- Add a `<Tabs>` at the top with two tabs:
  - **From image** — current UI (file picker + camera + preview + extract-words). No changes.
  - **From word list** — a `<Textarea>` "Paste words (one per line, or separated by spaces/commas)" + an **Enrich with AI** button.
- Word-list flow:
  - Split textarea on whitespace, commas, semicolons, newlines; lowercase; dedupe; drop empties.
  - Call `enrich-words` with the array → populate the same editable `rows` state.
  - `saveAll` works as-is, just without `source_image_id` when there's no image.
- Both tabs share the same right-column review/edit/save UI.

## Result
Paste:
```
ambiguous resilient
mitigate, ubiquitous
profound
```
→ Click **Enrich with AI** → rows appear pre-filled with simple-English definitions, Japanese, example, POS, category → edit if needed → **Save all**.