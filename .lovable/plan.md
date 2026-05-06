## Goal

Make the Weak Zone meaningful and the mastery tier honest, with one unified concept.

- **Weak Zone** = every seen word with mastery 0 or 1 (`勉強中` + `分かり始めた`).
- **Mastery** only goes up on a true first-try correct; "recovery" answers clear the wrong streak but don't inflate the tier.

No new tables, no migrations.

---

## Defining "first try" (no in-quiz retries today)

Each quiz question is answered exactly once per session, so "first try vs retry" must look at the word's history:

- **First-try correct** → the word's most recent prior `quiz_results` row was correct, or the word has no prior attempts.
- **Recovery correct** → the most recent prior `quiz_results` row was wrong. The user is "fixing" a known miss; we don't reward that with a mastery bump, but we stop punishing it.
- **Wrong** → unchanged: −1, with `3 → 1` exception.

This is computable from the existing `quiz_results` table — no schema change.

---

## Changes

### 1. `src/lib/words.ts` — `applyQuizResult`

Add a `firstTry: boolean` parameter:

```ts
applyQuizResult(studentId, wordId, current, correct, firstTry)
```

Logic:
- `correct && firstTry` → `clamp(current + 1)`
- `correct && !firstTry` → no change (return `current ?? 0`); just write nothing or a no-op upsert with the same value
- `!correct && current === 3` → `1`
- `!correct` → `clamp(current - 1)`

### 2. `src/routes/study.quiz.tsx` — compute `firstTry` before each call

Just before calling `applyQuizResult`, look up the word's most recent prior `quiz_results` row for this user:

```ts
const { data: prior } = await supabase
  .from("quiz_results")
  .select("correct")
  .eq("student_id", user.id)
  .eq("word_id", q.word.id)
  .order("taken_at", { ascending: false })
  .limit(1)
  .maybeSingle();
const firstTry = !prior || prior.correct === true;
```

Insert the new `quiz_results` row **after** this check (the existing insert already happens in parallel; reorder so the lookup precedes the insert, or do the lookup first and insert + apply in parallel afterwards).

For the **guest** branch, mirror the same logic against the in-memory `outcomes` array (the last outcome for that word) since guests don't write to `quiz_results`.

### 3. `src/lib/weakZone.ts` — rewrite to be mastery-driven

Replace the consecutive-correct walk with:

```ts
// Weak = seen words with mastery 0 or 1.
const { data: statuses } = await supabase
  .from("word_status")
  .select("word_id, mastery, updated_at")
  .eq("student_id", studentId)
  .lte("mastery", 1);
```

Sort by `updated_at desc` (most recently struggled first), then map to `Word[]` via `fetchActiveWords()`. Drop the `quiz_results` query entirely from this file.

### 4. UI copy (small)

In `WeakZoneStrip.tsx`, no structural change needed — the list will simply reflect tier 0/1 words. The existing label, count, and review/quiz buttons keep working.

---

## Behavior summary after change

| Scenario | Mastery change | Weak Zone effect |
|---|---|---|
| Never seen → correct | 0 → 1 | Stays out (still 1, but now seen) — actually enters at tier 1 |
| Tier 1, first-try correct | 1 → 2 | **Leaves** Weak Zone |
| Tier 1, recovery correct (prior was wrong) | 1 → 1 | Stays |
| Tier 2, wrong | 2 → 1 | **Enters** Weak Zone |
| Tier 3, wrong | 3 → 1 | **Enters** Weak Zone |
| Tier 0, wrong again | 0 → 0 | Stays |

One mental model: **"Get a word to 分かった (2) on a clean answer and it leaves the Weak Zone. Miss it and it comes back."**

---

## Files touched

- `src/lib/words.ts` — extend `applyQuizResult` signature + branch on `firstTry`.
- `src/routes/study.quiz.tsx` — compute `firstTry` (auth + guest paths), pass it in.
- `src/lib/weakZone.ts` — replace implementation with a `word_status` query (`mastery <= 1`).

No DB migration. No changes to `WeakZoneStrip.tsx` required.
