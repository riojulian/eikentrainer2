import { supabase } from "@/integrations/supabase/client";

export type Stats = {
  xp: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
};

export const XP_PER_CORRECT = 10;
export const XP_PER_KNOWN_FIRST = 5;
export const XP_BONUS_3STAR = 50;
export const XP_WEEKLY = 25;
export const XP_MONTHLY = 100;

/** level = floor(sqrt(xp/100)) + 1 (so 0xp → level 1, 100xp → 2, 400 → 3, 900 → 4…) */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}
export function xpForLevel(level: number): number {
  const l = Math.max(1, level) - 1;
  return l * l * 100;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / 86400000);
}

export async function getStats(studentId: string): Promise<Stats> {
  const { data } = await supabase
    .from("student_stats")
    .select("xp,current_streak,longest_streak,last_active_date")
    .eq("student_id", studentId)
    .maybeSingle();
  if (data) return data as Stats;
  await supabase.from("student_stats").insert({ student_id: studentId } as never);
  return { xp: 0, current_streak: 0, longest_streak: 0, last_active_date: null };
}

export async function awardXp(studentId: string, amount: number): Promise<Stats> {
  if (amount <= 0) return getStats(studentId);
  const cur = await getStats(studentId);
  const next = { ...cur, xp: cur.xp + amount };
  await supabase
    .from("student_stats")
    .upsert(
      { student_id: studentId, xp: next.xp, updated_at: new Date().toISOString() } as never,
      { onConflict: "student_id" },
    );
  return next;
}

/** Bump streak based on today vs last_active_date. Returns the new stats. */
export async function bumpStreak(studentId: string): Promise<Stats> {
  const cur = await getStats(studentId);
  const today = todayStr();
  if (cur.last_active_date === today) return cur;
  let nextStreak = 1;
  if (cur.last_active_date) {
    const diff = daysBetween(cur.last_active_date, today);
    if (diff === 1) nextStreak = cur.current_streak + 1;
    else if (diff === 0) nextStreak = cur.current_streak;
    else nextStreak = 1;
  }
  const longest = Math.max(cur.longest_streak, nextStreak);
  const next: Stats = { ...cur, current_streak: nextStreak, longest_streak: longest, last_active_date: today };
  await supabase
    .from("student_stats")
    .upsert(
      {
        student_id: studentId,
        current_streak: nextStreak,
        longest_streak: longest,
        last_active_date: today,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "student_id" },
    );
  return next;
}

export type BadgeDef = { key: string; name: string; desc: string; emoji: string };

export const BADGES: BadgeDef[] = [
  { key: "first_steps", name: "First Steps", desc: "Finished Stage 1", emoji: "👣" },
  { key: "perfect_stage", name: "Flawless", desc: "Got 3 stars on a stage", emoji: "🌟" },
  { key: "five_stages", name: "Climber", desc: "Cleared 5 stages", emoji: "⛰️" },
  { key: "ten_stages", name: "Mountaineer", desc: "Cleared 10 stages", emoji: "🏔️" },
  { key: "perfectionist", name: "Perfectionist", desc: "3-starred 5 stages", emoji: "💎" },
  { key: "streak_3", name: "On a Roll", desc: "3-day streak", emoji: "🔥" },
  { key: "streak_7", name: "Marathon", desc: "7-day streak", emoji: "🏃" },
  { key: "streak_30", name: "Unstoppable", desc: "30-day streak", emoji: "⚡" },
  { key: "weekly_done", name: "Weekly Warrior", desc: "Finished a weekly review", emoji: "📅" },
  { key: "monthly_done", name: "Monthly Master", desc: "Finished a monthly review", emoji: "🗓️" },
];

export async function getEarnedBadges(studentId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("student_badges")
    .select("badge_key")
    .eq("student_id", studentId);
  return new Set((data ?? []).map((r) => r.badge_key));
}

async function awardBadge(studentId: string, key: string) {
  await supabase
    .from("student_badges")
    .insert({ student_id: studentId, badge_key: key } as never)
    .then(() => {}, () => {}); // ignore duplicates
}

/** Check & award any new badges. Returns the list of newly awarded keys. */
export async function checkBadges(
  studentId: string,
  ctx: {
    starsByStage: Record<number, 0 | 1 | 2 | 3>;
    streak: number;
    justFinishedKind?: "stage" | "weekly" | "monthly";
    justFinishedStageIndex?: number | null;
    justFinishedStars?: 0 | 1 | 2 | 3;
  },
): Promise<BadgeDef[]> {
  const earned = await getEarnedBadges(studentId);
  const toAdd: string[] = [];

  const stageEntries = Object.entries(ctx.starsByStage);
  const cleared = stageEntries.filter(([, s]) => s >= 1).length;
  const threeStarCount = stageEntries.filter(([, s]) => s === 3).length;

  const tryAdd = (key: string, cond: boolean) => {
    if (cond && !earned.has(key)) toAdd.push(key);
  };

  tryAdd("first_steps", ctx.justFinishedStageIndex === 1 && (ctx.justFinishedStars ?? 0) >= 1);
  tryAdd("perfect_stage", (ctx.justFinishedStars ?? 0) === 3);
  tryAdd("five_stages", cleared >= 5);
  tryAdd("ten_stages", cleared >= 10);
  tryAdd("perfectionist", threeStarCount >= 5);
  tryAdd("streak_3", ctx.streak >= 3);
  tryAdd("streak_7", ctx.streak >= 7);
  tryAdd("streak_30", ctx.streak >= 30);
  tryAdd("weekly_done", ctx.justFinishedKind === "weekly");
  tryAdd("monthly_done", ctx.justFinishedKind === "monthly");

  await Promise.all(toAdd.map((k) => awardBadge(studentId, k)));
  return toAdd.map((k) => BADGES.find((b) => b.key === k)!).filter(Boolean);
}