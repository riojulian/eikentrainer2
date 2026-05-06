import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">{t("auth.signin")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.signup")}</TabsTrigger>
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
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("auth.studentNote")}
        </p>
      </div>
    </div>
  );
}