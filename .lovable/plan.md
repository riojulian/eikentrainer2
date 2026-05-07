## Goal

Make it clear to users that EikenTango currently covers only **英検準1級 (Eiken Pre-1)**, with more levels coming soon. Show this on the hero (landing) page and on the Study page.

## Changes

### 1. `src/lib/i18n.tsx` — add translation keys
- `level.badge`: EN "Pre-1 only · more levels coming soon" / JA "準1級のみ対応 ・ 他の級は近日対応"
- `level.short`: EN "準1級 (Pre-1)" / JA "英検準1級"
- `level.comingSoon`: EN "More levels coming soon" / JA "他の級は近日対応予定"

### 2. `src/routes/index.tsx` — hero
- Replace the existing pill `英検 Pre-1 ・ Vocabulary` with a clearer two-line treatment:
  - Pill: `{t("level.short")}` with a small `Sparkles` icon
  - Sub-line under the pill (small muted text): `{t("level.comingSoon")}`

### 3. `src/routes/study.index.tsx` — study page header
- Add a small badge near the top of the page (above the world picker / greeting area) showing `{t("level.badge")}`
- Style: rounded-full, `bg-accent/30 text-accent-foreground`, small text, with a `Sparkles` icon — matching the hero pill style for visual consistency
- Visible to both guests and logged-in users

## Visual

```
[ ✦ 英検準1級 ]
   他の級は近日対応予定
```

No backend / data changes. Pure UI + i18n.
