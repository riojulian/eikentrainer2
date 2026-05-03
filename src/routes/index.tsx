import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { BookOpen, ScrollText, Trophy, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={role === "admin" ? "/admin" : "/study"} />;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs uppercase tracking-widest text-gold">
            <Sparkles className="h-3 w-3" /> Eiken Pre-1
          </span>
          <h1 className="mt-6 font-display text-5xl sm:text-7xl font-bold leading-tight">
            Rinka's Vocabulary <em className="text-gold not-italic">Atelier</em>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            A quiet, beautiful place to learn the words that open up the Eiken Pre-1 exam — flashcards, lists, and quizzes built for focused study.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Begin studying</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            { icon: BookOpen, title: "Flashcards", body: "Tap to reveal the meaning. Mark Know it or Review." },
            { icon: ScrollText, title: "Word List", body: "Browse, search, and filter the whole vocabulary bank." },
            { icon: Trophy, title: "Quiz", body: "Fill-in-the-blank questions drawn from your reviewed words." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <f.icon className="h-6 w-6 text-gold" />
              <h3 className="mt-4 font-display text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
