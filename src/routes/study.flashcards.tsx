import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import {
  fetchActiveWords,
  fetchStatuses,
  setMastery,
  MASTERY_LABELS,
  type Word,
  type Mastery,
  type MasteryOrUnseen,
} from "@/lib/words";
import { Button } from "@/components/ui/button";
import { Shuffle, Check, RotateCcw, ChevronLeft, SkipForward, Keyboard, Undo2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

type Phase = "front" | "back" | "done";
type RatedKind = "review" | "known";
type LastAction = { wordId: string; prev: MasteryOrUnseen; after: Mastery; kind: RatedKind } | null;

function nextOnKnown(curr: MasteryOrUnseen): Mastery {
  const base = curr ?? 0;
  if (base < 2) return 2;
  if (base === 2) return 3;
  return 3;
}

function Flashcards() {
  const { user } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [statuses, setStatuses] = useState<Record<string, MasteryOrUnseen>>({});
  const [filter, setFilter] = useState<"all" | "learning" | "known" | "mastered" | "unseen">("all");
  const [order, setOrder] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("front");
  const [session, setSession] = useState({ known: 0, review: 0 });
  const [last, setLast] = useState<LastAction>(null);
  const undoTimer = useRef<number | null>(null);

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
      const s = statuses[w.id];
      if (filter === "learning") return s === 0 || s === 1;
      if (filter === "known") return s === 2;
      if (filter === "mastered") return s === 3;
      if (filter === "unseen") return s === null || s === undefined;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, filter]);

  useEffect(() => {
    setOrder(filtered.map((w) => w.id));
    setIdx(0);
    setPhase("front");
    setSession({ known: 0, review: 0 });
    setLast(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, words.length]);

  const current = words.find((w) => w.id === order[idx]);

  const advance = useCallback(() => {
    setPhase("front");
    setIdx((i) => {
      if (i + 1 >= order.length) {
        setPhase("done");
        return i;
      }
      return i + 1;
    });
  }, [order.length]);

  const reveal = useCallback(() => setPhase("back"), []);

  const rate = useCallback(
    (kind: RatedKind) => {
      if (!user || !current) return;
      const prev = statuses[current.id];
      const after: Mastery = kind === "review" ? 0 : nextOnKnown(prev);
      setStatuses((p) => ({ ...p, [current.id]: after }));
      setSession((s) => ({
        known: s.known + (kind === "known" ? 1 : 0),
        review: s.review + (kind === "review" ? 1 : 0),
      }));
      setLast({ wordId: current.id, prev, after, kind });
      setMastery(user.id, current.id, after).catch(() => {});
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setLast(null), 4000);
      advance();
    },
    [user, current, statuses, advance],
  );

  const undo = useCallback(() => {
    if (!user || !last) return;
    const { wordId, prev, kind } = last;
    setStatuses((p) => {
      const n = { ...p };
      if (prev === null || prev === undefined) delete n[wordId];
      else n[wordId] = prev;
      return n;
    });
    setSession((s) => ({
      known: s.known - (kind === "known" ? 1 : 0),
      review: s.review - (kind === "review" ? 1 : 0),
    }));
    setMastery(user.id, wordId, prev ?? null).catch(() => {});
    const backIdx = order.indexOf(wordId);
    if (backIdx >= 0) {
      setIdx(backIdx);
      setPhase("back");
    }
    setLast(null);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
  }, [user, last, order]);

  const prev = useCallback(() => {
    setPhase("front");
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  const skip = useCallback(() => advance(), [advance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (phase === "done") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (phase === "front") reveal();
        else rate("known");
      } else if (phase === "back" && (e.key === "1" || e.key === "ArrowLeft")) {
        e.preventDefault();
        rate("review");
      } else if (phase === "back" && (e.key === "2" || e.key === "ArrowRight")) {
        e.preventDefault();
        rate("known");
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        skip();
      } else if (e.key.toLowerCase() === "u" && last) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, reveal, rate, skip, undo, last]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    if (phase !== "back") return;
    if (dx < 0) rate("review");
    else rate("known");
  };

  if (!current && phase !== "done") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl mb-4">No cards here</h1>
        <p className="text-muted-foreground mb-6">Try a different filter or add some words.</p>
        <Button asChild><Link to="/study">Back to study</Link></Button>
      </main>
    );
  }

  if (phase === "done") {
    const total = session.known + session.review;
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-4xl mb-3">Deck complete</h1>
        <p className="text-muted-foreground mb-8">
          You reviewed {total} card{total === 1 ? "" : "s"} —{" "}
          <span className="text-sage font-medium">{session.known} knew</span>,{" "}
          <span className="text-rose font-medium">{session.review} still learning</span>.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {session.review > 0 && (
            <Button onClick={() => { setFilter("learning"); }}>
              <RotateCcw className="h-4 w-4 mr-1" /> Review the {session.review} again
            </Button>
          )}
          <Button variant="outline" onClick={() => { setOrder(shuffle(filtered.map((w) => w.id))); setIdx(0); setPhase("front"); setSession({ known: 0, review: 0 }); }}>
            <Shuffle className="h-4 w-4 mr-1" /> Shuffle and restart
          </Button>
          <Button variant="ghost" asChild><Link to="/study">Back to study</Link></Button>
        </div>
      </main>
    );
  }

  const pct = order.length ? Math.round(((idx + 1) / order.length) * 100) : 0;
  const currentMastery: MasteryOrUnseen = current ? statuses[current.id] ?? null : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={prev} disabled={idx === 0} aria-label="Previous card">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-sm text-muted-foreground tabular-nums">{idx + 1} / {order.length}</div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="learning">Still learning</SelectItem>
              <SelectItem value="known">I know it</SelectItem>
              <SelectItem value="mastered">Mastered</SelectItem>
              <SelectItem value="unseen">Unseen</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => { setOrder(shuffle(order)); setIdx(0); setPhase("front"); }} aria-label="Shuffle">
            <Shuffle className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Shortcuts"><Keyboard className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 text-sm">
              <div className="font-medium mb-2">Shortcuts</div>
              <ul className="space-y-1 text-muted-foreground">
                <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">Space</kbd> Reveal / I knew it</li>
                <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">←</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">1</kbd> Still learning</li>
                <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">→</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">2</kbd> I knew it</li>
                <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">S</kbd> Skip</li>
                <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">U</kbd> Undo</li>
                <li className="pt-2 border-t mt-2">Swipe ← still learning, → knew it</li>
              </ul>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-6">
        <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div
        onClick={() => phase === "front" && reveal()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={cn(
          "rounded-3xl border bg-card p-8 sm:p-12 shadow-card min-h-[20rem] flex flex-col select-none transition-all",
          phase === "front" && "cursor-pointer hover:shadow-lg",
        )}
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {current?.category ? <span className="text-xs uppercase tracking-widest rounded-full border border-gold/40 bg-gold/10 text-gold px-3 py-1">{current.category}</span> : null}
          {current?.part_of_speech ? <span className="text-xs uppercase tracking-widest rounded-full bg-muted text-muted-foreground px-3 py-1">{current.part_of_speech}</span> : null}
          {currentMastery !== null && currentMastery !== undefined ? (
            <span className="text-xs uppercase tracking-widest rounded-full bg-muted text-muted-foreground px-3 py-1">{MASTERY_LABELS[currentMastery as Mastery]}</span>
          ) : null}
        </div>
        <div className="font-display text-5xl sm:text-6xl">{current?.word}</div>
        {phase === "back" && current && (
          <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
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
        )}
      </div>

      <div className="mt-6">
        {phase === "front" ? (
          <div className="flex gap-3">
            <Button size="lg" className="flex-1 h-14 text-base" onClick={reveal}>
              Show answer
            </Button>
            <Button variant="ghost" size="lg" onClick={skip} className="h-14" aria-label="Skip">
              <SkipForward className="h-5 w-5 mr-1" /> Skip
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              onClick={() => rate("review")}
              className="h-14 text-base bg-rose text-rose-foreground hover:bg-rose/90"
            >
              <RotateCcw className="h-5 w-5 mr-2" /> 勉強中
            </Button>
            <Button
              size="lg"
              onClick={() => rate("known")}
              className="h-14 text-base bg-sage text-sage-foreground hover:bg-sage/90"
            >
              <Check className="h-5 w-5 mr-2" /> 分かった
            </Button>
          </div>
        )}
      </div>

      {last && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 rounded-full border bg-card shadow-lg px-4 py-2 text-sm">
            <span className="text-muted-foreground">
              Now <span className="font-medium text-foreground">{MASTERY_LABELS[last.after]}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={undo} className="h-7">
              <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
