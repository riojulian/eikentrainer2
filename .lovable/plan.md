
# Chunked Study Flow

Break study into bite-size **chunks of 10 words**. After flashcarding a chunk, the student takes a 10-question quiz mixing **7 from the current chunk + 3 from the previous chunk**. Add **weekly** and **monthly** review quizzes that target weak words.

## Concepts

- **Chunk**: a fixed group of 10 words **per student**. Order is randomized within each tier (Tier 1 → 2 → 3 → 4 → Phrases) and persisted so the student always sees the same chunk 1, chunk 2, etc.
- **No gating**: every chunk is accessible. The UI just *suggests* the next one. Students who want to jump ahead can.
- **Chunk 1 quiz**: all 10 questions from chunk 1 (no previous chunk).
- **Chunk N≥2 quiz**: 7 from current + 3 from chunk N-1.
- **Periodic quizzes**: weekly = words seen in last 7 days, monthly = last 30 days; both weighted toward low mastery (mastery 0/1 picked first).

## Database changes (one migration)

**`student_word_order`** — frozen per-student order so chunks are stable across sessions:
- `student_id uuid` (= auth.uid())
- `word_id uuid`
- `position int`
- PK `(student_id, word_id)`, index on `(student_id, position)`
- RLS: select/insert/delete own rows.

When new words are added by admin later, we append them at the end (next available `position`) on first load.

**`study_progress`** — tracks the suggested current chunk:
- `student_id uuid PK`
- `current_chunk int default 1`
- `chunk_size int default 10`
- `updated_at timestamptz`
- RLS: own row only.

**`chunk_attempts`** — log each quiz attempt:
- `id uuid PK`, `student_id uuid`, `chunk_index int null`, `kind text` ('chunk' | 'weekly' | 'monthly'), `score int`, `total int`, `taken_at timestamptz default now()`
- RLS: insert/select own.

Per-question hits stay in existing `quiz_results`.

## New helper: `src/lib/chunks.ts`

- `ensureWordOrder(studentId)` — if no rows exist, build order: shuffle within each tier (tier1, tier2, tier3, tier4, phrases, then null-tier), insert with sequential `position`. If rows exist but new words appeared, append them at the end.
- `getChunks(studentId)` → `Word[][]` of size 10.
- `getProgress(studentId)` / `setCurrentChunk(studentId, n)`.
- `buildChunkQuiz(chunks, currentIdx)` — chunk 1: 10 from chunk 1; chunk N: 7 random from current + 3 random from previous.
- `buildPeriodicQuiz(studentId, kind)` — pull words touched in last 7/30 days (via `word_status.updated_at`), weight low mastery first, sample 10. Falls back gracefully if <10.

## UI changes

### `src/routes/study.index.tsx`
Replace the 3 generic tiles with a chunk-aware layout:
- **Progress strip**: segmented bar of all chunks (done / current / upcoming), small label "Chunk 3 of 12".
- **Primary card**: "Chunk 3 — 10 words" with two CTAs:
  - "Study chunk" → `/study/flashcards?chunk=3`
  - "Take chunk quiz" → `/study/quiz?mode=chunk&chunk=3`
- **Other chunks**: collapsible list to jump to any chunk (no gating).
- **Review tiles**: "Weekly review" and "Monthly review" → `/study/quiz?mode=weekly|monthly`. Disabled with hint if fewer than 4 eligible words.
- Keep existing mastery pill bar.

### `src/routes/study.flashcards.tsx`
- Read `?chunk=N` (default = current). Load only that chunk's 10 words.
- Header shows "Chunk N · 10 cards" plus a small "Free study" toggle that flips back to the existing all-words+filter mode for users who want to browse.
- Done screen primary CTA: **"Take chunk N quiz"** → `/study/quiz?mode=chunk&chunk=N`.

### `src/routes/study.quiz.tsx`
- Read `?mode=chunk|weekly|monthly` and `?chunk=N`.
- Build questions via the matching helper. Same UI as today.
- On finish:
  - Always insert a row into `chunk_attempts`.
  - For `mode=chunk` with `N === currentChunk`: bump `study_progress.current_chunk` to `N+1` (capped at total chunks).
  - Result screen shows score + new CTAs:
    - chunk → "Study chunk N+1" / "Retry chunk N quiz"
    - weekly/monthly → "Back to study"

### `src/routes/study.list.tsx`
Stretch: show a small "Chunk N" badge per word (uses `student_word_order`).

## Edge cases

- **<10 words total**: chunk system disables itself; home page falls back to today's "free study + quiz of all words" tiles with a notice "Add more words to unlock chunks".
- **Final chunk has <10 words**: keep partial; chunk quiz uses what's available + top up from previous chunk.
- **Periodic quiz with <4 eligible words**: tile disabled with explanation.
- **Admin edits/disables words after order is built**: order helper filters out missing/inactive ids on read; chunk sizes can shrink — render gracefully.
- **Pass threshold**: not used (no gating). Score is purely informational + recorded.

## Files

- New migration: `student_word_order`, `study_progress`, `chunk_attempts` + RLS.
- New: `src/lib/chunks.ts`
- Edit: `src/routes/study.index.tsx`, `src/routes/study.flashcards.tsx`, `src/routes/study.quiz.tsx`
- Optional small edit: `src/routes/study.list.tsx`

## Out of scope (future)

- True spaced-repetition scheduling (SM-2 / Leitner).
- Email or push reminders for weekly/monthly quizzes.
- Admin UI to tune chunk size.
