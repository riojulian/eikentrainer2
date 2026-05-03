import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchActiveWords, fetchStatuses, setStatus, type Word, type WordStatus } from "@/lib/words";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/study/list")({
  component: ListPage,
});

function nextStatus(s: WordStatus): WordStatus {
  if (s === null) return "known";
  if (s === "known") return "review";
  return null;
}

function ListPage() {
  const { user } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [statuses, setStatuses] = useState<Record<string, WordStatus>>({});
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

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
    if (q && !w.word.toLowerCase().includes(q.toLowerCase()) && !w.definition.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const cycle = async (id: string) => {
    if (!user) return;
    const s = nextStatus(statuses[id] ?? null);
    setStatuses((p) => ({ ...p, [id]: s }));
    setStatus(user.id, id, s).catch(() => {});
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl mb-4">Word List</h1>
      <div className="flex gap-3 mb-6">
        <Input placeholder="Search words…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((w) => {
          const s = statuses[w.id] ?? null;
          const border = s === "known" ? "border-l-sage" : s === "review" ? "border-l-rose" : "border-l-muted";
          return (
            <button key={w.id} onClick={() => cycle(w.id)} className={`text-left rounded-xl border bg-card p-5 shadow-card border-l-4 ${border} transition hover:shadow-glow`}>
              <div className="flex items-baseline justify-between">
                <div className="font-display text-2xl">{w.word}</div>
                <span className="text-xs text-muted-foreground">{w.part_of_speech}</span>
              </div>
              {w.category ? <div className="text-xs text-gold mt-1">{w.category}</div> : null}
              <div className="mt-2 text-sm">{w.definition}</div>
              {w.example_sentence ? (
                <p className="mt-2 text-sm italic text-muted-foreground" dangerouslySetInnerHTML={{ __html: w.example_sentence }} />
              ) : null}
              <div className="mt-3 text-xs">
                {s === "known" ? <span className="text-sage">✓ Known</span> : s === "review" ? <span className="text-rose">↻ Review</span> : <span className="text-muted-foreground">Tap to mark</span>}
              </div>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? <p className="text-muted-foreground text-center mt-12">No words match your filters.</p> : null}
    </main>
  );
}