import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { ArrowUp, ArrowDown, Trophy, Star, Flame, Sparkles } from "lucide-react";
import {
  ensureWordOrder,
  stagize,
  buildStageQuiz,
  buildPeriodicQuiz,
  recordAttempt,
  getProgress,
  setCurrentStage,
  STAGE_SIZE,
  starsForScore,
  getStarsByStage,
} from "@/lib/stages";
import {
  awardXp,
  bumpStreak,
  checkBadges,
  XP_PER_CORRECT,
  XP_BONUS_3STAR,
  XP_WEEKLY,
  XP_MONTHLY,
  type BadgeDef,
} from "@/lib/gamification";
import { cn } from "@/lib/utils";

type Mode = "mission" | "weekly" | "monthly";

export const Route = createFileRoute("/study/quiz")({
  validateSearch: (s: Record<string, unknown>) => {
    const modeRaw = s.mode;
    const mode: Mode | undefined =
      modeRaw === "mission" || modeRaw === "weekly" || modeRaw === "monthly" ? modeRaw : undefined;
    const missionRaw = s.mission;
    const mission = typeof missionRaw === "number" ? missionRaw : typeof missionRaw === "string" ? Number(missionRaw) : undefined;
    return {
      mode,
      mission: mission && Number.isFinite(mission) && mission > 0 ? mission : undefined,
    } as { mode?: Mode; mission?: number };
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
};

function QuizPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const mode: Mode = search.mode ?? "mission";
  const missionParam = search.mission;

  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, MasteryOrUnseen>>({});
  const [stageIndex, setStageIndex] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [finished, setFinished] = useState<FinishResult | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [allWords, st] = await Promise.all([fetchActiveWords(), fetchStatuses(user.id)]);
      setStatuses(st);

      if (mode === "mission") {
        const ordered = await ensureWordOrder(user.id);
        const stages = stagize(ordered);
        const progress = await getProgress(user.id);
        const idxToUse = missionParam ?? progress.current_stage;
        setStageIndex(idxToUse);
        if (stages.length === 0) { setQuestions([]); return; }
        const pool = buildStageQuiz(stages, idxToUse);
        setQuestions(buildQuizQuestions(pool, allWords));
      } else {
        const days = mode === "weekly" ? 7 : 30;
        const pool = await buildPeriodicQuiz(user.id, days);
        if (pool.length < 4) { setQuestions([]); return; }
        setQuestions(buildQuizQuestions(pool, allWords));
      }
    })();
  }, [user, mode, missionParam]);

  // Run finish logic exactly once when quiz transitions to done
  useEffect(() => {
    if (!done || !user || !questions || finished) return;
    (async () => {
      const total = questions.length;
      const stars = mode === "mission" ? starsForScore(score, total) : 0;

      // Record attempt
      await recordAttempt(
        user.id,
        mode === "mission" ? "stage" : mode,
        score,
        total,
        mode === "mission" ? stageIndex : null,
      ).catch(() => {});

      // XP
      let xp = score * XP_PER_CORRECT;
      if (mode === "mission" && stars === 3) xp += XP_BONUS_3STAR;
      if (mode === "weekly") xp += XP_WEEKLY;
      if (mode === "monthly") xp += XP_MONTHLY;
      await awardXp(user.id, xp).catch(() => {});

      // Streak
      const after = await bumpStreak(user.id).catch(() => null);
      const streak = after?.current_streak ?? 0;

      // Badges
      const starsByStage = await getStarsByStage(user.id);
      const newBadges = await checkBadges(user.id, {
        starsByStage,
        streak,
        justFinishedKind: mode === "mission" ? "stage" : mode,
        justFinishedStageIndex: mode === "mission" ? stageIndex : null,
        justFinishedStars: stars,
      }).catch(() => [] as BadgeDef[]);

      // Advance current stage if they just finished the suggested stage
      if (mode === "mission" && stageIndex) {
        const p = await getProgress(user.id);
        if (stageIndex === p.current_stage) {
          await setCurrentStage(user.id, stageIndex + 1).catch(() => {});
        }
      }

      setFinished({ stars, xpGained: xp, newStreak: streak, newBadges });
    })();
  }, [done, user, questions, finished, mode, score, stageIndex]);

  if (!questions) return <main className="p-10 text-center text-muted-foreground">Loading…</main>;

  if (questions.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6 text-center">
        <h1 className="font-display text-3xl">Not enough words yet</h1>
        <p className="text-muted-foreground mt-2">
          {mode === "mission"
            ? "Need at least a few words with example sentences in this stage."
            : `Study at least 4 words in the last ${mode === "weekly" ? "7" : "30"} days to take this review.`}
        </p>
        <Button asChild className="mt-6"><Link to="/study">Back to study</Link></Button>
      </main>
    );
  }

  if (done) {
    const movedUp = outcomes.filter((o) => o.after > (o.before ?? 0)).length;
    const movedDown = outcomes.filter((o) => o.after < (o.before ?? 0)).length;
    const reachedMastered = outcomes.filter((o) => o.after === 3 && o.before !== 3).length;
    const stars = finished?.stars ?? 0;
    const msg =
      stars === 3 ? "Flawless victory!" :
      stars === 2 ? "Great work!" :
      stars === 1 ? "Nice — you cleared it!" :
      "Keep practicing — you've got this.";

    return (
      <main className="mx-auto max-w-xl px-4 py-6 text-center">
        {/* Star reveal */}
        {mode === "mission" && (
          <div className="flex justify-center gap-3 mb-3">
            {[1, 2, 3].map((n) => (
              <Star
                key={n}
                className={cn(
                  "h-14 w-14 transition-all duration-500",
                  n <= stars
                    ? "fill-gold text-gold drop-shadow-[0_0_12px_rgba(201,168,76,0.6)] animate-in zoom-in-50"
                    : "text-muted-foreground/30",
                )}
                style={{ animationDelay: `${n * 200}ms` }}
              />
            ))}
          </div>
        )}

        <div className="text-5xl mb-2">{score >= 8 ? "🎉" : score >= 5 ? "✨" : "🌱"}</div>
        <h1 className="font-display text-4xl">{score} / {questions.length}</h1>
        <p className="text-muted-foreground mt-2">{msg}</p>

        {/* XP + Streak strip */}
        {finished && (
          <div className="mt-5 flex justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 rounded-full border bg-gold/10 text-gold px-3 py-1.5 font-display animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Sparkles className="h-4 w-4" />
              +{finished.xpGained} XP
            </div>
            <div className="flex items-center gap-1.5 rounded-full border bg-rose/10 text-rose px-3 py-1.5 font-display animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: "100ms" }}>
              <Flame className="h-4 w-4" />
              {finished.newStreak} day{finished.newStreak === 1 ? "" : "s"}
            </div>
          </div>
        )}

        {/* New badges */}
        {finished && finished.newBadges.length > 0 && (
          <div className="mt-5 rounded-2xl border bg-gradient-to-br from-gold/10 to-amber-300/5 border-gold/40 p-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-xs uppercase tracking-widest text-gold font-medium mb-2">Achievements unlocked!</div>
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

        <div className="mt-6 rounded-2xl border bg-card p-5 shadow-card text-left">
          <div className="text-sm font-medium mb-3">What changed</div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-sage" />
              <span>{movedUp} word{movedUp === 1 ? "" : "s"} moved up</span>
            </li>
            <li className="flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-rose" />
              <span>{movedDown} word{movedDown === 1 ? "" : "s"} stepped back</span>
            </li>
            {reachedMastered > 0 && (
              <li className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-gold" />
                <span>{reachedMastered} reached <span className="text-gold font-medium">{MASTERY_LABELS[3]}</span></span>
              </li>
            )}
          </ul>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {mode === "mission" && stageIndex ? (
            <>
              <Button asChild>
                <Link to="/study/flashcards" search={{ mission: stageIndex + 1 }}>
                  Study stage {stageIndex + 1}
                </Link>
              </Button>
              {stars < 3 && (
                <Button variant="outline" asChild>
                  <Link to="/study/quiz" search={{ mode: "mission" as const, mission: stageIndex }} reloadDocument>
                    Retry for 3 stars
                  </Link>
                </Button>
              )}
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

    supabase.from("quiz_results").insert({ student_id: user.id, word_id: q.word.id, correct }).then(() => {});

    const before = statuses[q.word.id];
    applyQuizResult(user.id, q.word.id, before, correct).then((after) => {
      setStatuses((p) => ({ ...p, [q.word.id]: after }));
      setOutcomes((p) => [...p, { wordId: q.word.id, correct, before, after }]);
    });

    setTimeout(() => {
      if (idx + 1 >= questions.length) setDone(true);
      else { setIdx((i) => i + 1); setPicked(null); }
    }, 1200);
  };

  const headerLabel =
    mode === "mission" && stageIndex
      ? `Stage ${stageIndex} quiz`
      : mode === "weekly"
      ? "Weekly review"
      : mode === "monthly"
      ? "Monthly review"
      : "Quiz";

  return (
    <main className="mx-auto max-w-xl px-4 py-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
        <span className="rounded-full bg-gold/15 text-gold px-2 py-0.5 text-xs font-medium">{headerLabel}</span>
        <span>Question {idx + 1} of {questions.length}</span>
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
      </div>
    </main>
  );
}
