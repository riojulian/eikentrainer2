## Weighted Readiness by World

Change the 🟢 Readiness Score so it reflects Eiken priorities instead of a flat lifetime accuracy.

### New formula

```text
readiness = 0.60 * acc(tier1)
          + 0.10 * acc(tier2)
          + 0.10 * acc(tier3)
          + 0.10 * acc(tier4)
          + 0.10 * acc(phrases)
```

Where `acc(world) = correct_in_world / total_in_world` from `quiz_results`, joined to `words.tier`. A world with **zero answers contributes 0** (not skipped) — so a brand-new user starts at 0% and the only way to reach 100% is to also practice the smaller worlds. This is what makes the weighting actually push the user toward World 1 first while still rewarding breadth later.

### Display

- Same ring + % as today (red <50, amber 50–79, green ≥80).
- Subtitle changes from "based on N answers" to a tiny breakdown chip row:
  `W1 72% · W2 30% · W3 0% · W4 0% · Ph 0%` (each chip dimmed if 0 answers).
- Tooltip on the ring: "Weighted: World 1 = 60%, others = 10% each".
- Live chip in the quiz header keeps showing the same overall weighted %.

### Files touched

- `src/lib/gamification.ts` — rewrite `getReadiness()`:
  - One query: `quiz_results` joined with `words(tier)` for the student.
  - Bucket rows by tier, compute per-world accuracy, return `{ pct, total, perWorld: Record<World, {pct, total}> }`.
  - Keep the existing return shape additive (still expose `total`) so callers that only read `pct`/`total` keep working.
- `src/components/ReadinessHeader.tsx` — render the per-world chip row using the new `perWorld` map; show `WORLD_LABELS_SHORT` from `src/lib/words.ts`.
- `src/routes/study.quiz.tsx` — already calls `getReadiness()`; just consumes the new `pct`. No other change.
- `src/lib/i18n.tsx` — add EN/JA strings for the tooltip and the breakdown label.

### Open questions

None — weights are fixed (60/10/10/10/10) and zero-answer worlds count as 0 by design, matching the user's intent.
