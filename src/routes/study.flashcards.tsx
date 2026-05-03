import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchActiveWords, fetchStatuses, setStatus, type Word, type WordStatus } from "@/lib/words";
import { Button } from "@/components/ui/button";
import { Shuffle, ArrowRight, Check, RotateCcw, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/study/flashcards")({
  component: Flashcards,
});

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Flashcards() {
  const { user } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [statuses, setStatuses] = useState<Record<string, WordStatus>>({});
  const [filter, setFilter] = useState<"all" | "review" | "known" | "unseen">("all");
  const [order, setOrder] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [w, s] = await Promise.all([fetchActiveWords(), fetchStatuses(user.id)]);
      setWords(w);
      setStatuses(s);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    return words.filter((w) => {
      const s = statuses[w.id] ?? null;
      if (filter === "review") return s === "review";
      if (filter === "known") return s === "known";
      if (filter === "unseen") return s === null;
      return true;
    });
  }, [words, statuses, filter]);

  useEffect(() => {
    setOrder(filtered.map((w) => w.id));
    setIdx(0);
    setRevealed(false);
  }, [filtered.length, filter]);

  const current = filtered.find((w) => w.id === order[idx]);

  const mark = async (status: WordStatus) => {
    if (!user || !current) return;
    setStatuses((p) => ({ ...p, [current.id]: status }));
    setStatus(user.id, current.id, status).catch(() => {});
    next();
  };

  const next = () => {
    setRevealed(false);
    setIdx((i) => Math.min(i + 1, order.length - 1));
  };
  const prev = () => {
    setRevealed(false);
    setIdx((i) => Math.max(0, i - 1));
  };

  if (!current) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl mb-4">No cards here</h1>
        <p className="text-muted-foreground mb-6">Try a different filter or add some words.</p>
        <Button asChild><Link to="/study">Back to study</Link></Button>
      </main>
    );
  }

  const pct = order.length ? Math.round(((idx + 1) / order.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-3 mb-4">
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="known">Known</SelectItem>
            <SelectItem value="unseen">Unseen</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => { setOrder(shuffle(order)); setIdx(0); setRevealed(false); }}>
          <Shuffle className="h-4 w-4 mr-1" /> Shuffle
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">{idx + 1} / {order.length}</div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-6">
        <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div
        onClick={() => setRevealed((r) => !r)}
        className="cursor-pointer rounded-3xl border bg-card p-8 sm:p-12 shadow-card min-h-[20rem] flex flex-col select-none"
      >
        <div className="flex gap-2 mb-4">
          {current.category ? <span className="text-xs uppercase tracking-widest rounded-full border border-gold/40 bg-gold/10 text-gold px-3 py-1">{current.category}</span> : null}
          {current.part_of_speech ? <span className="text-xs uppercase tracking-widest rounded-full bg-muted text-muted-foreground px-3 py-1">{current.part_of_speech}</span> : null}
        </div>
        <div className="font-display text-5xl sm:text-6xl">{current.word}</div>
        {revealed ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl bg-muted/50 p-4">
              <div className="text-sm text-muted-foreground mb-1">Definition</div>
              <div>{current.definition}</div>
              {current.definition_ja ? (
                <div className="mt-2 text-sm text-muted-foreground">{current.definition_ja}</div>
              ) : null}
            </div>
            {current.example_sentence ? (
              <p className="italic text-lg" dangerouslySetInnerHTML={{ __html: current.example_sentence }} />
            ) : null}
          </div>
        ) : (
          <div className="mt-auto text-sm text-muted-foreground">Tap card to reveal</div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Button variant="outline" onClick={() => mark("review")} className="border-rose text-rose hover:bg-rose hover:text-rose-foreground">
          <RotateCcw className="h-4 w-4 mr-1" /> Review
        </Button>
        <Button variant="outline" onClick={() => mark("known")} className="border-sage text-sage hover:bg-sage hover:text-sage-foreground">
          <Check className="h-4 w-4 mr-1" /> Know it
        </Button>
        <Button onClick={next}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
      </div>
      <div className="mt-3 flex justify-center">
        <Button variant="ghost" size="sm" onClick={prev}><ArrowLeft className="h-4 w-4 mr-1" />Previous</Button>
      </div>
    </main>
  );
}