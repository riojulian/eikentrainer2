import { supabase } from "@/integrations/supabase/client";

export type Word = {
  id: string;
  word: string;
  part_of_speech: string | null;
  definition: string;
  definition_ja: string | null;
  example_sentence: string | null;
  alt_example_sentence?: string | null;
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

let _wordsCache: Promise<Word[]> | null = null;

export function fetchActiveWords(): Promise<Word[]> {
  if (!_wordsCache) {
    _wordsCache = (async () => {
      const PAGE = 1000;
      const all: Word[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await supabase
          .from("words")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (error) {
          _wordsCache = null; // allow retry on error
          throw error;
        }
        const rows = (data ?? []) as Word[];
        all.push(...rows);
        if (rows.length < PAGE) break;
      }
      return all;
    })();
  }
  return _wordsCache;
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

/**
 * Apply a single quiz outcome and return the new tier.
 * - first-try correct → +1 (real learning signal)
 * - recovery correct (firstTry=false) → no change (clears wrong streak, no inflation)
 * - wrong → −1, with the 3 → 1 exception so one slip doesn't nuke a mastered word
 */
export async function applyQuizResult(
  studentId: string,
  wordId: string,
  current: MasteryOrUnseen,
  correct: boolean,
  firstTry: boolean = true,
): Promise<Mastery> {
  let next: Mastery;
  if (correct) {
    next = firstTry ? clamp((current ?? 0) + 1) : ((current ?? 0) as Mastery);
  } else {
    if (current === 3) next = 1;
    else next = clamp((current ?? 0) - 1);
  }
  await setMastery(studentId, wordId, next);
  return next;
}
