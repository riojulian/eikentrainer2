import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin/analytics")({
  component: Analytics,
});

type RangeKey = "24h" | "7d" | "30d";

function rangeFor(key: RangeKey) {
  const end = new Date();
  const start = new Date(end);
  if (key === "24h") start.setUTCDate(end.getUTCDate() - 1);
  else if (key === "7d") start.setUTCDate(end.getUTCDate() - 6);
  else start.setUTCDate(end.getUTCDate() - 29);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

type Stats = { totalUsers: number; newSignups: number; daily: { date: string; count: number }[] };

type PageRow = { path: string; views: number; avg_seconds: number };
type DemoRow = { key: string; count: number };
type ActivityRow = { email: string | null; path: string; created_at: string };

function Analytics() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [data, setData] = useState<Stats | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [countries, setCountries] = useState<DemoRow[]>([]);
  const [devices, setDevices] = useState<DemoRow[]>([]);
  const [totals, setTotals] = useState<{ pageviews: number; uniqueVisitors: number }>({ pageviews: 0, uniqueVisitors: 0 });
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { start, end } = useMemo(() => rangeFor(range), [range]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [{ count: totalUsers, error: e1 }, { data: rows, error: e2 }, { data: views, error: e3 }] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase
            .from("profiles")
            .select("created_at")
            .gte("created_at", start.toISOString())
            .lte("created_at", end.toISOString())
            .order("created_at", { ascending: true }),
          supabase
            .from("page_views")
            .select("path,visitor_id,user_id,country,device,duration_ms,created_at")
            .gte("created_at", start.toISOString())
            .lte("created_at", end.toISOString())
            .limit(10000),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        if (e3) throw e3;

        const byDay = new Map<string, number>();
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          byDay.set(d.toISOString().slice(0, 10), 0);
        }
        (rows ?? []).forEach((r) => {
          const k = new Date(r.created_at).toISOString().slice(0, 10);
          byDay.set(k, (byDay.get(k) ?? 0) + 1);
        });
        const daily = [...byDay.entries()].map(([date, count]) => ({ date, count }));

        // Aggregate page views
        const v = views ?? [];
        const pageMap = new Map<string, { views: number; total: number; durSum: number; durCount: number }>();
        const countryMap = new Map<string, number>();
        const deviceMap = new Map<string, number>();
        const visitors = new Set<string>();
        v.forEach((r: any) => {
          visitors.add(r.visitor_id);
          const p = pageMap.get(r.path) || { views: 0, total: 0, durSum: 0, durCount: 0 };
          p.views += 1;
          if (r.duration_ms != null) { p.durSum += r.duration_ms; p.durCount += 1; }
          pageMap.set(r.path, p);
          if (r.country) countryMap.set(r.country, (countryMap.get(r.country) ?? 0) + 1);
          if (r.device) deviceMap.set(r.device, (deviceMap.get(r.device) ?? 0) + 1);
        });
        const topPages: PageRow[] = [...pageMap.entries()]
          .map(([path, p]) => ({ path, views: p.views, avg_seconds: p.durCount ? Math.round(p.durSum / p.durCount / 1000) : 0 }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 20);
        const topCountries: DemoRow[] = [...countryMap.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 10);
        const topDevices: DemoRow[] = [...deviceMap.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);

        // Recent activity for logged-in users
        const recent = [...v].filter((r: any) => r.user_id).sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 50);
        const userIds = [...new Set(recent.map((r: any) => r.user_id))];
        const emailMap = new Map<string, string>();
        if (userIds.length) {
          const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", userIds);
          profs?.forEach((p: any) => emailMap.set(p.id, p.display_name || ""));
        }
        const activityRows: ActivityRow[] = recent.map((r: any) => ({
          email: emailMap.get(r.user_id) || null,
          path: r.path,
          created_at: r.created_at,
        }));

        if (!cancelled) {
          setData({ totalUsers: totalUsers ?? 0, newSignups: rows?.length ?? 0, daily });
          setPages(topPages);
          setCountries(topCountries);
          setDevices(topDevices);
          setTotals({ pageviews: v.length, uniqueVisitors: visitors.size });
          setActivity(activityRows);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [start, end]);

  const ranges: { key: RangeKey; label: string }[] = [
    { key: "24h", label: "Last 24h" },
    { key: "7d", label: "Last 7 days" },
    { key: "30d", label: "Last 30 days" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Analytics</h1>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {ranges.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1 text-sm rounded-full transition ${
                range === r.key ? "bg-ink text-cream" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total users" value={data?.totalUsers ?? "—"} loading={loading} />
        <StatCard label="New signups" value={data?.newSignups ?? "—"} loading={loading} />
        <StatCard label="Page views" value={totals.pageviews} loading={loading} />
        <StatCard label="Unique visitors" value={totals.uniqueVisitors} loading={loading} />
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="font-display text-xl mb-3">New signups per day</div>
        {!data || data.daily.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data yet.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="oklch(0.74 0.13 80)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="font-display text-xl mb-3">Top pages</div>
        {pages.length === 0 ? (
          <p className="text-muted-foreground text-sm">No page views yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Page</th><th className="py-2">Views</th><th className="py-2">Avg time</th></tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.path} className="border-t">
                    <td className="py-2 font-mono">{p.path}</td>
                    <td className="py-2">{p.views}</td>
                    <td className="py-2">{p.avg_seconds ? `${p.avg_seconds}s` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <DemoCard title="Top countries" rows={countries} empty="No country data yet." />
        <DemoCard title="Devices" rows={devices} empty="No device data yet." />
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="font-display text-xl mb-3">Recent user activity</div>
        {activity.length === 0 ? (
          <p className="text-muted-foreground text-sm">No logged-in user activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">User</th><th className="py-2">Page</th><th className="py-2">Viewed at</th></tr>
              </thead>
              <tbody>
                {activity.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-2">{r.email || "—"}</td>
                    <td className="py-2 font-mono">{r.path}</td>
                    <td className="py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, loading, hint }: { label: string; value: number | string; loading?: boolean; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl">{loading ? "…" : value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function DemoCard({ title, rows, empty }: { title: string; rows: DemoRow[]; empty: string }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="font-display text-xl mb-3">{title}</div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="text-sm">
              <div className="flex justify-between mb-1"><span>{r.key}</span><span className="text-muted-foreground">{r.count}</span></div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-ink" style={{ width: `${(r.count / total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
