import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchActiveWords, fetchStatuses } from "@/lib/words";
import { BookOpen, ScrollText, Trophy } from "lucide-react";

export const Route = createFileRoute("/study/")({
  component: StudyHome,
});

function StudyHome() {
  const { user, displayName } = useAuth();
  const [stats, setStats] = useState({ total: 0, known: 0, review: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const words = await fetchActiveWords();
      const statuses = await fetchStatuses(user.id);
      let known = 0, review = 0;
      Object.values(statuses).forEach((s) => { if (s === "known") known++; else if (s === "review") review++; });
      setStats({ total: words.length, known, review });
    })();
  }, [user]);

  const studied = stats.known + stats.review;
  const pct = stats.total ? Math.round((studied / stats.total) * 100) : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-4xl">Hello, {displayName ?? "friend"} 🌸</h1>
      <p className="text-muted-foreground mt-2">Pick a mode and start your session.</p>

      <div className="mt-8 rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Today's progress</div>
            <div className="font-display text-3xl">{studied} <span className="text-muted-foreground text-xl">/ {stats.total}</span></div>
          </div>
          <div className="relative h-20 w-20">
            <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${pct}, 100`} className="text-gold" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 grid place-items-center font-display text-lg">{pct}%</div>
          </div>
        </div>
        <div className="mt-4 flex gap-4 text-sm">
          <span className="text-sage">✓ {stats.known} Known</span>
          <span className="text-rose">↻ {stats.review} Review</span>
        </div>
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