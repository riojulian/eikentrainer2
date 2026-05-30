## Goal
Make it obvious that users should tap the flashcard to reveal the meaning.

## Change
In `src/routes/study.flashcards.tsx`, on the card front (when `phase === "front"`), add a small centered hint pill below the word:

- Icon: `RotateCw` (or reuse `RotateCcw` already imported) at ~14px
- Text: `t("fc.tapToFlip")` — English: "Tap to reveal meaning", Japanese: "タップして意味を見る"
- Style: muted-foreground, small text, rounded-full subtle border, `animate-pulse` softly to draw attention
- Only rendered when `phase === "front"`; hidden once flipped
- Sits right under the big word, centered

## i18n
Add `fc.tapToFlip` key to `src/lib/i18n.tsx` for both `en` and `ja`.

## Out of scope
No flip animation, no coach mark, no extra button — keeps the existing two-button rating layout untouched.