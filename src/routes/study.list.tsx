import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  fetchActiveWords,
  fetchStatuses,
  setMastery,
  MASTERY_LABELS,
  MASTERY_BORDER,
  MASTERY_BG,
  type Word,
  type Mastery,
  type MasteryOrUnseen,
} from "@/lib/words";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";


const PAGE_SIZE = 50;

const TIER_META: Record<string, { label: string; cls: string }> = {
  tier1: { label: "World 1", cls: "bg-rose/15 text-rose border-rose/40" },
  tier2: { label: "World 2", cls: "bg-gold/15 text-gold border-gold/40" },
  tier3: { label: "World 3", cls: "bg-sage/15 text-sage border-sage/40" },
  tier4: { label: "World 4", cls: "bg-purple-500/15 text-purple-500 border-purple-500/40" },
  phrases: { label: "World 5", cls: "bg-blue-500/15 text-blue-500 border-blue-500/40" },
};

export const Route = createFileRoute("/study/list")({
  component: ListPage,
  head: () => ({
    meta: [
      { title: "Word list — EikenTango" },
      { name: "description", content: "Browse and filter every Eiken Pre-1 vocabulary word by world, category, part of speech, and mastery level. 英検準1級の単語リストを検索・フィルター。" },
      { property: "og:title", content: "Word list — EikenTango" },
      { property: "og:description", content: "Search and filter all Eiken Pre-1 vocabulary by world, category, and mastery." },
      { property: "og:url", content: "https://eikentango.com/study/list" },
    ],
    links: [{ rel: "canonical", href: "https://eikentango.com/study/list" }],
  }),
});

function ListPage() {
  const { user } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [statuses, setStatuses] = useState<Record<string, MasteryOrUnseen>>({});
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [mastery, setMasteryFilter] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [w, s] = await Promise.all([fetchActiveWords(), fetchStatuses(user.id)]);
      setWords(w);
      setStatuses(s);
    })();
  }, [user]);

  useEffect(() => setPage(1), [q, cat, mastery, tier]);

  const categories = useMemo(() => Array.from(new Set(words.map((w) => w.category).filter(Boolean))) as string[], [words]);

  const filtered = words.filter((w) => {
    if (cat !== "all" && w.category !== cat) return false;
    if (tier !== "all") {
      const t = w.tier ?? "_none";
      if (tier === "none" ? t !== "_none" : t !== tier) return false;
    }
    if (mastery !== "all") {
      const s = statuses[w.id];
      if (mastery === "unseen") {
        if (s !== undefined && s !== null) return false;
      } else {
        if (s !== Number(mastery)) return false;
      }
    }
    if (q && !w.word.toLowerCase().includes(q.toLowerCase()) && !w.definition.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const visible = filtered.slice(0, page * PAGE_SIZE);

  const setTier4 = async (id: string, m: Mastery) => {
    if (!user) return;
    setStatuses((p) => ({ ...p, [id]: m }));
    setMastery(user.id, id, m).catch(() => {});
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-4">
      <h1 className="font-display text-3xl mb-1">Word List</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Showing {filtered.length} of {words.length} words
      </p>
      <h2 className="sr-only">Filters</h2>
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          placeholder="Search words…"
          aria-label="Search words"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-44"><SelectValue placeholder="World" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All worlds</SelectItem>
            <SelectItem value="tier1">World 1: Core</SelectItem>
            <SelectItem value="tier2">World 2: Topic Specific</SelectItem>
            <SelectItem value="tier3">World 3: Reading/Listening</SelectItem>
            <SelectItem value="tier4">World 4: Very Specific</SelectItem>
            <SelectItem value="phrases">World 5: Phrases</SelectItem>
            <SelectItem value="none">No world</SelectItem>
          </SelectContent>
        </Select>
        <Select value={mastery} onValueChange={setMasteryFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Mastery" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All mastery levels</SelectItem>
            <SelectItem value="0">{MASTERY_LABELS[0]}</SelectItem>
            <SelectItem value="1">{MASTERY_LABELS[1]}</SelectItem>
            <SelectItem value="2">{MASTERY_LABELS[2]}</SelectItem>
            <SelectItem value="3">{MASTERY_LABELS[3]}</SelectItem>
            <SelectItem value="unseen">Unseen</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <h2 className="sr-only">Words</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((w) => {
          const s = statuses[w.id];
          const border = (s === null || s === undefined) ? "border-l-muted" : MASTERY_BORDER[s as Mastery];
          return (
            <div key={w.id} className={`rounded-xl border bg-card p-5 shadow-card border-l-4 ${border}`}>
              <div className="flex items-baseline justify-between">
                <div className="font-display text-2xl">{w.word}</div>
                <span className="text-xs text-muted-foreground">{w.part_of_speech}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {w.tier && TIER_META[w.tier] ? (
                  <span className={`text-[10px] uppercase tracking-wider rounded-full border px-2 py-0.5 ${TIER_META[w.tier].cls}`}>
                    {TIER_META[w.tier].label}
                  </span>
                ) : null}
                {w.category ? <span className="text-xs text-gold">{w.category}</span> : null}
              </div>
              <div className="mt-2 text-sm">{w.definition}</div>
              {w.example_sentence ? (
                <p className="mt-2 text-sm italic text-muted-foreground" dangerouslySetInnerHTML={{ __html: w.example_sentence }} />
              ) : null}
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-1.5">Mastery level</div>
                <div className="flex gap-1 min-w-0">
                  {([0, 1, 2, 3] as Mastery[]).map((m) => {
                    const active = s === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setTier4(w.id, m)}
                        className={`flex-1 min-w-0 overflow-hidden h-7 rounded-md transition flex items-center justify-center px-1 text-[8px] sm:text-[10px] font-medium leading-none truncate ${active ? `${MASTERY_BG[m]} text-white` : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"}`}
                        aria-label={MASTERY_LABELS[m]}
                        title={MASTERY_LABELS[m]}
                      >
                        {MASTERY_LABELS[m]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {visible.length < filtered.length ? (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
            Show more ({filtered.length - visible.length} remaining)
          </Button>
        </div>
      ) : null}
      {filtered.length === 0 ? <p className="text-muted-foreground text-center mt-12">No words match your filters.</p> : null}
    </main>
  );
}
