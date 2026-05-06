import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/admin/words")({
  component: WordsAdmin,
});

type Row = {
  id: string; word: string; part_of_speech: string | null; definition: string;
  definition_ja: string | null; example_sentence: string | null; category: string | null; is_active: boolean;
};

function WordsAdmin() {
  const { t } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const all: Row[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("words")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) break;
      const batch = (data ?? []) as Row[];
      all.push(...batch);
      if (batch.length < pageSize) break;
    }
    setRows(all);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing };
    if (editing.id) {
      await supabase.from("words").update(payload).eq("id", editing.id);
      toast.success(t("toast.words.updated"));
    } else {
      const { id: _ignored, ...insert } = payload;
      void _ignored;
      await supabase.from("words").insert(insert);
      toast.success(t("toast.words.created"));
    }
    setOpen(false);
    setEditing(null);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this word?")) return;
    await supabase.from("words").delete().eq("id", id);
    load();
  };

  const toggle = async (r: Row) => {
    await supabase.from("words").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  };

  const filtered = rows.filter((r) => !q || r.word.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-3xl">Word Bank</h1>
          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} of {rows.length} ({rows.filter((r) => r.is_active).length} active)
          </p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing({ id: "", word: "", part_of_speech: "", definition: "", definition_ja: "", example_sentence: "", category: "", is_active: true })}>
                <Plus className="h-4 w-4 mr-1" /> Add word
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing?.id ? "Edit word" : "New word"}</DialogTitle></DialogHeader>
              {editing ? (
                <div className="space-y-3">
                  <Input placeholder="Word" value={editing.word} onChange={(e) => setEditing({ ...editing, word: e.target.value })} />
                  <Input placeholder="Part of speech" value={editing.part_of_speech ?? ""} onChange={(e) => setEditing({ ...editing, part_of_speech: e.target.value })} />
                  <Input placeholder="Category" value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                  <Textarea placeholder="Definition (English)" value={editing.definition} onChange={(e) => setEditing({ ...editing, definition: e.target.value })} />
                  <Textarea placeholder="Definition (Japanese)" value={editing.definition_ja ?? ""} onChange={(e) => setEditing({ ...editing, definition_ja: e.target.value })} />
                  <Textarea placeholder="Example sentence (wrap word in <strong>…</strong>)" value={editing.example_sentence ?? ""} onChange={(e) => setEditing({ ...editing, example_sentence: e.target.value })} />
                </div>
              ) : null}
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="px-3 py-2">Word</th>
              <th className="px-3 py-2 hidden md:table-cell">Category</th>
              <th className="px-3 py-2 hidden lg:table-cell">Definition</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 font-medium">{r.word} <span className="text-xs text-muted-foreground">{r.part_of_speech}</span></td>
                <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{r.category}</td>
                <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground line-clamp-1 max-w-md">{r.definition}</td>
                <td className="px-3 py-2"><Switch checked={r.is_active} onCheckedChange={() => toggle(r)} /></td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground">No words yet.</div> : null}
      </div>
    </div>
  );
}