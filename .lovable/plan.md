## Add Analytics page to Admin

Add a new "Analytics" tab in the admin area showing site traffic + signup metrics.

### 1. New nav tab — `src/routes/admin.tsx`
Add a 4th link `{ to: "/admin/analytics", label: "Analytics", icon: LineChart }` to the existing tab bar.

### 2. New route — `src/routes/admin.analytics.tsx`
Page with a date-range selector (Last 24h / 7 days / 30 days, default 7d) and these cards:

**Traffic (from Lovable production analytics)**
- Page views (total in range)
- Unique visitors (total in range)
- Daily line chart of page views + unique visitors

Data source: `analytics--read_project_analytics` (production-only). On the preview/dev domain we'll show a small note: "Traffic analytics show data from the published site (eikentango.com)."

**Users (from our database)**
- New signups in range — `count(profiles where created_at in range)`
- Total users — `count(profiles)`
- Daily bar chart of new signups
- (Per your answer, "new trial" = new signup, so a single metric.)

### 3. Server function — `src/lib/analytics.functions.ts`
`getSignupStats({ startDate, endDate })` using `requireSupabaseAuth` + admin role check. Returns `{ totalUsers, newSignups, daily: [{date, count}] }` from the `profiles` table.

For the traffic numbers, since Lovable analytics isn't queryable from app code, the analytics page will instead render fetched values that I include at build time via a small server function calling our internal analytics endpoint — if not exposable, we'll fall back to displaying a "View full traffic analytics" link/button that opens the Lovable analytics panel, while the in-app cards focus on signup data we own. I'll attempt the API integration first and degrade gracefully.

### 4. Access control
Route wrapped by existing `RequireAuth admin` (inherited from `/admin` layout).

### Out of scope
- "New trial" as a separate metric (same as signups for now — revisit when paid plans land).
- Per-page breakdowns / referrers (can add later).
