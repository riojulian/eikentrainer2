import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { getWeakWords } from "@/lib/weakZone";
import type { Word } from "@/lib/words";
import { useLang } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, Swords, ChevronLeft, ChevronRight } from "lucide-react";

export function WeakZoneStrip({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [words, setWords] = useState<Word[]>([]);
  const [open, setOpen] = useState<Word | null>(null);
  const [reviewIdx, setReviewIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    getWeakWords(user.id).then(setWords).catch(() => {});
  }, [user, refreshKey]);

  if (!user) return null;

  const reviewing = reviewIdx !== null && words[reviewIdx];

  return (
    <div className="rounded-2xl border border-rose/40 bg-rose/5 p-3 shadow-card">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-sm font-medium text-rose flex items-center gap-1">
          🔴 {t("weak.title")}
          <span className="text-xs text-muted-foreground ml-1">({words.length})</span>
        </div>
        {words.length > 0 && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs border-rose/40 text-rose hover:bg-rose/10"
              onClick={() => setReviewIdx(0)}
            >
              <BookOpen className="h-3 w-3 mr-1" />
              {t("weak.review")}
            </Button>
            <Button asChild size="sm" className="h-7 px-2 text-xs bg-rose hover:bg-rose/90 text-white">
              <Link to="/study/quiz" search={{ mode: "weakness" }}>
                <Swords className="h-3 w-3 mr-1" />
                {t("weak.quiz")}
              </Link>
            </Button>
          </div>
        )}
      </div>
      {words.length === 0 && (
        <div className="text-xs text-muted-foreground py-1">{t("weak.empty")}</div>
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
      <Dialog open={reviewIdx !== null} onOpenChange={(v) => !v && setReviewIdx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center justify-between">
              <span>{reviewing ? words[reviewIdx!].word : ""}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {reviewIdx !== null ? reviewIdx + 1 : 0} {t("weak.of")} {words.length}
              </span>
            </DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-3 text-sm">
              {words[reviewIdx!].part_of_speech && (
                <div className="text-xs uppercase tracking-widest text-gold">{words[reviewIdx!].part_of_speech}</div>
              )}
              {lang === "ja" && words[reviewIdx!].definition_ja ? (
                <>
                  <div className="font-display text-lg">{words[reviewIdx!].definition_ja}</div>
                  <div className="text-muted-foreground">{words[reviewIdx!].definition}</div>
                </>
              ) : (
                <>
                  <div className="font-display text-lg">{words[reviewIdx!].definition}</div>
                  {words[reviewIdx!].definition_ja && (
                    <div className="text-muted-foreground">{words[reviewIdx!].definition_ja}</div>
                  )}
                </>
              )}
              {words[reviewIdx!].example_sentence && (
                <div
                  className="rounded-lg border bg-muted/30 p-3 italic"
                  dangerouslySetInnerHTML={{ __html: words[reviewIdx!].example_sentence! }}
                />
              )}
              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reviewIdx === 0}
                  onClick={() => setReviewIdx((i) => (i! > 0 ? i! - 1 : i))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("weak.prev")}
                </Button>
                {reviewIdx! < words.length - 1 ? (
                  <Button size="sm" onClick={() => setReviewIdx((i) => i! + 1)}>
                    {t("weak.next")}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button asChild size="sm" className="bg-rose hover:bg-rose/90 text-white">
                    <Link to="/study/quiz" search={{ mode: "weakness" }} onClick={() => setReviewIdx(null)}>
                      <Swords className="h-4 w-4 mr-1" />
                      {t("weak.quiz")}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}