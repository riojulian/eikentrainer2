I found two concrete causes behind the “loading all the time” and admin redirect behavior:

1. The backend function used by role-based security still does not have execute permission for signed-in users in the live database. Recent requests are failing with `permission denied for function has_role`, which breaks role loading, profile loading, admin checks, and word status reads.
2. The frontend is doing repeated uncached reads for words/statuses and role/profile data. When one of those role/status reads fails or races, admin routes can temporarily think the user is not admin and redirect back to `/study`.

Plan to fix it carefully:

1. Repair backend role permissions
   - Add a new migration that definitely grants execute access on `public.has_role(uuid, public.app_role)` to signed-in users.
   - Keep `handle_new_user` locked down.
   - Add missing performance indexes for common student-status/admin queries, especially `word_status(student_id)` and `quiz_results(word_id)`.
   - Verify the database reports that signed-in users can execute `has_role` before relying on the UI.

2. Make auth and role loading stable
   - Update `src/lib/auth.tsx` so role/profile loading handles errors explicitly instead of silently falling back to `student`.
   - Prevent duplicate initial role loads from `onAuthStateChange` plus `getSession` running at the same time.
   - Debounce or limit focus/visibility role refreshes so the app does not keep flipping into loading states.
   - Keep the last known role during background refreshes, so an admin is not briefly treated as a student.

3. Stop admin route redirect loops
   - Update `RequireAuth` so admin pages wait for role resolution and show a stable loading/error state instead of redirecting to `/study` when role loading fails.
   - If role loading fails because permissions are broken, show a clear retry message rather than bouncing routes.
   - Keep `/admin` and `/admin/upload` accessible once the resolved role is `admin`.

4. Speed up study data loading
   - Add shared cached query helpers for active words and the signed-in user’s word statuses using TanStack Query.
   - Wire the QueryClient provider into the root route/router setup.
   - Convert `/study`, `/study/list`, `/study/flashcards`, and `/study/quiz` to use the shared cache instead of each page refetching words and statuses independently.
   - Add proper loading/error states so failed status reads do not make the word list look empty.

5. Improve admin data loading resilience
   - Update admin word/progress pages to surface backend errors with retry controls instead of staying on “Loading…” forever.
   - Keep admin word-bank reads lightweight and cached where appropriate.

6. Verify after implementation
   - Confirm the database permission check for `has_role` returns true for signed-in users.
   - Confirm `/study/list` shows the 5 active words quickly.
   - Confirm `/admin` resolves to the admin area and `/admin/upload` does not redirect to `/study` for Rio’s admin account.
   - Check browser network/errors for remaining 403s or stuck loading states.