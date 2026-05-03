import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchActiveWords, fetchStatuses, MASTERY_LABELS, MASTERY_BG, TIER_LABELS, type Mastery } from "@/lib/words";
import { BookOpen, ScrollText, Trophy, CalendarDays, CalendarRange, ChevronRight } from "lucide-react";
import {
  ensureWorldOrder,
  stagize,
  STAGE_SIZE,
  WORLD_ORDER,
  groupByWorld,
  getCurrentWorld,
  setCurrentWorld,
  getWorldStage,
  getStarsByStage,
} from "@/lib/stages";
import { getStats, getEarnedBadges, type Stats } from "@/lib/gamification";
import { StatsHeader } from "@/components/StatsHeader";
import { StageMap } from "@/components/StageMap";
import { AchievementsStrip } from "@/components/AchievementsStrip";
import { WorldPicker, type WorldSummary } from "@/components/WorldPicker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
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
  const [activeWorld, setActiveWorld] = useState<string>("tier1");
  const [worldSummaries, setWorldSummaries] = useState<WorldSummary[]>([]);
  const [stages, setStages] = useState<Word[][]>([]);
  const [currentStage, setStageState] = useState(1);
  const [starsByStage, setStarsByStage] = useState<Record<number, 0 | 1 | 2 | 3>>({});
  const [weeklyEligible, setWeeklyEligible] = useState(0);
  const [monthlyEligible, setMonthlyEligible] = useState(0);
  const [gameStats, setGameStats] = useState<Stats>({ xp: 0, current_streak: 0, longest_streak: 0, last_active_date: null });
  const [earnedBadges, setEarnedBadges] = useState<Set<string>>(new Set());

  // Initial load: figure out active world + global summaries
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [allWords, statuses, world, gs, badges] = await Promise.all([
        fetchActiveWords(),
        fetchStatuses(user.id),
        getCurrentWorld(user.id),
        getStats(user.id),
        getEarnedBadges(user.id),
      ]);

      // Mastery tallies (global)
      const tiers: Record<Mastery, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
      let seen = 0;
      Object.values(statuses).forEach((s) => {
        if (s === null || s === undefined) return;
        tiers[s as Mastery]++;
        seen++;
      });
      setStats({ total: allWords.length, tiers, unseen: allWords.length - seen });
      setGameStats(gs);
      setEarnedBadges(badges);

      // Per-world summaries
      const grouped = groupByWorld(allWords);
      const summaries: WorldSummary[] = await Promise.all(
        WORLD_ORDER.map(async (w) => {
          const totalStages = Math.ceil(grouped[w].length / STAGE_SIZE);
          let curStage = 1;
          let starsEarned = 0;
          if (totalStages > 0) {
            const [cs, stars] = await Promise.all([
              getWorldStage(user.id, w),
              getStarsByStage(user.id, w),
            ]);
            curStage = cs;
            starsEarned = Object.values(stars).reduce((a: number, b) => a + (b as number), 0);
          }
          return {
            world: w,
            totalStages,
            currentStage: curStage,
            starsEarned,
            starsMax: totalStages * 3,
          };
        }),
      );
      setWorldSummaries(summaries);

      // Pick active world (fallback to first non-empty if stored one is empty)
      let chosen = world;
      const chosenSummary = summaries.find((s) => s.world === chosen);
      if (!chosenSummary || chosenSummary.totalStages === 0) {
        chosen = summaries.find((s) => s.totalStages > 0)?.world ?? "tier1";
        if (chosen !== world) await setCurrentWorld(user.id, chosen);
      }
      setActiveWorld(chosen);

      // Weekly / monthly review counts (global)
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

  // Load stages + stars for the active world
  useEffect(() => {
    if (!user || !activeWorld) return;
    (async () => {
      const [ordered, stars, cs] = await Promise.all([
        ensureWorldOrder(user.id, activeWorld),
        getStarsByStage(user.id, activeWorld),
        getWorldStage(user.id, activeWorld),
      ]);
      const newStages = stagize(ordered);
      setStages(newStages);
      setStageState(Math.min(cs, Math.max(1, newStages.length)));
      setStarsByStage(stars);
    })();
  }, [user, activeWorld]);

  const onWorldChange = async (next: string) => {
    if (!user || next === activeWorld) return;
    setActiveWorld(next);
    await setCurrentWorld(user.id, next);
  };

  const masteredish = stats.tiers[2] + stats.tiers[3];
  const tierRows: { key: Mastery; count: number; cls: string; label: string }[] = [
    { key: 0, count: stats.tiers[0], cls: MASTERY_BG[0], label: MASTERY_LABELS[0] },
    { key: 1, count: stats.tiers[1], cls: MASTERY_BG[1], label: MASTERY_LABELS[1] },
    { key: 2, count: stats.tiers[2], cls: MASTERY_BG[2], label: MASTERY_LABELS[2] },
    { key: 3, count: stats.tiers[3], cls: MASTERY_BG[3], label: MASTERY_LABELS[3] },
  ];

  const totalStages = stages.length;
  const hasStages = totalStages > 0;
  const tierByStage = stages.map((stage) => stage[0]?.tier ?? null);
  const activeWorldLabel = TIER_LABELS[activeWorld] ?? activeWorld;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-3xl truncate">Hello, {displayName ?? "friend"} 🌸</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Reviews & Library</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild disabled={weeklyEligible < 4}>
              <Link to="/study/quiz" search={{ mode: "weekly" as const }}>
                <CalendarDays className="h-4 w-4 mr-2 text-gold" />
                <div className="flex flex-col">
                  <span>Weekly review</span>
                  <span className="text-xs text-muted-foreground">
                    {weeklyEligible >= 4 ? `${weeklyEligible} words from last 7 days` : "Study 4+ words to unlock"}
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild disabled={monthlyEligible < 4}>
              <Link to="/study/quiz" search={{ mode: "monthly" as const }}>
                <CalendarRange className="h-4 w-4 mr-2 text-gold" />
                <div className="flex flex-col">
                  <span>Monthly review</span>
                  <span className="text-xs text-muted-foreground">
                    {monthlyEligible >= 4 ? `${monthlyEligible} words from last 30 days` : "Study 4+ words to unlock"}
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/study/list">
                <ScrollText className="h-4 w-4 mr-2 text-gold" />
                Browse all words
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4">
        <StatsHeader stats={gameStats} />
      </div>

      {worldSummaries.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-sm font-medium">Pick a world</div>
            <div className="text-xs text-muted-foreground">Each world has its own stages</div>
          </div>
          <WorldPicker summaries={worldSummaries} active={activeWorld} onChange={onWorldChange} />
        </div>
      )}

      {hasStages ? (
        <>
          <div className="mt-4 rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-widest text-gold truncate">{activeWorldLabel}</div>
                <div className="font-display text-2xl mt-0.5">Stage {currentStage}</div>
                <div className="text-sm text-muted-foreground">
                  {stages[currentStage - 1]?.length ?? 0} words · Stage {currentStage} of {totalStages}
                </div>
              </div>
              <BookOpen className="h-8 w-8 text-gold shrink-0" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button asChild size="lg" className="h-12">
                <Link to="/study/flashcards" search={{ mission: currentStage, world: activeWorld }}>
                  <BookOpen className="h-4 w-4 mr-1" /> Study stage
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12">
                <Link to="/study/quiz" search={{ mode: "mission" as const, mission: currentStage, world: activeWorld }}>
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
              world={activeWorld}
            />
          </div>

          <div className="mt-4">
            <AchievementsStrip earned={earnedBadges} />
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
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed bg-card p-6 text-center shadow-card">
          <div className="font-display text-xl">No stages in {activeWorldLabel} yet</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Add at least {STAGE_SIZE} words to this world, or pick another world above.
          </p>
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
