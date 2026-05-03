import { supabase } from "@/integrations/supabase/client";
import { fetchActiveWords, type Word } from "@/lib/words";

export const MISSION_SIZE = 10;
const TIER_ORDER = ["tier1", "tier2", "tier3", "tier4", "phrases"] as const;

function orderKeysWithStart(startTier?: string | null): string[] {
  const base = [...TIER_ORDER, "_null"];
  if (!startTier) return base;
  const idx = base.indexOf(startTier);
  if (idx <= 0) return base;
  return [...base.slice(idx), ...base.slice(0, idx)];
}

/** Wipe and rebuild the per-student word order. Used when starting tier changes. */
export async function rebuildWordOrder(studentId: string, startTier?: string | null): Promise<Word[]> {
  await supabase.from("student_word_order").delete().eq("student_id", studentId);
  return ensureWordOrder(studentId, startTier);
}


function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Ensure this student has a stable, per-student shuffled order of all active words.
 * - First time: shuffle words within each tier (tier1 → tier4 → phrases → null) and persist.
 * - Later: append any newly added words at the end (preserves existing positions).
 * Returns the ordered Word[].
 */
export async function ensureWordOrder(studentId: string, startTier?: string | null): Promise<Word[]> {
  const [allWords, { data: existing }] = await Promise.all([
    fetchActiveWords(),
    supabase.from("student_word_order").select("word_id,position").eq("student_id", studentId),
  ]);
  const wordById = new Map(allWords.map((w) => [w.id, w] as const));
  const existingMap = new Map((existing ?? []).map((r) => [r.word_id, r.position] as const));

  // Append rows for any words missing from the order.
  const missingIds = allWords.map((w) => w.id).filter((id) => !existingMap.has(id));
  if (missingIds.length > 0) {
    // Group missing by tier, shuffle within each tier, then append in tier order.
    const grouped: Record<string, string[]> = {};
    for (const id of missingIds) {
      const w = wordById.get(id)!;
      const key = w.tier ?? "_null";
      (grouped[key] ||= []).push(id);
    }
    const orderedKeys = orderKeysWithStart(startTier);
    let nextPos = existing && existing.length > 0
      ? Math.max(...existing.map((r) => r.position)) + 1
      : 0;
    const rows: { student_id: string; word_id: string; position: number }[] = [];
    for (const k of orderedKeys) {
      const ids = grouped[k];
      if (!ids) continue;
      for (const id of shuffle(ids)) {
        rows.push({ student_id: studentId, word_id: id, position: nextPos++ });
      }
    }
    if (rows.length > 0) {
      await supabase.from("student_word_order").insert(rows);
    }
  }

  // Re-read final order
  const { data: ordered } = await supabase
    .from("student_word_order")
    .select("word_id,position")
    .eq("student_id", studentId)
    .order("position", { ascending: true });
  const result: Word[] = [];
  (ordered ?? []).forEach((r) => {
    const w = wordById.get(r.word_id);
    if (w) result.push(w);
  });
  return result;
}

export function missionize(words: Word[], size = MISSION_SIZE): Word[][] {
  const out: Word[][] = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size));
  return out;
}

export type StudyProgress = { current_mission: number; mission_size: number };

export async function getProgress(studentId: string): Promise<StudyProgress> {
  const { data } = await supabase
    .from("study_progress")
    .select("current_mission,mission_size")
    .eq("student_id", studentId)
    .maybeSingle();
  if (data) return data;
  await supabase.from("study_progress").insert({ student_id: studentId });
  return { current_mission: 1, mission_size: MISSION_SIZE };
}

export async function setCurrentMission(studentId: string, mission: number) {
  await supabase
    .from("study_progress")
    .upsert(
      { student_id: studentId, current_mission: mission, updated_at: new Date().toISOString() },
      { onConflict: "student_id" },
    );
}

/** Build a 10-question quiz for mission index N (1-based). Mission 1 → all current; else 7 current + 3 previous. */
export function buildMissionQuiz(missions: Word[][], missionIndex: number): Word[] {
  const i = missionIndex - 1;
  const current = missions[i] ?? [];
  const usableCurrent = current.filter((w) => w.example_sentence);
  if (missionIndex <= 1 || i - 1 < 0) {
    return shuffle(usableCurrent).slice(0, MISSION_SIZE);
  }
  const prev = (missions[i - 1] ?? []).filter((w) => w.example_sentence);
  const fromCurrent = shuffle(usableCurrent).slice(0, 7);
  const fromPrev = shuffle(prev).slice(0, 3);
  let combined = [...fromCurrent, ...fromPrev];
  // Top up if too short
  if (combined.length < MISSION_SIZE) {
    const seen = new Set(combined.map((w) => w.id));
    const extras = [...usableCurrent, ...prev].filter((w) => !seen.has(w.id));
    combined = combined.concat(shuffle(extras).slice(0, MISSION_SIZE - combined.length));
  }
  return shuffle(combined);
}

/** Periodic quiz: words touched in last `days` days, weighted toward low mastery. */
export async function buildPeriodicQuiz(studentId: string, days: number): Promise<Word[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: statuses } = await supabase
    .from("word_status")
    .select("word_id,mastery,updated_at")
    .eq("student_id", studentId)
    .gte("updated_at", since);
  if (!statuses || statuses.length === 0) return [];
  const allWords = await fetchActiveWords();
  const wordById = new Map(allWords.map((w) => [w.id, w] as const));
  // Sort: mastery 0 first, then 1, 2, 3 (weakest first).
  const sorted = [...statuses].sort((a, b) => a.mastery - b.mastery);
  const picked: Word[] = [];
  for (const s of sorted) {
    const w = wordById.get(s.word_id);
    if (w && w.example_sentence) picked.push(w);
    if (picked.length >= MISSION_SIZE) break;
  }
  return shuffle(picked);
}

export async function recordAttempt(
  studentId: string,
  kind: "mission" | "weekly" | "monthly",
  score: number,
  total: number,
  missionIndex: number | null,
) {
  await supabase.from("mission_attempts").insert({
    student_id: studentId,
    kind,
    score,
    total,
    mission_index: missionIndex,
  });
}