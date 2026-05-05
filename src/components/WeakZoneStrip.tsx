import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getWeakWords } from "@/lib/weakZone";
import type { Word } from "@/lib/words";
import { useLang } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function WeakZoneStrip({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [words, setWords] = useState<Word[]>([]);
  const [open, setOpen] = useState<Word | null>(null);

  useEffect(() => {
    if (!user) return;
    getWeakWords(user.id).then(setWords).catch(() => {});
  }, [user, refreshKey]);

  if (!user) return null;

  return (
    <div className="rounded-2xl border border-rose/40 bg-rose/5 p-3 shadow-card">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-sm font-medium text-rose flex items-center gap-1">
          🔴 {t("weak.title")}
        </div>
        <div className="text-xs text-muted-foreground">{words.length}</div>
      </div>
      {words.length === 0 ? (
        <div className="text-xs text-muted-foreground py-1">{t("weak.empty")}</div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {words.map((w) => (
            <button
              key={w.id}
              onClick={() => setOpen(w)}
              className="shrink-0 rounded-full border border-rose/40 bg-card px-3 py-1 text-sm hover:bg-rose/10 transition"
            >
              {w.word}
            </button>
          ))}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{open?.word}</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-3 text-sm">
              {open.part_of_speech && (
                <div className="text-xs uppercase tracking-widest text-gold">{open.part_of_speech}</div>
              )}
              {lang === "ja" && open.definition_ja ? (
                <>
                  <div className="font-display text-lg">{open.definition_ja}</div>
                  <div className="text-muted-foreground">{open.definition}</div>
                </>
              ) : (
                <>
                  <div className="font-display text-lg">{open.definition}</div>
                  {open.definition_ja && <div className="text-muted-foreground">{open.definition_ja}</div>}
                </>
              )}
              {open.example_sentence && (
                <div
                  className="rounded-lg border bg-muted/30 p-3 italic"
                  dangerouslySetInnerHTML={{ __html: open.example_sentence }}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}