# New Reward & Punishment System

Replace the current Level / XP / 🔥 day-streak / star bar with a simpler, more meaningful loop:

## Reward layer

1. **🟢 Readiness Score (live %)**
   - A single number, 0–100%, that updates after every quiz answer.
   - Formula: `correct_answers_all_time / total_answers_all_time * 100`.
   - Source of truth: the existing `quiz_results` table — no new table needed.
   - Shown big and bold at the top of `/study` (replaces the current StatsHeader level pill), with a colored ring:
     - red < 50%, amber 50–79%, green ≥ 80%.
   - Also shown live during the quiz (small chip in the header) so the user feels it tick up/down per answer.

2. **🔥 Session Streak**
   - Counts **consecutive completed sessions** (a "session" = a finished stage quiz, weekly, or monthly review). It is no longer day-based.
   - Resets to 0 only if the user abandons a session midway *and* starts a new one (or, simpler: never resets — just counts total completed sessions in a row from app open. Decision in Q1 below.)
   - Persisted on `student_stats.current_streak` / `longest_streak` (we reuse the columns; no migration).

3. **🏅 4 Unlockable Badges** (replaces the current 10-badge wall)
   | Key | Name | Trigger |
   |---|---|---|
   | `streak_5` | 5-Streak | Session streak reaches 5 |
   | `mc_master` | MC Master | 20 correct multiple-choice answers in a row |
   | `fill_pro` | Fill Pro | 20 correct fill-in answers in a row (placeholder until fill-in mode exists — see Q3) |
   | `vocab_ready` | Vocab Ready | Readiness ≥ 80% with at least 50 answers logged |
   - Awarded via the existing `student_badges` table (just new keys).
   - On unlock: `toast.success("🏅 Badge unlocked: …")` from sonner.

## Punishment layer

4. **🔴 Weak Zone strip** — persistent, on the home screen
   - A horizontally-scrolling red strip just under the Readiness ring titled "弱点 / Weak Zone".
   - Each chip = a word the user got wrong recently. Tapping a chip opens a tiny review (flip card with definition + example).
   - A word leaves the Weak Zone after the user gets it correct twice in a row in any subsequent quiz.
   - Implementation: derive from existing `quiz_results` (last N rows per word). No schema change required.

5. **✗ Wrong answer behavior in quiz**
   - Correct answer is revealed immediately (already happens).
   - The word is added to the Weak Zone (implicit via the wrong row in `quiz_results`).
   - **No hearts, no XP loss, no stage failure** — the only "punishment" is the visible red zone growing.
   - Remove star bonuses, XP awards, and the "stepped back" mastery downgrade in `applyQuizResult` so the system is purely accuracy-driven.

## What gets removed

- `StatsHeader` (Level pill + XP bar + 🔥 streak + ⭐ XP chip) — replaced by `ReadinessHeader` (ring + session streak chip + 4-badge row).
- The 3-star stage results screen — replaced by a results screen that just shows: score, readiness delta (e.g. "78% → 81%"), any weak-zone additions, any new badges.
- All XP constants, `levelFromXp`, `xpForLevel`, `awardXp`.
- Old badges in `BADGES` array (replaced with the 4 above). Old earned rows stay in DB but are simply never displayed.
- `AchievementsStrip`'s grid — folded into a compact 4-icon row inside the new header.

## Files touched

- `src/lib/gamification.ts` — replace XP/level/badges with `getReadiness()`, `bumpSessionStreak()`, new BADGES, new `checkBadges()` triggers.
- `src/lib/weakZone.ts` *(new)* — `getWeakWords(userId)` derived from `quiz_results`, `isStillWeak(wordId)`.
- `src/components/ReadinessHeader.tsx` *(new)* — ring + streak + 4 badges.
- `src/components/WeakZoneStrip.tsx` *(new)* — horizontal red chips on home + mini review dialog.
- `src/routes/study.index.tsx` — swap `StatsHeader` + `AchievementsStrip` for the two new components.
- `src/routes/study.quiz.tsx` — remove XP/star math, add live readiness chip in the header, simplify results screen.
- `src/lib/words.ts` — neutralize the demote-on-wrong branch in `applyQuizResult` (or keep mastery, but stop punishing).
- `src/lib/i18n.tsx` — add EN/JA strings: "Readiness", "Weak Zone", "Session streak", badge names.

## Open questions

Please answer these so we can lock the design before building.

```text
Q1. Session streak reset rule
Q2. "Fill Pro" badge — do we have a fill-in quiz mode planned, or should this badge be replaced now?
Q3. Should we hide all old XP/level/star data on screen but keep writing to the DB for safety, or fully stop writing?
Q4. Weak Zone size cap on home screen (e.g. show last 12 with "+N more" link)?
```
