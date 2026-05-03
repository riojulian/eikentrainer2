import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Check, Camera, ImagePlus } from "lucide-react";

export const Route = createFileRoute("/admin/upload")({
  component: UploadPage,
});

type Extracted = {
  word: string;
  part_of_speech: string;
  definition: string;
  definition_ja: string;
  example_sentence: string;
  category: string;
};

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Extracted[]>([]);
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
      setRows(((data as { words: Extracted[] }).words ?? []).map((w) => ({ ...w, word: w.word.toLowerCase() })));
      toast.success(`Found ${(data as { words: Extracted[] }).words?.length ?? 0} words`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<Extracted>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const addManual = () => setRows((r) => [...r, { word: "", part_of_speech: "noun", definition: "", definition_ja: "", example_sentence: "", category: "Abstract Concepts" }]);

  const saveAll = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    const payload = rows.map((r) => ({ ...r, source_image_id: imageId, is_active: true }));
    const { error } = await supabase.from("words").insert(payload);
    if (imageId) await supabase.from("images").update({ processed: true }).eq("id", imageId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved to word bank");
    setRows([]); setFile(null); setPreviewUrl(null); setImageId(null); setLabel("");
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Upload exam page</h1>

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

      {previewUrl ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Source image</div>
            <img src={previewUrl} alt="exam page" className="rounded-xl border max-h-[80vh] object-contain w-full" />
          </div>
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