import { supabase } from "@/integrations/supabase/client";
import { fetchActiveWords, type Word } from "@/lib/words";

/**
 * Weak Zone = every seen word at mastery 0 (勉強中) or 1 (分かり始めた).
 * Ordered by most recently updated first (most recent struggle on top).
 */
export async function getWeakWords(studentId: string): Promise<Word[]> {
  const { data } = await supabase
    .from("word_status")
    .select("word_id,mastery,updated_at")
    .eq("student_id", studentId)
    .lte("mastery", 1)
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows = data ?? [];
  if (rows.length === 0) return [];
  const all = await fetchActiveWords();
  const byId = new Map(all.map((w) => [w.id, w] as const));
  return rows
    .map((r) => byId.get(r.word_id))
    .filter((w): w is Word => Boolean(w));
}