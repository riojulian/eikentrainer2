import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { BookOpen, ScrollText, Trophy, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, role, loading, roleLoading } = useAuth();
  if (loading || (user && roleLoading)) return null;
  if (user) return <Navigate to={role === "admin" ? "/admin" : "/study"} />;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <BrandMark size={80} />
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/30 px-3 py-1 text-xs font-semibold tracking-wide text-accent-foreground">
            <Sparkles className="h-3 w-3" /> 英検 Pre-1 ・ Vocabulary
          </span>
          <h1 className="mt-6 font-display text-5xl sm:text-7xl font-bold leading-[1.05] tracking-tight">
            EikenTango <br className="sm:hidden" />
            <span className="text-primary">単語を、もっと<em className="not-italic">楽しく</em>。</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg text-muted-foreground">
            毎日5分でOK。フラッシュカード・クイズ・ステージで、英検の単語をどんどんクリアしよう。
            <span className="block mt-1 text-sm">Eiken vocab, made playful.</span>
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full shadow-[var(--shadow-glow)] px-8">
              <Link to="/auth">はじめる →</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            { icon: BookOpen, title: "フラッシュカード", body: "タップで意味をチェック。覚えた単語をどんどんマーク。", tint: "bg-rose/15 text-rose" },
            { icon: ScrollText, title: "単語リスト", body: "全単語を検索・フィルター。お気に入りもまとめて管理。", tint: "bg-sage/20 text-sage" },
            { icon: Trophy, title: "クイズ", body: "穴埋めクイズで実力チェック。スターを集めてレベルアップ！", tint: "bg-gold/30 text-ink" },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl border border-border bg-card p-6 shadow-card transition-transform hover:-translate-y-1">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${f.tint}`}>
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
