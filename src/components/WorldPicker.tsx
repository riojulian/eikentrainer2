import { cn } from "@/lib/utils";
import { Star, Lock } from "lucide-react";
import { TIER_LABELS, TIER_SHORT } from "@/lib/words";
import { WORLD_ORDER } from "@/lib/stages";

const WORLD_ACCENT: Record<string, string> = {
  tier1: "from-rose/30 to-rose/5 border-rose/40",
  tier2: "from-amber-300/30 to-amber-300/5 border-amber-400/40",
  tier3: "from-sage/30 to-sage/5 border-sage/40",
  tier4: "from-sky-300/30 to-sky-300/5 border-sky-400/40",
  phrases: "from-violet-300/30 to-violet-300/5 border-violet-400/40",
};

export type WorldSummary = {
  world: string;
  totalStages: number;
  currentStage: number;
  starsEarned: number;
  starsMax: number;
};

export function WorldPicker({
  summaries,
  active,
  onChange,
}: {
  summaries: WorldSummary[];
  active: string;
  onChange: (world: string) => void;
}) {
  const ordered = WORLD_ORDER.map((w) => summaries.find((s) => s.world === w)).filter(Boolean) as WorldSummary[];
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {ordered.map((s) => {
        const empty = s.totalStages === 0;
        const isActive = s.world === active;
        const label = TIER_LABELS[s.world]?.replace(/^World \d+:\s*/, "") ?? s.world;
        const short = TIER_SHORT[s.world] ?? s.world;
        const pct = s.starsMax > 0 ? (s.starsEarned / s.starsMax) : 0;
        return (
          <button
            key={s.world}
            type="button"
            onClick={() => !empty && onChange(s.world)}
            disabled={empty}
            className={cn(
              "min-w-0 rounded-2xl border bg-gradient-to-br p-2 sm:p-3 text-left shadow-card transition",
              WORLD_ACCENT[s.world] ?? "from-muted to-muted/30 border-muted-foreground/30",
              empty && "opacity-50 cursor-not-allowed",
              isActive && "ring-2 ring-gold scale-[1.02]",
              !isActive && !empty && "hover:scale-[1.01]",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="font-display text-sm sm:text-base truncate">{short}</div>
              {empty ? <Lock className="h-3 w-3 text-muted-foreground shrink-0" /> : null}
            </div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-1">{label}</div>
            {!empty && (
              <>
                <div className="mt-1.5 text-[11px] sm:text-xs tabular-nums truncate">
                  <span className="hidden sm:inline">Stage </span>
                  <span className="font-medium text-foreground">{Math.min(s.currentStage, s.totalStages)}</span>
                  <span className="text-muted-foreground"> / {s.totalStages}</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] sm:text-xs text-gold">
                  <Star className="h-3 w-3 fill-gold shrink-0" />
                  <span className="tabular-nums">{s.starsEarned}<span className="text-muted-foreground">/{s.starsMax}</span></span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-background/60">
                  <div className="h-full bg-gold transition-all" style={{ width: `${Math.round(pct * 100)}%` }} />
                </div>
              </>
            )}
            {empty && <div className="mt-1.5 text-[10px] sm:text-xs text-muted-foreground">Empty</div>}
          </button>
        );
      })}
    </div>
  );
}
