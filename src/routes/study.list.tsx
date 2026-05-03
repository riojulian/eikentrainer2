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

export const Route = createFileRoute("/study/list")({
  component: ListPage,
});

function ListPage() {
  const { user } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [statuses, setStatuses] = useState<Record<string, MasteryOrUnseen>>({});
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [tier, setTier] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [w, s] = await Promise.all([fetchActiveWords(), fetchStatuses(user.id)]);
      setWords(w);
      setStatuses(s);
    })();
  }, [user]);

  const categories = useMemo(() => Array.from(new Set(words.map((w) => w.category).filter(Boolean))) as string[], [words]);

  const filtered = words.filter((w) => {
    if (cat !== "all" && w.category !== cat) return false;
    if (tier !== "all") {
      const s = statuses[w.id];
      if (tier === "unseen") {
        if (s !== undefined && s !== null) return false;
      } else {
        if (s !== Number(tier)) return false;
      }
    }
    if (q && !w.word.toLowerCase().includes(q.toLowerCase()) && !w.definition.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const setTier4 = async (id: string, m: Mastery) => {
    if (!user) return;
    setStatuses((p) => ({ ...p, [id]: m }));
    setMastery(user.id, id, m).catch(() => {});
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl mb-4">Word List</h1>
      <div className="flex flex-wrap gap-3 mb-6">
        <Input placeholder="Search words…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={setTier}>
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
      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((w) => {
          const s = statuses[w.id];
          const border = (s === null || s === undefined) ? "border-l-muted" : MASTERY_BORDER[s as Mastery];
          return (
            <div key={w.id} className={`rounded-xl border bg-card p-5 shadow-card border-l-4 ${border}`}>
              <div className="flex items-baseline justify-between">
                <div className="font-display text-2xl">{w.word}</div>
                <span className="text-xs text-muted-foreground">{w.part_of_speech}</span>
              </div>
              {w.category ? <div className="text-xs text-gold mt-1">{w.category}</div> : null}
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
      {filtered.length === 0 ? <p className="text-muted-foreground text-center mt-12">No words match your filters.</p> : null}
    </main>
  );
}
