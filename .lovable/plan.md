## Goal

Collapse the two ring widgets (Readiness, Completeness) into a single **Mastery Progress** metric with a segmented stacked bar visualization, using a linear credit curve.

## Formula

Per word credit (linear):

```
untouched (no word_status row) → 0.00
m=0  勉強中                     → 0.25
m=1  分かり始めた                → 0.50
m=2  分かった                   → 0.75
m=3  完全に習得                  → 1.00
```

Per world: `score_world = sum(credit_w) / total_in_world`

Headline (same world weights as today):

```
W1 = 0.6, W2 = W3 = W4 = phrases = 0.1
headline = sum(weight_w * score_world) * 100
```

Per-world chips: unweighted raw % per world.

## File changes

### `src/lib/gamification.ts`
- Remove `getReadiness`, `getCompleteness`, `PerWorldReadiness`, `PerWorldCompleteness`.
- Add `getMastery(studentId)` returning:
  ```
  {
    pct: number,            // weighted headline
    total: number,          // total active Pre-1 words
    touched: number,        // words with any word_status row
    buckets: { untouched, m0, m1, m2, m3 },   // global counts
    perWorld: Record<string, {
      pct: number,          // unweighted score_world * 100
      total: number,
      buckets: { untouched, m0, m1, m2, m3 }
    }>
  }
  ```
- Update `checkBadges` signature: replace `readinessPct` + `touchedCount` with `masteryPct` + `touchedCount`. `vocab_ready` stays `masteryPct >= 80 && touchedCount >= 50`. Update `BADGES` description text.

### `src/components/MasteryHeader.tsx` (new)
- Renders a single card with:
  - Headline `pct%` and label "Mastery progress / 習得進捗".
  - **Segmented stacked bar** spanning full width, segments in order: m=3 (deepest), m=2, m=1, m=0, untouched (muted). Each segment width = `bucket / total * 100%`. Tooltip per segment shows count + label.
  - Per-world chips reusing `WORLD_CHIP_LABEL` (W1/W2/W3/W4/Ph) showing unweighted per-world %.
  - Caption: `{touched} / {total} words seen · {m2+m3} known`.
  - Streak flame + earned badges (moved from `ReadinessHeader`).
- Color tokens: m3=sage, m2=sage/70, m1=gold, m0=gold/60, untouched=muted.

### `src/components/ReadinessHeader.tsx` & `src/components/CompletenessHeader.tsx`
- Delete both files.

### `src/routes/study.index.tsx`
- Drop imports of `ReadinessHeader`, `CompletenessHeader`, `getReadiness`, `getCompleteness`, `PerWorldReadiness`, `PerWorldCompleteness`.
- Import `MasteryHeader` and `getMastery` instead.
- Replace `readiness` + `completeness` state with single `mastery` state.
- Replace the two `<...Header>` blocks with one `<MasteryHeader ... streak={gameStats.current_streak} earned={earnedBadges} />`.

### `src/routes/study.quiz.tsx`
- Replace `getReadiness` / `getCompleteness` with `getMastery`.
- Live-progress pill ("Readiness X%") becomes "Progress X%" — use mastery `pct` from initial `getMastery` call. Drop the optimistic `livePct` increment math (it was based on quiz-answer accuracy, no longer meaningful); recompute via `getMastery` after each answer is fine, OR keep showing the static "before" pct until results screen. Plan: recompute `getMastery` after each `applyQuizResult` resolves and update the pill.
- Results screen `before/after` numbers come from `getMastery` calls (renamed local vars).
- `checkBadges` call passes `masteryPct: mAfter.pct, touchedCount: mAfter.touched`.

### `src/lib/i18n.tsx`
- Remove `rdy.*` and `cmp.*` keys.
- Add:
  - `mastery.title` — "Mastery progress" / "習得進捗"
  - `mastery.tooltip` — "Linear credit per mastery level (0/0.25/0.5/0.75/1). Weighted W1=60%, others 10%."
  - `mastery.caption` — "words seen" / "語接触済"
  - `mastery.known` — "known" / "習得済"
  - `mastery.live` — "Progress" / "進捗"
  - `mastery.legend.untouched` — "untouched" / "未学習"
  - Reuse existing `MASTERY_LABELS` from `src/lib/words.ts` for m=0..3 segment tooltips.
- Update badge text key references if needed (`rdy.live` → `mastery.live` in quiz pill).

## Side effects

- The headline number will land somewhere between today's Readiness (strict m≥2) and today's Completeness (any touched). Users with many m=0/m=1 words get more credit than before from Readiness, less than from Completeness.
- Old `vocab_ready` thresholds re-anchored on the new combined pct; "≥80%" now requires substantial m=2/m=3 coverage (you can't reach 80 on m=0 alone — max from all-m=0 is 25).
- WeakZone, flashcards, quiz logic, mastery transitions, DB schema: unchanged.

## Out of scope

- No DB migrations.
- No new badges.
- Keep WeakZone strip and per-world chips behavior identical.
