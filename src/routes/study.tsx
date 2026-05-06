import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/study")({
  component: () => (
    <div className="min-h-screen">
      <AppHeader />
      <Outlet />
    </div>
  ),
});