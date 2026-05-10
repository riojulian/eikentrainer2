## Goal

Move the Category picker out of the main study page body and into the floating three-dots overflow menu in the header, so the hero (Study Flashcards card) becomes the first thing users see.

## Approach

The active category currently lives in `study.index.tsx` local state (`activeWorld`). To control it from the header dropdown, lift it into the URL as a search param (`?world=tier1`). The header reads/writes the param, the study page reads it as the source of truth.

## Changes

### 1. `src/routes/study.index.tsx`
- Add `validateSearch` to the route: `{ world?: string }`.
- Replace `useState<string>("tier1")` with `Route.useSearch()` + `useNavigate()`. `onWorldChange` becomes `navigate({ search: { world: next } })`.
- Remove the `WorldPicker` block (the "Pick a category" section, ~lines 322–329) entirely from the page.
- Keep the small gold `activeWorldLabel` eyebrow on the hero card so users still see which category is active. Add a tiny "Change ▾" hint next to it that opens the header menu (just a visual cue — no wiring needed; users tap the ⋮ button).

### 2. `src/components/AppHeader.tsx`
- Add a new "Category" section in the dropdown (above "Words I know" when on `/study`, or always — simpler).
- Fetch the same per-world summaries the study page builds. To avoid duplicating the fetch logic, extract the summary builder into `src/lib/worldSummaries.ts` (`fetchWorldSummaries(userId | null)`) and call it via `useQuery` from both the header and `study.index.tsx`.
- Render 5 `DropdownMenuItem`s, one per world: friendly name (Core/Topics/Reading/Niche/Phrases) + small "stage X / Y" subline + lock icon when empty. Selecting one calls `navigate({ to: "/study", search: { world: w } })`.
- Mark the active world with a check.

### 3. `src/components/WorldPicker.tsx`
- No longer used on the study page. Either delete the file or leave it for now (unused). Recommend deleting to keep the tree clean.

### 4. Translation strings (`src/lib/i18n.tsx`)
- Add `menu.category` ("Category" / 「カテゴリー」).
- Remove (or keep unused) `home.pickWorld` / `home.worldHint`.

## Out of scope
- No backend changes.
- No changes to flashcards/quiz routes.
- Hero card layout, WeakZone, and Tabs stay as they are.

## Visual sketch (mobile, 411px)

```text
┌─ Header ──────────────── [Study] [⋮] ─┐
                                   │
                                   ▼
                          ┌──────────────────┐
                          │ CATEGORY         │
                          │ • Core   3/8   ✓ │
                          │ • Topics 1/6     │
                          │ • Reading  —  🔒 │
                          │ • Niche    —  🔒 │
                          │ • Phrases 0/4    │
                          │ ─────────────    │
                          │ Words I know …   │
                          │ Weekly quiz …    │
                          └──────────────────┘

Hi, Alex 🌸

┌──────────────────────────────────┐
│ CORE  ·  Change ▾                │
│ Stage 3                          │
│ 10 words to learn                │
│ [  📖  Study Flashcards       ]  │
│        Or take the quiz →        │
└──────────────────────────────────┘

(WeakZone if any)
[ Progress | Map | Badges ]
```
