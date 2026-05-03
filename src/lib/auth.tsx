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
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle(),
    ]);
    // Only update role if the query succeeded — never silently downgrade
    // an admin to student on a transient permission/network error.
    if (!rolesRes.error) {
      const isAdmin = rolesRes.data?.some((r) => r.role === "admin");
      setRole(isAdmin ? "admin" : "student");
    }
    if (!profileRes.error) {
      setDisplayName(profileRes.data?.display_name ?? null);
    }
    if (!background) setRoleLoading(false);
  };

  useEffect(() => {
    let lastLoadedUid: string | null = null;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Avoid duplicate role loads when getSession + onAuthStateChange
        // both fire for the same user on initial mount.
        if (lastLoadedUid !== s.user.id) {
          lastLoadedUid = s.user.id;
          setTimeout(() => loadProfile(s.user.id), 0);
        }
      } else {
        lastLoadedUid = null;
        setRole(null);
        setDisplayName(null);
        setRoleLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        lastLoadedUid = s.user.id;
        loadProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setRoleLoading(false);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Refresh role when window regains focus or tab becomes visible,
  // so role promotions in the DB take effect without re-login.
  // Throttled so rapid focus/blur cycles don't hammer the backend or
  // flicker the UI.
  useEffect(() => {
    let lastRefresh = 0;
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh < 60_000) return; // at most once per minute
      lastRefresh = now;
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