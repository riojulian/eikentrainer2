import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function getVisitorId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let v = localStorage.getItem("visitor_id");
    if (!v) {
      v = (crypto.randomUUID?.() || Math.random().toString(36).slice(2)) as string;
      localStorage.setItem("visitor_id", v);
    }
    return v;
  } catch {
    return "anon";
  }
}

export function usePageTracking() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const lastRef = useRef<{ id: string | null; path: string | null; t: number }>({
    id: null,
    path: null,
    t: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const sendDuration = () => {
      const { id, t } = lastRef.current;
      if (!id) return;
      const dur = Date.now() - t;
      const payload = JSON.stringify({ action: "duration", id, duration_ms: dur });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/public/track", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/public/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
      }
    };

    // close out previous page
    sendDuration();

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const res = await fetch("/api/public/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "view",
          visitor_id: getVisitorId(),
          user_id: data.user?.id || null,
          path,
          referrer: document.referrer || null,
        }),
      });
      if (cancelled) return;
      try {
        const j = await res.json();
        lastRef.current = { id: j.id || null, path, t: Date.now() };
      } catch {}
    })();

    const onHide = () => {
      if (document.visibilityState === "hidden") sendDuration();
    };
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", sendDuration);

    return () => {
      cancelled = true;
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", sendDuration);
    };
  }, [path]);
}