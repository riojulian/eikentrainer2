## Changes to `src/routes/admin.progress.tsx`

**1. Remove the "Per-student breakdown" table**
- Delete the entire breakdown table block and the `StudentRow` type / `studentRows` memo logic that powers it.
- Keep the student dropdown at the top (still needed to filter the rest of the page). Populate its options from `profiles` directly instead of `studentRows`.
- Drop the now-unused `student_stats` fetch and the `Table*` imports.

**2. Fix "Total words" showing 1000**
- Real active count in DB is **2141**, but the page shows 1000. Cause: the current code does `supabase.from("words").select("id,word")…` and uses `words.length` as the total. PostgREST caps row payloads, and we only need the count, not the rows.
- Replace the words fetch with a head-count query:
  ```ts
  supabase.from("words").select("*", { count: "exact", head: true }).eq("is_active", true)
  ```
  Use the returned `count` as `totalWords`.
- For the "Words to revisit" list we still need word text → fetch only the words that actually appear in `quiz_results` (`.in("id", [...wordIds])`) instead of pulling the whole table.

**3. Result**
- Admin dropdown remains, filters mastery distribution / accuracy chart / weak words per student (or All).
- Total words reflects true active count (2141, kept in sync automatically).
- No giant per-student table cluttering the page.