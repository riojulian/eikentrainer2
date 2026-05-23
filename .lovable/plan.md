## Goal

In weakness-mode quizzes, show a **different cloze sentence** than the one used in normal stage flashcards/quizzes — so the student is tested on the word in a fresh context, not by recognizing the sentence shape.

No change to mastery, stage flow, or existing studied words.

## Approach

Add a second example sentence per word (`alt_example_sentence`), generated on-demand by Lovable AI the first time a word appears in weakness mode, then cached in DB forever. Weakness quizzes use `alt_example_sentence`; stages keep using `example_sentence`.

## Changes

### 1. DB migration

Add column to `words`:
- `alt_example_sentence text` (nullable)

No RLS changes needed — inherits existing `words` policies. Generation will be done by an authenticated server function using `supabaseAdmin` to update the row.

### 2. Server function: `ensureAltSentence`

New file `src/lib/words.functions.ts`:
- `createServerFn({ method: "POST" })` protected by `requireSupabaseAuth`.
- Input: `{ wordIds: string[] }`.
- For each word missing `alt_example_sentence`:
  - Call Lovable AI Gateway (`google/gemini-3-flash-preview`) with a prompt that asks for a NEW example sentence different from the existing one, wrapping the target word in `<strong>...</strong>`.
  - Update the row via `supabaseAdmin`.
- Returns `Record<wordId, alt_example_sentence>` for the batch.
- Wrap in try/catch per word; if AI fails, fall back to the original sentence (don't block the quiz).

Wire `attachSupabaseAuth` in `src/start.ts` if not already wired.

### 3. Quiz wiring (`src/routes/study.quiz.tsx`)

- In the `mode === "weakness"` branch, after `getWeakWords`, call `ensureAltSentence({ data: { wordIds: weak.map(w => w.id) }})`.
- Pass the returned map to a new `buildQuizQuestions(pool, allWords, statuses, altMap)` signature.
- Inside `buildQuizQuestions`, when `altMap[w.id]` exists, use it for `sentenceHtml` instead of `w.example_sentence`. The cloze replacement (`<strong>...</strong>` → `<strong>______</strong>`) stays the same.
- Stage / weekly / monthly modes: pass empty `altMap` → unchanged behavior.

### 4. Prompt

```
You are generating an English example sentence for an EIKEN study app.

Target word: {word} ({part_of_speech})
Definition: {definition}
Original sentence (do NOT reuse or paraphrase): {example_sentence}

Write ONE new natural English sentence (12–22 words) that:
- uses the target word in a clearly different context from the original
- wraps the target word in <strong>...</strong> exactly once
- is appropriate for an EIKEN Grade {tier} learner
- does not translate or define the word

Return only the sentence, no quotes, no commentary.
```

## What does NOT change

- `example_sentence` column, stage cloze sentences, mastery, `word_status`, `student_word_order`, `world_progress`.
- Existing studied words keep all progress.
- Weekly / monthly review modes still use the original sentence (only weakness mode swaps).

## Open question (will assume default if not flagged)

- I'll generate **lazily** (first weakness encounter) to avoid a big upfront AI batch. If you'd rather pre-generate for all active words in one admin job, say so.