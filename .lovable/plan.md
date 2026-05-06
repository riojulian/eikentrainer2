## Goal
On the landing hero (`/`), make "EikenTango" always sit on its own line above the Japanese tagline — currently it only breaks on mobile, so on tablet/desktop the heading runs as one long line.

## Change
**File:** `src/routes/index.tsx`

In the `<h1>`, replace:
```tsx
EikenTango <br className="sm:hidden" />
<span className="text-primary">単語を、もっと<em className="not-italic">楽しく</em>。</span>
```
with:
```tsx
EikenTango <br />
<span className="text-primary">単語を、もっと<em className="not-italic">楽しく</em>。</span>
```

Removing the `sm:hidden` class makes the `<br />` apply at every breakpoint, so "EikenTango" is always on its own row and the colored tagline drops to the next line on mobile, tablet, and desktop alike.

No other files or styles change.
