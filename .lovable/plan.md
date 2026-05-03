# Connect World ↔ Stage

## Concept

Today, all words across all worlds are concatenated into one global stage list. We change it so **each World owns its own stage track**. Stage count per world is derived: `ceil(activeWords[world] / 10)`.

Example with 10 words/stage:
- World 1 (Core, ~200 words) → 20 stages
- World 4 (Very specific, ~700 words) → 70 stages
- Empty world → 0 stages (hidden)

A user is "in" one world at a time, and has an **independent current stage per world** (so switching worlds doesn't lose progress).

## Data model

Schema change:
- `study_progress`: add `current_world text` (nullable, default `'tier1'`).
- New table `world_progress (student_id uuid, world text, current_stage int default 1, updated_at timestamptz, primary key (student_id, world))` with RLS (own rows).

Stage attempts already store `stage_index`; we add `world text` (nullable) so stars are scoped per world. Backfill old rows as `null` (treated as legacy/global, not shown in new per-world maps).

## Logic (`src/lib/stages.ts`)

Rewrite around worlds:

```ts
export function stagizeByWorld(words: Word[]): Record<string, Word[][]> {
  // group active words by tier in fixed WORLD_ORDER, then chunk by 10
}

getCurrentWorld(studentId): string
setCurrentWorld(studentId, world)
getWorldProgress(studentId, world): { current_stage }
setWorldStage(studentId, world, stage)
getStarsByStage(studentId, world): Record<number, 0|1|2|3>
buildStageQuiz(stagesForWorld, stageIndex)  // unchanged shape
```

Word ordering: drop the cross-world `student_word_order` rebuild flow. Words inside a world are still shuffled deterministically per student (seeded by `student_id + world`), so stage membership is stable but personalized. `ensureWordOrder` becomes per-world and stores rows tagged with `world`.

Migration: add `world text` column to `student_word_order`; existing rows tagged `null` are ignored and re-seeded on next load.

## Dashboard UI (`src/routes/study.index.tsx`)

Replace the "Start stages from" select with a **World Picker** row:

```text
[ World 1 ★★☆ 4/20 ] [ World 2 ★☆☆ 1/15 ] [ World 3 ✕ ] [ World 4 0/70 ] [ World 5 ]
   selected               
```

- Horizontal scroll on mobile, grid on sm+.
- Each card shows: world short name, color band (existing TIER_BAND), `currentStage / totalStages`, and aggregate stars (sum of stage stars / max).
- Worlds with 0 active words are shown disabled.
- Selecting a world updates `study_progress.current_world` and re-renders the rest of the dashboard for that world only.

The "Current stage" card, "Your journey" StageMap, and stage quiz CTAs all read from the **selected world's** stage list and progress. The `StageMap` already supports `tierByStage`; since one world = one tier, the band is uniform but kept for visual identity.

Weekly/Monthly review tiles, Achievements, "Browse all words" stay global (unchanged).

## StageMap

No prop changes. Receives the per-world stages and per-world stars/current. Header above it shows: `World 4: Very Specific — Stage 12 of 70`.

## Files touched

- `supabase/migrations/*` — add `world` to `study_progress`, `student_word_order`, `stage_attempts`; create `world_progress` (or just reuse `study_progress` keyed by world — see Open question).
- `src/lib/stages.ts` — rewrite per-world.
- `src/lib/words.ts` — add `WORLD_ORDER` export.
- `src/routes/study.index.tsx` — World Picker + per-world wiring.
- `src/components/StageMap.tsx` — minor heading text only.
- `src/routes/study.flashcards.tsx`, `src/routes/study.quiz.tsx` — read stages for the active world (via `current_world`) instead of the global list.

## Open question (need your call before I build)

Per-world current stage storage:
1. **New `world_progress` table** (cleanest, scales if we add more per-world fields later).
2. **Reuse `study_progress`** by changing PK to `(student_id, world)` (simpler, but a heavier migration of existing row).

I recommend option 1.
