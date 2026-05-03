## Goal

Replace the English mastery tier labels with Japanese across the app. The 4-tier scale and underlying numeric values (0–3) stay the same — only the display strings change.

## Proposed labels


| Tier | English (current)    | Japanese (new) | Notes                                                                                                          |
| ---- | -------------------- | -------------- | -------------------------------------------------------------------------------------------------------------- |
| 0    | Still learning       | 勉強中            | "Studying" — short, fits the small pill                                                                        |
| 1    | Understanding better | 分かり始めた         | "Sort of get it" — slightly tightened from まぁまぁわかった for present-tense consistency, kanji 分 to match the others |
| 2    | I know it            | 分かった           | "Got it"                                                                                                       |
| 3    | Mastered             | 完全に習得          | 完全に分かった                                                                                                        |


## Where the strings live

A single source: `MASTERY_LABELS` in `src/lib/words.ts`. Every screen (dashboard, word list, quiz summary, flashcards, admin progress) reads from this map, so updating it once propagates everywhere — no per-screen edits needed.

```ts
// src/lib/words.ts
export const MASTERY_LABELS: Record<Mastery, string> = {
  0: "勉強中",
  1: "分かり始めた",
  2: "分かった",
  3: "完全に習得",
};
```

## Out of scope

- Translating the rest of the UI (buttons, headers, filter dropdown placeholder, etc.). The mastery filter dropdown items will become Japanese automatically because they also read from `MASTERY_LABELS`, but surrounding labels like "Mastery level", "All mastery levels", "Unseen" stay English unless you ask.
- Changing colors, ordering, or quiz logic.

Confirm the tier-1 wording (まぁまぁ分かる vs. まぁまぁわかった) and whether to shorten tier 3, and I'll apply the change.