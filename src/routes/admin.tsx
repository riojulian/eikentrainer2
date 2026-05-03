import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppHeader } from "@/components/AppHeader";
import { Upload, Library, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const links = [
    { to: "/admin/upload", label: "Upload", icon: Upload },
    { to: "/admin/words", label: "Word Bank", icon: Library },
    { to: "/admin/progress", label: "Progress", icon: BarChart3 },
  ];
  return (
    <RequireAuth admin>
      <div className="min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-wrap gap-2 mb-6 border-b pb-3">
            {links.map((l) => {
              const active = path === l.to || (l.to === "/admin/words" && path.startsWith("/admin/words"));
              return (
                <Link key={l.to} to={l.to} className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition ${active ? "bg-ink text-cream" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                  <l.icon className="h-4 w-4" /> {l.label}
                </Link>
              );
            })}
          </div>
          <Outlet />
        </div>
      </div>
    </RequireAuth>
  );
}