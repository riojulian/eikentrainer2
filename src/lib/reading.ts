import { supabase } from "@/integrations/supabase/client";

export type ReadingQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correct_choice_index: number;
  explanation: string | null;
  subskill_ids: string[];
  difficulty_rating: number;
};

export type Subskill = {
  id: string;
  key: string;
  label_en: string;
  label_ja: string;
};

/** Fetch all active questions for a section code (e.g. eiken_pre1_d1). */
export async function fetchSectionQuestions(sectionCode: string): Promise<ReadingQuestion[]> {
  const { data: section, error: sErr } = await supabase
    .from("exam_sections")
    .select("id")
    .eq("code", sectionCode)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!section) return [];

  const { data, error } = await supabase
    .from("questions")
    .select("id,prompt,choices,correct_choice_index,explanation,subskill_ids,difficulty_rating")
    .eq("exam_section_id", section.id)
    .eq("status", "active")
    .order("difficulty_rating", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((q) => ({
    id: q.id,
    prompt: q.prompt,
    choices: (q.choices as unknown as string[]) ?? [],
    correct_choice_index: q.correct_choice_index,
    explanation: q.explanation,
    subskill_ids: q.subskill_ids ?? [],
    difficulty_rating: q.difficulty_rating,
  }));
}

export async function fetchSubskills(sectionCode: string): Promise<Subskill[]> {
  const { data: section } = await supabase
    .from("exam_sections")
    .select("id")
    .eq("code", sectionCode)
    .maybeSingle();
  if (!section) return [];
  const { data, error } = await supabase
    .from("subskills")
    .select("id,key,label_en,label_ja")
    .eq("exam_section_id", section.id)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Subskill[];
}

export async function startSession(userId: string, moduleType: string, questionIds: string[]) {
  const { data, error } = await supabase
    .from("user_sessions")
    .insert({ user_id: userId, module_type: moduleType, questions_served: questionIds })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function endSession(sessionId: string) {
  await supabase.from("user_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId);
}

/** Record one answer and roll the per-subskill accuracy forward. */
export async function recordAnswer(opts: {
  userId: string;
  sessionId: string | null;
  question: ReadingQuestion;
  selectedIndex: number;
  isCorrect: boolean;
  tappedSentenceId?: string | null;
  evidenceOutcome?: string | null;
}) {
  const { userId, sessionId, question, selectedIndex, isCorrect } = opts;
  await supabase.from("user_answers").insert({
    user_id: userId,
    user_session_id: sessionId,
    question_id: question.id,
    selected_choice_index: selectedIndex,
    is_correct: isCorrect,
    tapped_sentence_id: opts.tappedSentenceId ?? null,
    evidence_outcome: opts.evidenceOutcome ?? null,
  });

  if (question.subskill_ids.length === 0) return;
  const { data: existing } = await supabase
    .from("user_subskill_stats")
    .select("subskill_id,attempts,correct,rolling_accuracy")
    .eq("user_id", userId)
    .in("subskill_id", question.subskill_ids);
  const byId = new Map((existing ?? []).map((r) => [r.subskill_id, r]));

  const rows = question.subskill_ids.map((sid) => {
    const prev = byId.get(sid);
    const attempts = (prev?.attempts ?? 0) + 1;
    const correct = (prev?.correct ?? 0) + (isCorrect ? 1 : 0);
    // exponential rolling accuracy so recent answers matter more
    const prevRoll = prev?.rolling_accuracy ?? (isCorrect ? 1 : 0);
    const rolling = prev ? Number(prevRoll) * 0.7 + (isCorrect ? 1 : 0) * 0.3 : isCorrect ? 1 : 0;
    return {
      user_id: userId,
      subskill_id: sid,
      attempts,
      correct,
      rolling_accuracy: Math.round(rolling * 1000) / 1000,
      last_practiced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  await supabase.from("user_subskill_stats").upsert(rows, { onConflict: "user_id,subskill_id" });
}

export async function fetchMySubskillStats(userId: string) {
  const { data, error } = await supabase
    .from("user_subskill_stats")
    .select("subskill_id,attempts,correct,rolling_accuracy")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}
