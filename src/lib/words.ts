import { supabase } from "@/integrations/supabase/client";

export type Word = {
  id: string;
  word: string;
  part_of_speech: string | null;
  definition: string;
  definition_ja: string | null;
  example_sentence: string | null;
  category: string | null;
  is_active: boolean;
  tier?: string | null;
};

/** Display labels for tier values (DB stays as `tier1`..`phrases`, UI shows "World N"). */
export const TIER_LABELS: Record<string, string> = {
  tier1: "World 1: Core",
  tier2: "World 2: Topic Specific",
  tier3: "World 3: Reading/Listening",
  tier4: "World 4: Very Specific",
  phrases: "World 5: Phrases",
};

export const TIER_SHORT: Record<string, string> = {
  tier1: "World 1",
  tier2: "World 2",
  tier3: "World 3",
  tier4: "World 4",
  phrases: "World 5",
};

export type Mastery = 0 | 1 | 2 | 3;
export type MasteryOrUnseen = Mastery | null;

export const MASTERY_LABELS: Record<Mastery, string> = {
  0: "勉強中",
  1: "分かり始めた",
  2: "分かった",
  3: "完全に習得",
};

// Tailwind classes referencing existing tokens
export const MASTERY_BG: Record<Mastery, string> = {
  0: "bg-rose",
  1: "bg-gold/50",
  2: "bg-sage",
  3: "bg-gold",
};
export const MASTERY_TEXT: Record<Mastery, string> = {
  0: "text-rose",
  1: "text-gold",
  2: "text-sage",
  3: "text-gold",
};
export const MASTERY_BORDER: Record<Mastery, string> = {
  0: "border-l-rose",
  1: "border-l-gold/60",
  2: "border-l-sage",
  3: "border-l-gold",
};

export async function fetchActiveWords() {
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Word[];
}

export async function fetchStatuses(studentId: string) {
  const { data, error } = await supabase
    .from("word_status")
    .select("word_id,mastery")
    .eq("student_id", studentId);
  if (error) throw error;
  const map: Record<string, MasteryOrUnseen> = {};
  data?.forEach((r) => { map[r.word_id] = r.mastery as Mastery; });
  return map;
}

const clamp = (n: number): Mastery => Math.max(0, Math.min(3, n)) as Mastery;

export async function setMastery(studentId: string, wordId: string, mastery: MasteryOrUnseen) {
  if (mastery === null) {
    await supabase.from("word_status").delete().eq("student_id", studentId).eq("word_id", wordId);
    return;
  }
  await supabase.from("word_status").upsert(
    { student_id: studentId, word_id: wordId, mastery, updated_at: new Date().toISOString() },
    { onConflict: "word_id,student_id" }
  );
}

export async function bumpMastery(
  studentId: string,
  wordId: string,
  current: MasteryOrUnseen,
  delta: number,
): Promise<Mastery> {
  const base = current ?? 0;
  const next = clamp(base + delta);
  await setMastery(studentId, wordId, next);
  return next;
}

/** Apply a single quiz outcome and return the new tier. */
export async function applyQuizResult(
  studentId: string,
  wordId: string,
  current: MasteryOrUnseen,
  correct: boolean,
): Promise<Mastery> {
  let next: Mastery;
  if (correct) {
    next = clamp((current ?? 0) + 1);
  } else {
    // Don't nuke a mastered word from one mistake — drop to 1.
    if (current === 3) next = 1;
    else next = clamp((current ?? 0) - 1);
  }
  await setMastery(studentId, wordId, next);
  return next;
}
