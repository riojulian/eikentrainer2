import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { BrandMark } from "@/components/BrandMark";
import { useLang } from "@/lib/i18n";
import { migrateGuestMasteryToSupabase, getGuestMastery } from "@/lib/guestMastery";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const { t, lang, setLang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={role === "admin" ? "/admin" : "/study"} />;
  }

  const signInWithProvider = async (provider: "google" | "apple") => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error(result.error.message ?? "Sign-in failed");
      return;
    }
    if (result.redirected) return;
  };

  const signIn = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("auth.welcomeBack"));
    let dest: "/admin" | "/study" = "/study";
    const uid = data.user?.id;
    if (uid) {
      const hasProgress = Object.keys(getGuestMastery()).length > 0;
      if (hasProgress) {
        toast("Saving your progress...");
        migrateGuestMasteryToSupabase(uid)
          .then(() => toast.success("Progress saved! Welcome!"))
          .catch(() => {});
      }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (roles?.some((r) => r.role === "admin")) dest = "/admin";
    }
    navigate({ to: dest });
  };

  const signUp = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data.user) {
      const hasProgress = Object.keys(getGuestMastery()).length > 0;
      if (hasProgress) {
        toast("Saving your progress...");
        migrateGuestMasteryToSupabase(data.user.id)
          .then(() => toast.success("Progress saved! Welcome!"))
          .catch(() => {});
      }
    }
    toast.success(t("auth.created"));
    navigate({ to: "/study" });
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <BrandMark size={56} />
          </div>
          <h1 className="font-display text-3xl font-bold">{t("auth.welcome")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("auth.tagline")}</p>
          <div className="mt-3 inline-flex rounded-full border bg-card p-0.5 text-xs">
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1 rounded-full transition ${lang === "en" ? "bg-gold/20 text-gold font-medium" : "text-muted-foreground"}`}
            >
              English
            </button>
            <button
              onClick={() => setLang("ja")}
              className={`px-3 py-1 rounded-full transition ${lang === "ja" ? "bg-gold/20 text-gold font-medium" : "text-muted-foreground"}`}
            >
              日本語
            </button>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <Tabs defaultValue="signup">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signup">{t("auth.signup")}</TabsTrigger>
              <TabsTrigger value="signin">{t("auth.signin")}</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-4 mt-4">
              <div className="space-y-2"><Label>{t("auth.email")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>{t("auth.password")}</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button className="w-full" disabled={busy} onClick={signIn}>{t("auth.signinBtn")}</Button>
            </TabsContent>
            <TabsContent value="signup" className="space-y-4 mt-4">
              <div className="space-y-2"><Label>{t("auth.displayName")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-2"><Label>{t("auth.email")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>{t("auth.password")}</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button className="w-full" disabled={busy} onClick={signUp}>{t("auth.signupBtn")}</Button>
            </TabsContent>
          </Tabs>
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{t("auth.or") || "or"}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => signInWithProvider("google")}
                className="w-full h-11 rounded-md border bg-background hover:bg-accent transition flex items-center justify-center gap-3 text-sm font-medium disabled:opacity-50"
              >
                <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.7 0 2.8.7 3.5 1.3l2.4-2.3C16.3 3.7 14.3 2.9 12 2.9 6.9 2.9 2.8 7 2.8 12.1S6.9 21.3 12 21.3c6.9 0 9.2-4.8 9.2-7.3 0-.5 0-.9-.1-1.3l-9.1-.5z"/>
                  <path fill="#34A853" d="M3.9 7.3l3.2 2.4c.9-2.2 2.9-3.7 5.4-3.7 1.7 0 2.8.7 3.5 1.3l2.4-2.3C16.3 3.7 14.3 2.9 12 2.9c-3.4 0-6.4 2-7.8 4.9l-.3-.5z"/>
                  <path fill="#FBBC05" d="M12 21.3c2.3 0 4.2-.8 5.6-2.1l-2.6-2.1c-.8.6-1.8.9-3 .9-2.4 0-4.5-1.6-5.2-3.8l-3.2 2.5C5 19.7 8.2 21.3 12 21.3z"/>
                  <path fill="#4285F4" d="M21.2 12.1c0-.5 0-.9-.1-1.3H12v3.9h5.5c-.3 1.3-1.1 2.4-2.3 3.1l2.6 2.1c1.6-1.4 3.4-3.7 3.4-7.8z"/>
                </svg>
                <span>{t("auth.continueWithGoogle") || "Continue with Google"}</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => signInWithProvider("apple")}
                className="w-full h-11 rounded-md border bg-background hover:bg-accent transition flex items-center justify-center gap-3 text-sm font-medium disabled:opacity-50"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.4-1.1-1.6-2.8-1.8-3.4-1.9-1.5-.1-2.8.9-3.6.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.6-1-2.6-3.9zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.3z"/>
                </svg>
                <span>{t("auth.continueWithApple") || "Continue with Apple"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}