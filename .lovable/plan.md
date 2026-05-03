## Goal

Replace the current binary "review / known" tagging with a 4-tier **mastery** scale, and use quiz results to automatically move words up and down that scale.

## The mastery scale

```text
0  Still learning        (rose)
1  Understanding better  (amber)
2  I know it             (sage)        ← what "known" used to mean
3  I've mastered it      (gold)
```

`Unseen` is not a tier — it just means no row exists in `word_status` yet.

## How quiz feeds back into mastery

At the end of `study/quiz.tsx`, before showing the score screen, batch-update each answered word:

- **Correct** → `mastery = min(3, current + 1)`
- **Wrong** → `mastery = max(0, current - 1)`
- Words that were unseen get a new row: tier 1 if correct, tier 0 if wrong.
- Special case: getting a tier-3 word wrong drops it to tier 1 (not all the way to 0) so a single misclick on a mastered word doesn't nuke it.

The score screen gets a small "What changed" block:

```text
↑ 4 words moved up
↓ 1 word slipped back to Still learning
✓ 1 reached Mastered
```

## How flashcards feed in

Two-button model is kept but rewired:

- **Still learning** → set tier 0
- **I knew it** → if current tier < 2, jump to 2; if already ≥ 2, bump by 1 (so repeated "I knew it" eventually reaches Mastered).

No new third button for now — the quiz is the path to Mastered.

## Data model

Drop the old `status` text and replace with a numeric tier.

Migration:

```sql
-- 1. add new column
alter table public.word_status
  add column mastery smallint not null default 0;

-- 2. backfill from old status
update public.word_status set mastery = 2 where status = 'known';
update public.word_status set mastery = 0 where status = 'review';

-- 3. drop old column
alter table public.word_status drop column status;

-- 4. validation trigger (no CHECK, per project rules)
create or replace function public.validate_mastery()
returns trigger language plpgsql as $$
begin
  if new.mastery < 0 or new.mastery > 3 then
    raise exception 'mastery must be 0..3';
  end if;
  return new;
end $$;

create trigger word_status_mastery_check
before insert or update on public.word_status
for each row execute function public.validate_mastery();
```

Existing RLS policies on `word_status` already cover the row, no policy changes needed.

## UI changes

### Student dashboard (`src/routes/study.index.tsx`)

Replace the two-line "Known / Review" summary with a single 5-segment bar (4 tiers + Unseen) and a legend:

```text
[██ Still learning 12 │ ██ Understanding 7 │ ███ Know it 5 │ █ Mastered 2 │ ░░░ Unseen 24]
```

The % ring becomes "% truly known" = `(tier ≥ 2) / total`.

### Word List (`src/routes/study.list.tsx`)

- Replace the cycle-on-tap with a small 4-segment control on each card (taps set absolute tier).
- Filter dropdown gains: All / Still learning / Understanding / Know it / Mastered / Unseen.
- Left border color reflects tier.

### Quiz (`src/routes/study.quiz.tsx`)

- After last question, run `applyQuizResults()` then show score + "What changed" block.

### Flashcards (`src/routes/study.flashcards.tsx`)

- Buttons stay; rewired through new helper. Filter dropdown updated to use mastery tiers.

### Admin progress (`src/routes/admin.progress.tsx`)

- Replace 4 stat cards (Total / Known / Review / Unseen) with 5 (Total + 4 tiers).
- Add a stacked-bar mastery distribution.
- "Words to revisit" unchanged.

## Code changes

- `src/lib/words.ts`
  - `WordStatus` removed; new `Mastery = 0 | 1 | 2 | 3 | null` (null = unseen).
  - `fetchStatuses` returns `Record<string, Mastery>`.
  - New helpers: `setMastery`, `bumpMastery(delta, opts?)`, `applyQuizResult(wordId, correct)`.
  - Constants `MASTERY_LABELS`, `MASTERY_COLORS`, `MASTERY_BORDERS`.
- All four routes above updated to use the new helpers and labels.
- `src/integrations/supabase/types.ts` regenerates automatically after migration.

## Out of scope (ask later)

- True SRS scheduling / per-tier review intervals.
- Decay over time (mastered words slipping back if untouched for N days).
- Per-session quiz history persistence beyond `quiz_results` (already stored).

Approve and I'll run the migration and ship the code in one pass.