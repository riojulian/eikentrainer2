import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Sparkles, ArrowRight } from "lucide-react";
import {
  fetchSectionQuestions,
  fetchSubskills,
  startSession,
  endSession,
  recordAnswer,
  type ReadingQuestion,
} from "@/lib/reading";
import { useLang } from "@/lib/i18n";

const SECTION = "eiken_pre1_d1";

export const Route = createFileRoute("/study/vocab")({
  component: VocabInContext,
  head: () => ({
    meta: [
      { title: "Vocab in Context (大問1) — EikenTango" },
      { name: "description", content: "Eiken Pre-1 大問1 practice: choose the word that fits the sentence, with instant feedback on which micro-skill you are building. 英検準1級の短文語句空所補充。" },
      { property: "og:title", content: "Vocab in Context (大問1) — EikenTango" },
      { property: "og:description", content: "Eiken Pre-1 短文語句空所補充 practice with instant feedback and skill tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://eikentango.com/study/vocab" },
    ],
    links: [{ rel: "canonical", href: "https://eikentango.com/study/vocab" }],
  }),
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

function VocabInContext() {
  const { user } = useAuth();
  const { lang } = useLang();
  const ja = lang === "ja";

  const { data: questions, isLoading } = useQuery({
    queryKey: ["reading", SECTION, "questions"],
    queryFn: () => fetchSectionQuestions(SECTION),
    staleTime: 30 * 60 * 1000,
  });
  const { data: subskills } = useQuery({
    queryKey: ["reading", SECTION, "subskills"],
    queryFn: () => fetchSubskills(SECTION),
    staleTime: Infinity,
  });

  const [deck, setDeck] = useState<ReadingQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!questions || questions.length === 0) return;
    const d = shuffle(questions).slice(0, 10);
    setDeck(d);
    setIdx(0);
    setPicked(null);
    setScore(0);
    setDone(false);
    if (user) {
      void startSession(user.id, "vocab", d.map((q) => q.id)).then(setSessionId).catch(() => setSessionId(null));
    }
  }, [questions, user]);

  const current = deck[idx];
  const skillLabel = useMemo(() => {
    if (!current || !subskills) return null;
    const hits = subskills.filter((s) => current.subskill_ids.includes(s.id));
    if (hits.length === 0) return null;
    return hits.map((s) => (ja ? s.label_ja : s.label_en)).join(" · ");
  }, [current, subskills, ja]);

  function choose(i: number) {
    if (picked !== null || !current) return;
    setPicked(i);
    const correct = i === current.correct_choice_index;
    if (correct) setScore((s) => s + 1);
    if (user) {
      void recordAnswer({
        userId: user.id,
        sessionId,
        question: current,
        selectedIndex: i,
        isCorrect: correct,
      }).catch(() => {});
    }
  }

  function next() {
    if (idx + 1 >= deck.length) {
      setDone(true);
      if (sessionId) void endSession(sessionId);
      return;
    }
    setIdx((n) => n + 1);
    setPicked(null);
  }

  if (isLoading || (!current && !done)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="sr-only">Vocab in Context practice</h1>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="mt-6 rounded-2xl border bg-card p-6 shadow-card">
          <Skeleton className="h-3 w-28" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
          </div>
          <div className="mt-6 space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (done) {
    const pct = deck.length ? Math.round((score / deck.length) * 100) : 0;
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <h1 className="font-display text-3xl">{ja ? "おつかれさま！" : "Nice work!"}</h1>
        <div className="mt-6 rounded-2xl border bg-card p-8 shadow-card">
          <div className="font-display text-5xl text-gold">{score}/{deck.length}</div>
          <p className="mt-2 text-sm text-muted-foreground">{pct}% {ja ? "正解" : "correct"}</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button onClick={() => { setDeck(shuffle(deck)); setIdx(0); setPicked(null); setScore(0); setDone(false); }}>
              {ja ? "もう一度" : "Practice again"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/study">{ja ? "ホームに戻る" : "Back to study"}</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const q = current!;
  const progress = ((idx + (picked !== null ? 1 : 0)) / deck.length) * 100;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="sr-only">Vocab in Context practice</h1>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{ja ? "大問1 語句空所補充" : "Part 1 · Vocab in context"}</span>
        <span>{idx + 1} / {deck.length}</span>
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-6 shadow-card">
        {skillLabel && (
          <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-gold" /> {skillLabel}
          </div>
        )}
        <p className="mt-3 text-lg leading-relaxed">{q.prompt}</p>

        <div className="mt-5 space-y-2">
          {q.choices.map((c, i) => {
            const isAnswer = i === q.correct_choice_index;
            const isPicked = picked === i;
            const revealed = picked !== null;
            const cls = !revealed
              ? "border bg-background hover:border-gold hover:bg-muted/50"
              : isAnswer
                ? "border-sage bg-sage/10"
                : isPicked
                  ? "border-rose bg-rose/10"
                  : "border bg-background opacity-60";
            return (
              <button
                key={i}
                type="button"
                onClick={() => choose(i)}
                disabled={revealed}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition ${cls}`}
              >
                <span>{c}</span>
                {revealed && isAnswer && <CheckCircle2 className="h-5 w-5 shrink-0 text-sage" />}
                {revealed && isPicked && !isAnswer && <XCircle className="h-5 w-5 shrink-0 text-rose" />}
              </button>
            );
          })}
        </div>

        {picked !== null && (
          <div className="mt-5">
            {q.explanation && (
              <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{q.explanation}</p>
            )}
            <Button className="mt-4 h-12 w-full" onClick={next}>
              {idx + 1 >= deck.length ? (ja ? "結果を見る" : "See results") : (ja ? "次へ" : "Next")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {!user && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {ja ? "サインインすると弱点スキルが記録されます。" : "Sign in to track which skills you are building."}
        </p>
      )}
    </main>
  );
}
