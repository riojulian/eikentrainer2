import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  BookOpen,
  MoreVertical,
  ScrollText,
  BarChart3,
  CalendarDays,
  CalendarRange,
  Languages,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useLang } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import {
  fetchActiveWords,
  fetchStatuses,
  MASTERY_BG,
  MASTERY_LABELS,
  type Mastery,
} from "@/lib/words";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export function AppHeader() {
  const { user, role, displayName, signOut } = useAuth();
  const navigate = useNavigate();
  const { lang, setLang, t } = useLang();

  const allWordsQ = useQuery({
    queryKey: qk.words(),
    queryFn: fetchActiveWords,
    staleTime: Infinity,
  });
  const statusesQ = useQuery({
    queryKey: user ? qk.statuses(user.id) : ["statuses", "anon"],
    queryFn: () => fetchStatuses(user!.id),
    enabled: !!user,
  });
  const weeklyQ = useQuery({
    queryKey: user ? ["weeklyEligible", user.id] : ["weeklyEligible", "anon"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count } = await supabase
        .from("word_status")
        .select("word_id", { count: "exact", head: true })
        .eq("student_id", user!.id)
        .gte("updated_at", since);
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const monthlyQ = useQuery({
    queryKey: user ? ["monthlyEligible", user.id] : ["monthlyEligible", "anon"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { count } = await supabase
        .from("word_status")
        .select("word_id", { count: "exact", head: true })
        .eq("student_id", user!.id)
        .gte("updated_at", since);
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const allWords = allWordsQ.data ?? [];
  const statuses = statusesQ.data ?? {};
  const weeklyEligible = weeklyQ.data ?? 0;
  const monthlyEligible = monthlyQ.data ?? 0;

  const stats = useMemo(() => {
    const tiers: Record<Mastery, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    let seen = 0;
    Object.values(statuses).forEach((s) => {
      if (s === null || s === undefined) return;
      tiers[s as Mastery]++;
      seen++;
    });
    return { total: allWords.length, tiers, unseen: allWords.length - seen };
  }, [allWords, statuses]);

  const masteredish = stats.tiers[2] + stats.tiers[3];
  const tierRows: { key: Mastery; count: number; cls: string; label: string }[] = [
    { key: 0, count: stats.tiers[0], cls: MASTERY_BG[0], label: MASTERY_LABELS[0] },
    { key: 1, count: stats.tiers[1], cls: MASTERY_BG[1], label: MASTERY_LABELS[1] },
    { key: 2, count: stats.tiers[2], cls: MASTERY_BG[2], label: MASTERY_LABELS[2] },
    { key: 3, count: stats.tiers[3], cls: MASTERY_BG[3], label: MASTERY_LABELS[3] },
  ];

  const overflowMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0 h-9 w-9">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {user ? (
          <>
            <DropdownMenuLabel>{t("menu.reviewsLib")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Dialog>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <BarChart3 className="h-4 w-4 mr-2 text-gold" />
                  <div className="flex flex-col">
                    <span>{t("menu.wordsKnow")}</span>
                    <span className="text-xs text-muted-foreground">
                      {masteredish} / {stats.total} {t("menu.mastered")}
                    </span>
                  </div>
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("home.wordsKnowTitle")}</DialogTitle>
                </DialogHeader>
                <div className="rounded-2xl border bg-card p-4">
                  <div className="flex items-baseline justify-between">
                    <div className="text-sm text-muted-foreground">{t("home.mastered")}</div>
                    <div className="font-display text-2xl">
                      {masteredish} <span className="text-muted-foreground text-base">/ {stats.total}</span>
                    </div>
                  </div>
                  {stats.total > 0 && (
                    <div className="mt-3">
                      <div className="flex w-full gap-1 overflow-hidden rounded-full">
                        {tierRows.map((s) => (
                          <div
                            key={s.key}
                            className={`${s.cls} flex h-6 min-w-0 flex-1 items-center justify-center overflow-hidden px-1 text-[8px] sm:text-[10px] font-medium text-white/95 whitespace-nowrap`}
                            title={`${s.label}: ${s.count}`}
                          >
                            <span className="truncate">{s.label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1.5 flex w-full gap-1">
                        {tierRows.map((s) => (
                          <div key={s.key} className="flex min-w-0 flex-1 justify-center font-display text-lg">
                            {s.count}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="text-muted-foreground">{t("home.unseen")}</span>
                        <span className="font-display text-base">{stats.unseen}</span>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild disabled={weeklyEligible < 4}>
              <Link to="/study/quiz" search={{ mode: "weekly" as const }}>
                <CalendarDays className="h-4 w-4 mr-2 text-gold" />
                <div className="flex flex-col">
                  <span>{t("menu.weekly")}</span>
                  <span className="text-xs text-muted-foreground">
                    {weeklyEligible >= 4 ? `${weeklyEligible} ${t("menu.weeklyHint")}` : t("menu.unlockHint")}
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild disabled={monthlyEligible < 4}>
              <Link to="/study/quiz" search={{ mode: "monthly" as const }}>
                <CalendarRange className="h-4 w-4 mr-2 text-gold" />
                <div className="flex flex-col">
                  <span>{t("menu.monthly")}</span>
                  <span className="text-xs text-muted-foreground">
                    {monthlyEligible >= 4 ? `${monthlyEligible} ${t("menu.monthlyHint")}` : t("menu.unlockHint")}
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild>
          <Link to="/study/list">
            <ScrollText className="h-4 w-4 mr-2 text-gold" />
            {t("menu.browse")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-gold" /> {t("menu.language")}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setLang("en")}>
          <span className={lang === "en" ? "font-semibold" : ""}>English</span>
          {lang === "en" ? <span className="ml-auto text-xs text-muted-foreground">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setLang("ja")}>
          <span className={lang === "ja" ? "font-semibold" : ""}>日本語</span>
          {lang === "ja" ? <span className="ml-auto text-xs text-muted-foreground">✓</span> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header className="border-b border-border/60 bg-card/60 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <BrandMark size={32} />
          EikenTango
          <span className="text-muted-foreground font-sans text-xs font-normal hidden sm:inline">英検単語</span>
        </Link>
        <nav className="flex items-center gap-2">
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
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-muted-foreground mr-1">
                {displayName ?? user.email}
              </span>
              {overflowMenu}
              <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              {overflowMenu}
              <Button size="sm" asChild>
                <Link to="/auth">{t("nav.signin")}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
