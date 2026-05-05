import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, BookOpen } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useLang } from "@/lib/i18n";

export function AppHeader() {
  const { user, role, displayName, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useLang();

  return (
    <header className="border-b border-border/60 bg-card/60 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <BrandMark size={32} />
          EikenTango
          <span className="text-muted-foreground font-sans text-xs font-normal hidden sm:inline">英検単語</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              {role === "admin" ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin">{t("home.admin")}</Link>
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" asChild>
                <Link to="/study">
                  <BookOpen className="h-4 w-4 mr-1" /> {t("nav.study")}
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
              <Link to="/auth">{t("nav.signin")}</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}