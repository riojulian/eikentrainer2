import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "student";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role | null;
  displayName: string | null;
  loading: boolean;
  roleLoading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  const loadProfile = async (uid: string, { background = false }: { background?: boolean } = {}) => {
    if (!background) setRoleLoading(true);
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle(),
    ]);
    const isAdmin = roles?.some((r) => r.role === "admin");
    setRole(isAdmin ? "admin" : "student");
    setDisplayName(profile?.display_name ?? null);
    if (!background) setRoleLoading(false);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setRole(null);
        setDisplayName(null);
        setRoleLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else { setRoleLoading(false); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Refresh role when window regains focus or tab becomes visible,
  // so role promotions in the DB take effect without re-login.
  useEffect(() => {
    const refresh = () => {
      if (user?.id) loadProfile(user.id, { background: true });
    };
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id]);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        role,
        displayName,
        loading,
        roleLoading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
        refreshRole: async () => {
          if (user) await loadProfile(user.id);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}