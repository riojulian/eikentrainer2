import { Flame } from "lucide-react";
import { BADGES, BADGES_JA } from "@/lib/gamification";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  pct: number;
  total: number;
  streak: number;
  earned: Set<string>;
};

export function ReadinessHeader({ pct, total, streak, earned }: Props) {
  const { t, lang } = useLang();
  const ringColor =
    pct >= 80 ? "stroke-sage" : pct >= 50 ? "stroke-gold" : "stroke-rose";
  const textColor =
    pct >= 80 ? "text-sage" : pct >= 50 ? "text-gold" : "text-rose";
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card">
      <div className="relative h-16 w-16 shrink-0">
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
        <div className="font-display text-lg leading-tight">{t("rdy.based")} {total} {t("rdy.answers")}</div>
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