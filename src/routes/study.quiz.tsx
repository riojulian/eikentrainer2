import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchActiveWords,
  fetchStatuses,
  applyQuizResult,
  MASTERY_LABELS,
  type Word,
  type Mastery,
  type MasteryOrUnseen,
} from "@/lib/words";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, Star } from "lucide-react";
import {
  ensureWorldOrder,
  stagize,
  buildStageQuiz,
  buildPeriodicQuiz,
  recordAttempt,
  getCurrentWorld,
  getWorldStage,
  setWorldStage,
  STAGE_SIZE,
  starsForScore,
  getStarsByStage,
  DEFAULT_WORLD,
  getGuestWords,
} from "@/lib/stages";
import {
  isGuestAllowed,
  GUEST_FREE_STAGES,
  GUEST_FREE_WORLD,
  getGuestMasteryForWord,
  setGuestMasteryForWord,
} from "@/lib/guestMastery";
import { SignupGate } from "@/components/SignupGate";
import {
  awardXp,
  bumpStreak,
  bumpSessionStreak,
  checkBadges,
  getMastery,
  XP_PER_CORRECT,
  XP_BONUS_3STAR,
  XP_WEEKLY,
  XP_MONTHLY,
  type BadgeDef,
} from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { getWeakWords } from "@/lib/weakZone";
import { useLang, useCategoryLabel } from "@/lib/i18n";
import { ensureAltSentences } from "@/lib/words.functions";
import { BADGES_JA } from "@/lib/gamification";
import { toast } from "sonner";

type Mode = "mission" | "weekly" | "monthly" | "weakness";

export const Route = createFileRoute("/study/quiz")({
  validateSearch: (s: Record<string, unknown>) => {
    const modeRaw = s.mode;
    const mode: Mode | undefined =
      modeRaw === "mission" || modeRaw === "weekly" || modeRaw === "monthly" || modeRaw === "weakness"
        ? modeRaw
        : undefined;
    const missionRaw = s.mission;
    const mission = typeof missionRaw === "number" ? missionRaw : typeof missionRaw === "string" ? Number(missionRaw) : undefined;
    const world = typeof s.world === "string" ? s.world : undefined;
    return {
      mode,
      mission: mission && Number.isFinite(mission) && mission > 0 ? mission : undefined,
      world,
    } as { mode?: Mode; mission?: number; world?: string };
  },
  component: QuizPage,
  head: () => ({
    meta: [
      { title: "Quiz — EikenTango" },
      { name: "description", content: "Cloze-style multiple-choice quizzes for Eiken vocabulary: stage, weekly, monthly, and weakness review. 英検単語の穴埋めクイズ。" },
      { property: "og:title", content: "Quiz — EikenTango" },
      { property: "og:description", content: "Cloze-style multiple-choice quizzes for Eiken vocab: stage, weekly, monthly, and weakness review." },
      { property: "og:url", content: "https://eikentango.com/study/quiz" },
    ],
    links: [{ rel: "canonical", href: "https://eikentango.com/study/quiz" }],
  }),
});

type Q = { word: Word; options: string[]; answer: string; sentenceHtml: string };
type Outcome = { wordId: string; correct: boolean; before: MasteryOrUnseen; after: Mastery };

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isPhraseWord = (w: Word) => w.tier === "phrases" || /\s/.test(w.word.trim());

function pickDistractors(
  w: Word,
  allWords: Word[],
  statuses: Record<string, MasteryOrUnseen>,
): string[] {
  const answerIsPhrase = isPhraseWord(w);
  const answerLen = w.word.length;
  const ansLower = w.word.toLowerCase();

  // Same-shape candidates (phrase vs single word) and not the answer itself.
  const base = allWords.filter(
    (x) =>
      x.id !== w.id &&
      x.word.toLowerCase() !== ansLower &&
      isPhraseWord(x) === answerIsPhrase,
  );

  const sameTier = (xs: Word[]) => xs.filter((x) => x.tier === w.tier);
  const samePos = (xs: Word[]) =>
    w.part_of_speech ? xs.filter((x) => x.part_of_speech === w.part_of_speech) : xs;
  const seenIds = new Set(Object.keys(statuses));
  const seen = (xs: Word[]) => xs.filter((x) => seenIds.has(x.id));
  const unseen = (xs: Word[]) => xs.filter((x) => !seenIds.has(x.id));

  // Priority tiers: same category + same POS + already seen, then relax.
  const tiers: Word[][] = [
    seen(samePos(sameTier(base))),
    unseen(samePos(sameTier(base))),
    seen(sameTier(base)),
    sameTier(base),
    seen(samePos(base)),
    samePos(base),
    seen(base),
    base,
  ];

  // Soft length filter to defeat "obviously the longest/shortest" tells.
  // Apply only inside higher-priority tiers, and only if it leaves enough.
  const lengthOk = (x: Word) => {
    const r = x.word.length / Math.max(1, answerLen);
    return r >= 0.6 && r <= 1.6;
  };

  const picked: Word[] = [];
  const pushFrom = (pool: Word[]) => {
    for (const cand of shuffle(pool)) {
      if (picked.length >= 3) return;
      if (picked.some((p) => p.id === cand.id)) continue;
      if (picked.some((p) => p.word.toLowerCase() === cand.word.toLowerCase())) continue;
      picked.push(cand);
    }
  };

  for (let i = 0; i < tiers.length && picked.length < 3; i++) {
    const tier = tiers[i];
    if (i < 4) {
      const filtered = tier.filter(lengthOk);
      if (filtered.length >= 3 - picked.length) {
        pushFrom(filtered);
        continue;
      }
    }
    pushFrom(tier);
  }

  return picked.slice(0, 3).map((x) => x.word);
}

