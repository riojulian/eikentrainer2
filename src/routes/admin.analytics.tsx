import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSignupStats } from "@/lib/analytics.functions";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ExternalLink } from "lucide-react";

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
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

function Analytics() {
  const [range, setRange] = useState<RangeKey>("7d");
  const params = useMemo(() => rangeFor(range), [range]);
  const fetchStats = useServerFn(getSignupStats);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-analytics", params],
    queryFn: () => fetchStats({ data: params }),
  });

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

      {/* Signup stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total users" value={data?.totalUsers ?? "—"} loading={isLoading} />
        <StatCard label="New signups" value={data?.newSignups ?? "—"} loading={isLoading} />
        <StatCard label="New trials" value={data?.newSignups ?? "—"} loading={isLoading} hint="Same as signups" />
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load signup stats.
        </div>
      )}

      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="font-display text-xl mb-3">New signups per day</div>
        {!data || data.daily.length === 0 ? (
          <p className="text-muted-foreground text-sm">No signups in this range.</p>
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

      {/* Traffic */}
      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="font-display text-xl">Traffic (page views & visitors)</div>
            <p className="text-sm text-muted-foreground mt-1">
              Page views, unique visitors, and traffic sources are tracked on the published site
              (eikentango.com). View detailed traffic analytics on the project insights dashboard.
            </p>
          </div>
        </div>
        <a
          href={`/projects/dacf7487-36ec-4542-a90f-362680b1ca86/settings/project-insights`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 mt-2 rounded-full bg-ink text-cream px-4 py-1.5 text-sm hover:opacity-90 transition"
        >
          Open traffic analytics <ExternalLink className="h-3.5 w-3.5" />
        </a>
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