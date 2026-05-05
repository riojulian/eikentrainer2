import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { MASTERY_LABELS, MASTERY_BG, type Mastery } from "@/lib/words";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/admin/progress")({
  component: Progress,
});

type Stats = {
  totalWords: number;
  tiers: Record<Mastery, number>;
  unseen: number;
  daily: { date: string; correct: number; total: number; accuracy: number }[];
  weakest: { word: string; correct: number; total: number; accuracy: number }[];
};

type StudentRow = {
  id: string;
  name: string;
  mastered: number;
  attempts: number;
  correct: number;
  accuracy: number;
  xp: number;
  streak: number;
  lastActive: string | null;
};

type RawData = {
  words: { id: string; word: string }[];
  profiles: { id: string; display_name: string | null }[];
  statuses: { student_id: string; word_id: string; mastery: number }[];
  results: { student_id: string; word_id: string; correct: boolean; taken_at: string }[];
  stats: { student_id: string; xp: number; current_streak: number; last_active_date: string | null }[];
};

function Progress() {
  const [raw, setRaw] = useState<RawData | null>(null);
  const [studentId, setStudentId] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const [{ data: words }, { data: profiles }, { data: statuses }, { data: results }, { data: stats }] = await Promise.all([
        supabase.from("words").select("id,word").eq("is_active", true).range(0, 49999),
        supabase.from("profiles").select("id,display_name").range(0, 9999),
        supabase.from("word_status").select("student_id,mastery,word_id").range(0, 99999),
        supabase.from("quiz_results").select("student_id,word_id,correct,taken_at").order("taken_at", { ascending: true }).range(0, 99999),
        supabase.from("student_stats").select("student_id,xp,current_streak,last_active_date").range(0, 9999),
      ]);
      setRaw({
        words: words ?? [],
        profiles: profiles ?? [],
        statuses: (statuses ?? []) as RawData["statuses"],
        results: (results ?? []) as RawData["results"],
        stats: (stats ?? []) as RawData["stats"],
      });
    })();
  }, []);

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    raw?.profiles.forEach((p) => m.set(p.id, p.display_name ?? "—"));
    return m;
  }, [raw]);

  const studentRows = useMemo<StudentRow[]>(() => {
    if (!raw) return [];
    const ids = new Set<string>();
    raw.profiles.forEach((p) => ids.add(p.id));
    raw.statuses.forEach((r) => ids.add(r.student_id));
    raw.results.forEach((r) => ids.add(r.student_id));
    raw.stats.forEach((r) => ids.add(r.student_id));
    const byStat = new Map(raw.stats.map((r) => [r.student_id, r]));
    return [...ids].map((id) => {
      const mastered = raw.statuses.filter((r) => r.student_id === id && r.mastery >= 3).length;
      const attempts = raw.results.filter((r) => r.student_id === id);
      const correct = attempts.filter((r) => r.correct).length;
      const st = byStat.get(id);
      return {
        id,
        name: nameOf.get(id) ?? "(unknown)",
        mastered,
        attempts: attempts.length,
        correct,
        accuracy: attempts.length ? Math.round((correct / attempts.length) * 100) : 0,
        xp: st?.xp ?? 0,
        streak: st?.current_streak ?? 0,
        lastActive: st?.last_active_date ?? null,
      };
    }).sort((a, b) => b.xp - a.xp || b.attempts - a.attempts);
  }, [raw, nameOf]);

  const s = useMemo<Stats | null>(() => {
    if (!raw) return null;
    const words = raw.words;
    const statuses = studentId === "all" ? raw.statuses : raw.statuses.filter((r) => r.student_id === studentId);
    const results = studentId === "all" ? raw.results : raw.results.filter((r) => r.student_id === studentId);

    const totalWords = words.length;
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

      const wordIdToText = new Map(words.map((w) => [w.id, w.word]));
      const byWord = new Map<string, { c: number; t: number }>();
      results.forEach((r) => {
        const v = byWord.get(r.word_id) ?? { c: 0, t: 0 };
        v.t++; if (r.correct) v.c++;
        byWord.set(r.word_id, v);
      });
      const weakest = [...byWord.entries()]
        .filter(([, v]) => v.t >= 1)
        .map(([id, v]) => ({ word: wordIdToText.get(id) ?? "—", correct: v.c, total: v.t, accuracy: Math.round((v.c / v.t) * 100) }))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 8);

    return { totalWords, tiers, unseen, daily, weakest };
  }, [raw, studentId]);

  if (!s) return <div className="text-muted-foreground">Loading…</div>;

  const stat = (label: string, value: string | number, color?: string) => (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl ${color ?? ""}`}>{value}</div>
    </div>
  );

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
            {studentRows.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-card overflow-x-auto">
        <div className="font-display text-xl mb-3">Per-student breakdown</div>
        {studentRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No students yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">XP</TableHead>
                <TableHead className="text-right">Streak</TableHead>
                <TableHead className="text-right">Mastered</TableHead>
                <TableHead className="text-right">Quizzes</TableHead>
                <TableHead className="text-right">Accuracy</TableHead>
                <TableHead className="text-right">Last active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentRows.map((r) => (
                <TableRow key={r.id} className={studentId === r.id ? "bg-muted/40" : ""}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{r.xp}</TableCell>
                  <TableCell className="text-right">{r.streak}</TableCell>
                  <TableCell className="text-right">{r.mastered}</TableCell>
                  <TableCell className="text-right">{r.attempts}</TableCell>
                  <TableCell className="text-right">{r.attempts ? `${r.accuracy}%` : "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.lastActive ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => setStudentId(r.id)}
                    >View</button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        Showing: <span className="font-medium text-foreground">{studentId === "all" ? "All students" : nameOf.get(studentId) ?? "—"}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stat("Total", s.totalWords)}
        {stat(MASTERY_LABELS[0], s.tiers[0], "text-rose")}
        {stat(MASTERY_LABELS[1], s.tiers[1], "text-gold")}
        {stat(MASTERY_LABELS[2], s.tiers[2], "text-sage")}
        {stat(MASTERY_LABELS[3], s.tiers[3], "text-gold")}
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
