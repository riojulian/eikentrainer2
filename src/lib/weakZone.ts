import { supabase } from "@/integrations/supabase/client";
import { fetchActiveWords, type Word } from "@/lib/words";

/**
 * A word is "weak" if, looking at its most recent quiz_results rows,
 * the user has NOT yet hit 2 correct in a row since the latest wrong.
 * Returns the words in order of most-recently-wrong first.
 */
export async function getWeakWords(studentId: string): Promise<Word[]> {
  const { data } = await supabase
    .from("quiz_results")
    .select("word_id,correct,taken_at")
    .eq("student_id", studentId)
    .order("taken_at", { ascending: false })
    .limit(500);

  const rows = data ?? [];
  // Walk newest -> oldest. Per word, count consecutive corrects from the top.
  // If we hit a wrong before 2 corrects accumulated, the word is weak.
  const state = new Map<string, { corrects: number; weak: boolean | null; lastWrongAt: string }>();
  for (const r of rows) {
    const s = state.get(r.word_id);
    if (s?.weak !== null && s?.weak !== undefined) continue;
    if (r.correct) {
      const corrects = (s?.corrects ?? 0) + 1;
      if (corrects >= 2) {
        state.set(r.word_id, { corrects, weak: false, lastWrongAt: s?.lastWrongAt ?? "" });
      } else {
        state.set(r.word_id, { corrects, weak: null, lastWrongAt: s?.lastWrongAt ?? "" });
      }
    } else {
      state.set(r.word_id, { corrects: 0, weak: true, lastWrongAt: r.taken_at });
    }
  }

  const weakIds = [...state.entries()]
    .filter(([, s]) => s.weak === true)
    .sort((a, b) => (a[1].lastWrongAt < b[1].lastWrongAt ? 1 : -1))
    .map(([id]) => id);

  if (weakIds.length === 0) return [];
  const all = await fetchActiveWords();
  const byId = new Map(all.map((w) => [w.id, w] as const));
  return weakIds.map((id) => byId.get(id)).filter((w): w is Word => Boolean(w));
}