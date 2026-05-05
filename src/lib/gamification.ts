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
  { key: "first_steps", name: "First Timer", desc: "Study your first word", emoji: "🌱" },
  { key: "explorer", name: "Explorer", desc: "Touch 25 different words", emoji: "🧭" },
  { key: "scholar", name: "Scholar", desc: "Touch 100 different words", emoji: "📚" },
  { key: "streak_3", name: "On a Roll", desc: "3 sessions in a row", emoji: "✨" },
  { key: "streak_5", name: "5-Streak", desc: "5 sessions in a row", emoji: "🔥" },
  { key: "streak_10", name: "10-Streak", desc: "10 sessions in a row", emoji: "⚡" },
  { key: "marathon", name: "Marathon", desc: "30 sessions in a row", emoji: "🏃" },
  { key: "mc_starter", name: "Sharpshooter", desc: "5 correct multiple-choice in a row", emoji: "🎯" },
  { key: "mc_master", name: "MC Master", desc: "20 correct multiple-choice in a row", emoji: "🏹" },
  { key: "mc_legend", name: "MC Legend", desc: "50 correct multiple-choice in a row", emoji: "👑" },
  { key: "vocab_ready", name: "Vocab Ready", desc: "Mastery progress ≥ 80% (50+ words seen)", emoji: "🟢" },
  { key: "vocab_master", name: "Vocab Master", desc: "Mastery progress ≥ 95% (100+ words)", emoji: "🏆" },
];

export const BADGES_JA: Record<string, { name: string; desc: string }> = {
  first_steps: { name: "はじめの一歩", desc: "最初の単語を学習" },
  explorer: { name: "探検家", desc: "25語に触れた" },
  scholar: { name: "学者", desc: "100語に触れた" },
  streak_3: { name: "好調", desc: "3セッション連続達成" },
  streak_5: { name: "5連続", desc: "5セッション連続達成" },
  streak_10: { name: "10連続", desc: "10セッション連続達成" },
  marathon: { name: "マラソン", desc: "30セッション連続達成" },
  mc_starter: { name: "射手", desc: "選択問題5問連続正解" },
  mc_master: { name: "選択肢マスター", desc: "選択問題20問連続正解" },
  mc_legend: { name: "伝説の射手", desc: "選択問題50問連続正解" },
  vocab_ready: { name: "語彙準備完了", desc: "習得進捗80%以上 (50語以上)" },
  vocab_master: { name: "語彙マスター", desc: "習得進捗95%以上 (100語以上)" },
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

export type MasteryBuckets = { untouched: number; m0: number; m1: number; m2: number; m3: number };

export type PerWorldMastery = {
  pct: number;
  total: number;
  buckets: MasteryBuckets;
};

/** Linear credit per word based on mastery level. Untouched=0, m0=0.25, m1=0.5, m2=0.75, m3=1.0. */
const MASTERY_CREDIT: Record<number, number> = { 0: 0.25, 1: 0.5, 2: 0.75, 3: 1.0 };

/** Unified Mastery Progress: linear credit per word, weighted by world. */
export async function getMastery(
  studentId: string,
): Promise<{
  pct: number;
  total: number;
  touched: number;
  buckets: MasteryBuckets;
  perWorld: Record<string, PerWorldMastery>;
}> {
  const [allWords, { data: statusData }] = await Promise.all([
    fetchActiveWords(),
    supabase.from("word_status").select("word_id, mastery").eq("student_id", studentId),
  ]);
  const masteryByWord = new Map<string, number>(
    (statusData ?? []).map((r) => [r.word_id, r.mastery as number]),
  );
  const perWorld: Record<string, PerWorldMastery> = {};
  for (const k of Object.keys(READINESS_WEIGHTS)) {
    perWorld[k] = { pct: 0, total: 0, buckets: { untouched: 0, m0: 0, m1: 0, m2: 0, m3: 0 } };
  }
  const buckets: MasteryBuckets = { untouched: 0, m0: 0, m1: 0, m2: 0, m3: 0 };
  let total = 0;
  let touched = 0;
  const perWorldCredit: Record<string, number> = {};
  for (const k of Object.keys(READINESS_WEIGHTS)) perWorldCredit[k] = 0;

  for (const w of allWords) {
    const tier = w.tier ?? "";
    if (!(tier in perWorld)) continue;
    const pw = perWorld[tier];
    pw.total += 1;
    total += 1;
    const m = masteryByWord.get(w.id);
    if (m === undefined) {
      pw.buckets.untouched += 1;
      buckets.untouched += 1;
    } else {
      const key = (`m${m}` as keyof MasteryBuckets);
      pw.buckets[key] += 1;
      buckets[key] += 1;
      touched += 1;
      const credit = MASTERY_CREDIT[m] ?? 0;
      perWorldCredit[tier] += credit;
    }
  }

  let weighted = 0;
  for (const [k, weight] of Object.entries(READINESS_WEIGHTS)) {
    const pw = perWorld[k];
    const ratio = pw.total === 0 ? 0 : perWorldCredit[k] / pw.total;
    pw.pct = Math.round(ratio * 100);
    weighted += weight * ratio;
  }
  const pct = Math.round(weighted * 100);
  return { pct, total, touched, buckets, perWorld };
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
  ctx: { streak: number; mcRun: number; masteryPct: number; touchedCount: number },
): Promise<BadgeDef[]> {
  const earned = await getEarnedBadges(studentId);
  const toAdd: string[] = [];
  const tryAdd = (key: string, cond: boolean) => {
    if (cond && !earned.has(key)) toAdd.push(key);
  };
  tryAdd("first_steps", ctx.touchedCount >= 1);
  tryAdd("explorer", ctx.touchedCount >= 25);
  tryAdd("scholar", ctx.touchedCount >= 100);
  tryAdd("streak_3", ctx.streak >= 3);
  tryAdd("streak_5", ctx.streak >= 5);
  tryAdd("streak_10", ctx.streak >= 10);
  tryAdd("marathon", ctx.streak >= 30);
  tryAdd("mc_starter", ctx.mcRun >= 5);
  tryAdd("mc_master", ctx.mcRun >= 20);
  tryAdd("mc_legend", ctx.mcRun >= 50);
  tryAdd("vocab_ready", ctx.masteryPct >= 80 && ctx.touchedCount >= 50);
  tryAdd("vocab_master", ctx.masteryPct >= 95 && ctx.touchedCount >= 100);
  await Promise.all(toAdd.map((k) => awardBadge(studentId, k)));
  return toAdd.map((k) => BADGES.find((b) => b.key === k)!).filter(Boolean);
}