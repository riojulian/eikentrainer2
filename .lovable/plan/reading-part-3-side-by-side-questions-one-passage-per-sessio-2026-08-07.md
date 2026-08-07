# Reading Part 3: side-by-side questions, one passage per session

## What changes for the student

Today Part 3 loads every passage in the bank (6 passages, 16 questions) as one long
queue, and the question sits far below the passage so you have to scroll back and
forth to answer.

After this change:

- One randomly chosen passage per practice session, with 4 questions — the same
  shape as the longer block of the real Eiken Pre-1 Part 3.
- On desktop the passage sits on the left and the question panel is pinned on the
  right, so both are visible at once. Tapping a sentence for evidence never scrolls
  the question out of view.
- On phones the passage fills the screen and the question becomes a sticky card at
  the bottom that can be expanded to full height and collapsed back to peek at the
  passage.
- Progress reads "Question 2 of 4" for the current passage; finishing shows results
  with a "Try another passage" button that pulls a different passage.

```text
desktop                              mobile
+------------------+-------------+   +---------------------+
| passage          | Q 2 of 4    |   | passage (scrolls)   |
| (scrolls in its  | prompt      |   |                     |
|  own column)     | [ choice ]  |   +---------------------+
|                  | [ choice ]  |   | Q2/4  prompt    [^] | <- sticky
|                  | [ choice ]  |   | [ choice ] [choice] |
+------------------+-------------+   +---------------------+
```

## Content

Passages currently carry 2-3 questions each, so a 4-question session needs one more
question on most of them. Add questions so every active Part 3 passage has exactly 4,
each with its evidence sentences mapped, in the same style and difficulty as the
existing ones.

## Technical notes

- `src/lib/reading.ts`: add a helper that returns a single passage (random pick among
  active ones) rather than the whole list; keep `fetchSectionPassages` for other
  callers. Cap questions served at 4.
- `src/routes/study.reading3.tsx`: replace the single-column stack with a
  `lg:grid-cols-[1.2fr_1fr]` layout. Passage column gets its own scroll container with
  `lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto`; the question
  panel is `lg:sticky lg:top-20`. Below `lg`, the question panel renders as a fixed
  bottom sheet (`fixed inset-x-0 bottom-0`) with a collapse/expand toggle and safe-area
  padding; the passage gets bottom padding so the sheet never covers the last lines.
- Drop the multi-passage index state (`pIdx`); keep per-question state, scoring,
  evidence outcome tracking, and `startSession`/`recordAnswer` unchanged. Session
  question ids come from the single passage.
- Restart re-picks a passage instead of resetting to index 0.
- One migration inserting the additional questions with `evidence_sentence_ids`
  referencing existing `passage_sentences` rows.
