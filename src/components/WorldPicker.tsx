import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { TIER_LABELS, TIER_SHORT } from "@/lib/words";
import { WORLD_ORDER } from "@/lib/stages";
import { useLang } from "@/lib/i18n";

// Short topic labels stripped of "World N:" prefix for prominent display
const WORLD_TOPIC_EN: Record<string, string> = {
  tier1: "Core",
  tier2: "Topic",
  tier3: "R/L",
  tier4: "Niche",
  phrases: "Phrases",
};
const WORLD_TOPIC_JA: Record<string, string> = {
  tier1: "基礎",
  tier2: "分野",
  tier3: "読解/聴解",
  tier4: "上級",
  phrases: "熟語",
};

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
  const { lang, t } = useLang();
  const ordered = WORLD_ORDER.map((w) => summaries.find((s) => s.world === w)).filter(Boolean) as WorldSummary[];
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {ordered.map((s) => {
        const empty = s.totalStages === 0;
        const isActive = s.world === active;
        const topicMap = lang === "ja" ? WORLD_TOPIC_JA : WORLD_TOPIC_EN;
        const topic = topicMap[s.world] ?? (TIER_LABELS[s.world]?.replace(/^World \d+:\s*/, "") ?? s.world);
        const shortBase = TIER_SHORT[s.world] ?? s.world;
        const short = lang === "ja" ? shortBase.replace(/^World\s*/, "ワールド") : shortBase;
        const pct = s.starsMax > 0 ? (s.starsEarned / s.starsMax) : 0;
        return (
          <button
            key={s.world}
            type="button"
            onClick={() => !empty && onChange(s.world)}
            disabled={empty}
            className={cn(
              "min-w-0 rounded-2xl border bg-gradient-to-br p-2 sm:p-3 text-center shadow-card transition",
              WORLD_ACCENT[s.world] ?? "from-muted to-muted/30 border-muted-foreground/30",
              empty && "opacity-50 cursor-not-allowed",
              isActive && "ring-2 ring-gold scale-[1.02]",
              !isActive && !empty && "hover:scale-[1.01]",
            )}
          >
            <div className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80 leading-none">
              {short}
            </div>
            <div className="mt-0.5 flex items-center justify-center gap-1">
              <div className="font-display text-base sm:text-lg font-semibold leading-tight truncate">
                {topic}
              </div>
              {empty ? <Lock className="h-3 w-3 text-muted-foreground shrink-0" /> : null}
            </div>
            {!empty ? (
              <>
                <div className="mt-1 text-[10px] sm:text-[11px] tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">{Math.min(s.currentStage, s.totalStages)}</span>
                  <span> / {s.totalStages}</span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-background/60">
                  <div className="h-full bg-gold transition-all" style={{ width: `${Math.round(pct * 100)}%` }} />
                </div>
              </>
            ) : (
              <div className="mt-1 text-[10px] text-muted-foreground">{t("home.empty")}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
