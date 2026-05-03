import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchActiveWords, fetchStatuses, MASTERY_LABELS, MASTERY_BG, type Mastery } from "@/lib/words";
import { BookOpen, ScrollText, Trophy } from "lucide-react";

export const Route = createFileRoute("/study/")({
  component: StudyHome,
});

function StudyHome() {
  const { user, displayName } = useAuth();
  const [stats, setStats] = useState<{ total: number; tiers: Record<Mastery, number>; unseen: number }>({
    total: 0,
    tiers: { 0: 0, 1: 0, 2: 0, 3: 0 },
    unseen: 0,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const words = await fetchActiveWords();
      const statuses = await fetchStatuses(user.id);
      const tiers: Record<Mastery, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
      let seen = 0;
      Object.values(statuses).forEach((s) => {
        if (s === null || s === undefined) return;
        tiers[s as Mastery]++;
        seen++;
      });
      setStats({ total: words.length, tiers, unseen: words.length - seen });
    })();
  }, [user]);

  const masteredish = stats.tiers[2] + stats.tiers[3];
  const pct = stats.total ? Math.round((masteredish / stats.total) * 100) : 0;

  const tiers: { key: Mastery; count: number; cls: string; label: string }[] = [
    { key: 0, count: stats.tiers[0], cls: MASTERY_BG[0], label: MASTERY_LABELS[0] },
    { key: 1, count: stats.tiers[1], cls: MASTERY_BG[1], label: MASTERY_LABELS[1] },
    { key: 2, count: stats.tiers[2], cls: MASTERY_BG[2], label: MASTERY_LABELS[2] },
    { key: 3, count: stats.tiers[3], cls: MASTERY_BG[3], label: MASTERY_LABELS[3] },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-4xl">Hello, {displayName ?? "friend"} 🌸</h1>
      <p className="text-muted-foreground mt-2">Pick a mode and start your session.</p>

      <div className="mt-8 rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Words you know</div>
            <div className="font-display text-3xl">{masteredish} <span className="text-muted-foreground text-xl">/ {stats.total}</span></div>
          </div>
          <div className="relative h-20 w-20">
            <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${pct}, 100`} className="text-gold" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 grid place-items-center font-display text-lg">{pct}%</div>
          </div>
        </div>

        {/* Mastery pill bar */}
        {stats.total > 0 && (
          <div className="mt-5">
            <div className="flex w-full gap-1 overflow-hidden rounded-full">
              {tiers.map((s) => (
                <div
                  key={s.key}
                  className={`${s.cls} flex h-6 min-w-0 flex-1 items-center justify-center overflow-hidden px-1 text-[8px] sm:text-[10px] font-medium text-white/95 whitespace-nowrap`}
                  title={`${s.label}: ${s.count}`}
                >
                  <span className="truncate">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex w-full gap-1">
              {tiers.map((s) => (
                <div key={s.key} className="flex min-w-0 flex-1 justify-center font-display text-lg">
                  {s.count}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">未勉強</span>
              <span className="font-display text-lg">{stats.unseen}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { to: "/study/flashcards", icon: BookOpen, title: "Flashcards", desc: "Tap to reveal" },
          { to: "/study/list", icon: ScrollText, title: "Word List", desc: "Browse all" },
          { to: "/study/quiz", icon: Trophy, title: "Quiz", desc: "Test yourself" },
        ].map((m) => (
          <Link key={m.to} to={m.to} className="group rounded-2xl border bg-card p-6 shadow-card transition hover:border-gold hover:shadow-glow">
            <m.icon className="h-6 w-6 text-gold" />
            <div className="mt-3 font-display text-xl">{m.title}</div>
            <div className="text-sm text-muted-foreground">{m.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
