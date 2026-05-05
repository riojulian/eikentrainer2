import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchActiveWords,
  fetchStatuses,
  applyQuizResult,
  MASTERY_LABELS,
  TIER_SHORT,
  type Word,
  type Mastery,
  type MasteryOrUnseen,
} from "@/lib/words";
import { Button } from "@/components/ui/button";
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
} from "@/lib/stages";
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
import { useLang } from "@/lib/i18n";
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

function buildQuizQuestions(pool: Word[], allWords: Word[]): Q[] {
  const usable = pool.filter((w) => w.example_sentence);
  return usable.slice(0, STAGE_SIZE).map((w) => {
    const distractors = shuffle(allWords.filter((x) => x.id !== w.id)).slice(0, 3).map((x) => x.word);
    const options = shuffle([w.word, ...distractors]);
    const sentenceHtml = (w.example_sentence ?? "").replace(/<strong>.*?<\/strong>/i, "<strong>______</strong>");
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
  const { t } = useLang();
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
    if (!user) return;
    (async () => {
      if (mode === "mission") {
        const world = search.world ?? await getCurrentWorld(user.id);
        setActiveWorld(world);
        const [allWords, st, ordered, mst] = await Promise.all([
          fetchActiveWords(),
          fetchStatuses(user.id),
          ensureWorldOrder(user.id, world),
          getMastery(user.id),
        ]);
        setStatuses(st);
        setLivePct(mst.pct); setReadinessBefore(mst.pct);
        const stages = stagize(ordered);
        const cur = await getWorldStage(user.id, world);
        const idxToUse = missionParam ?? cur;
        setStageIndex(idxToUse);
        if (stages.length === 0) { setQuestions([]); return; }
        const pool = buildStageQuiz(stages, idxToUse);
        setQuestions(buildQuizQuestions(pool, allWords));
      } else if (mode === "weakness") {
        const [allWords, st, weak, mst] = await Promise.all([
          fetchActiveWords(),
          fetchStatuses(user.id),
          getWeakWords(user.id),
          getMastery(user.id),
        ]);
        setStatuses(st);
        setLivePct(mst.pct); setReadinessBefore(mst.pct);
        if (weak.length < 1) { setQuestions([]); return; }
        setQuestions(buildQuizQuestions(weak, allWords));
      } else {
        const [allWords, st, mst] = await Promise.all([
          fetchActiveWords(),
          fetchStatuses(user.id),
          getMastery(user.id),
        ]);
        setStatuses(st);
        setLivePct(mst.pct); setReadinessBefore(mst.pct);
        const days = mode === "weekly" ? 7 : 30;
        const pool = await buildPeriodicQuiz(user.id, days);
        if (pool.length < 4) { setQuestions([]); return; }
        setQuestions(buildQuizQuestions(pool, allWords));
      }
    })();
  }, [user, mode, missionParam, search.world]);

  useEffect(() => {
    if (!done || !user || !questions || finished) return;
    (async () => {
      const total = questions.length;
      const stars = mode === "mission" ? starsForScore(score, total) : 0;

      if (mode !== "weakness") {
        await recordAttempt(
          user.id,
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
      await awardXp(user.id, xp).catch(() => {});

      // Bump session streak (consecutive completed sessions; never auto-resets).
      const after = await bumpSessionStreak(user.id).catch(() => null);
      // Also bump the legacy day-streak so old data keeps moving (Q3=a).
      bumpStreak(user.id).catch(() => {});
      const streak = after?.current_streak ?? 0;

      const mstAfter = await getMastery(user.id);
      const newBadges = await checkBadges(user.id, {
        streak,
        mcRun,
        masteryPct: mstAfter.pct,
        touchedCount: mstAfter.touched,
      }).catch(() => [] as BadgeDef[]);
      newBadges.forEach((b) => toast.success(`🏅 ${b.name}`, { description: b.desc }));

      const weakAdded = outcomes.filter((o) => !o.correct).length;

      // Advance per-world current stage if they cleared the suggested one
      if (mode === "mission" && stageIndex) {
        const cur = await getWorldStage(user.id, activeWorld);
        if (stageIndex === cur) {
          await setWorldStage(user.id, activeWorld, stageIndex + 1).catch(() => {});
        }
      }

      setFinished({
        stars,
        xpGained: xp,
        newStreak: streak,
        newBadges,
        readinessBefore,
        readinessAfter: mstAfter.pct,
        weakAdded,
      });
    })();
  }, [done, user, questions, finished, mode, score, stageIndex, activeWorld, mcRun, readinessBefore, outcomes]);

  if (!questions) return <main className="p-10 text-center text-muted-foreground">Loading…</main>;

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
      </main>
    );
  }

  const q = questions[idx];

  const pick = async (opt: string) => {
    if (picked || !user) return;
    setPicked(opt);
    const correct = opt === q.answer;
    if (correct) setScore((s) => s + 1);
    setMcRun((r) => (correct ? r + 1 : 0));
    setRevealed(true);

    supabase.from("quiz_results").insert({ student_id: user.id, word_id: q.word.id, correct }).then(() => {});

    const before = statuses[q.word.id];
    applyQuizResult(user.id, q.word.id, before, correct).then((after) => {
      setStatuses((p) => ({ ...p, [q.word.id]: after }));
      setOutcomes((p) => [...p, { wordId: q.word.id, correct, before, after }]);
      // Refresh live mastery after persistence
      getMastery(user.id).then((m) => setLivePct(m.pct)).catch(() => {});
    });

    const delay = correct ? 900 : 1800;
    setTimeout(() => {
      setRevealed(false);
      if (idx + 1 >= questions.length) setDone(true);
      else { setIdx((i) => i + 1); setPicked(null); }
    }, delay);
  };

  const worldShort = TIER_SHORT[activeWorld] ?? activeWorld;
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
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
        <span className="rounded-full bg-gold/15 text-gold px-2 py-0.5 text-xs font-medium">{headerLabel}</span>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", liveColor)}>
            {t("rdy.live")} {livePct}%
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
