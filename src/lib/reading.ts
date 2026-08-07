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

/** Shuffle choices so the correct answer isn't always first; remaps the answer index. */
function shuffleChoices<T extends { choices: string[]; correct_choice_index: number }>(q: T): T {
  const idx = q.choices.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i]!, idx[j]!] = [idx[j]!, idx[i]!];
  }
  return {
    ...q,
    choices: idx.map((i) => q.choices[i]!),
    correct_choice_index: idx.indexOf(q.correct_choice_index),
  };
}

export type PassageSentence = {
  id: string;
  sentence_index: number;
  label: string | null;
  text: string;
};

export type PassageQuestion = ReadingQuestion & {
  blank_number: number | null;
  evidence_sentence_ids: string[];
};

export type ReadingPassage = {
  id: string;
  title: string;
  body_text: string;
  topic_tag: string | null;
  word_count: number | null;
  difficulty_rating: number;
  sentences: PassageSentence[];
  questions: PassageQuestion[];
};

/** Fetch active passages (with sentences + questions) for a section code. */
export async function fetchSectionPassages(sectionCode: string): Promise<ReadingPassage[]> {
  const { data: section, error: sErr } = await supabase
    .from("exam_sections")
    .select("id")
    .eq("code", sectionCode)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!section) return [];

  const { data: passages, error: pErr } = await supabase
    .from("passages")
    .select("id,title,body_text,topic_tag,word_count,difficulty_rating")
    .eq("exam_section_id", section.id)
    .eq("status", "active")
    .order("difficulty_rating", { ascending: true });
  if (pErr) throw pErr;
  const ids = (passages ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const [{ data: sentences }, { data: questions }] = await Promise.all([
    supabase
      .from("passage_sentences")
      .select("id,passage_id,sentence_index,label,text")
      .in("passage_id", ids)
      .order("sentence_index", { ascending: true }),
    supabase
      .from("questions")
      .select(
        "id,passage_id,prompt,choices,correct_choice_index,explanation,subskill_ids,difficulty_rating,blank_number,evidence_sentence_ids",
      )
      .in("passage_id", ids)
      .eq("status", "active"),
  ]);

  return (passages ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    body_text: p.body_text,
    topic_tag: p.topic_tag,
    word_count: p.word_count,
    difficulty_rating: p.difficulty_rating,
    sentences: (sentences ?? [])
      .filter((s) => s.passage_id === p.id)
      .map((s) => ({ id: s.id, sentence_index: s.sentence_index, label: s.label, text: s.text })),
    questions: (questions ?? [])
      .filter((q) => q.passage_id === p.id)
      .map((q) => shuffleChoices({
        id: q.id,
        prompt: q.prompt,
        choices: (q.choices as unknown as string[]) ?? [],
        correct_choice_index: q.correct_choice_index,
        explanation: q.explanation,
        subskill_ids: q.subskill_ids ?? [],
        difficulty_rating: q.difficulty_rating,
        blank_number: q.blank_number,
        evidence_sentence_ids: q.evidence_sentence_ids ?? [],
      }))
      .sort((a, b) => (a.blank_number ?? 0) - (b.blank_number ?? 0)),
  }));
}

/** Fetch all active questions for a section code (e.g. eiken_pre1_d1). */
export async function fetchSectionQuestions(sectionCode: string): Promise<ReadingQuestion[]> {
  return fetchSectionQuestionsImpl(sectionCode);
}

/** Pick one random active passage for a section, with at most `maxQuestions` questions. */
export async function fetchRandomSectionPassage(
  sectionCode: string,
  opts?: { excludeId?: string | null; maxQuestions?: number },
): Promise<ReadingPassage | null> {
  const max = opts?.maxQuestions ?? 4;
  const all = await fetchSectionPassages(sectionCode);
  const withQs = all.filter((p) => p.questions.length > 0);
  if (withQs.length === 0) return null;
  const pool = withQs.length > 1 && opts?.excludeId
    ? withQs.filter((p) => p.id !== opts.excludeId)
    : withQs;
  const picked = pool[Math.floor(Math.random() * pool.length)]!;
  const qs = [...picked.questions];
  for (let i = qs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [qs[i]!, qs[j]!] = [qs[j]!, qs[i]!];
  }
  return { ...picked, questions: qs.slice(0, max) };
}

async function fetchSectionQuestionsImpl(sectionCode: string): Promise<ReadingQuestion[]> {
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

  return (data ?? []).map((q) => shuffleChoices({
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
