# Fix: "No stages in World 1: Core yet" appears even though words exist

## Root causes

I checked the database and the relevant code paths. Two real bugs are combining to produce this message.

### 1. Empty-state flashes during loading (primary cause)

In `src/routes/study.index.tsx`:

- `activeWorld` is initialized to `"tier1"`, and `stages` is initialized to `[]`.
- `hasStages = stages.length > 0` is computed unconditionally on every render.
- While the two `useEffect` hooks are still loading (`fetchActiveWords`, `ensureWorldOrder`, `getStarsByStage`, …), `stages` is still `[]`, so the page renders the **"No stages in World 1: Core yet"** empty card on every visit until the data resolves. On a slow connection or cold tab this is very visible — it looks permanent.

There is no `loading` flag distinguishing "data not loaded yet" from "world genuinely has 0 stages".

### 2. Supabase 1000-row default limit hides words

`fetchActiveWords()` in `src/lib/words.ts` does:

```ts
supabase.from("words").select("*").eq("is_active", true).order("created_at", { ascending: true })
```

The DB currently has **1633 active words**. Supabase caps a single `select` at 1000 rows by default, so the client only ever sees the oldest 1000. Confirmed by querying the DB:

- Total active words: 1633 (tier1: 331, tier2: 693, tier3: 435, tier4: 140, NULL tier: 34)
- First 1000 by `created_at`: tier1 316, tier2 366, tier3 221, tier4 63, NULL 34
- The remaining ~633 newer words (including most of tier4 and some of every other tier) are silently dropped.

This affects every screen that calls `fetchActiveWords` (study home, flashcards, quiz, list). It also explains why `student_word_order` rows top out at exactly the truncated counts (e.g. tier1 = 316 for some students).

There are no `phrases` rows in the DB at all, so World 5 is correctly empty — that part of the UI is working as intended.

## Fix

### A. Remove the 1000-row limit in `src/lib/words.ts`

Update `fetchActiveWords` to page through all rows using `.range()` until fewer than the page size come back. Keep the `created_at ASC` ordering so existing `student_word_order` positions stay stable.

```text
fetchActiveWords:
  page = 1000
  for offset = 0; ; offset += page:
    rows = select * from words where is_active eq true
              order by created_at asc
              range(offset, offset + page - 1)
    push rows
    if rows.length < page: break
  return all
```

This is a one-function change and fixes the data shortfall everywhere it's used.

### B. Add a loading guard in `src/routes/study.index.tsx`

- Add `const [loading, setLoading] = useState(true);` and set it `false` at the end of the first effect (in a `finally` so errors don't leave it stuck).
- Render order in the JSX:
  - if `loading` → render a small skeleton/placeholder card ("Loading your stages…") instead of the stages block.
  - else if `hasStages` → existing stage UI.
  - else → existing "No stages in {world} yet" empty state.

This way the empty card only appears when the world is genuinely empty, not while fetching.

## Files touched

- `src/lib/words.ts` — paginate `fetchActiveWords`.
- `src/routes/study.index.tsx` — add `loading` state and gate the empty-state render.

## Out of scope

- No DB migration. No RLS change. No change to `phrases` (genuinely empty).
- Other call sites of `fetchActiveWords` automatically benefit from the pagination fix.
