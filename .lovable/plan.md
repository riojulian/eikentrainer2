## Goal

When studying a specific stage (e.g. `?mission=3&world=tier1`), the flashcard header should show only what belongs to that stage — no "Free study" shortcut and no filter dropdown. Keep those controls available only in Free Study mode.

## Changes

**File: `src/routes/study.flashcards.tsx`**

Header (lines ~311–335):
- In **stage mode** (`missionParam && !freeMode`), render just:
  `[<] World · Stage N · 1/10`
  No "Free study" link, no filter `<Select>`.
- In **free mode**, keep the current header: `[<] World · 1/N · Free study` plus the All / Unseen filter dropdown on the right.

Logic cleanup:
- `filter` state and the filtered `useEffect` only run in free mode. In stage mode, `order` is always the full stage deck (no filter applied), so the "Review the X again" button on the done screen (which calls `setFilter("learning")`) should also be hidden in stage mode (stages don't filter).
- Remove the now-unused `Select*` imports if filter is no longer used in stage mode (kept for free mode, so imports stay).

## Result

Stage flashcard header becomes a single clean line: back arrow + `World · Stage N · idx/total`. No dropdown, no Free Study escape hatch — users finish the stage and return via the back arrow or the done screen.
