import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/study")({
  component: () => (
    <RequireAuth>
      <div className="min-h-screen">
        <AppHeader />
        <Outlet />
      </div>
    </RequireAuth>
  ),
});