import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Check, Camera, ImagePlus, Sparkles } from "lucide-react";

export const Route = createFileRoute("/admin/upload")({
  component: UploadPage,
});

type Tier = "tier1" | "tier2" | "tier3" | "tier4" | "phrases" | "";
type Extracted = {
  word: string;
  tier: Tier;
  part_of_speech: string;
  definition: string;
  definition_ja: string;
  example_sentence: string;
  category: string;
};

const TIER_META: Record<Exclude<Tier, "">, { label: string; emoji: string; desc: string; cls: string }> = {
  tier1:    { label: "Tier 1", emoji: "🔴", desc: "Core high-frequency",    cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  tier2:    { label: "Tier 2", emoji: "🟠", desc: "Topic-specific frequent", cls: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
  tier3:    { label: "Tier 3", emoji: "🟢", desc: "Reading/Listening vocab", cls: "bg-green-500/15 text-green-600 border-green-500/30" },
  tier4:    { label: "Tier 4", emoji: "🟣", desc: "Lower priority",          cls: "bg-purple-500/15 text-purple-600 border-purple-500/30" },
  phrases:  { label: "Phrases", emoji: "🔵", desc: "Phrasal verbs",          cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
};

function normalizeTier(raw: string): Tier | null {
  const t = raw.trim().toLowerCase().replace(/^tier/, "").replace(/^t/, "");
  if (t === "1") return "tier1";
  if (t === "2") return "tier2";
  if (t === "3") return "tier3";
  if (t === "4") return "tier4";
  if (["p", "phrase", "phrases"].includes(raw.trim().toLowerCase())) return "phrases";
  return null;
}

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Extracted[]>([]);
  const [wordList, setWordList] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const onUpload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("exam-images").upload(path, file);
      if (upErr) throw upErr;
      const { data: img, error: insErr } = await supabase.from("images").insert({ storage_path: path, label }).select().single();
      if (insErr) throw insErr;
      setImageId(img.id);

      const { data: signed } = await supabase.storage.from("exam-images").createSignedUrl(path, 600);
      setPreviewUrl(signed?.signedUrl ?? null);

      toast.info("Extracting vocabulary…");
      const { data, error } = await supabase.functions.invoke("extract-words", { body: { imageUrl: signed?.signedUrl } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setRows(((data as { words: Extracted[] }).words ?? []).map((w) => ({ ...w, tier: (w.tier ?? "") as Tier, word: w.word.toLowerCase() })));
      toast.success(`Found ${(data as { words: Extracted[] }).words?.length ?? 0} words`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const onEnrich = async () => {
    const lines = wordList.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const seen = new Set<string>();
    const items: { word: string; tier: Tier }[] = [];
    let skipped = 0;
    for (const line of lines) {
      const parts = line.split(/[\s,\t]+/).filter(Boolean);
      if (parts.length < 2) { skipped++; continue; }
      const tier = normalizeTier(parts[0]);
      if (!tier) { skipped++; continue; }
      const word = parts.slice(1).join(" ").toLowerCase();
      const key = `${tier}:${word}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ word, tier });
    }
    if (items.length === 0) return toast.error("No valid lines. Format: <tier> <word>, e.g. '1 ambiguous'");
    if (skipped > 0) toast.warning(`Skipped ${skipped} unparseable line${skipped === 1 ? "" : "s"}`);
    setBusy(true);
    try {
      toast.info(`Enriching ${items.length} item${items.length === 1 ? "" : "s"}…`);
      const { data, error } = await supabase.functions.invoke("enrich-words", { body: { items } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setRows(((data as { words: Extracted[] }).words ?? []).map((w) => ({ ...w, tier: (w.tier ?? "") as Tier, word: w.word.toLowerCase() })));
      setImageId(null);
      setPreviewUrl(null);
      toast.success(`Enriched ${(data as { words: Extracted[] }).words?.length ?? 0} words`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enrich failed");
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<Extracted>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const addManual = () => setRows((r) => [...r, { word: "", tier: "", part_of_speech: "noun", definition: "", definition_ja: "", example_sentence: "", category: "Abstract Concepts" }]);

  const saveAll = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    const payload = rows.map((r) => ({
      ...r,
      tier: r.tier === "" ? null : r.tier,
      source_image_id: imageId,
      is_active: true,
    }));
    const { error } = await supabase.from("words").insert(payload);
    if (imageId) await supabase.from("images").update({ processed: true }).eq("id", imageId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved to word bank");
    setRows([]); setFile(null); setPreviewUrl(null); setImageId(null); setLabel(""); setWordList("");
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Upload exam page</h1>

      <Tabs defaultValue="image" className="w-full">
        <TabsList>
          <TabsTrigger value="image">From image</TabsTrigger>
          <TabsTrigger value="list">From word list</TabsTrigger>
        </TabsList>
        <TabsContent value="image">
          <div className="rounded-xl border bg-card p-5 shadow-card space-y-3">
        <Input placeholder="Label, e.g. Mock Test p.138" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="h-4 w-4 mr-1" /> Choose file
          </Button>
          <Button type="button" variant="outline" onClick={() => cameraInputRef.current?.click()}>
            <Camera className="h-4 w-4 mr-1" /> Take picture
          </Button>
        </div>
        {file ? (
          <div className="text-xs text-muted-foreground truncate">Selected: {file.name}</div>
        ) : null}
        <Button disabled={!file || busy} onClick={onUpload}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Upload & extract
        </Button>
          </div>
        </TabsContent>
        <TabsContent value="list">
          <div className="rounded-xl border bg-card p-5 shadow-card space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {(Object.entries(TIER_META) as [Exclude<Tier,"">, typeof TIER_META["tier1"]][]).map(([k, m]) => (
                <span key={k} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${m.cls}`}>
                  <span>{m.emoji}</span><span className="font-medium">{m.label}</span>
                  <span className="text-muted-foreground">— {m.desc}</span>
                </span>
              ))}
            </div>
            <Textarea
              placeholder={"One per line: <tier> <word>\n\nexample:\n1 ambiguous\n1 resilient\n2 mitigate\n3 profound\n4 esoteric\nphrases give up"}
              value={wordList}
              onChange={(e) => setWordList(e.target.value)}
              rows={10}
              className="font-mono"
            />
            <Button disabled={busy || !wordList.trim()} onClick={onEnrich}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />} Enrich with AI
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {previewUrl || rows.length > 0 ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {previewUrl ? (
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Source image</div>
              <img src={previewUrl} alt="exam page" className="rounded-xl border max-h-[80vh] object-contain w-full" />
            </div>
          ) : (
            <div className="hidden lg:block" />
          )}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-display text-xl">Extracted words ({rows.length})</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addManual}>+ Add row</Button>
                <Button size="sm" onClick={saveAll} disabled={busy || rows.length === 0}>
                  <Check className="h-4 w-4 mr-1" /> Save all
                </Button>
              </div>
            </div>
            <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-2">
              {rows.map((r, i) => (
                <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input value={r.word} onChange={(e) => update(i, { word: e.target.value })} placeholder="word" />
                    <Select value={r.tier === "" ? "none" : r.tier} onValueChange={(v) => update(i, { tier: v === "none" ? "" : (v as Tier) })}>
                      <SelectTrigger className="w-32"><SelectValue placeholder="Tier" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— No tier —</SelectItem>
                        {(Object.entries(TIER_META) as [Exclude<Tier,"">, typeof TIER_META["tier1"]][]).map(([k, m]) => (
                          <SelectItem key={k} value={k}>{m.emoji} {m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input value={r.part_of_speech} onChange={(e) => update(i, { part_of_speech: e.target.value })} className="w-32" placeholder="POS" />
                    <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Input value={r.category} onChange={(e) => update(i, { category: e.target.value })} placeholder="Category" />
                  <Textarea value={r.definition} onChange={(e) => update(i, { definition: e.target.value })} placeholder="Definition (EN)" rows={2} />
                  <Textarea value={r.definition_ja} onChange={(e) => update(i, { definition_ja: e.target.value })} placeholder="Definition (JA)" rows={2} />
                  <Textarea value={r.example_sentence} onChange={(e) => update(i, { example_sentence: e.target.value })} placeholder="Example sentence" rows={2} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}