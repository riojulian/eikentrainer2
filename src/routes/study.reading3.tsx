import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Sparkles, ArrowRight, Highlighter } from "lucide-react";
import {
  fetchSectionPassages,
  fetchSubskills,
  startSession,
  endSession,
  recordAnswer,
  type ReadingPassage,
} from "@/lib/reading";
import { useLang } from "@/lib/i18n";

const SECTION = "eiken_pre1_d3";

export const Route = createFileRoute("/study/reading3")({
  component: DetailInference,
  head: () => ({
    meta: [
      { title: "Reading Comprehension (大問3) — EikenTango" },
      {
        name: "description",
        content:
          "Eiken Pre-1 大問3 practice: tap the sentence that proves your answer, then choose. We show whether your evidence was right. 英検準1級の長文内容一致選択。",
      },
      { property: "og:title", content: "Reading Comprehension (大問3) — EikenTango" },
      { property: "og:description", content: "Eiken Pre-1 長文内容一致選択 with evidence tapping and skill tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://eikentango.com/study/reading3" },
    ],
    links: [{ rel: "canonical", href: "https://eikentango.com/study/reading3" }],
  }),
});

type Outcome = "correct_evidence" | "lucky_guess" | "reasonable_miss" | "no_evidence_found";

function outcomeCopy(o: Outcome, ja: boolean) {
  switch (o) {
    case "correct_evidence":
      return ja ? "根拠も答えも正解！この読み方を続けましょう。" : "Right answer, right evidence. That's the skill.";
    case "lucky_guess":
      return ja ? "正解ですが、根拠の文が違いました。ハイライトを確認しましょう。" : "Correct — but your evidence was off. Check the highlighted sentence.";
    case "reasonable_miss":
      return ja ? "根拠の文は合っています。読み取り方をもう一度確認しましょう。" : "You found the right sentence but read it the wrong way.";
    case "no_evidence_found":
      return ja ? "根拠の文を見つけられませんでした。ハイライトを読み直しましょう。" : "The evidence was elsewhere — re-read the highlighted sentence.";
  }
}

