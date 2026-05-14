## Goal

Make quiz answer choices less obvious by drawing distractors from words the student has actually encountered, and matching the answer's "shape" (phrase vs. single word, part of speech).

No DB changes. No effect on already-studied word mastery — only the distractor selection in quizzes going forward changes.

## Where the change lives

All logic stays in `src/routes/study.quiz.tsx` inside `buildQuizQuestions(pool, allWords)`. Signature gains a `statuses` arg so it can prefer "seen" words:

```ts
buildQuizQuestions(pool, allWords, statuses, world)
```

Call sites already have `statuses` and `activeWorld` in scope.

## Distractor selection rules (in priority order)

For each answer word `w`, pick 3 distractors from a candidate pool filtered like this:

1. **Same shape as the answer**
   - If `w.tier === "phrases"` (or `w.word` contains a space): only consider other phrases.
   - Else: only consider single-word entries.
   - This guarantees a phrase question shows 4 phrases, a word question shows 4 words.

2. **Same part of speech when available**
   - Prefer candidates with `part_of_speech === w.part_of_speech`.
   - Fall back to any POS if too few matches (<3).

3. **Same world / category preferred**
   - Prefer candidates with `tier === w.tier` (e.g. tier1 distractors for a tier1 answer).
   - Fall back to other tiers if needed.

4. **Prefer words the student has seen**
   - Build tiers of candidates:
     - **Tier A:** words present in `statuses` (any mastery 0–3) — "learned in this stage or in the past".
     - **Tier B:** other active words in the same category.
     - **Tier C:** anything else active (last resort).
   - Fill the 3 distractor slots from Tier A first, then B, then C.

5. **De-noise**
   - Exclude `w.id` itself.
   - Exclude any candidate whose `word` equals `w.word` (case-insensitive) — guards against duplicate entries.
   - Optional: prefer candidates with similar word length (within ±40% of answer length) to avoid the "obviously the longest one" tell. Apply only inside Tier A/B; skip if it leaves <3 candidates.

6. **Shuffle and slice 3**, then shuffle the final 4 options.

## Pseudocode

```ts
function pickDistractors(w, allWords, statuses) {
  const isPhrase = w.tier === "phrases" || /\s/.test(w.word);
  const shapeOk = (x) => (/\s/.test(x.word) || x.tier === "phrases") === isPhrase;

  const base = allWords.filter(x =>
    x.id !== w.id &&
    x.word.toLowerCase() !== w.word.toLowerCase() &&
    shapeOk(x)
  );

  const samePos = base.filter(x => w.part_of_speech && x.part_of_speech === w.part_of_speech);
  const sameTier = (pool) => pool.filter(x => x.tier === w.tier);

  const seenIds = new Set(Object.keys(statuses));
  const tierA = sameTier(samePos).filter(x => seenIds.has(x.id));
  const tierB = sameTier(samePos).filter(x => !seenIds.has(x.id));
  const tierC = sameTier(base);
  const tierD = base;

  const picked = [];
  for (const tier of [tierA, tierB, tierC, tierD]) {
    if (picked.length >= 3) break;
    for (const cand of shuffle(tier)) {
      if (picked.length >= 3) break;
      if (!picked.some(p => p.id === cand.id)) picked.push(cand);
    }
  }
  return picked.slice(0, 3).map(x => x.word);
}
```

## What does NOT change

- `word_status`, `world_progress`, `student_word_order` — untouched. Existing studied words keep their mastery.
- Stage building (`buildStageQuiz`) and which words appear as questions — unchanged.
- Weekly / monthly / weakness modes get the same improved distractors automatically since they share `buildQuizQuestions`.

## Other ideas worth considering (not in this plan unless you want them)

- **Confusable-pair list**: maintain a small admin-curated list of "easily confused" words (e.g. *affect/effect*, *adapt/adopt*) and inject one when applicable.
- **POS-fit distractors for cloze**: since the question is a fill-in-the-blank sentence, requiring same POS makes all options grammatically plausible, which is the single biggest difficulty boost.
- **Mastery-weighted distractors**: prefer Tier A candidates the student already mastered (mastery ≥ 2), so the wrong options are familiar-but-wrong rather than unknown.
- **Anti-repeat**: avoid showing the same distractor twice in one quiz session.

Tell me which extras (if any) to fold in and I'll add them to the implementation step.
