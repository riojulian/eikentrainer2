import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin/progress")({
  component: Progress,
});

type Stats = {
  totalWords: number;
  known: number;
  review: number;
  unseen: number;
  daily: { date: string; correct: number; total: number; accuracy: number }[];
  weakest: { word: string; correct: number; total: number; accuracy: number }[];
};

function Progress() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: words }, { data: statuses }, { data: results }] = await Promise.all([
        supabase.from("words").select("id,word").eq("is_active", true),
        supabase.from("word_status").select("status,word_id"),
        supabase.from("quiz_results").select("word_id,correct,taken_at").order("taken_at", { ascending: true }),
      ]);
      const totalWords = words?.length ?? 0;
      let known = 0, review = 0;
      statuses?.forEach((r) => { if (r.status === "known") known++; else if (r.status === "review") review++; });
      const unseen = totalWords - known - review;

      const byDay = new Map<string, { c: number; t: number }>();
      results?.forEach((r) => {
        const d = new Date(r.taken_at).toISOString().slice(0, 10);
        const v = byDay.get(d) ?? { c: 0, t: 0 };
        v.t++; if (r.correct) v.c++;
        byDay.set(d, v);
      });
      const daily = [...byDay.entries()].map(([date, v]) => ({ date, correct: v.c, total: v.t, accuracy: Math.round((v.c / v.t) * 100) }));

      const wordIdToText = new Map((words ?? []).map((w) => [w.id, w.word]));
      const byWord = new Map<string, { c: number; t: number }>();
      results?.forEach((r) => {
        const v = byWord.get(r.word_id) ?? { c: 0, t: 0 };
        v.t++; if (r.correct) v.c++;
        byWord.set(r.word_id, v);
      });
      const weakest = [...byWord.entries()]
        .filter(([, v]) => v.t >= 1)
        .map(([id, v]) => ({ word: wordIdToText.get(id) ?? "—", correct: v.c, total: v.t, accuracy: Math.round((v.c / v.t) * 100) }))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 8);

      setS({ totalWords, known, review, unseen, daily, weakest });
    })();
  }, []);

  if (!s) return <div className="text-muted-foreground">Loading…</div>;

  const stat = (label: string, value: string | number, color?: string) => (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl ${color ?? ""}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Rinka's Progress</h1>
      <div className="grid gap-4 sm:grid-cols-4">
        {stat("Total words", s.totalWords)}
        {stat("Known", s.known, "text-sage")}
        {stat("Review", s.review, "text-rose")}
        {stat("Unseen", s.unseen, "text-muted-foreground")}
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
        {s.weakest.length === 0 ? <p className="text-muted-foreground text-sm">Take a quiz to see weak spots.</p> : (
          <ul className="divide-y">
            {s.weakest.map((w) => (
              <li key={w.word} className="flex items-center justify-between py-2">
                <span className="font-medium">{w.word}</span>
                <span className="text-sm text-muted-foreground">{w.correct}/{w.total} · {w.accuracy}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}