function buildQuizQuestions(
  pool: Word[],
  allWords: Word[],
  statuses: Record<string, MasteryOrUnseen> = {},
  altSentences: Record<string, string> = {},
): Q[] {
  const usable = pool.filter((w) => w.example_sentence);
  return usable.slice(0, STAGE_SIZE).map((w) => {
    const distractors = pickDistractors(w, allWords, statuses);
    const options = shuffle([w.word, ...distractors]);
    const source = altSentences[w.id] ?? w.example_sentence ?? "";
    const sentenceHtml = source.replace(/<strong>.*?<\/strong>/i, "<strong>______</strong>");
    return { word: w, options, answer: w.word, sentenceHtml };
  });
}

type FinishResult = {
  stars: 0 | 1 | 2 | 3;
  xpGained: number;
  newStreak: number;
  newBadges: BadgeDef[];
  readinessBefore: number;
  readinessAfter: number;
  weakAdded: number;
};

function QuizPage() {
  const { user } = useAuth();
  const isGuest = !user;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, lang } = useLang();
  const categoryLabel = useCategoryLabel();
  const search = Route.useSearch();
  const mode: Mode = search.mode ?? "mission";
  const missionParam = search.mission;

  const [activeWorld, setActiveWorld] = useState<string>(search.world ?? DEFAULT_WORLD);
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, MasteryOrUnseen>>({});
  const [stageIndex, setStageIndex] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [finished, setFinished] = useState<FinishResult | null>(null);
  const [livePct, setLivePct] = useState<number>(0);
  const [readinessBefore, setReadinessBefore] = useState<number>(0);
  const [mcRun, setMcRun] = useState<number>(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (isGuest && !isGuestAllowed(search.world ?? GUEST_FREE_WORLD, missionParam)) {
      navigate({ to: "/auth" });
      return;
    }
    if (!isGuest && !user) return;
    (async () => {
      if (!isGuest && !user) return;
      if (mode === "mission") {
        const resolvedWorld = isGuest
          ? (search.world ?? GUEST_FREE_WORLD)
          : (search.world ?? await queryClient.ensureQueryData({
          queryKey: qk.currentWorld(user.id),
          queryFn: () => getCurrentWorld(user.id),
        }));
        const world: string = resolvedWorld ?? DEFAULT_WORLD;
        setActiveWorld(world);
        if (isGuest) {
          const ordered = await getGuestWords(world);
          setStatuses({});
          setLivePct(0); setReadinessBefore(0);
          const stages = stagize(ordered);
          const idxToUse = missionParam ?? 1;
          setStageIndex(idxToUse);
          if (stages.length === 0) { setQuestions([]); return; }
          const pool = buildStageQuiz(stages, idxToUse);
          setQuestions(buildQuizQuestions(pool, ordered));
          return;
        }
        const [allWords, st, ordered, mst] = await Promise.all([
          queryClient.ensureQueryData({ queryKey: qk.words(), queryFn: fetchActiveWords, staleTime: Infinity }),
          queryClient.ensureQueryData({ queryKey: qk.statuses(user.id), queryFn: () => fetchStatuses(user.id) }),
          queryClient.ensureQueryData({ queryKey: qk.worldOrder(user!.id, world), queryFn: () => ensureWorldOrder(user!.id, world) }),
          queryClient.ensureQueryData({ queryKey: qk.mastery(user!.id), queryFn: () => getMastery(user!.id) }),
        ]);
        setStatuses(st);
        setLivePct(mst.pct); setReadinessBefore(mst.pct);
        const stages = stagize(ordered);
        const cur = await getWorldStage(user!.id, world);
        const idxToUse = missionParam ?? cur;
        setStageIndex(idxToUse);
        if (stages.length === 0) { setQuestions([]); return; }
        const pool = buildStageQuiz(stages, idxToUse);
        setQuestions(buildQuizQuestions(pool, allWords, st));
      } else if (mode === "weakness") {
        const [allWords, st, weak, mst] = await Promise.all([
          queryClient.ensureQueryData({ queryKey: qk.words(), queryFn: fetchActiveWords, staleTime: Infinity }),
          queryClient.ensureQueryData({ queryKey: qk.statuses(user!.id), queryFn: () => fetchStatuses(user!.id) }),
          getWeakWords(user!.id),
          queryClient.ensureQueryData({ queryKey: qk.mastery(user!.id), queryFn: () => getMastery(user!.id) }),
        ]);
        setStatuses(st);
        setLivePct(mst.pct); setReadinessBefore(mst.pct);
        if (weak.length < 1) { setQuestions([]); return; }
        const usable = weak.filter((w) => w.example_sentence).slice(0, STAGE_SIZE);
        let altMap: Record<string, string> = {};
        try {
          altMap = await ensureAltSentences({ data: { wordIds: usable.map((w) => w.id) } });
        } catch (err) {
          console.error("ensureAltSentences failed", err);
        }
        setQuestions(buildQuizQuestions(weak, allWords, st, altMap));
      } else {
        const [allWords, st, mst] = await Promise.all([
          queryClient.ensureQueryData({ queryKey: qk.words(), queryFn: fetchActiveWords, staleTime: Infinity }),
          queryClient.ensureQueryData({ queryKey: qk.statuses(user!.id), queryFn: () => fetchStatuses(user!.id) }),
          queryClient.ensureQueryData({ queryKey: qk.mastery(user!.id), queryFn: () => getMastery(user!.id) }),
        ]);
        setStatuses(st);
        setLivePct(mst.pct); setReadinessBefore(mst.pct);
        const days = mode === "weekly" ? 7 : 30;
        const pool = await buildPeriodicQuiz(user!.id, days);
        if (pool.length < 4) { setQuestions([]); return; }
        setQuestions(buildQuizQuestions(pool, allWords, st));
      }
    })();
  }, [user, isGuest, mode, missionParam, search.world, queryClient, navigate]);

  useEffect(() => {
    if (!done || !questions || finished) return;
    if (!isGuest && !user) return;
    (async () => {
      const total = questions.length;
      const stars = mode === "mission" ? starsForScore(score, total) : 0;

      if (!isGuest && mode !== "weakness") {
        await recordAttempt(
          user!.id,
          mode === "mission" ? "stage" : mode,
          score,
          total,
          mode === "mission" ? stageIndex : null,
          mode === "mission" ? activeWorld : null,
        ).catch(() => {});
      }

      let xp = score * XP_PER_CORRECT;
      if (mode === "mission" && stars === 3) xp += XP_BONUS_3STAR;
      if (mode === "weekly") xp += XP_WEEKLY;
      if (mode === "monthly") xp += XP_MONTHLY;
      let streak = 0;
      let mstAfterPct = 0;
      let newBadges: BadgeDef[] = [];
      if (!isGuest) {
        await awardXp(user!.id, xp).catch(() => {});
        const after = await bumpSessionStreak(user!.id).catch(() => null);
        bumpStreak(user!.id).catch(() => {});
        streak = after?.current_streak ?? 0;

        const mstAfter = await getMastery(user!.id);
        mstAfterPct = mstAfter.pct;
        const allWords = await fetchActiveWords();
        const masteryMap = await fetchStatuses(user!.id);
        const touched = Object.keys(masteryMap).length;
        const masteredCount = Object.values(masteryMap).filter((v) => v !== null && v !== undefined).length;
        const masteryPct = allWords.length > 0 ? Math.round((masteredCount / allWords.length) * 100) : 0;
        newBadges = await checkBadges(user!.id, {
          streak,
          mcRun: 0,
          masteryPct,
          touchedCount: touched,
        }).catch(() => [] as BadgeDef[]);
        newBadges.forEach((b) => {
          const ja = BADGES_JA[b.key];
          const name = lang === "ja" && ja ? ja.name : b.name;
          const desc = lang === "ja" && ja ? ja.desc : b.desc;
          toast.success(`🏅 ${name}`, { description: desc });
        });
      }

      const weakAdded = outcomes.filter((o) => !o.correct).length;

      // Advance per-world current stage if they cleared the suggested one
      if (!isGuest && mode === "mission" && stageIndex) {
        const cur = await getWorldStage(user!.id, activeWorld);
        if (stageIndex === cur) {
          await setWorldStage(user!.id, activeWorld, stageIndex + 1).catch(() => {});
        }
      }

      setFinished({
        stars,
        xpGained: xp,
        newStreak: streak,
        newBadges,
        readinessBefore,
        readinessAfter: isGuest ? 0 : mstAfterPct,
        weakAdded,
      });
    })();
  }, [done, user, isGuest, questions, finished, mode, score, stageIndex, activeWorld, mcRun, readinessBefore, outcomes, lang]);

  if (!questions)
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="space-y-6 rounded-2xl border bg-card p-6 shadow-card">
          <Skeleton className="mx-auto h-4 w-24" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="mx-auto h-5 w-40" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </div>
      </main>
    );

  if (questions.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6 text-center">
        <h1 className="font-display text-3xl">Not enough words yet</h1>
        <p className="text-muted-foreground mt-2">
          {mode === "mission"
            ? "Need at least a few words with example sentences in this stage."
            : mode === "weakness"
            ? "No weak words to quiz — keep practicing!"
            : `Study at least 4 words in the last ${mode === "weekly" ? "7" : "30"} days to take this review.`}
        </p>
        <Button asChild className="mt-6"><Link to="/study">Back to study</Link></Button>
      </main>
    );
  }

  if (done) {
    if (isGuest && mode === "mission" && stageIndex === GUEST_FREE_STAGES) {
      return (
        <main className="mx-auto max-w-xl px-4 py-6">
          <SignupGate trigger="stage-complete" />
        </main>
      );
    }
    const before = finished?.readinessBefore ?? readinessBefore;
    const afterPct = finished?.readinessAfter ?? livePct;
    const delta = afterPct - before;

    return (
      <main className="mx-auto max-w-xl px-4 py-6 text-center">
        <div className="text-5xl mb-2">{delta >= 5 ? "🎉" : delta >= 0 ? "✨" : "🌱"}</div>
        <h1 className="font-display text-4xl">{score} / {questions.length}</h1>

        <div className="mt-5 flex justify-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 font-display">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">{t("results.delta")}</span>
            <span className={cn(
              "text-base",
              afterPct >= 80 ? "text-sage" : afterPct >= 50 ? "text-gold" : "text-rose",
            )}>{before}% → {afterPct}%</span>
            {delta !== 0 && (
              <span className={cn("text-xs", delta > 0 ? "text-sage" : "text-rose")}>
                {delta > 0 ? "+" : ""}{delta}
              </span>
            )}
          </div>
          {finished && (
            <div className="flex items-center gap-1.5 rounded-full border bg-rose/10 text-rose px-3 py-1.5 font-display">
              <Flame className="h-4 w-4" />
              {finished.newStreak}
            </div>
          )}
        </div>

        {finished && finished.weakAdded > 0 && (
          <div className="mt-4 inline-block rounded-full border border-rose/40 bg-rose/5 text-rose px-3 py-1 text-sm">
            🔴 +{finished.weakAdded} {t("weak.title")}
          </div>
        )}

        {finished && finished.newBadges.length > 0 && (
          <div className="mt-5 rounded-2xl border bg-gradient-to-br from-gold/10 to-amber-300/5 border-gold/40 p-4">
            <div className="text-xs uppercase tracking-widest text-gold font-medium mb-2">{t("results.newBadges")}</div>
            <div className="flex flex-wrap gap-3 justify-center">
              {finished.newBadges.map((b) => (
                <div key={b.key} className="flex flex-col items-center w-20">
                  <div className="text-3xl">{b.emoji}</div>
                  <div className="mt-0.5 text-[11px] font-medium leading-tight">{b.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {mode === "mission" && stageIndex ? (
            <>
              <Button asChild>
                <Link to="/study/flashcards" search={{ mission: stageIndex + 1, world: activeWorld }}>
                  Study stage {stageIndex + 1}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/study/quiz" search={{ mode: "mission" as const, mission: stageIndex, world: activeWorld }} reloadDocument>
                  Retry
                </Link>
              </Button>
            </>
          ) : (
            <Button onClick={() => location.reload()}>Try again</Button>
          )}
          <Button variant="ghost" asChild><Link to="/study">Back</Link></Button>
        </div>
        {isGuest && (
          <p className="mt-6 text-sm text-muted-foreground">
            Sign up free to track your XP and streak across all worlds.
          </p>
        )}
      </main>
    );
  }

  const q = questions[idx];

  const pick = async (opt: string) => {
    if (picked) return;
    if (!isGuest && !user) return;
    setPicked(opt);
    const correct = opt === q.answer;
    if (correct) setScore((s) => s + 1);
    setMcRun((r) => (correct ? r + 1 : 0));
    setRevealed(true);

    if (isGuest) {
      const before = getGuestMasteryForWord(q.word.id);
      const base = before ?? 0;
      // First-try = no prior outcome for this word, or the prior was correct.
      const prior = [...outcomes].reverse().find((o) => o.wordId === q.word.id);
      const firstTry = !prior || prior.correct === true;
      let after: Mastery;
      if (correct) after = (firstTry ? Math.min(3, base + 1) : base) as Mastery;
      else if (base === 3) after = 1;
      else after = Math.max(0, base - 1) as Mastery;
      setGuestMasteryForWord(q.word.id, after);
      setStatuses((p) => ({ ...p, [q.word.id]: after }));
      setOutcomes((p) => [...p, { wordId: q.word.id, correct, before, after }]);
    } else {
      const before = statuses[q.word.id];
      // Look up the most recent prior attempt for this word BEFORE inserting the new row.
      const { data: prior } = await supabase
        .from("quiz_results")
        .select("correct")
        .eq("student_id", user!.id)
        .eq("word_id", q.word.id)
        .order("taken_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const firstTry = !prior || prior.correct === true;
      supabase.from("quiz_results").insert({ student_id: user!.id, word_id: q.word.id, correct }).then(() => {});
      applyQuizResult(user!.id, q.word.id, before, correct, firstTry).then((after) => {
        setStatuses((p) => ({ ...p, [q.word.id]: after }));
        setOutcomes((p) => [...p, { wordId: q.word.id, correct, before, after }]);
        getMastery(user!.id).then((m) => setLivePct(m.pct)).catch(() => {});
        queryClient.invalidateQueries({ queryKey: qk.statuses(user!.id) });
        queryClient.invalidateQueries({ queryKey: qk.mastery(user!.id) });
      });
    }

    const delay = correct ? 900 : 1800;
    setTimeout(() => {
      setRevealed(false);
      if (idx + 1 >= questions.length) setDone(true);
      else { setIdx((i) => i + 1); setPicked(null); }
    }, delay);
  };

  const worldShort = categoryLabel(activeWorld);
  const headerLabel =
    mode === "mission" && stageIndex
      ? `${worldShort} · Stage ${stageIndex} quiz`
      : mode === "weekly"
      ? "Weekly review"
      : mode === "monthly"
      ? "Monthly review"
      : mode === "weakness"
      ? "Weakness quiz"
      : "Quiz";

  const liveColor = livePct >= 80 ? "text-sage bg-sage/10" : livePct >= 50 ? "text-gold bg-gold/10" : "text-rose bg-rose/10";

  return (
    <main className="mx-auto max-w-xl px-4 py-4">
      <h1 className="sr-only">{headerLabel}</h1>
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
        <span className="rounded-full bg-gold/15 text-gold px-2 py-0.5 text-xs font-medium">{headerLabel}</span>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", liveColor)}>
            {t("mastery.live")} {livePct}%
          </span>
          <span>{idx + 1} / {questions.length}</span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-6">
        <div className="h-full bg-gold" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <p className="text-lg" dangerouslySetInnerHTML={{ __html: q.sentenceHtml }} />
        <div className="mt-6 grid grid-cols-1 gap-3">
          {q.options.map((opt) => {
            const isAnswer = opt === q.answer;
            const isPicked = picked === opt;
            const cls = !picked
              ? "border bg-card hover:border-gold"
              : isAnswer
              ? "border-sage bg-sage text-sage-foreground"
              : isPicked
              ? "border-rose bg-rose text-rose-foreground"
              : "border bg-card opacity-60";
            return (
              <button key={opt} onClick={() => pick(opt)} className={`rounded-xl px-4 py-3 text-left font-medium transition ${cls}`}>
                {opt}
              </button>
            );
          })}
        </div>
        {revealed && picked !== q.answer && (
          <div className="mt-4 rounded-xl border border-rose/40 bg-rose/5 p-3 text-sm">
            <div className="text-rose font-medium">{t("quiz.correctAns")}: <span className="font-display">{q.answer}</span></div>
            <div className="mt-1 text-xs text-muted-foreground">🔴 {t("quiz.added")}</div>
          </div>
        )}
      </div>
    </main>
  );
}
