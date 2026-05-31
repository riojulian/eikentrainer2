import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { MASTERY_LABELS, MASTERY_BG, type Mastery } from "@/lib/words";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin/progress")({
  component: Progress,
});

type Stats = {
  totalWords: number;
  tiers: Record<Mastery, number>;
  unseen: number;
  daily: { date: string; correct: number; total: number; accuracy: number }[];
  weakest: { word: string; mastery: Mastery; updatedAt: string }[];
};

type RawData = {
  totalWords: number;
  profiles: { id: string; display_name: string | null }[];
  statuses: { student_id: string; word_id: string; mastery: number; updated_at: string }[];
  results: { student_id: string; word_id: string; correct: boolean; taken_at: string }[];
  wordsMeta: { id: string; category: string | null }[];
};

function Progress() {
  const [raw, setRaw] = useState<RawData | null>(null);
  const [studentId, setStudentId] = useState<string>("all");

  useEffect(() => {
    (async () => {
      async function fetchAll<T>(
        build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
      ): Promise<T[]> {
        const PAGE = 1000;
        let from = 0;
        const out: T[] = [];
        while (true) {
          const { data } = await build(from, from + PAGE - 1);
          const rows = data ?? [];
          out.push(...rows);
          if (rows.length < PAGE) break;
          from += PAGE;
        }
        return out;
      }

      const [{ count: wordsCount }, { data: profiles }, statuses, results] = await Promise.all([
        supabase.from("words").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("profiles").select("id,display_name").range(0, 9999),
        fetchAll<RawData["statuses"][number]>((f, t) =>
          supabase.from("word_status").select("student_id,mastery,word_id,updated_at").range(f, t),
        ),
        fetchAll<RawData["results"][number]>((f, t) =>
          supabase
            .from("quiz_results")
            .select("student_id,word_id,correct,taken_at")
            .order("taken_at", { ascending: true })
            .range(f, t),
        ),
      ]);
      const wordsMeta = await fetchAll<RawData["wordsMeta"][number]>((f, t) =>
        supabase.from("words").select("id,category").eq("is_active", true).range(f, t),
      );
      const rawResults = results as RawData["results"];
      const rawStatuses = statuses as RawData["statuses"];
      const wordIds = [
        ...new Set([
          ...rawResults.map((r) => r.word_id),
          ...rawStatuses.map((r) => r.word_id),
        ]),
      ];
      let wordTexts: { id: string; word: string }[] = [];
      if (wordIds.length) {
        const CHUNK = 200;
        for (let i = 0; i < wordIds.length; i += CHUNK) {
          const slice = wordIds.slice(i, i + CHUNK);
          const { data } = await supabase.from("words").select("id,word").in("id", slice);
          if (data) wordTexts.push(...data);
        }
      }
      (window as any).__wordTexts = wordTexts;
      setRaw({
        totalWords: wordsCount ?? 0,
        profiles: profiles ?? [],
        statuses: rawStatuses,
        results: rawResults,
        wordsMeta,
      });
    })();
  }, []);

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    raw?.profiles.forEach((p) => m.set(p.id, p.display_name ?? "—"));
    return m;
  }, [raw]);

  const s = useMemo<Stats | null>(() => {
    if (!raw) return null;
    const statuses = studentId === "all" ? raw.statuses : raw.statuses.filter((r) => r.student_id === studentId);
    const results = studentId === "all" ? raw.results : raw.results.filter((r) => r.student_id === studentId);

    const totalWords = raw.totalWords;
      const tiers: Record<Mastery, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
      let seen = 0;
      statuses.forEach((r) => {
        const m = r.mastery as Mastery;
        if (m >= 0 && m <= 3) { tiers[m]++; seen++; }
      });
      const unseen = Math.max(0, totalWords - seen);

      const byDay = new Map<string, { c: number; t: number }>();
      results.forEach((r) => {
        const d = new Date(r.taken_at).toISOString().slice(0, 10);
        const v = byDay.get(d) ?? { c: 0, t: 0 };
        v.t++; if (r.correct) v.c++;
        byDay.set(d, v);
      });
      const daily = [...byDay.entries()].map(([date, v]) => ({ date, correct: v.c, total: v.t, accuracy: Math.round((v.c / v.t) * 100) }));

      const wordTexts = ((typeof window !== "undefined" ? (window as any).__wordTexts : []) ?? []) as { id: string; word: string }[];
      const wordIdToText = new Map(wordTexts.map((w) => [w.id, w.word]));
      // Align with student-facing Weak Zone: mastery 0 or 1, newest first.
      const weakest = studentId === "all"
        ? (() => {
            // Aggregate: pick lowest mastery per word across students, newest update.
            const byWord = new Map<string, { m: Mastery; u: string }>();
            statuses.forEach((r) => {
              if (r.mastery > 1) return;
              const cur = byWord.get(r.word_id);
              if (!cur || r.mastery < cur.m || (r.mastery === cur.m && r.updated_at > cur.u)) {
                byWord.set(r.word_id, { m: r.mastery as Mastery, u: r.updated_at });
              }
            });
            return [...byWord.entries()]
              .map(([id, v]) => ({ word: wordIdToText.get(id) ?? "—", mastery: v.m, updatedAt: v.u }))
              .sort((a, b) => (a.mastery - b.mastery) || (b.updatedAt.localeCompare(a.updatedAt)))
              .slice(0, 8);
          })()
        : statuses
            .filter((r) => r.mastery <= 1)
            .sort((a, b) => (a.mastery - b.mastery) || b.updated_at.localeCompare(a.updated_at))
            .slice(0, 8)
            .map((r) => ({ word: wordIdToText.get(r.word_id) ?? "—", mastery: r.mastery as Mastery, updatedAt: r.updated_at }));

    return { totalWords, tiers, unseen, daily, weakest };
  }, [raw, studentId]);

  if (!s) return <div className="text-muted-foreground">Loading…</div>;

  const segments = [
    { label: MASTERY_LABELS[0], count: s.tiers[0], cls: MASTERY_BG[0] },
    { label: MASTERY_LABELS[1], count: s.tiers[1], cls: MASTERY_BG[1] },
    { label: MASTERY_LABELS[2], count: s.tiers[2], cls: MASTERY_BG[2] },
    { label: MASTERY_LABELS[3], count: s.tiers[3], cls: MASTERY_BG[3] },
    { label: "Unseen", count: s.unseen, cls: "bg-muted" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">生徒の進捗 / Student Progress</h1>
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All students</SelectItem>
            {(raw?.profiles ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.display_name ?? "—"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing: <span className="font-medium text-foreground">{studentId === "all" ? "All students" : nameOf.get(studentId) ?? "—"}</span>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="font-display text-xl mb-3">Mastery distribution</div>
        {s.totalWords > 0 ? (
          <>
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
              {segments.map((seg) => seg.count > 0 && (
                <div key={seg.label} className={seg.cls} style={{ width: `${(seg.count / s.totalWords) * 100}%` }} title={`${seg.label}: ${seg.count}`} />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {segments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${seg.cls}`} />
                  <span className="text-muted-foreground">{seg.label}</span>
                  <span className="ml-auto font-medium">{seg.count}</span>
                </div>
              ))}
            </div>
          </>
        ) : <p className="text-muted-foreground text-sm">No words yet.</p>}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="font-display text-xl mb-3">Quiz accuracy over time</div>
        {s.daily.length === 0 ? <p className="text-muted-foreground text-sm">No quiz attempts yet.</p> : (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={s.daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="accuracy" stroke="oklch(0.74 0.13 80)" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="font-display text-xl mb-3">Words to revisit</div>
        {s.weakest.length === 0 ? <p className="text-muted-foreground text-sm">No struggling words yet.</p> : (
          <ul className="divide-y">
            {s.weakest.map((w) => (
              <li key={w.word} className="flex items-center justify-between py-2">
                <span className="font-medium">{w.word}</span>
                <span className="text-sm text-muted-foreground">{MASTERY_LABELS[w.mastery]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
