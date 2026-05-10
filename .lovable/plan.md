## Goal

The /study page feels busy and the "World" concept confuses users. Make it obvious that the main action is **studying flashcards**, and reframe Worlds as **Categories** with friendlier names.

## Changes

### 1. Hero stage card — single primary CTA
File: `src/routes/study.index.tsx`

- Replace the two side-by-side buttons (Study Stage + Take Quiz) with **one large "Study Flashcards" button** spanning full width, gold-filled, taller (h-14), with the BookOpen icon.
- Move "Take Quiz" to a small secondary text link beneath the main button (e.g. "Or take the quiz →"), styled as a muted ghost link.
- Tighten card copy: bigger "Stage N" headline, shorter subline ("10 words to learn").

### 2. Rename "World" → "Category" everywhere user-facing
- New short labels (replace `WORLD_TOPIC_EN` / `WORLD_TOPIC_JA` and the picker heading):
  - tier1 → **Core**
  - tier2 → **Topics**
  - tier3 → **Reading**
  - tier4 → **Niche**
  - phrases → **Phrases**
- Files to touch:
  - `src/components/WorldPicker.tsx` — update topic maps; remove the small "WORLD N" eyebrow chip above each tile (this is a big source of visual noise on a 411px viewport). Show only the category name + progress.
  - `src/lib/i18n.tsx` — change `home.pickWorld` to "Pick a category" / 「カテゴリーを選ぶ」 and `home.worldHint` to a one-liner like "Vocabulary sets by topic" / 「テーマ別の語彙セット」.
  - Any other `t("home.pickWorld")` / "World" strings in `study.index.tsx`.
- Keep the internal code identifiers (`world`, `WORLD_ORDER`, `tier1`…) unchanged — purely a copy/UI change.

### 3. Reduce header noise
- Remove the "Level · coming soon" Sparkles chip block at the top of `study.index.tsx` (lines ~320–325).
- Greeting stays but trimmed to one line.

### 4. Category picker visual polish
File: `src/components/WorldPicker.tsx`
- Drop the tiny uppercase "WORLD 1/2/…" eyebrow text — it's the main thing the user calls "confusing".
- Make the active tile more obvious (slightly larger gold ring already there; add subtle bg highlight).
- Keep the 5-column grid, progress bar, and lock state.

### 5. Tabs section unchanged
Progress / Map / Badges tabs stay where they are (user didn't ask to move them). The added breathing room from #1 + #3 already lifts the hero.

## Out of scope
- No DB / backend changes.
- No changes to flashcards or quiz routes themselves.
- No changes to admin analytics work.

## Visual sketch (mobile, 411px)

```text
Hi, Alex 🌸

Pick a category          Vocabulary sets by topic
[ Core ][ Topics ][Reading][ Niche ][Phrases]

┌──────────────────────────────────┐
│ CORE                             │
│ Stage 3                          │
│ 10 words to learn                │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  📖  Study Flashcards        │ │  ← big gold
│ └──────────────────────────────┘ │
│        Or take the quiz →        │  ← small link
└──────────────────────────────────┘

(WeakZone strip if any)

[ Progress | Map | Badges ]
```
