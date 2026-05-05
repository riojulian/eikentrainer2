
## Add Completeness alongside Readiness

A second top-of-home metric that answers a different question:

- **Readiness** = quiz accuracy (how reliably you answer correctly), weighted by world.
- **Completeness** = coverage (how many of the required Pre-1 words you actually know), segmented per world.

Both are needed: a learner can be 90% accurate on the 50 words they've touched (high readiness) while only knowing 5% of the full Pre-1 set (low completeness).

### Definition

```text
completeness_world(w) = mastered_in_w / total_active_in_w
completeness_total   = mastered_total / total_active_total   (unweighted, raw coverage)
```

Where `mastered = word_status.mastery >= 2` ("分かった" or "完全に習得"). Tier 1 mastery counts as 0.5 (partially known) so the bar moves earlier; thresholds:

- `mastery >= 2` → counts as 1.0 known
- `mastery == 1` → counts as 0.5 known
- `mastery == 0` or unseen → 0

This matches the existing 4-tier mastery system in `src/lib/words.ts` and rewards progress without requiring full mastery of every word.

Unlike Readiness, Completeness is **unweighted overall** — every world contributes proportionally to its size, because the goal is total coverage. Per-world bars still show each world's own coverage so the weighting story stays clear.

### Display

A second card under (or beside) the Readiness card:

```text
[ 🟦 23% ]  COMPLETENESS
            W1 41%  W2 12%  W3 5%  W4 0%  Ph 8%
            312 / 1340 words known
```

- Same ring style as Readiness, different accent color (blue/sage) to distinguish.
- Same color thresholds (red <50, amber 50–79, green ≥80).
- Per-world chips reuse the `WORLD_CHIP_LABEL` map already in `ReadinessHeader`.
- Tooltip: "Share of all Pre-1 words you've learned. Mastery 2+ = full credit, 1 = half."

On mobile (411px viewport) the two cards stack vertically.

### Files to change

- **`src/lib/gamification.ts`** — add `getCompleteness(studentId)`:
  - Fetch all active words grouped by tier (reuse cached `fetchActiveWords()` from `words.ts` to avoid a second query).
  - Fetch `word_status` for the user (mastery + word_id).
  - Compute per-world `{ known, total, pct }` and an overall `{ known, total, pct }` using the half-credit rule.
  - Return `{ pct, known, total, perWorld: Record<string, { pct; known; total }> }`.
- **`src/components/CompletenessHeader.tsx`** — new component, mirrors `ReadinessHeader` layout (ring + per-world chips + caption). No badge/streak section — those stay on Readiness only.
- **`src/routes/study.index.tsx`**:
  - Call `getCompleteness(user.id)` in the initial-load `Promise.all`.
  - Add `<CompletenessHeader … />` directly under the existing `<ReadinessHeader />`.
- **`src/lib/i18n.tsx`** — add EN/JA strings: `cmp.title`, `cmp.caption` ("{known} / {total} words known" / "{known} / {total} 語習得"), `cmp.tooltip`.

### Out of scope

- No DB changes. No new tables. The metric is derived live from `words` + `word_status`.
- Quiz results (`quiz_results`) are not consulted — completeness is purely about mastery state, not test history.
- No badge tied to completeness yet (can add later, e.g. "Pre-1 Ready: ≥80% completeness").
