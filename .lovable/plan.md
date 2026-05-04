## Rebrand to EikenTango

Rename the app everywhere from "Rinka / Vocabulary Atelier / Vocab Trainer" to **EikenTango** (英検 + 単語), with an **ET** monogram logo and a fresher, more playful identity aimed at younger Japanese learners.

### 1. New brand identity

**Name & tagline**
- App name: `EikenTango`
- Tagline: `英検の単語を、もっと楽しく。` / "Make Eiken vocab fun."

**Logo: "ET" monogram**
- Inline SVG component `src/components/BrandMark.tsx` — a rounded-square badge with bold "ET" letters. Used in header, auth, landing hero, and as favicon.
- Style: chunky rounded geometric sans, white letters on a vibrant gradient (coral → sunshine), soft drop shadow. Feels sticker-like, friendly, mobile-first.

**Color palette (replace the muted cream/ink/gold "atelier" palette)**
Updated in `src/styles.css` `:root` and `.dark`:
- `--background`: soft off-white `oklch(0.98 0.01 250)` (light); deep indigo `oklch(0.22 0.05 270)` (dark)
- `--primary` (brand): coral-pink `oklch(0.70 0.18 25)` — "Tango Coral"
- `--accent` (replaces gold): sunshine yellow `oklch(0.86 0.16 95)` — "Sunshine"
- `--sage` → mint `oklch(0.78 0.12 165)`
- `--rose` → bubblegum `oklch(0.72 0.18 0)`
- New token `--sky`: `oklch(0.78 0.12 230)` for accents
- Increase border radii: `--radius: 1rem` (more rounded, playful)

**Typography**
- Display font: **Fredoka** (rounded, friendly, supports JP via fallback) loaded from Google Fonts in `__root.tsx` head links.
- Body: **Plus Jakarta Sans** + JP fallback `"Hiragino Maru Gothic ProN", "M PLUS Rounded 1c"` so Japanese characters also feel rounded/youthful.
- Update `--font-display` and `--font-sans` in `styles.css`.
- Drop the `strong` color override (rose) — replace with brand coral.

### 2. File-by-file changes

- **`src/components/BrandMark.tsx`** (new) — `<BrandMark size={32} />` SVG with rounded gradient square + "ET" letters. Reusable.
- **`src/components/AppHeader.tsx`** — replace `Sparkles` badge + "Rinka / Vocab Trainer" with `<BrandMark />` + `EikenTango` wordmark, small `英検単語` subtitle on `sm+`.
- **`src/routes/index.tsx`** (landing)
  - Hero badge: `英検 Pre-1 ・ Vocabulary` with sunshine pill style.
  - H1: `EikenTango — 単語を、もっと<em>楽しく</em>。` (with English subline `Eiken vocab, made playful.`)
  - Body copy rewritten: friendly, encouraging, emoji-light tone targeting JHS/HS students (e.g. "毎日5分でOK。フラッシュカード、クイズ、ステージで英検単語をクリアしよう。").
  - Feature cards: keep three (Flashcards / Word List / Quiz) but with brighter coral/sunshine/mint icon backgrounds and rounded-2xl, slightly tilted hover.
  - CTA button label: `はじめる →`.
  - Replace large `BrandMark` above hero.
- **`src/routes/auth.tsx`** — swap `Sparkles` for `<BrandMark />`, heading `EikenTango へようこそ`, subtitle `毎日コツコツ、単語マスターへ。`, signup placeholder `たろう`.
- **`src/routes/__root.tsx`** — update all `title`/`og:title`/`twitter:title` to `EikenTango — 英検単語トレーニング`, descriptions to the new copy. Add Google Fonts `<link>` tags for Fredoka + Plus Jakarta Sans + M PLUS Rounded 1c. Add favicon link to `/favicon.svg`.
- **`public/favicon.svg`** (new) — same ET monogram, square, gradient bg.
- **`src/routes/admin.progress.tsx`** — `Rinka's Progress` → `生徒の進捗 / Student Progress`.
- **`src/styles.css`** — palette + radius + font tokens updated as above; tweak `--shadow-card` and `--shadow-glow` to use the new coral.

### 3. What stays the same
- All routes, data, study flow, dashboard logic, burger menu, WorldPicker grid, StageMap behavior — purely visual/branding pass.
- Component APIs unchanged; only `AppHeader` swaps inner content.

### 4. Out of scope
- No raster logo / PNG generation — pure SVG keeps it crisp and free.
- No copy translation pass beyond hero, auth, and meta titles. Internal admin screens keep current labels except the one rename above.
