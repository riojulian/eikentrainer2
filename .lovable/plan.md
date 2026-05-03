
# Rename Mission → Stage + Gamification Plan

## Part 1: Rename "Mission" → "Stage"

Straight find/replace across the codebase, mirroring the previous chunk→mission rename.

**Database migration**
- Rename table `mission_attempts` → `stage_attempts`
- Rename column `mission_index` → `stage_index`
- Rename `study_progress.current_mission` → `current_stage`
- Rename `study_progress.mission_size` → `stage_size`

**Code**
- Rename `src/lib/missions.ts` → `src/lib/stages.ts`
- `buildMissionQuiz` → `buildStageQuiz`, `setCurrentMission` → `setCurrentStage`, `MISSION_SIZE` → `STAGE_SIZE`, `missionize` → `stagize` (or `chunkIntoStages`)
- URL params: `?mission=N` → `?stage=N`, `?mode=mission` → `?mode=stage`
- UI labels in `study.index.tsx`, `study.flashcards.tsx`, `study.quiz.tsx`: "Stage 3 of 12", "Study stage", "Take stage quiz", etc.

---

## Part 2: Gamification — Stage as a Game Level

Theme: each Stage is a "level" the student climbs. Visible progress, small rewards, no punishment.

### Mechanics to add

**1. Stars per stage (1–3)**
Earned on the stage quiz:
- 1 star: ≥60% (6/10)
- 2 stars: ≥80% (8/10)
- 3 stars: 100% (10/10)
Best score is kept. Re-taking can upgrade stars but never downgrade.

**2. XP points**
- +10 XP per correct quiz answer
- +5 XP first time a flashcard is marked "known"
- +50 XP bonus for 3-starring a stage
- +25 XP for completing weekly review, +100 XP for monthly review
Total XP shown in header; drives a simple **level** number (e.g. level = floor(sqrt(XP/100))).

**3. Streak**
Daily streak counter (consecutive days with at least one quiz or flashcard session). Flame icon + day count in header. Soft reset (grace day) optional.

**4. Stage map / path UI**
Replace the current "Stage N of M" card with a vertical or horizontal **path** of stage nodes (think Duolingo). Each node shows:
- Stage number
- Lock/unlock state (still no hard gating — just a visual hint that earlier stages are "recommended first")
- Stars earned (0–3)
- Current stage highlighted with a pulse
Tapping a node opens the stage detail (study + quiz CTAs).

**5. Badges / achievements**
Awarded silently and shown on a small "Achievements" strip:
- First Steps — finish stage 1
- Tier Crusher — 3-star every stage in a tier
- Marathon — 7-day streak
- Perfectionist — 3-star 10 stages
- Phrase Master — finish all phrase stages
- Early Bird — quiz before 8am, etc.

**6. Tier progression visual**
Color the stage path by tier (Tier 1 rose, Tier 2 amber…) so the student can see "I'm 2 stages into Tier 3". Show a celebratory screen when crossing into a new tier.

**7. End-of-stage result screen**
Currently: score + CTA. Add:
- Star animation (1/2/3 stars filling)
- XP gained this round (+30 XP)
- Streak update ("Day 4 🔥")
- Any badges unlocked
- CTA: "Next stage →" or "Retry for 3 stars"

### What we'd build

**DB additions**
- `stage_attempts` already stores score/total — derive stars from best score; no schema change needed for stars.
- New table `student_stats`: `student_id pk`, `xp int`, `current_streak int`, `longest_streak int`, `last_active_date date`
- New table `student_badges`: `student_id`, `badge_key text`, `earned_at`
- RLS: own rows only

**New helper: `src/lib/gamification.ts`**
- `awardXp(studentId, amount, reason)`
- `bumpStreak(studentId)` (called on any study/quiz action; handles same-day, +1 day, reset)
- `getStarsForStage(studentId, stageIndex)` — best score → 0/1/2/3
- `checkBadges(studentId)` — evaluates after each attempt, inserts new badges
- `getStats(studentId)` — XP, level, streak, badges

**UI additions**
- `src/components/StageMap.tsx` — the path of stage nodes
- `src/components/StatsHeader.tsx` — XP, level, streak in `AppHeader` (or study layout)
- `src/components/StageResult.tsx` — animated end-of-quiz screen
- `src/components/AchievementsStrip.tsx` — badge list on study home

### Scope for first pass (recommended)

To avoid a giant change, ship in 2 steps:

**Step A (this turn): Rename + Stars + Stage Map**
- All the rename work
- Stars (1–3) per stage based on best quiz score
- New visual stage map replacing the current "current/upcoming" card
- Animated star result screen

**Step B (follow-up turn): XP + Streaks + Badges**
- `student_stats` and `student_badges` tables
- XP/level/streak in header
- Badge definitions + achievements strip

### Questions before I build

1. **Scope:** ship Step A only first, or do A+B in one go?
2. **Star thresholds:** keep 60/80/100, or softer (50/70/90)?
3. **Stage map style:** vertical scroll path (Duolingo-like) or horizontal carousel?
4. **Theme tone:** playful/colorful (kids) or clean/minimal (adult learners)?
