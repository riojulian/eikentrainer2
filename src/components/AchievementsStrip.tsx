import { BADGES } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

export function AchievementsStrip({ earned }: { earned: Set<string> }) {
  const { t } = useLang();
  const earnedCount = BADGES.filter((b) => earned.has(b.key)).length;
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-sm font-medium">{t("home.achievements")}</div>
        <div className="text-xs text-muted-foreground">{earnedCount} / {BADGES.length}</div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {BADGES.map((b) => {
          const got = earned.has(b.key);
          return (
            <div
              key={b.key}
              title={`${b.name} — ${b.desc}`}
              className={cn(
                "aspect-square rounded-xl border flex flex-col items-center justify-center text-center p-1 transition",
                got
                  ? "bg-gradient-to-br from-gold/20 to-amber-300/10 border-gold/40 shadow-sm"
                  : "bg-muted/30 border-dashed border-muted-foreground/20 grayscale opacity-50",
              )}
            >
              <div className="text-2xl leading-none">{b.emoji}</div>
              <div className="mt-0.5 text-[9px] font-medium leading-tight line-clamp-2">{b.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}