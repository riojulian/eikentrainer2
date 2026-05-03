import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveWords, fetchStatuses, type Word } from "@/lib/words";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/study/quiz")({
  component: QuizPage,
});

type Q = { word: Word; options: string[]; answer: string; sentenceHtml: string };

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
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [all, statuses] = await Promise.all([fetchActiveWords(), fetchStatuses(user.id)]);
      const marked = all.filter((w) => statuses[w.id] === "known" || statuses[w.id] === "review");
      if (marked.length < 4) { setQuestions([]); return; }
      setQuestions(buildQuiz(marked, all));
    })();
  }, [user]);

  if (!questions) return <main className="p-10 text-center text-muted-foreground">Loading…</main>;

  if (questions.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl">Study some words first</h1>
        <p className="text-muted-foreground mt-2">Mark at least 4 words as Known or Review to unlock the quiz.</p>
        <Button asChild className="mt-6"><Link to="/study/flashcards">Open flashcards</Link></Button>
      </main>
    );
  }

  if (done) {
    const msg = score >= 8 ? "Brilliant!" : score >= 5 ? "Nice work!" : "Keep practicing — you've got this.";
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="text-6xl mb-4">{score >= 8 ? "🎉" : score >= 5 ? "✨" : "🌱"}</div>
        <h1 className="font-display text-4xl">{score} / {questions.length}</h1>
        <p className="text-muted-foreground mt-2">{msg}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={() => location.reload()}>Try again</Button>
          <Button variant="outline" asChild><Link to="/study">Back</Link></Button>
        </div>
      </main>
    );
  }

  const q = questions[idx];

  const pick = async (opt: string) => {
    if (picked) return;
    setPicked(opt);
    const correct = opt === q.answer;
    if (correct) setScore((s) => s + 1);
    if (user) {
      supabase.from("quiz_results").insert({ student_id: user.id, word_id: q.word.id, correct }).then(() => {});
    }
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