import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Sparkles, ArrowRight } from "lucide-react";
import {
  fetchSectionPassages,
  fetchSubskills,
  startSession,
  endSession,
  recordAnswer,
  type ReadingPassage,
} from "@/lib/reading";
import { useLang } from "@/lib/i18n";

const SECTION = "eiken_pre1_d2";

export const Route = createFileRoute("/study/reading2")({
  component: LogicalFlow,
  head: () => ({
    meta: [
      { title: "Passage Blanks (大問2) — EikenTango" },
      {
        name: "description",
        content:
          "Eiken Pre-1 大問2 practice: fill the blanks in a passage by following its logical flow, with instant feedback and micro-skill tracking. 英検準1級の長文語句空所補充。",
      },
      { property: "og:title", content: "Passage Blanks (大問2) — EikenTango" },
      { property: "og:description", content: "Eiken Pre-1 長文語句空所補充 practice with logical-flow feedback." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://eikentango.com/study/reading2" },
    ],
    links: [{ rel: "canonical", href: "https://eikentango.com/study/reading2" }],
  }),
});

function renderBody(body: string, activeBlank: number | null, solved: Record<number, string>) {
  const parts = body.split(/(\(\s*\d+\s*\))/g);
  return parts.map((part, i) => {
    const m = part.match(/^\(\s*(\d+)\s*\)$/);
    if (!m) return <span key={i}>{part}</span>;
    const n = Number(m[1]);
    const answer = solved[n];
    if (answer) {
      return (
        <span key={i} className="rounded-md bg-sage/15 px-1.5 py-0.5 font-medium text-foreground">
          {answer}
        </span>
      );
    }
    return (
      <span
        key={i}
        className={`rounded-md px-2 py-0.5 font-semibold ${
          activeBlank === n ? "bg-gold/25 text-foreground ring-2 ring-gold" : "bg-muted text-muted-foreground"
        }`}
      >
        ( {n} )
      </span>
    );
  });
}

function LogicalFlow() {
  const { user } = useAuth();
  const { lang } = useLang();
  const ja = lang === "ja";

  const { data: passages, isLoading } = useQuery({
    queryKey: ["reading", SECTION, "passages"],
    queryFn: () => fetchSectionPassages(SECTION),
    staleTime: 30 * 60 * 1000,
  });
  const { data: subskills } = useQuery({
    queryKey: ["reading", SECTION, "subskills"],
    queryFn: () => fetchSubskills(SECTION),
    staleTime: Infinity,
  });

  const [pIdx, setPIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [solved, setSolved] = useState<Record<number, string>>({});
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const passage: ReadingPassage | undefined = passages?.[pIdx];
  const question = passage?.questions[qIdx];

  useEffect(() => {
    if (!passages || passages.length === 0 || !user) return;
    const ids = passages.flatMap((p) => p.questions.map((q) => q.id));
    void startSession(user.id, "logical_flow", ids).then(setSessionId).catch(() => setSessionId(null));
  }, [passages, user]);

  const skillLabel = useMemo(() => {
    if (!question || !subskills) return null;
    const hits = subskills.filter((s) => question.subskill_ids.includes(s.id));
    return hits.length ? hits.map((s) => (ja ? s.label_ja : s.label_en)).join(" · ") : null;
  }, [question, subskills, ja]);

  function choose(i: number) {
    if (picked !== null || !question) return;
    setPicked(i);
    const correct = i === question.correct_choice_index;
    setTotal((t) => t + 1);
    if (correct) setScore((s) => s + 1);
    setSolved((prev) => ({
      ...prev,
      [question.blank_number ?? qIdx + 1]: question.choices[question.correct_choice_index] ?? "",
    }));
    if (user) {
      void recordAnswer({
        userId: user.id,
        sessionId,
        question,
        selectedIndex: i,
        isCorrect: correct,
      }).catch(() => {});
    }
  }

  function next() {
    if (!passage) return;
    setPicked(null);
    if (qIdx + 1 < passage.questions.length) {
      setQIdx((n) => n + 1);
      return;
    }
    if (passages && pIdx + 1 < passages.length) {
      setPIdx((n) => n + 1);
      setQIdx(0);
      setSolved({});
      return;
    }
    setDone(true);
    if (sessionId) void endSession(sessionId);
  }

  function restart() {
    setPIdx(0);
    setQIdx(0);
    setPicked(null);
    setSolved({});
    setScore(0);
    setTotal(0);
    setDone(false);
  }

  if (isLoading || (!passage && !done)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="sr-only">Passage blanks practice</h1>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="mt-6 space-y-2 rounded-2xl border bg-card p-6 shadow-card">
          <Skeleton className="h-5 w-1/2" />
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </main>
    );
  }

  if (done) {
    const pct = total ? Math.round((score / total) * 100) : 0;
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <h1 className="font-display text-3xl">{ja ? "おつかれさま！" : "Nice work!"}</h1>
        <div className="mt-6 rounded-2xl border bg-card p-8 shadow-card">
          <div className="font-display text-5xl text-gold">
            {score}/{total}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {pct}% {ja ? "正解" : "correct"}
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button onClick={restart}>{ja ? "もう一度" : "Practice again"}</Button>
            <Button variant="outline" asChild>
              <Link to="/study">{ja ? "ホームに戻る" : "Back to study"}</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const p = passage!;
  const q = question!;
  const totalQs = passages!.reduce((n, x) => n + x.questions.length, 0);
  const answeredSoFar = passages!.slice(0, pIdx).reduce((n, x) => n + x.questions.length, 0) + qIdx;
  const progress = (answeredSoFar / Math.max(1, totalQs)) * 100;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="sr-only">Passage blanks practice</h1>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{ja ? "大問2 長文語句空所補充" : "Part 2 · Passage blanks"}</span>
        <span>
          {answeredSoFar + 1} / {totalQs}
        </span>
      </div>

      <article className="mt-4 rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="font-display text-xl">{p.title}</h2>
        {p.topic_tag && <div className="mt-1 text-[11px] uppercase tracking-widest text-gold">{p.topic_tag}</div>}
        <div className="mt-3 space-y-8 text-[13.5px] leading-7">
          {p.body_text.split(/\n\s*\n|\n/).filter((t) => t.trim()).map((para, i) => (
            <p key={i}>{renderBody(para, q.blank_number, solved)}</p>
          ))}
        </div>
      </article>

      <div className="mt-4 rounded-2xl border bg-card p-6 shadow-card">
        {skillLabel && (
          <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-gold" /> {skillLabel}
          </div>
        )}
        <p className="mt-3 text-sm font-medium">
          {ja ? `空所 ( ${q.blank_number} ) に入るものを選びましょう` : `Choose what belongs in blank ( ${q.blank_number} )`}
        </p>

        <div className="mt-4 space-y-2">
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
              {answeredSoFar + 1 >= totalQs ? (ja ? "結果を見る" : "See results") : ja ? "次へ" : "Next"}
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
