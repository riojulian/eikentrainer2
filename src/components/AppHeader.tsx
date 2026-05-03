import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, BookOpen, Sparkles } from "lucide-react";

export function AppHeader() {
  const { user, role, displayName, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-border/60 bg-card/60 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gold text-gold-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          Rinka <span className="text-muted-foreground font-sans text-sm font-normal hidden sm:inline">Vocab Trainer</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              {role === "admin" ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin">Admin</Link>
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" asChild>
                <Link to="/study">
                  <BookOpen className="h-4 w-4 mr-1" /> Study
                </Link>
              </Button>
              <span className="hidden sm:inline text-sm text-muted-foreground mr-2">
                {displayName ?? user.email}
              </span>
              <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}