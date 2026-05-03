import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchStatuses, MASTERY_LABELS, MASTERY_BG, type Mastery } from "@/lib/words";
import { BookOpen, ScrollText, Trophy, CalendarDays, CalendarRange, ChevronRight } from "lucide-react";
import {
  ensureWordOrder,
  rebuildWordOrder,
  stagize,
  getProgress,
  setCurrentStage as persistCurrentStage,
  STAGE_SIZE,
  getStarsByStage,
} from "@/lib/stages";
import { getStats, getEarnedBadges, type Stats } from "@/lib/gamification";
import { StatsHeader } from "@/components/StatsHeader";
import { StageMap } from "@/components/StageMap";
import { AchievementsStrip } from "@/components/AchievementsStrip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Word } from "@/lib/words";
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
  const [stages, setStages] = useState<Word[][]>([]);
  const [currentStage, setCurrentStage] = useState(1);
  const [weeklyEligible, setWeeklyEligible] = useState(0);
  const [monthlyEligible, setMonthlyEligible] = useState(0);
  const [starsByStage, setStarsByStage] = useState<Record<number, 0 | 1 | 2 | 3>>({});
  const [gameStats, setGameStats] = useState<Stats>({ xp: 0, current_streak: 0, longest_streak: 0, last_active_date: null });
  const [earnedBadges, setEarnedBadges] = useState<Set<string>>(new Set());
  const [startTier, setStartTier] = useState<string>(() => {
    if (typeof window === "undefined") return "auto";
    return localStorage.getItem("stage_start_tier") || "auto";
  });
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const tierArg = startTier === "auto" ? null : startTier;
      const [words, statuses, progress, stars, gs, badges] = await Promise.all([
        ensureWordOrder(user.id, tierArg),
        fetchStatuses(user.id),
        getProgress(user.id),
        getStarsByStage(user.id),
        getStats(user.id),
        getEarnedBadges(user.id),
      ]);
      const tiers: Record<Mastery, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
      let seen = 0;
      Object.values(statuses).forEach((s) => {
        if (s === null || s === undefined) return;
        tiers[s as Mastery]++;
        seen++;
      });
      setStats({ total: words.length, tiers, unseen: words.length - seen });
      const newStages = stagize(words);
      setStages(newStages);
      const total = Math.max(1, newStages.length);
      setCurrentStage(Math.min(progress.current_stage, total));
      setStarsByStage(stars);
      setGameStats(gs);
      setEarnedBadges(badges);

      const wkSince = new Date(Date.now() - 7 * 86400000).toISOString();
      const moSince = new Date(Date.now() - 30 * 86400000).toISOString();
      const [wk, mo] = await Promise.all([
        supabase.from("word_status").select("word_id", { count: "exact", head: true }).eq("student_id", user.id).gte("updated_at", wkSince),
        supabase.from("word_status").select("word_id", { count: "exact", head: true }).eq("student_id", user.id).gte("updated_at", moSince),
      ]);
      setWeeklyEligible(wk.count ?? 0);
      setMonthlyEligible(mo.count ?? 0);
    })();
  }, [user, startTier]);

  const onStartTierChange = async (next: string) => {
    if (!user) return;
    setStartTier(next);
    if (typeof window !== "undefined") localStorage.setItem("stage_start_tier", next);
    setRebuilding(true);
    try {
      const tierArg = next === "auto" ? null : next;
      const words = await rebuildWordOrder(user.id, tierArg);
      setStages(stagize(words));
      setCurrentStage(1);
      await persistCurrentStage(user.id, 1);
    } finally {
      setRebuilding(false);
    }
  };

  const masteredish = stats.tiers[2] + stats.tiers[3];

  const tierRows: { key: Mastery; count: number; cls: string; label: string }[] = [
    { key: 0, count: stats.tiers[0], cls: MASTERY_BG[0], label: MASTERY_LABELS[0] },
    { key: 1, count: stats.tiers[1], cls: MASTERY_BG[1], label: MASTERY_LABELS[1] },
    { key: 2, count: stats.tiers[2], cls: MASTERY_BG[2], label: MASTERY_LABELS[2] },
    { key: 3, count: stats.tiers[3], cls: MASTERY_BG[3], label: MASTERY_LABELS[3] },
  ];

  const totalStages = stages.length;
  const hasStages = totalStages > 0 && stats.total >= STAGE_SIZE;
  const tierByStage = stages.map((stage) => stage[0]?.tier ?? null);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-3xl">Hello, {displayName ?? "friend"} 🌸</h1>

      <div className="mt-4">
        <StatsHeader stats={gameStats} />
      </div>

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

      {hasStages ? (
        <>
          <div className="mt-4 rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">Start stages from</div>
                <div className="text-xs text-muted-foreground">Re-orders stages to begin at the chosen world. Resets your current stage to 1.</div>
              </div>
              <Select value={startTier} onValueChange={onStartTierChange} disabled={rebuilding}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (World 1 first)</SelectItem>
                  <SelectItem value="tier1">World 1: Core</SelectItem>
                  <SelectItem value="tier2">World 2: Topic Specific</SelectItem>
                  <SelectItem value="tier3">World 3: Reading/Listening</SelectItem>
                  <SelectItem value="tier4">World 4: Very Specific</SelectItem>
                  <SelectItem value="phrases">World 5: Phrases</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-gold">Current stage</div>
                <div className="font-display text-2xl mt-0.5">Stage {currentStage}</div>
                <div className="text-sm text-muted-foreground">{stages[currentStage - 1]?.length ?? 0} words</div>
              </div>
              <BookOpen className="h-8 w-8 text-gold" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button asChild size="lg" className="h-12">
                <Link to="/study/flashcards" search={{ mission: currentStage }}>
                  <BookOpen className="h-4 w-4 mr-1" /> Study stage
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12">
                <Link to="/study/quiz" search={{ mode: "mission", mission: currentStage }}>
                  <Trophy className="h-4 w-4 mr-1" /> Take stage quiz
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-sm font-medium">Your journey</div>
              <div className="text-xs text-muted-foreground">Stage {currentStage} of {totalStages}</div>
            </div>
            <StageMap
              total={totalStages}
              currentStage={currentStage}
              starsByStage={starsByStage}
              tierByStage={tierByStage}
            />
          </div>

          <div className="mt-4">
            <AchievementsStrip earned={earnedBadges} />
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
          <div className="font-display text-xl">Add at least {STAGE_SIZE} words to unlock stages</div>
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
      <Icon className={eligible ? "h-6 w-6 text-gold" : "h-6 w-6 text-muted-foreground"} />
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
