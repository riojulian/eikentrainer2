import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (admin && role !== "admin") return <Navigate to="/study" />;
  return <>{children}</>;
}