import { Flame, Star } from "lucide-react";
import { levelFromXp, xpForLevel, type Stats } from "@/lib/gamification";
import { useLang } from "@/lib/i18n";

export function StatsHeader({ stats }: { stats: Stats }) {
  const { t } = useLang();
  const level = levelFromXp(stats.xp);
  const curLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progress = Math.min(100, Math.max(0, ((stats.xp - curLevelXp) / Math.max(1, nextLevelXp - curLevelXp)) * 100));
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-amber-500 font-display text-lg text-gold-foreground shadow-sm">
        {level}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">{t("home.level")} {level}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {stats.xp} / {nextLevelXp} XP
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-gradient-to-r from-gold to-amber-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-1 rounded-full border bg-rose/10 px-2.5 py-1 text-rose">
        <Flame className="h-4 w-4" />
        <span className="font-display text-base leading-none">{stats.current_streak}</span>
      </div>
      <div className="flex items-center gap-1 rounded-full border bg-gold/10 px-2.5 py-1 text-gold">
        <Star className="h-4 w-4 fill-gold" />
        <span className="font-display text-base leading-none">{stats.xp}</span>
      </div>
    </div>
  );
}