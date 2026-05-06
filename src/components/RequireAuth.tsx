import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, role, loading } = useAuth();
  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" />;
  // For admin routes, also wait until role is resolved (not null) before
  // deciding to redirect — prevents bouncing admins to /study on transient
  // role-load failures.
  if (admin) {
    if (role === null) {
      return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
    }
    if (role !== "admin") return <Navigate to="/study" />;
  }
  return <>{children}</>;
}