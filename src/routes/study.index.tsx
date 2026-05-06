import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { useAuth } from "@/lib/auth";
import { fetchActiveWords, fetchStatuses, MASTERY_LABELS, MASTERY_BG, TIER_LABELS, type Mastery } from "@/lib/words";
import { BookOpen, ScrollText, Trophy, CalendarDays, CalendarRange, MoreVertical, BarChart3, Languages } from "lucide-react";
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
  getAllStarsByWorld,
  getGuestWords,
} from "@/lib/stages";
import { getStats, getEarnedBadges, getMastery, type PerWorldMastery, type MasteryBuckets } from "@/lib/gamification";
import { MasteryHeader } from "@/components/MasteryHeader";
import { AchievementsStrip } from "@/components/AchievementsStrip";
import { WeakZoneStrip } from "@/components/WeakZoneStrip";
import { StageMap } from "@/components/StageMap";
import { WorldPicker, type WorldSummary } from "@/components/WorldPicker";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Word } from "@/lib/words";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { GUEST_FREE_STAGES, GUEST_FREE_WORLD, getGuestMastery, isGuestAllowed } from "@/lib/guestMastery";
import { SignupGate } from "@/components/SignupGate";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/study/")({
  component: StudyHome,
});

function StudyHome() {
  const { user, displayName } = useAuth();
  const isGuest = !user;
  const { lang, setLang, t } = useLang();
  const [activeWorld, setActiveWorld] = useState<string>("tier1");
  const [stages, setStages] = useState<Word[][]>([]);
  const [currentStage, setStageState] = useState(1);
  const [starsByStage, setStarsByStage] = useState<Record<number, 0 | 1 | 2 | 3>>({});
  const [weeklyEligible, setWeeklyEligible] = useState(0);
  const [monthlyEligible, setMonthlyEligible] = useState(0);
  const [loading, setLoading] = useState(true);
  const initialWorldRef = useRef<string | null>(null);

  // Cached fetches
  const allWordsQ = useQuery({ queryKey: qk.words(), queryFn: fetchActiveWords });
  const statusesQ = useQuery({
    queryKey: user ? qk.statuses(user.id) : ["statuses", "anon"],
    queryFn: () => fetchStatuses(user!.id),
    enabled: !!user,
  });
  const currentWorldQ = useQuery({
    queryKey: user ? qk.currentWorld(user.id) : ["currentWorld", "anon"],
    queryFn: () => getCurrentWorld(user!.id),
    enabled: !!user,
  });
  const gameStatsQ = useQuery({
    queryKey: user ? qk.stats(user.id) : ["stats", "anon"],
    queryFn: () => getStats(user!.id),
    enabled: !!user,
  });
  const earnedBadgesQ = useQuery({
    queryKey: user ? qk.badges(user.id) : ["badges", "anon"],
    queryFn: () => getEarnedBadges(user!.id),
    enabled: !!user,
  });
  const masteryQ = useQuery({
    queryKey: user ? qk.mastery(user.id) : ["mastery", "anon"],
    queryFn: () => getMastery(user!.id),
    enabled: !!user,
  });
  const allStarsQ = useQuery({
    queryKey: user ? qk.allStars(user.id) : ["allStars", "anon"],
    queryFn: () => getAllStarsByWorld(user!.id),
    enabled: !!user,
  });

  const allWords = allWordsQ.data ?? [];
  const statuses = statusesQ.data ?? {};
  const gameStats = gameStatsQ.data ?? { xp: 0, current_streak: 0, longest_streak: 0, last_active_date: null };
  const earnedBadges = earnedBadgesQ.data ?? new Set<string>();
  const mastery = masteryQ.data ?? {
    pct: 0,
    total: 0,
    touched: 0,
    buckets: { untouched: 0, m0: 0, m1: 0, m2: 0, m3: 0 } as MasteryBuckets,
    perWorld: {} as Record<string, PerWorldMastery>,
  };

  const stats = useMemo(() => {
    const tiers: Record<Mastery, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    let seen = 0;
    Object.values(statuses).forEach((s) => {
      if (s === null || s === undefined) return;
      tiers[s as Mastery]++;
      seen++;
    });
    return { total: allWords.length, tiers, unseen: allWords.length - seen };
  }, [allWords, statuses]);

  // Per-world summaries — needs per-world current stage; fetch only when we have base data
  const [worldSummaries, setWorldSummaries] = useState<WorldSummary[]>([]);
  useEffect(() => {
    if (!user || !allWordsQ.data || !allStarsQ.data || !currentWorldQ.data) return;
    let cancelled = false;
    (async () => {
      const grouped = groupByWorld(allWordsQ.data!);
      const allStars = allStarsQ.data!;
      const summaries: WorldSummary[] = await Promise.all(
        WORLD_ORDER.map(async (w) => {
          const totalStages = Math.ceil(grouped[w].length / STAGE_SIZE);
          let curStage = 1;
          let starsEarned = 0;
          if (totalStages > 0) {
            curStage = await getWorldStage(user.id, w);
            const stars = allStars[w] ?? {};
            starsEarned = Object.values(stars).reduce((a: number, b) => a + (b as number), 0);
          }
          return { world: w, totalStages, currentStage: curStage, starsEarned, starsMax: totalStages * 3 };
        }),
      );
      if (cancelled) return;
      setWorldSummaries(summaries);

      let chosen = currentWorldQ.data!;
      const chosenSummary = summaries.find((s) => s.world === chosen);
      if (!chosenSummary || chosenSummary.totalStages === 0) {
        chosen = summaries.find((s) => s.totalStages > 0)?.world ?? "tier1";
        if (chosen !== currentWorldQ.data) await setCurrentWorld(user.id, chosen);
      }
      const chosenSummaryFinal = summaries.find((s) => s.world === chosen);
      const [orderedInit, starsInit] = await Promise.all([
        ensureWorldOrder(user.id, chosen),
        getStarsByStage(user.id, chosen),
      ]);
      if (cancelled) return;
      const initStages = stagize(orderedInit);
      setStages(initStages);
      setStarsByStage(starsInit);
      const csInit = chosenSummaryFinal?.currentStage ?? 1;
      setStageState(Math.min(csInit, Math.max(1, initStages.length)));
      initialWorldRef.current = chosen;
      setActiveWorld(chosen);

      const wkSince = new Date(Date.now() - 7 * 86400000).toISOString();
      const moSince = new Date(Date.now() - 30 * 86400000).toISOString();
      const [wk, mo] = await Promise.all([
        supabase.from("word_status").select("word_id", { count: "exact", head: true }).eq("student_id", user.id).gte("updated_at", wkSince),
        supabase.from("word_status").select("word_id", { count: "exact", head: true }).eq("student_id", user.id).gte("updated_at", moSince),
      ]);
      if (cancelled) return;
      setWeeklyEligible(wk.count ?? 0);
      setMonthlyEligible(mo.count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, allWordsQ.data, allStarsQ.data, currentWorldQ.data]);

  // Load stages + stars for the active world
  useEffect(() => {
    if (!user || !activeWorld) return;
    if (activeWorld === initialWorldRef.current) {
      initialWorldRef.current = null;
      return;
    }
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

  if (isGuest) {
    return <GuestStudyHome />;
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>

        {/* StatsHeader */}
        <div className="mt-4 rounded-2xl border bg-card p-3 shadow-card">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-2 w-full" />
        </div>

        {/* WorldPicker */}
        <div className="mt-6">
          <Skeleton className="h-4 w-40" />
          <div className="mt-2 grid grid-cols-5 gap-1.5 sm:gap-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>

        {/* Stage card */}
        <div className="mt-4 rounded-2xl border bg-card p-5 shadow-card">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </div>
        </div>

        {/* StageMap */}
        <div className="mt-6 rounded-2xl border bg-card p-4 shadow-card">
          <Skeleton className="h-4 w-32" />
          <div className="mt-3 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex">
                <Skeleton className="h-16 w-[88%] sm:w-[72%] rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-3xl truncate">{t("home.hello")}, {displayName ?? t("home.friend")} 🌸</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>{t("menu.reviewsLib")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Dialog>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <BarChart3 className="h-4 w-4 mr-2 text-gold" />
                  <div className="flex flex-col">
                    <span>{t("menu.wordsKnow")}</span>
                    <span className="text-xs text-muted-foreground">
                      {masteredish} / {stats.total} {t("menu.mastered")}
                    </span>
                  </div>
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("home.wordsKnowTitle")}</DialogTitle>
                </DialogHeader>
                <div className="rounded-2xl border bg-card p-4">
                  <div className="flex items-baseline justify-between">
                    <div className="text-sm text-muted-foreground">{t("home.mastered")}</div>
                    <div className="font-display text-2xl">
                      {masteredish} <span className="text-muted-foreground text-base">/ {stats.total}</span>
                    </div>
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
                        <span className="text-muted-foreground">{t("home.unseen")}</span>
                        <span className="font-display text-base">{stats.unseen}</span>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild disabled={weeklyEligible < 4}>
              <Link to="/study/quiz" search={{ mode: "weekly" as const }}>
                <CalendarDays className="h-4 w-4 mr-2 text-gold" />
                <div className="flex flex-col">
                  <span>{t("menu.weekly")}</span>
                  <span className="text-xs text-muted-foreground">
                    {weeklyEligible >= 4 ? `${weeklyEligible} ${t("menu.weeklyHint")}` : t("menu.unlockHint")}
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild disabled={monthlyEligible < 4}>
              <Link to="/study/quiz" search={{ mode: "monthly" as const }}>
                <CalendarRange className="h-4 w-4 mr-2 text-gold" />
                <div className="flex flex-col">
                  <span>{t("menu.monthly")}</span>
                  <span className="text-xs text-muted-foreground">
                    {monthlyEligible >= 4 ? `${monthlyEligible} ${t("menu.monthlyHint")}` : t("menu.unlockHint")}
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/study/list">
                <ScrollText className="h-4 w-4 mr-2 text-gold" />
                {t("menu.browse")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-gold" /> {t("menu.language")}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setLang("en")}>
              <span className={lang === "en" ? "font-semibold" : ""}>English</span>
              {lang === "en" ? <span className="ml-auto text-xs text-muted-foreground">✓</span> : null}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLang("ja")}>
              <span className={lang === "ja" ? "font-semibold" : ""}>日本語</span>
              {lang === "ja" ? <span className="ml-auto text-xs text-muted-foreground">✓</span> : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {worldSummaries.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-sm font-medium">{t("home.pickWorld")}</div>
            <div className="text-xs text-muted-foreground">{t("home.worldHint")}</div>
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
                <div className="font-display text-2xl mt-0.5">{t("home.stage")} {currentStage}</div>
                <div className="text-sm text-muted-foreground">
                  {stages[currentStage - 1]?.length ?? 0} {t("home.words")} · {t("home.stage")} {currentStage} {t("home.of")} {totalStages}
                </div>
              </div>
              <BookOpen className="h-8 w-8 text-gold shrink-0" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button asChild size="lg" className="h-12">
                <Link to="/study/flashcards" search={{ mission: currentStage, world: activeWorld }}>
                  <BookOpen className="h-4 w-4 mr-1" /> {t("home.studyStage")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12">
                <Link to="/study/quiz" search={{ mode: "mission" as const, mission: currentStage, world: activeWorld }}>
                  <Trophy className="h-4 w-4 mr-1" /> {t("home.takeQuiz")}
                </Link>
              </Button>
            </div>
          </div>
        </>
      ) : loading ? (
        <div className="mt-4 rounded-2xl border bg-card p-6 text-center shadow-card">
          <div className="font-display text-xl">{t("home.loading")}</div>
          <p className="mt-1 text-sm text-muted-foreground">{t("home.justMoment")}</p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed bg-card p-6 text-center shadow-card">
          <div className="font-display text-xl">{t("home.noStages")}</div>
          <p className="mt-1 text-sm text-muted-foreground">{t("home.noStagesHint")}</p>
        </div>
      )}

      <div className="mt-6">
        <Tabs defaultValue="progress" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="progress">{t("home.tabs.progress")}</TabsTrigger>
            <TabsTrigger value="map">{t("home.tabs.map")}</TabsTrigger>
            <TabsTrigger value="badges">{t("home.tabs.badges")}</TabsTrigger>
          </TabsList>
          <TabsContent value="progress" className="mt-3 space-y-3">
            <MasteryHeader
              pct={mastery.pct}
              total={mastery.total}
              touched={mastery.touched}
              buckets={mastery.buckets}
              perWorld={mastery.perWorld}
              streak={gameStats.current_streak}
            />
            <WeakZoneStrip />
          </TabsContent>
          <TabsContent value="map" className="mt-3">
            {hasStages ? (
              <div className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-sm font-medium">{t("home.journey")}</div>
                  <div className="text-xs text-muted-foreground">{t("home.stage")} {currentStage} {t("home.of")} {totalStages}</div>
                </div>
                <StageMap
                  total={totalStages}
                  currentStage={currentStage}
                  starsByStage={starsByStage}
                  tierByStage={tierByStage}
                  world={activeWorld}
                />
              </div>
            ) : null}
          </TabsContent>
          <TabsContent value="badges" className="mt-3">
            <AchievementsStrip earned={earnedBadges} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

