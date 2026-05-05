import { Flame } from "lucide-react";
import { READINESS_WEIGHTS, type MasteryBuckets, type PerWorldMastery } from "@/lib/gamification";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MASTERY_LABELS } from "@/lib/words";

type Props = {
  pct: number;
  total: number;
  touched: number;
  buckets: MasteryBuckets;
  perWorld: Record<string, PerWorldMastery>;
  streak: number;
};

const WORLD_CHIP_LABEL: Record<string, string> = {
  tier1: "W1",
  tier2: "W2",
  tier3: "W3",
  tier4: "W4",
  phrases: "Ph",
};

type Seg = { key: keyof MasteryBuckets; cls: string; label: string };

export function MasteryHeader({ pct, total, touched, buckets, perWorld, streak }: Props) {
  const { t } = useLang();
  const textColor = pct >= 80 ? "text-sage" : pct >= 50 ? "text-gold" : "text-rose";
  const tooltip = t("mastery.tooltip");
  const known = buckets.m2 + buckets.m3;

  const segs: Seg[] = [
    { key: "m3", cls: "bg-sage", label: MASTERY_LABELS[3] },
    { key: "m2", cls: "bg-sage/60", label: MASTERY_LABELS[2] },
    { key: "m1", cls: "bg-gold", label: MASTERY_LABELS[1] },
    { key: "m0", cls: "bg-gold/50", label: MASTERY_LABELS[0] },
    { key: "untouched", cls: "bg-muted", label: t("mastery.legend.untouched") },
  ];

  return (
    <div className="rounded-2xl border bg-card p-3 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground" title={tooltip}>
          {t("mastery.title")}
        </div>
        <div className={cn("font-display text-2xl leading-none", textColor)}>{pct}%</div>
      </div>

      <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full" title={tooltip}>
        {segs.map((s) => {
          const count = buckets[s.key];
          const w = total === 0 ? 0 : (count / total) * 100;
          if (w === 0) return null;
          return (
            <div
              key={s.key}
              className={cn(s.cls, "h-full transition-all duration-500")}
              style={{ width: `${w}%` }}
              title={`${s.label}: ${count}`}
            />
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-1" title={tooltip}>
        {Object.keys(READINESS_WEIGHTS).map((k) => {
          const pw = perWorld[k];
          const dim = !pw || pw.total === 0;
          return (
            <span
              key={k}
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-display leading-none",
                dim ? "bg-muted/30 text-muted-foreground" : "bg-card",
              )}
            >
              {WORLD_CHIP_LABEL[k]} {pw?.pct ?? 0}%
            </span>
          );
        })}
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {touched} / {total} {t("mastery.caption")} · {known} {t("mastery.known")}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border bg-rose/10 px-2 py-0.5 text-rose text-xs">
            <Flame className="h-3 w-3" />
            <span className="font-display leading-none">{streak}</span>
          </div>
        </div>
      </div>
    </div>
  );
}