function DetailInference() {
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
  const [tapped, setTapped] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [evidenceHits, setEvidenceHits] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const passage: ReadingPassage | undefined = passages?.[pIdx];
  const question = passage?.questions[qIdx];

  useEffect(() => {
    if (!passages || passages.length === 0 || !user) return;
    const ids = passages.flatMap((p) => p.questions.map((q) => q.id));
    void startSession(user.id, "detail_inference", ids).then(setSessionId).catch(() => setSessionId(null));
  }, [passages, user]);

  const skillLabel = useMemo(() => {
    if (!question || !subskills) return null;
    const hits = subskills.filter((s) => question.subskill_ids.includes(s.id));
    return hits.length ? hits.map((s) => (ja ? s.label_ja : s.label_en)).join(" · ") : null;
  }, [question, subskills, ja]);

  const revealed = picked !== null;
  const outcome: Outcome | null = useMemo(() => {
    if (!revealed || !question) return null;
    const correct = picked === question.correct_choice_index;
    const evidenceOk = !!tapped && question.evidence_sentence_ids.includes(tapped);
    if (correct) return evidenceOk ? "correct_evidence" : "lucky_guess";
    return evidenceOk ? "reasonable_miss" : "no_evidence_found";
  }, [revealed, question, picked, tapped]);

  function choose(i: number) {
    if (revealed || !question) return;
    setPicked(i);
    const correct = i === question.correct_choice_index;
    const evidenceOk = !!tapped && question.evidence_sentence_ids.includes(tapped);
    setTotal((t) => t + 1);
    if (correct) setScore((s) => s + 1);
    if (evidenceOk) setEvidenceHits((n) => n + 1);
    if (user) {
      void recordAnswer({
        userId: user.id,
        sessionId,
        question,
        selectedIndex: i,
        isCorrect: correct,
        tappedSentenceId: tapped,
        evidenceOutcome: correct
          ? evidenceOk
            ? "correct_evidence"
            : "lucky_guess"
          : evidenceOk
            ? "reasonable_miss"
            : "no_evidence_found",
      }).catch(() => {});
    }
  }

  function next() {
    if (!passage) return;
    setPicked(null);
    setTapped(null);
    if (qIdx + 1 < passage.questions.length) {
      setQIdx((n) => n + 1);
      return;
    }
    if (passages && pIdx + 1 < passages.length) {
      setPIdx((n) => n + 1);
      setQIdx(0);
      return;
    }
    setDone(true);
    if (sessionId) void endSession(sessionId);
  }

  function restart() {
    setPIdx(0);
    setQIdx(0);
    setPicked(null);
    setTapped(null);
    setScore(0);
    setTotal(0);
    setEvidenceHits(0);
    setDone(false);
  }

  if (isLoading || (!passage && !done)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="sr-only">Reading comprehension practice</h1>
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
    const evPct = total ? Math.round((evidenceHits / total) * 100) : 0;
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <h1 className="font-display text-3xl">{ja ? "おつかれさま！" : "Nice work!"}</h1>
        <div className="mt-6 rounded-2xl border bg-card p-8 shadow-card">
          <div className="font-display text-5xl text-gold">
            {score}/{total}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {pct}% {ja ? "正解" : "correct"} · {evPct}% {ja ? "根拠も的中" : "evidence found"}
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
      <h1 className="sr-only">Reading comprehension practice</h1>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{ja ? "大問3 長文内容一致選択" : "Part 3 · Reading comprehension"}</span>
        <span>
          {answeredSoFar + 1} / {totalQs}
        </span>
      </div>

      <article className="mt-4 rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="font-display text-xl">{p.title}</h2>
        {p.topic_tag && <div className="mt-1 text-[11px] uppercase tracking-widest text-gold">{p.topic_tag}</div>}
        <div className="mt-3 text-[15px] leading-8">
          {p.sentences.length > 0
            ? p.sentences.map((s) => {
                const isEvidence = q.evidence_sentence_ids.includes(s.id);
                const isTapped = tapped === s.id;
                const cls = revealed
                  ? isEvidence
                    ? "bg-sage/20 rounded-md"
                    : isTapped
                      ? "bg-rose/15 rounded-md"
                      : ""
                  : isTapped
                    ? "bg-gold/25 rounded-md"
                    : "hover:bg-muted/60 rounded-md";
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => !revealed && setTapped(isTapped ? null : s.id)}
                    disabled={revealed}
                    aria-label={`Select sentence ${s.label ?? s.sentence_index + 1} as evidence`}
                    className={`cursor-pointer px-0.5 text-left transition ${cls}`}
                  >
                    {s.text}{" "}
                  </button>
                );
              })
            : <p className="whitespace-pre-wrap">{p.body_text}</p>}
        </div>
      </article>

      <div className="mt-4 rounded-2xl border bg-card p-6 shadow-card">
        {skillLabel && (
          <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-gold" /> {skillLabel}
          </div>
        )}
        <p className="mt-3 text-[15px] font-medium leading-relaxed">{q.prompt}</p>

        {!revealed && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Highlighter className="h-3.5 w-3.5 text-gold" />
            {tapped
              ? ja
                ? "根拠の文を選びました。答えを選びましょう。"
                : "Evidence selected — now pick your answer."
              : ja
                ? "答える前に、根拠になる文をタップ（任意）"
                : "Tap the sentence that proves your answer first (optional)"}
          </p>
        )}

        <div className="mt-4 space-y-2">
          {q.choices.map((c, i) => {
            const isAnswer = i === q.correct_choice_index;
            const isPicked = picked === i;
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

        {revealed && (
          <div className="mt-5 space-y-3">
            {outcome && (
              <p className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">{outcomeCopy(outcome, ja)}</p>
            )}
            {q.explanation && (
              <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{q.explanation}</p>
            )}
            <Button className="h-12 w-full" onClick={next}>
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
