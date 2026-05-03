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
import { ArrowUp, ArrowDown, Trophy } from "lucide-react";

export const Route = createFileRoute("/study/quiz")({
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

function buildQuiz(pool: Word[], allWords: Word[]): Q[] {
  const usable = pool.filter((w) => w.example_sentence);
  const sample = shuffle(usable).slice(0, 10);
  return sample.map((w) => {
    const distractors = shuffle(allWords.filter((x) => x.id !== w.id)).slice(0, 3).map((x) => x.word);
    const options = shuffle([w.word, ...distractors]);
    const sentenceHtml = (w.example_sentence ?? "").replace(/<strong>.*?<\/strong>/i, "<strong>______</strong>");
    return { word: w, options, answer: w.word, sentenceHtml };
  });
}

function QuizPage() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, MasteryOrUnseen>>({});
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [all, st] = await Promise.all([fetchActiveWords(), fetchStatuses(user.id)]);
      setStatuses(st);
      // Pool = words the user has at least seen, otherwise fall back to all words
      const seen = all.filter((w) => st[w.id] !== undefined && st[w.id] !== null);
      const pool = seen.length >= 4 ? seen : all;
      if (pool.filter((w) => w.example_sentence).length < 4) { setQuestions([]); return; }
      setQuestions(buildQuiz(pool, all));
    })();
  }, [user]);

  if (!questions) return <main className="p-10 text-center text-muted-foreground">Loading…</main>;

  if (questions.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl">Not enough words yet</h1>
        <p className="text-muted-foreground mt-2">Need at least 4 words with example sentences to run a quiz.</p>
        <Button asChild className="mt-6"><Link to="/study/flashcards">Open flashcards</Link></Button>
      </main>
    );
  }

  if (done) {
    const movedUp = outcomes.filter((o) => o.after > (o.before ?? 0)).length;
    const movedDown = outcomes.filter((o) => o.after < (o.before ?? 0)).length;
    const reachedMastered = outcomes.filter((o) => o.after === 3 && o.before !== 3).length;
    const msg = score >= 8 ? "Brilliant!" : score >= 5 ? "Nice work!" : "Keep practicing — you've got this.";
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="text-6xl mb-4">{score >= 8 ? "🎉" : score >= 5 ? "✨" : "🌱"}</div>
        <h1 className="font-display text-4xl">{score} / {questions.length}</h1>
        <p className="text-muted-foreground mt-2">{msg}</p>

        <div className="mt-8 rounded-2xl border bg-card p-5 shadow-card text-left">
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

        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={() => location.reload()}>Try again</Button>
          <Button variant="outline" asChild><Link to="/study">Back</Link></Button>
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

    // record quiz result
    supabase.from("quiz_results").insert({ student_id: user.id, word_id: q.word.id, correct }).then(() => {});

    // update mastery
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

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="text-sm text-muted-foreground mb-2">Question {idx + 1} of {questions.length}</div>
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
