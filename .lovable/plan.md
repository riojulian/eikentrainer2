## Cache `fetchActiveWords` results in `src/lib/words.ts`

Replace the current `fetchActiveWords` (lines 62–78) with a module-level memoized version so repeated callers share a single in-flight/resolved promise instead of re-paginating the full word list on every navigation.

### Change

- Add a module-scoped `_wordsCache: Promise<Word[]> | null = null`.
- `fetchActiveWords()` becomes synchronous-shaped: returns the cached promise if present, otherwise builds it via the same paginated loop already in place.
- On error, reset `_wordsCache = null` inside the async IIFE so the next call retries instead of permanently caching a rejection.
- Keep pagination logic identical (`PAGE = 1000`, `range(offset, offset+PAGE-1)`, break when short page).

### Notes / trade-offs

- Cache lives for the lifetime of the JS module (page session). A hard refresh clears it. Admin word edits won't appear until refresh — acceptable for student study flow; admins already reload after edits.
- No API change: signature stays `(): Promise<Word[]>`, all current `await fetchActiveWords()` callers keep working.
- No DB / schema changes.