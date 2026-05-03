## Problem with the current flashcards

The bottom row mixes three unrelated concepts in confusing ways:

- **Review** is colored like a "wrong" button but actually means "mark this card for review" (a status), not "I got it wrong."
- **Know it** marks the card as known AND advances — but visually it looks parallel to "Next," so users don't realize it's a judgment.
- **Next** advances without a judgment, which silently skips learning signal.
- **Previous** is hidden underneath, and **Tap to reveal** is a tiny hint at the bottom that's easy to miss.

Result: people tap "Review" thinking it goes back, tap "Next" instead of rating, and never build a real review queue.

## Proposed redesign

A classic two-phase flashcard loop, inspired by Anki / Quizlet, but kept minimal.

### Phase 1 — Front of card (not revealed)

- Big word, category/POS chips, nothing else.
- Single primary CTA: **"Show answer"** (full-width button) — replaces the tiny "Tap card to reveal" hint.
- Card is still tappable to flip; spacebar also flips.
- Top bar keeps filter + shuffle + progress.
- Small **Skip** ghost link in the corner (advances without rating, for cards you can't judge).

### Phase 2 — Back of card (revealed)

Card shows definition + example as today. The action row swaps to **two clear rating buttons**:

```text
[  Still learning  ]   [  I knew it  ]
     (rose)                 (sage)
```

- **Still learning** → marks `review`, advances.
- **I knew it** → marks `known`, advances.
- That's it. No third "Next" button — rating *is* advancing, which removes the ambiguity.

Optional third tier later (Easy / Good / Hard) if the user wants real SRS, but two buttons match the existing `review | known` data model exactly.

### Navigation that's actually navigation

- **Previous** moves to a separate, unambiguous spot: a small chevron button in the **top-left** of the card area, paired with the progress counter. It does not look like a rating.
- Add a tiny **Undo last rating** link that appears for ~4s after a rating (toast-style), so a misclick is recoverable without leaving the flow.

### Keyboard + gesture shortcuts

- `Space` / `Enter` — reveal, then on second press = "I knew it."
- `1` or `←` — Still learning.
- `2` or `→` — I knew it.
- `S` — skip.
- Touch: swipe left = still learning, swipe right = knew it, tap = reveal. (Use a small `useSwipe` handler, no new dependency.)
- A subtle "Shortcuts" popover (?) documents these.

### End-of-deck screen

When `idx` passes the last card, show a summary instead of getting stuck on the last card:

- "You reviewed N cards — X knew, Y to review."
- Buttons: **Review the X again**, **Shuffle and restart**, **Back to study**.

### Visual cleanup

- Remove the green border/red border from action buttons — use solid backgrounds (sage / rose) so they read as decisions, not outlined secondary actions.
- Card gets a subtle flip animation (CSS transform on reveal) so the two phases feel distinct.
- "Tap card to reveal" hint removed (replaced by the explicit button).

## Files to change

- `src/routes/study.flashcards.tsx` — main rewrite of the action area, phase-based rendering, keyboard handler, swipe handler, end-of-deck summary, undo toast.
- No DB or schema changes — still writes `review` / `known` via existing `setStatus`.

## Out of scope (ask later if wanted)

- True SRS scheduling (Easy/Good/Hard/Again with intervals).
- Audio playback of the word.
- Per-session stats persisted to the DB.

Want me to also add a 4-button SRS rating now, or keep the two-button model that matches your existing `review | known` schema?
