import { supabase } from "@/integrations/supabase/client";
import { fetchActiveWords, type Word } from "@/lib/words";

export const STAGE_SIZE = 10;
export const WORLD_ORDER = ["tier1", "tier2", "tier3", "tier4", "phrases"] as const;
export type World = (typeof WORLD_ORDER)[number];
export const DEFAULT_WORLD: World = "tier1";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Group active words by world, in fixed WORLD_ORDER. */
export function groupByWorld(words: Word[]): Record<string, Word[]> {
  const out: Record<string, Word[]> = {};
  for (const w of WORLD_ORDER) out[w] = [];
  for (const w of words) {
    const k = (w.tier ?? "") as string;
    if (k in out) out[k].push(w);
  }
  return out;
}

/** Ensure ordering rows exist for a single world. Returns the ordered word list for that world. */
export async function ensureWorldOrder(studentId: string, world: string): Promise<Word[]> {
  const allWords = await fetchActiveWords();
  const worldWords = allWords.filter((w) => (w.tier ?? "") === world);
  const wordById = new Map(worldWords.map((w) => [w.id, w] as const));

  const { data: existing } = await supabase
    .from("student_word_order")
    .select("word_id,position")
    .eq("student_id", studentId)
    .eq("world", world)
    .order("position", { ascending: true });

  const existingMap = new Map((existing ?? []).map((r) => [r.word_id, r.position] as const));
  const missingIds = worldWords.map((w) => w.id).filter((id) => !existingMap.has(id));

  if (missingIds.length > 0) {
    let nextPos = existing && existing.length > 0
      ? Math.max(...existing.map((r) => r.position)) + 1
      : 0;
    const rows = shuffle(missingIds).map((id) => ({
      student_id: studentId,
      word_id: id,
      position: nextPos++,
      world,
    }));
    if (rows.length > 0) {
      await supabase.from("student_word_order").insert(rows);
    }
  } else {
    const result: Word[] = [];
    (existing ?? []).forEach((r) => {
      const w = wordById.get(r.word_id);
      if (w) result.push(w);
    });
    for (const w of worldWords) if (!result.find((x) => x.id === w.id)) result.push(w);
    return result;
  }

  const { data: ordered } = await supabase
    .from("student_word_order")
    .select("word_id,position")
    .eq("student_id", studentId)
    .eq("world", world)
    .order("position", { ascending: true });

  const result: Word[] = [];
  (ordered ?? []).forEach((r) => {
    const w = wordById.get(r.word_id);
    if (w) result.push(w);
  });
  // Append any unsynced (e.g., race) words deterministically
  for (const w of worldWords) if (!result.find((x) => x.id === w.id)) result.push(w);
  return result;
}

/** Rebuild ordering for a single world (wipe and reseed). */
export async function rebuildWorldOrder(studentId: string, world: string): Promise<Word[]> {
  await supabase
    .from("student_word_order")
    .delete()
    .eq("student_id", studentId)
    .eq("world", world);
  return ensureWorldOrder(studentId, world);
}

export function stagize(words: Word[], size = STAGE_SIZE): Word[][] {
  const out: Word[][] = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size));
  return out;
}

/** Counts of stages per world, derived from active words. */
export async function getWorldStageCounts(): Promise<Record<string, number>> {
  const all = await fetchActiveWords();
  const grouped = groupByWorld(all);
  const out: Record<string, number> = {};
  for (const w of WORLD_ORDER) out[w] = Math.ceil(grouped[w].length / STAGE_SIZE);
  return out;
}

/** Read currently selected world for the student (defaults to first world that has stages). */
export async function getCurrentWorld(studentId: string): Promise<string> {
  const { data } = await supabase
    .from("study_progress")
    .select("current_world")
    .eq("student_id", studentId)
    .maybeSingle();
  if (data?.current_world) return data.current_world;
  await supabase
    .from("study_progress")
    .upsert(
      { student_id: studentId, current_world: DEFAULT_WORLD, updated_at: new Date().toISOString() } as never,
      { onConflict: "student_id" },
    );
  return DEFAULT_WORLD;
}

export async function setCurrentWorld(studentId: string, world: string) {
  await supabase
    .from("study_progress")
    .upsert(
      { student_id: studentId, current_world: world, updated_at: new Date().toISOString() } as never,
      { onConflict: "student_id" },
    );
}

/** Per-world current stage. */
export async function getWorldStage(studentId: string, world: string): Promise<number> {
  const { data } = await supabase
    .from("world_progress")
    .select("current_stage")
    .eq("student_id", studentId)
    .eq("world", world)
    .maybeSingle();
  if (data) return data.current_stage;
  await supabase
    .from("world_progress")
    .insert({ student_id: studentId, world, current_stage: 1 } as never);
  return 1;
}

export async function setWorldStage(studentId: string, world: string, stage: number) {
  await supabase
    .from("world_progress")
    .upsert(
      { student_id: studentId, world, current_stage: stage, updated_at: new Date().toISOString() } as never,
      { onConflict: "student_id,world" },
    );
}

/** Build a 10-question quiz for stage index N (1-based) within a world. */
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
  world: string | null,
) {
  await supabase.from("stage_attempts").insert({
    student_id: studentId,
    kind,
    score,
    total,
    stage_index: stageIndex,
    world,
  } as never);
}

/** Stars 0–3. Soft thresholds: 50/70/90%. */
export function starsForScore(score: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const pct = score / total;
  if (pct >= 0.9) return 3;
  if (pct >= 0.7) return 2;
  if (pct >= 0.5) return 1;
  return 0;
}

/** Best stars per stage_index, scoped to a world. */
export async function getStarsByStage(studentId: string, world?: string): Promise<Record<number, 0 | 1 | 2 | 3>> {
  let q = supabase
    .from("stage_attempts")
    .select("stage_index,score,total,kind,world")
    .eq("student_id", studentId)
    .eq("kind", "stage");
  if (world) q = q.eq("world", world);
  const { data } = await q;
  const out: Record<number, 0 | 1 | 2 | 3> = {};
  (data ?? []).forEach((r) => {
    if (r.stage_index == null) return;
    const s = starsForScore(r.score, r.total);
    if (s > (out[r.stage_index] ?? 0)) out[r.stage_index] = s;
  });
  return out;
}

export async function getAllStarsByWorld(studentId: string): Promise<Record<string, Record<number, 0 | 1 | 2 | 3>>> {
  const { data } = await supabase
    .from("stage_attempts")
    .select("stage_index,score,total,world")
    .eq("student_id", studentId)
    .eq("kind", "stage");
  const out: Record<string, Record<number, 0 | 1 | 2 | 3>> = {};
  (data ?? []).forEach((r) => {
    if (r.stage_index == null || !r.world) return;
    if (!out[r.world]) out[r.world] = {};
    const s = starsForScore(r.score, r.total);
    if (s > (out[r.world][r.stage_index] ?? 0)) out[r.world][r.stage_index] = s;
  });
  return out;
}
