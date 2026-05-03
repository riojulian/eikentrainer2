import { supabase } from "@/integrations/supabase/client";
import { fetchActiveWords, type Word } from "@/lib/words";

export const STAGE_SIZE = 10;
const TIER_ORDER = ["tier1", "tier2", "tier3", "tier4", "phrases"] as const;

function orderKeysWithStart(startTier?: string | null): string[] {
  const base = [...TIER_ORDER, "_null"];
  if (!startTier) return base;
  const idx = base.indexOf(startTier);
  if (idx <= 0) return base;
  return [...base.slice(idx), ...base.slice(0, idx)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wipe and rebuild the per-student word order. Used when starting tier changes. */
export async function rebuildWordOrder(studentId: string, startTier?: string | null): Promise<Word[]> {
  await supabase.from("student_word_order").delete().eq("student_id", studentId);
  return ensureWordOrder(studentId, startTier);
}

export async function ensureWordOrder(studentId: string, startTier?: string | null): Promise<Word[]> {
  const [allWords, { data: existing }] = await Promise.all([
    fetchActiveWords(),
    supabase.from("student_word_order").select("word_id,position").eq("student_id", studentId),
  ]);
  const wordById = new Map(allWords.map((w) => [w.id, w] as const));
  const existingMap = new Map((existing ?? []).map((r) => [r.word_id, r.position] as const));

  const missingIds = allWords.map((w) => w.id).filter((id) => !existingMap.has(id));
  if (missingIds.length > 0) {
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

export function stagize(words: Word[], size = STAGE_SIZE): Word[][] {
  const out: Word[][] = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size));
  return out;
}

export type StudyProgress = { current_stage: number; stage_size: number };

export async function getProgress(studentId: string): Promise<StudyProgress> {
  const { data } = await supabase
    .from("study_progress")
    .select("current_stage,stage_size")
    .eq("student_id", studentId)
    .maybeSingle();
  if (data) return data as StudyProgress;
  await supabase.from("study_progress").insert({ student_id: studentId } as never);
  return { current_stage: 1, stage_size: STAGE_SIZE };
}

export async function setCurrentStage(studentId: string, stage: number) {
  await supabase
    .from("study_progress")
    .upsert(
      { student_id: studentId, current_stage: stage, updated_at: new Date().toISOString() } as never,
      { onConflict: "student_id" },
    );
}

/** Build a 10-question quiz for stage index N (1-based). Stage 1 → all current; else 7 current + 3 previous. */
export function buildStageQuiz(stages: Word[][], stageIndex: number): Word[] {
  const i = stageIndex - 1;
  const current = stages[i] ?? [];
  const usableCurrent = current.filter((w) => w.example_sentence);
  if (stageIndex <= 1 || i - 1 < 0) {
    return shuffle(usableCurrent).slice(0, STAGE_SIZE);
  }
  const prev = (stages[i - 1] ?? []).filter((w) => w.example_sentence);
  const fromCurrent = shuffle(usableCurrent).slice(0, 7);
  const fromPrev = shuffle(prev).slice(0, 3);
  let combined = [...fromCurrent, ...fromPrev];
  if (combined.length < STAGE_SIZE) {
    const seen = new Set(combined.map((w) => w.id));
    const extras = [...usableCurrent, ...prev].filter((w) => !seen.has(w.id));
    combined = combined.concat(shuffle(extras).slice(0, STAGE_SIZE - combined.length));
  }
  return shuffle(combined);
}

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
  const sorted = [...statuses].sort((a, b) => a.mastery - b.mastery);
  const picked: Word[] = [];
  for (const s of sorted) {
    const w = wordById.get(s.word_id);
    if (w && w.example_sentence) picked.push(w);
    if (picked.length >= STAGE_SIZE) break;
  }
  return shuffle(picked);
}

export async function recordAttempt(
  studentId: string,
  kind: "stage" | "weekly" | "monthly",
  score: number,
  total: number,
  stageIndex: number | null,
) {
  await supabase.from("stage_attempts").insert({
    student_id: studentId,
    kind,
    score,
    total,
    stage_index: stageIndex,
  } as never);
}

/** Stars 0–3 from a quiz score (10-question). Soft thresholds: 50/70/90%. */
export function starsForScore(score: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const pct = score / total;
  if (pct >= 0.9) return 3;
  if (pct >= 0.7) return 2;
  if (pct >= 0.5) return 1;
  return 0;
}

/** Best score per stage_index from stage_attempts.kind='stage'. Returns map index→stars. */
export async function getStarsByStage(studentId: string): Promise<Record<number, 0 | 1 | 2 | 3>> {
  const { data } = await supabase
    .from("stage_attempts")
    .select("stage_index,score,total,kind")
    .eq("student_id", studentId)
    .eq("kind", "stage");
  const out: Record<number, 0 | 1 | 2 | 3> = {};
  (data ?? []).forEach((r) => {
    if (r.stage_index == null) return;
    const s = starsForScore(r.score, r.total);
    if (s > (out[r.stage_index] ?? 0)) out[r.stage_index] = s;
  });
  return out;
}