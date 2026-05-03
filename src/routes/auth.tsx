import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
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
    toast.success("Welcome back");
    let dest: "/admin" | "/study" = "/study";
    const uid = data.user?.id;
    if (uid) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (roles?.some((r) => r.role === "admin")) dest = "/admin";
    }
    navigate({ to: dest });
  };

  const signUp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created!");
    navigate({ to: "/study" });
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold text-gold-foreground mb-3">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="font-display text-3xl">Welcome</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to continue your vocabulary practice.</p>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button className="w-full" disabled={busy} onClick={signIn}>Sign in</Button>
            </TabsContent>
            <TabsContent value="signup" className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rinka" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button className="w-full" disabled={busy} onClick={signUp}>Create account</Button>
            </TabsContent>
          </Tabs>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          New accounts are created as students. An admin can promote you in the database.
        </p>
      </div>
    </div>
  );
}