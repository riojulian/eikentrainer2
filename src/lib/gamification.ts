import { supabase } from "@/integrations/supabase/client";
import { fetchActiveWords } from "@/lib/words";

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
  { key: "streak_5", name: "5-Streak", desc: "5 sessions in a row", emoji: "🔥" },
  { key: "mc_master", name: "MC Master", desc: "20 correct multiple-choice in a row", emoji: "🎯" },
  { key: "vocab_ready", name: "Vocab Ready", desc: "Readiness ≥ 80% (50+ answers)", emoji: "🟢" },
];

export const BADGES_JA: Record<string, { name: string; desc: string }> = {
  streak_5: { name: "5連続", desc: "5セッション連続達成" },
  mc_master: { name: "選択肢マスター", desc: "選択問題20問連続正解" },
  vocab_ready: { name: "語彙準備完了", desc: "理解度80%以上 (50問以上)" },
};

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

/** World weights for the readiness score. Must sum to 1. */
export const READINESS_WEIGHTS: Record<string, number> = {
  tier1: 0.6,
  tier2: 0.1,
  tier3: 0.1,
  tier4: 0.1,
  phrases: 0.1,
};

export type PerWorldReadiness = { pct: number; total: number; correct: number };

export type PerWorldCompleteness = { pct: number; known: number; total: number };

/** Coverage metric: share of Pre-1 words mastered.
 *  mastery >= 2 → 1.0 credit, mastery == 1 → 0.5 credit, else 0. */
export async function getCompleteness(
  studentId: string,
): Promise<{ pct: number; known: number; total: number; perWorld: Record<string, PerWorldCompleteness> }> {
  const [allWords, { data: statusData }] = await Promise.all([
    fetchActiveWords(),
    supabase.from("word_status").select("word_id, mastery").eq("student_id", studentId),
  ]);
  const masteryByWord = new Map<string, number>(
    (statusData ?? []).map((r) => [r.word_id, r.mastery as number]),
  );
  const perWorld: Record<string, PerWorldCompleteness> = {};
  for (const k of Object.keys(READINESS_WEIGHTS)) perWorld[k] = { pct: 0, known: 0, total: 0 };
  let knownTotal = 0;
  let countTotal = 0;
  for (const w of allWords) {
    const tier = w.tier ?? "";
    if (!(tier in perWorld)) continue;
    const m = masteryByWord.get(w.id) ?? 0;
    const credit = m >= 2 ? 1 : m === 1 ? 0.5 : 0;
    perWorld[tier].known += credit;
    perWorld[tier].total += 1;
    knownTotal += credit;
    countTotal += 1;
  }
  for (const pw of Object.values(perWorld)) {
    pw.pct = pw.total === 0 ? 0 : Math.round((pw.known / pw.total) * 100);
  }
  const pct = countTotal === 0 ? 0 : Math.round((knownTotal / countTotal) * 100);
  return { pct, known: Math.round(knownTotal), total: countTotal, perWorld };
}

/** Compute live readiness % from quiz_results, weighted per world.
 *  A world with zero answers contributes 0 (so untouched worlds drag the score down). */
export async function getReadiness(
  studentId: string,
): Promise<{ pct: number; total: number; correct: number; perWorld: Record<string, PerWorldReadiness> }> {
  const [{ data: qrData }, { data: wordsData }] = await Promise.all([
    supabase.from("quiz_results").select("correct, word_id").eq("student_id", studentId),
    supabase.from("words").select("id, tier"),
  ]);
  const tierByWord = new Map<string, string | null>((wordsData ?? []).map((w) => [w.id, w.tier]));
  const rows = (qrData ?? []).map((r) => ({ correct: r.correct, tier: tierByWord.get(r.word_id) ?? "" }));
  const perWorld: Record<string, PerWorldReadiness> = {};
  for (const k of Object.keys(READINESS_WEIGHTS)) perWorld[k] = { pct: 0, total: 0, correct: 0 };
  let total = 0;
  let correct = 0;
  for (const r of rows) {
    const tier = r.tier ?? "";
    if (!(tier in perWorld)) continue;
    perWorld[tier].total += 1;
    if (r.correct) perWorld[tier].correct += 1;
    total += 1;
    if (r.correct) correct += 1;
  }
  let weighted = 0;
  for (const [k, w] of Object.entries(READINESS_WEIGHTS)) {
    const pw = perWorld[k];
    pw.pct = pw.total === 0 ? 0 : Math.round((pw.correct / pw.total) * 100);
    const acc = pw.total === 0 ? 0 : pw.correct / pw.total;
    weighted += w * acc;
  }
  const pct = Math.round(weighted * 100);
  return { pct, total, correct, perWorld };
}

/** Bump session streak (counts consecutive completed sessions; never auto-resets). */
export async function bumpSessionStreak(studentId: string): Promise<Stats> {
  const cur = await getStats(studentId);
  const next = cur.current_streak + 1;
  const longest = Math.max(cur.longest_streak, next);
  await supabase
    .from("student_stats")
    .upsert(
      {
        student_id: studentId,
        current_streak: next,
        longest_streak: longest,
        last_active_date: todayStr(),
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "student_id" },
    );
  return { ...cur, current_streak: next, longest_streak: longest, last_active_date: todayStr() };
}

/** Check & award new badges based on readiness, streak, and MC run. */
export async function checkBadges(
  studentId: string,
  ctx: { streak: number; mcRun: number; readinessPct: number; readinessTotal: number },
): Promise<BadgeDef[]> {
  const earned = await getEarnedBadges(studentId);
  const toAdd: string[] = [];
  const tryAdd = (key: string, cond: boolean) => {
    if (cond && !earned.has(key)) toAdd.push(key);
  };
  tryAdd("streak_5", ctx.streak >= 5);
  tryAdd("mc_master", ctx.mcRun >= 20);
  tryAdd("vocab_ready", ctx.readinessPct >= 80 && ctx.readinessTotal >= 50);
  await Promise.all(toAdd.map((k) => awardBadge(studentId, k)));
  return toAdd.map((k) => BADGES.find((b) => b.key === k)!).filter(Boolean);
}