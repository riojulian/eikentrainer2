## Problem

Your account `riojulian@gmail.com` IS correctly assigned the `admin` role in the database (verified via query — both `student` and `admin` rows exist for your user). The admin page is unreachable because of a race condition in the route guard, not a permissions issue.

### Root cause

`src/components/RequireAuth.tsx` only waits for `loading` (initial session restore). It does NOT wait for the role lookup to finish. Flow when you click "Admin":

1. `RequireAuth admin` renders.
2. `loading === false` (session is restored), but `role` is still `null` because `loadProfile()` runs in a `setTimeout` and hasn't resolved yet.
3. `role !== "admin"` → immediately `<Navigate to="/study" />`.
4. By the time the role actually loads as `"admin"`, you've already been bounced to /study.

Additionally, `src/routes/auth.tsx` always navigates to `/study` after sign-in, even for admins.

## Fix

### 1. Track role-loading state in `src/lib/auth.tsx`
- Add `roleLoading: boolean` to the auth context.
- Set it `true` whenever `loadProfile` starts and `false` when it resolves (or when there's no user).
- Expose it from the provider.

### 2. Gate `src/components/RequireAuth.tsx` on role readiness
- When `admin` is required, wait for both `loading` AND `roleLoading` to be false before deciding.
- Only then check `role !== "admin"` and redirect.
- Show the same "Loading…" placeholder during role load instead of redirecting prematurely.

### 3. Send admins to `/admin` after sign-in (`src/routes/auth.tsx`)
- After `signInWithPassword`, `await` a fresh role lookup (or read from context once `roleLoading` flips false) and navigate to `/admin` if admin, else `/study`.
- Simplest implementation: query `user_roles` for the just-signed-in user inline and branch on the result before calling `navigate`.

### 4. Minor: dedupe role rows
- Your user has two rows in `user_roles` (`student` + `admin`). Not a bug (the code uses `.some(r => r.role === "admin")`), but I'll delete the leftover `student` row for `dcfe2fac-…` so the data is clean.

## What you'll see after the fix

- Sign in as `riojulian@gmail.com` → land directly on `/admin/words`.
- Clicking "Admin" in the header from any page works without bouncing to /study.
- Non-admins still get redirected to /study as before.

No schema changes, no new routes — just three small file edits and one cleanup row delete.