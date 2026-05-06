import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SignupGateProps {
  trigger: "stage-complete" | "locked-stage";
  lockedStage?: number;
  onRetry?: () => void;
}

export function SignupGate({ trigger, lockedStage, onRetry }: SignupGateProps) {
  if (trigger === "stage-complete") {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2">Free preview complete!</h2>
        <p className="text-muted-foreground mb-6">
          You've finished the 3 free stages. Create a free account to unlock all 5 worlds and save your progress permanently.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Button asChild size="lg">
            <Link to="/auth">
              <Sparkles className="w-4 h-4 mr-2" /> Create Free Account
            </Link>
          </Button>
          {onRetry && (
            <Button variant="ghost" onClick={onRetry}>
              Try again
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-2">Free forever. No credit card needed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="flex flex-col items-center gap-4">
        <Lock className="w-10 h-10 text-muted-foreground" />
        <h2 className="text-xl font-bold">
          Stage {lockedStage} is locked
        </h2>
        <p className="text-muted-foreground">
          Create a free account to unlock all stages and track your progress.
        </p>
        <Button asChild size="lg">
          <Link to="/auth">
            <Sparkles className="w-4 h-4 mr-2" /> Sign Up Free
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">Free forever. No credit card needed.</p>
      </div>
    </div>
  );
}