import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function parseDevice(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|android|iphone/.test(s)) return "mobile";
  return "desktop";
}

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          if (body.action === "duration" && body.id) {
            await supabaseAdmin
              .from("page_views")
              .update({ duration_ms: Math.max(0, Math.min(60 * 60 * 1000, Number(body.duration_ms) || 0)) })
              .eq("id", body.id);
            return Response.json({ ok: true });
          }
          if (body.action === "view") {
            const ua = request.headers.get("user-agent") || "";
            const country =
              request.headers.get("cf-ipcountry") ||
              request.headers.get("x-vercel-ip-country") ||
              null;
            const { data, error } = await supabaseAdmin
              .from("page_views")
              .insert({
                visitor_id: String(body.visitor_id || "anon").slice(0, 64),
                user_id: body.user_id || null,
                path: String(body.path || "/").slice(0, 500),
                referrer: body.referrer ? String(body.referrer).slice(0, 500) : null,
                user_agent: ua.slice(0, 500),
                country,
                device: parseDevice(ua),
              })
              .select("id")
              .single();
            if (error) return new Response(error.message, { status: 500 });
            return Response.json({ id: data.id });
          }
          return new Response("bad request", { status: 400 });
        } catch (e: any) {
          return new Response(e?.message || "error", { status: 500 });
        }
      },
    },
  },
});