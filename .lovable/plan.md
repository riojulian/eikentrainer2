## Goal

Make Readiness and Completeness share the same denominator (active Pre-1 words) and same world weights, but tell two different stories driven by `word_status.mastery`:

- **Completeness** = how much of the deck you've *touched* (any `word_status` row, m=0..3).
- **Readiness** = how much of the deck you actually *know* (only m≥2: 分かった + 完全に習得)

Both drop the `quiz_results`-based accuracy formula entirely.

## Formulas

Per world:

```
completeness_world = touched_in_world / total_in_world
   touched = exists(word_status row), regardless of mastery value

readiness_world   = (count of m>=2 in world) / total_in_world
```

Headline (both metrics use the same weights):

```
W1 = 0.6, W2 = W3 = W4 = phrases = 0.1
headline = sum(weight_w * metric_world_w) * 100
```

Per-world chips remain unweighted (raw % per world).

## Changes

### `src/lib/gamification.ts`

- Rewrite `getReadiness(studentId)` to read from `word_status` + `fetchActiveWords()` (drop the `quiz_results` query). Return shape stays `{ pct, total, correct, perWorld }` where:
  - `total` = total active words across tracked tiers
  - `correct` = count of words with mastery ≥ 2
  - `perWorld[tier] = { pct, total, correct }` with `correct` = m≥2 count
  - `pct` = weighted headline using `READINESS_WEIGHTS`
- Rewrite `getCompleteness(studentId)`:
  - `known` (per-world and total) = count of words with any `word_status` row (touched), no fractional credit
  - `pct` = **weighted** headline using `READINESS_WEIGHTS` (was unweighted)
  - Per-world chip pct stays `touched/total`
- Update `checkBadges` `vocab_ready` gate: replace `readinessTotal >= 50` with `readinessTouched >= 50` (touched word count from completeness), since readiness no longer counts answers. Pass it in via the existing `ctx` object — rename `readinessTotal` to `touchedCount` for clarity.

### `src/routes/study.quiz.tsx`

- Where `checkBadges` is called, pass the new `touchedCount` (from `getCompleteness`) instead of `readiness.total`. Keep readiness call for the pct.

### `src/components/ReadinessHeader.tsx`

- Update caption/tooltip text: no longer "based on quiz answers"; now "based on words you Know (分かった or 完全に習得)".
- Caption "X / Y answers" → "X / Y known" (using `correct`/`total` which now mean known/total words).

### `src/components/CompletenessHeader.tsx`

- Caption "X / Y words known" → "X / Y words seen".
- Tooltip: "any word you've encountered counts, regardless of mastery level".

### `src/lib/i18n.tsx`

- Update existing keys:
  - `read.caption` → "words known" / "語習得"
  - `read.tooltip` → mastery-based explanation
  - `cmp.caption` → "words seen" / "語接触"
  - `cmp.tooltip` → "any word with progress counts"

## Side effects

- Readiness numbers will drop for users who answered quiz questions correctly but never reached mastery ≥ 2 on those words. This is intentional — it now reflects retained knowledge, not one-time accuracy.
- Completeness will jump up for any user who's touched many words at m=0, since the half-credit gate is gone.
- A wrong-on-first-sight quiz answer creates a m=0 row → bumps completeness but not readiness. This matches the requested semantics.

## Out of scope

- No DB schema changes.
- No changes to flashcards / quiz / mastery transitions.
- No new badges.
- WeakZone strip stays as-is (it uses its own logic).