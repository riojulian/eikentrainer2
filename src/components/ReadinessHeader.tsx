import { Flame } from "lucide-react";
import { BADGES, BADGES_JA, READINESS_WEIGHTS, type PerWorldReadiness } from "@/lib/gamification";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  pct: number;
  total: number;
  correct: number;
  streak: number;
  earned: Set<string>;
  perWorld?: Record<string, PerWorldReadiness>;
};

const WORLD_CHIP_LABEL: Record<string, string> = {
  tier1: "W1",
  tier2: "W2",
  tier3: "W3",
  tier4: "W4",
  phrases: "Ph",
};

export function ReadinessHeader({ pct, total, correct, streak, earned, perWorld }: Props) {
  const { t, lang } = useLang();
  const ringColor =
    pct >= 80 ? "stroke-sage" : pct >= 50 ? "stroke-gold" : "stroke-rose";
  const textColor =
    pct >= 80 ? "text-sage" : pct >= 50 ? "text-gold" : "text-rose";
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  const tooltip = t("rdy.tooltip");

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card">
      <div className="relative h-16 w-16 shrink-0" title={tooltip}>
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={radius} className="stroke-muted" strokeWidth="6" fill="none" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            className={cn(ringColor, "transition-all duration-500")}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
          />
        </svg>
        <div className={cn("absolute inset-0 flex items-center justify-center font-display text-base", textColor)}>
          {pct}%
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("rdy.title")}</div>
        {perWorld ? (
          <div className="flex flex-wrap gap-1 mt-0.5" title={tooltip}>
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
        ) : null}
        <div className="mt-1 text-xs text-muted-foreground">
          {correct} / {total} {t("rdy.answers")}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border bg-rose/10 px-2 py-0.5 text-rose text-xs">
            <Flame className="h-3 w-3" />
            <span className="font-display leading-none">{streak}</span>
          </div>
          <div className="flex gap-1">
            {BADGES.map((b) => {
              const got = earned.has(b.key);
              const name = lang === "ja" ? BADGES_JA[b.key]?.name ?? b.name : b.name;
              const desc = lang === "ja" ? BADGES_JA[b.key]?.desc ?? b.desc : b.desc;
              return (
                <div
                  key={b.key}
                  title={`${name} — ${desc}`}
                  className={cn(
                    "h-6 w-6 rounded-md border flex items-center justify-center text-sm",
                    got ? "bg-gold/20 border-gold/50" : "bg-muted/30 border-dashed grayscale opacity-50",
                  )}
                >
                  {b.emoji}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}