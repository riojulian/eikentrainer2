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
};

export type WordStatus = "known" | "review" | null;

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
    .select("word_id,status")
    .eq("student_id", studentId);
  if (error) throw error;
  const map: Record<string, WordStatus> = {};
  data?.forEach((r) => { map[r.word_id] = r.status as WordStatus; });
  return map;
}

export async function setStatus(studentId: string, wordId: string, status: WordStatus) {
  if (status === null) {
    await supabase.from("word_status").delete().eq("student_id", studentId).eq("word_id", wordId);
    return;
  }
  await supabase.from("word_status").upsert(
    { student_id: studentId, word_id: wordId, status, updated_at: new Date().toISOString() },
    { onConflict: "word_id,student_id" }
  );
}