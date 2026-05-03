import { Link } from "@tanstack/react-router";
import { Star, Lock, BookOpen, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export type StageMapProps = {
  total: number;
  currentStage: number;
  starsByStage: Record<number, 0 | 1 | 2 | 3>;
  /** World (DB tier value) of each stage's first word, used for color band */
  tierByStage?: (string | null)[];
};

const TIER_BAND: Record<string, string> = {
  tier1: "from-rose/30 to-rose/5 border-rose/40 text-rose",
  tier2: "from-amber-300/30 to-amber-300/5 border-amber-400/40 text-amber-600",
  tier3: "from-sage/30 to-sage/5 border-sage/40 text-sage",
  tier4: "from-sky-300/30 to-sky-300/5 border-sky-400/40 text-sky-600",
  phrases: "from-violet-300/30 to-violet-300/5 border-violet-400/40 text-violet-600",
  _null: "from-muted to-muted/30 border-muted-foreground/30 text-muted-foreground",
};

function StarRow({ stars }: { stars: 0 | 1 | 2 | 3 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= stars ? "fill-gold text-gold" : "text-muted-foreground/40",
          )}
        />
      ))}
    </div>
  );
}

export function StageMap({ total, currentStage, starsByStage, tierByStage }: StageMapProps) {
  const nodes = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="relative py-2">
      {/* dotted spine */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,theme(colors.muted-foreground/30)_0_6px,transparent_6px_12px)]"
        aria-hidden
      />
      <ul className="relative space-y-3">
        {nodes.map((n, i) => {
          const stars = starsByStage[n] ?? 0;
          const isCurrent = n === currentStage;
          const isDone = stars > 0 || n < currentStage;
          const isFuture = n > currentStage && stars === 0;
          const tier = tierByStage?.[i] ?? "_null";
          const band = TIER_BAND[tier] ?? TIER_BAND._null;
          // Zigzag: even rows lean right, odd lean left
          const lean = i % 2 === 0 ? "ml-0 mr-auto" : "ml-auto mr-0";
          return (
            <li key={n} className="flex">
              <div className={cn("w-[88%] sm:w-[72%]", lean)}>
                <Link
                  to="/study/flashcards"
                  search={{ mission: n }}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-2xl border bg-gradient-to-br p-3 shadow-card transition hover:scale-[1.01] hover:shadow-glow",
                    band,
                    isCurrent && "ring-2 ring-gold",
                    isFuture && "opacity-80",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 font-display text-lg shadow-sm",
                      isCurrent ? "bg-gold text-gold-foreground border-gold" :
                      isDone ? "bg-sage text-sage-foreground border-sage" :
                      "bg-card border-muted-foreground/30 text-muted-foreground",
                    )}
                  >
                    {isFuture && stars === 0 ? <Lock className="h-5 w-5" /> : n}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-base text-foreground">Stage {n}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gold">
                          Now
                        </span>
                      )}
                    </div>
                    <StarRow stars={stars} />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {isDone ? <Trophy className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                  </div>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}