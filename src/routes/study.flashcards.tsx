import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import {
  fetchStatuses,
  setMastery,
  MASTERY_LABELS,
  TIER_SHORT,
  type Word,
  type Mastery,
  type MasteryOrUnseen,
} from "@/lib/words";
import { Button } from "@/components/ui/button";
import { Shuffle, Check, RotateCcw, ChevronLeft, SkipForward, Undo2, Trophy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ensureWorldOrder, stagize, getCurrentWorld, DEFAULT_WORLD } from "@/lib/stages";
import { bumpStreak, awardXp, XP_PER_KNOWN_FIRST } from "@/lib/gamification";

export const Route = createFileRoute("/study/flashcards")({
  validateSearch: (s: Record<string, unknown>) => {
    const missionRaw = s.mission;
    const mission = typeof missionRaw === "number" ? missionRaw : typeof missionRaw === "string" ? Number(missionRaw) : undefined;
    const free = s.free === true || s.free === "1" || s.free === "true";
    const world = typeof s.world === "string" ? s.world : undefined;
    return {
      mission: mission && Number.isFinite(mission) && mission > 0 ? mission : undefined,
      free: free || undefined,
      world,
    } as { mission?: number; free?: boolean; world?: string };
  },
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
  const { user, loading: authLoading } = useAuth();
  const search = Route.useSearch();
  const missionParam = search.mission;
  const freeMode = search.free || missionParam === undefined;
  const requestedDeckKey = `${user?.id ?? "guest"}:${search.world ?? "saved-world"}:${freeMode ? "free" : missionParam ?? "free"}`;
  const [activeWorld, setActiveWorld] = useState<string>(search.world ?? DEFAULT_WORLD);
  const [words, setWords] = useState<Word[]>([]);
  const [statuses, setStatuses] = useState<Record<string, MasteryOrUnseen>>({});
  const [cardsLoading, setCardsLoading] = useState(true);
  const [loadedDeckKey, setLoadedDeckKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "learning" | "known" | "mastered" | "unseen">("all");
  const [order, setOrder] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("front");
  const [session, setSession] = useState({ known: 0, review: 0 });
  const [last, setLast] = useState<LastAction>(null);
  const undoTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) {
      setCardsLoading(true);
      return () => {
        cancelled = true;
      };
    }
    if (!user) {
      setWords([]);
      setStatuses({});
      setOrder([]);
      setLoadedDeckKey(requestedDeckKey);
      setCardsLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setCardsLoading(true);
    (async () => {
      const world = search.world ?? (await getCurrentWorld(user.id));
      const [ordered, s] = await Promise.all([ensureWorldOrder(user.id, world), fetchStatuses(user.id)]);
      if (cancelled) return;
      setActiveWorld(world);
      const nextWords = missionParam && !freeMode ? stagize(ordered)[missionParam - 1] ?? [] : ordered;
      setWords(nextWords);
      setOrder(nextWords.map((w) => w.id));
      setIdx(0);
      setPhase("front");
      setSession({ known: 0, review: 0 });
      setLast(null);
      setStatuses(s);
      setLoadedDeckKey(requestedDeckKey);
      setCardsLoading(false);
      bumpStreak(user.id).catch(() => {});
    })().catch(() => {
      if (cancelled) return;
      setWords([]);
      setOrder([]);
      setLoadedDeckKey(requestedDeckKey);
      setCardsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, missionParam, freeMode, search.world, requestedDeckKey]);

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
  }, [words, filter, freeMode]);

  useEffect(() => {
    setOrder(filtered.map((w) => w.id));
    setIdx(0);
    setPhase("front");
    setSession({ known: 0, review: 0 });
    setLast(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, words.length]);

  const current = words.find((w) => w.id === order[idx]);
  const isDeckLoading = authLoading || cardsLoading || loadedDeckKey !== requestedDeckKey;

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
      if (kind === "known" && (prev === null || prev === undefined || prev < 2)) {
        awardXp(user.id, XP_PER_KNOWN_FIRST).catch(() => {});
      }
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setLast(null), 900);
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

  if (isDeckLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 text-center">
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <p className="mt-1 text-sm text-muted-foreground">Loading your cards…</p>
        </div>
      </main>
    );
  }

  if (!current && phase !== "done") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 text-center">
        <h1 className="font-display text-3xl mb-4">No cards here</h1>
        <p className="text-muted-foreground mb-6">Try a different filter or add some words.</p>
        <Button asChild><Link to="/study">Back to study</Link></Button>
      </main>
    );
  }

  if (phase === "done") {
    const total = session.known + session.review;
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 text-center">
        <h1 className="font-display text-4xl mb-3">Deck complete</h1>
        <p className="text-muted-foreground mb-8">
          You reviewed {total} card{total === 1 ? "" : "s"} —{" "}
          <span className="text-sage font-medium">{session.known} knew</span>,{" "}
          <span className="text-rose font-medium">{session.review} still learning</span>.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {missionParam && !freeMode && (
            <Button asChild>
              <Link to="/study/quiz" search={{ mode: "mission" as const, mission: missionParam, world: activeWorld }}>
                <Trophy className="h-4 w-4 mr-1" /> Take stage {missionParam} quiz
              </Link>
            </Button>
          )}
          {session.review > 0 && (
            <Button variant="outline" onClick={() => { setFilter("learning"); }}>
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
  const worldShort = TIER_SHORT[activeWorld] ?? activeWorld;

  return (
    <main className="mx-auto max-w-2xl px-4 py-4">
      <div className="flex items-center gap-2 mb-4 whitespace-nowrap">
        <Button variant="ghost" size="icon" onClick={prev} disabled={idx === 0} aria-label="Previous card" className="shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-sm text-muted-foreground tabular-nums flex items-center gap-1.5 min-w-0 truncate">
          {missionParam && !freeMode ? (
            <span className="text-foreground font-medium">{worldShort} · Stage {missionParam}</span>
          ) : null}
          <span>· {idx + 1}/{order.length} ·</span>
          {missionParam && !freeMode ? (
            <Link to="/study/flashcards" search={{ free: true, world: activeWorld }} className="underline-offset-2 hover:underline">Free study</Link>
          ) : (
            <span>Free study</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unseen">Unseen</SelectItem>
            </SelectContent>
          </Select>
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
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 rounded-full border bg-card shadow-md px-2.5 py-1 text-[11px]">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{MASTERY_LABELS[last.after]}</span>
            </span>
            <button onClick={undo} className="flex items-center gap-1 rounded-full px-1.5 py-0.5 hover:bg-muted text-foreground">
              <Undo2 className="h-3 w-3" /> Undo
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
