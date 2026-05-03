import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchStatuses, MASTERY_LABELS, MASTERY_BG, type Mastery } from "@/lib/words";
import { BookOpen, ScrollText, Trophy, CalendarDays, CalendarRange, ChevronRight } from "lucide-react";
import { ensureWordOrder, missionize, getProgress, MISSION_SIZE } from "@/lib/missions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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
  const [missions, setMissions] = useState<string[][]>([]);
  const [currentMission, setCurrentMission] = useState(1);
  const [weeklyEligible, setWeeklyEligible] = useState(0);
  const [monthlyEligible, setMonthlyEligible] = useState(0);
  const [showAllMissions, setShowAllMissions] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const words = await ensureWordOrder(user.id);
      const statuses = await fetchStatuses(user.id);
      const progress = await getProgress(user.id);
      const tiers: Record<Mastery, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
      let seen = 0;
      Object.values(statuses).forEach((s) => {
        if (s === null || s === undefined) return;
        tiers[s as Mastery]++;
        seen++;
      });
      setStats({ total: words.length, tiers, unseen: words.length - seen });
      setMissions(missionize(words).map((c) => c.map((w) => w.id)));
      const total = Math.max(1, Math.ceil(words.length / MISSION_SIZE));
      setCurrentMission(Math.min(progress.current_mission, total));

      const wkSince = new Date(Date.now() - 7 * 86400000).toISOString();
      const moSince = new Date(Date.now() - 30 * 86400000).toISOString();
      const [wk, mo] = await Promise.all([
        supabase.from("word_status").select("word_id", { count: "exact", head: true }).eq("student_id", user.id).gte("updated_at", wkSince),
        supabase.from("word_status").select("word_id", { count: "exact", head: true }).eq("student_id", user.id).gte("updated_at", moSince),
      ]);
      setWeeklyEligible(wk.count ?? 0);
      setMonthlyEligible(mo.count ?? 0);
    })();
  }, [user]);

  const masteredish = stats.tiers[2] + stats.tiers[3];

  const tierRows: { key: Mastery; count: number; cls: string; label: string }[] = [
    { key: 0, count: stats.tiers[0], cls: MASTERY_BG[0], label: MASTERY_LABELS[0] },
    { key: 1, count: stats.tiers[1], cls: MASTERY_BG[1], label: MASTERY_LABELS[1] },
    { key: 2, count: stats.tiers[2], cls: MASTERY_BG[2], label: MASTERY_LABELS[2] },
    { key: 3, count: stats.tiers[3], cls: MASTERY_BG[3], label: MASTERY_LABELS[3] },
  ];

  const totalMissions = missions.length;
  const hasMissions = totalMissions > 0 && stats.total >= MISSION_SIZE;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-3xl">Hello, {displayName ?? "friend"} 🌸</h1>

      <div className="mt-4 rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex items-baseline justify-between">
          <div className="text-sm text-muted-foreground">Words you know</div>
          <div className="font-display text-2xl">{masteredish} <span className="text-muted-foreground text-base">/ {stats.total}</span></div>
        </div>

        {stats.total > 0 && (
          <div className="mt-3">
            <div className="flex w-full gap-1 overflow-hidden rounded-full">
              {tierRows.map((s) => (
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
              {tierRows.map((s) => (
                <div key={s.key} className="flex min-w-0 flex-1 justify-center font-display text-lg">
                  {s.count}
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">未勉強</span>
              <span className="font-display text-base">{stats.unseen}</span>
            </div>
          </div>
        )}
      </div>

      {hasMissions ? (
        <>
          <div className="mt-4 rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-muted-foreground">Your progress</div>
              <div className="text-sm">Mission <span className="font-display text-lg">{currentMission}</span> of {totalMissions}</div>
            </div>
            <div className="mt-3 flex w-full gap-0.5 overflow-hidden rounded-full">
              {missions.map((_, i) => {
                const n = i + 1;
                const cls = n < currentMission ? "bg-sage" : n === currentMission ? "bg-gold" : "bg-muted";
                return <div key={n} className={cn("h-2 flex-1", cls)} title={`Mission ${n}`} />;
              })}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-gold">Current mission</div>
                <div className="font-display text-2xl mt-0.5">Mission {currentMission}</div>
                <div className="text-sm text-muted-foreground">{missions[currentMission - 1]?.length ?? 0} words</div>
              </div>
              <BookOpen className="h-8 w-8 text-gold" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button asChild size="lg" className="h-12">
                <Link to="/study/flashcards" search={{ mission: currentMission }}>
                  <BookOpen className="h-4 w-4 mr-1" /> Study mission
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12">
                <Link to="/study/quiz" search={{ mode: "mission", mission: currentMission }}>
                  <Trophy className="h-4 w-4 mr-1" /> Take mission quiz
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ReviewTile
              icon={CalendarDays}
              title="Weekly review"
              desc={`${weeklyEligible} word${weeklyEligible === 1 ? "" : "s"} from the last 7 days`}
              eligible={weeklyEligible >= 4}
              search={{ mode: "weekly" as const }}
            />
            <ReviewTile
              icon={CalendarRange}
              title="Monthly review"
              desc={`${monthlyEligible} word${monthlyEligible === 1 ? "" : "s"} from the last 30 days`}
              eligible={monthlyEligible >= 4}
              search={{ mode: "monthly" as const }}
            />
          </div>

          <div className="mt-4 rounded-2xl border bg-card p-4 shadow-card">
            <button
              type="button"
              onClick={() => setShowAllMissions((s) => !s)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="text-sm font-medium">Jump to another mission</div>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showAllMissions && "rotate-90")} />
            </button>
            {showAllMissions && (
              <div className="mt-3 grid gap-1.5 grid-cols-4 sm:grid-cols-6">
                {missions.map((_, i) => {
                  const n = i + 1;
                  const status = n < currentMission ? "done" : n === currentMission ? "current" : "upcoming";
                  return (
                    <Link
                      key={n}
                      to="/study/flashcards"
                      search={{ mission: n }}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-center text-sm transition hover:border-gold",
                        status === "done" && "bg-sage/15 border-sage/40",
                        status === "current" && "bg-gold/15 border-gold/50 font-medium",
                      )}
                    >
                      {n}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4">
            <Link to="/study/list" className="group flex items-center justify-between rounded-xl border bg-card p-3 shadow-card transition hover:border-gold">
              <div className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-gold" />
                <span className="font-display text-base">Browse all words</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed bg-card p-6 text-center shadow-card">
          <div className="font-display text-xl">Add at least {MISSION_SIZE} words to unlock missions</div>
          <p className="mt-1 text-sm text-muted-foreground">For now, you can browse and quiz freely.</p>
          <div className="mt-4 grid gap-3 grid-cols-3">
            {[
              { to: "/study/flashcards", icon: BookOpen, title: "Flashcards" },
              { to: "/study/list", icon: ScrollText, title: "Word List" },
              { to: "/study/quiz", icon: Trophy, title: "Quiz" },
            ].map((m) => (
              <Link key={m.to} to={m.to} className="rounded-xl border bg-card p-3 shadow-card transition hover:border-gold">
                <m.icon className="h-5 w-5 text-gold mx-auto" />
                <div className="mt-1.5 font-display text-sm">{m.title}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function ReviewTile({
  icon: Icon,
  title,
  desc,
  eligible,
  search,
}: {
  icon: typeof CalendarDays;
  title: string;
  desc: string;
  eligible: boolean;
  search: { mode: "weekly" | "monthly" };
}) {
  const inner = (
    <div className="flex items-center gap-3">
      <Icon className={cn("h-6 w-6", eligible ? "text-gold" : "text-muted-foreground")} />
      <div className="min-w-0">
        <div className="font-display text-base leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground leading-tight truncate">
          {eligible ? desc : "Study at least 4 words to unlock"}
        </div>
      </div>
    </div>
  );
  if (!eligible) {
    return <div className="rounded-xl border bg-card p-3 shadow-card opacity-60">{inner}</div>;
  }
  return (
    <Link to="/study/quiz" search={search} className="rounded-xl border bg-card p-3 shadow-card transition hover:border-gold hover:shadow-glow">
      {inner}
    </Link>
  );
}