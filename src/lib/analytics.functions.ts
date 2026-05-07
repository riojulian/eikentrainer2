import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({
  startDate: z.string(), // ISO date (YYYY-MM-DD)
  endDate: z.string(),
});

export const getSignupStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Verify admin role
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    const start = new Date(data.startDate + "T00:00:00.000Z");
    const end = new Date(data.endDate + "T23:59:59.999Z");

    const [{ count: totalUsers }, { data: rows }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("profiles")
        .select("created_at")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: true }),
    ]);

    const byDay = new Map<string, number>();
    // Seed each day in range with 0
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    (rows ?? []).forEach((r) => {
      const k = new Date(r.created_at).toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    });
    const daily = [...byDay.entries()].map(([date, count]) => ({ date, count }));

    return {
      totalUsers: totalUsers ?? 0,
      newSignups: rows?.length ?? 0,
      daily,
    };
  });