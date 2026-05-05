# Restore Achievements grid

## Problem
The full badge grid (First Timer, Marathon, etc., including unearned/greyed-out ones) is no longer visible. When `MasteryHeader` was introduced, it only renders earned badges as small chips, and `AchievementsStrip` was no longer mounted anywhere.

## Change
**`src/routes/study.index.tsx`**
- Import `AchievementsStrip` from `@/components/AchievementsStrip`.
- Render `<AchievementsStrip earned={earnedBadges} />` near the bottom of the page (after the StageMap card, before closing `</main>`), so all badges — earned and unearned — are visible again.

## Out of scope
- No changes to `MasteryHeader` (keeps its compact earned-only chips).
- No changes to badge logic, data, or i18n.
- `AchievementsStrip.tsx` itself stays as-is.
