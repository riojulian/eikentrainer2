## Fix word upload to support Tier5 / phrases and multi-word entries

**File:** `src/routes/admin.upload.tsx`

### Changes

1. **Extend `normalizeTier()`** to map Tier5 variants to `phrases`:
   - Add `5`, `tier5`, `t5`, `world5`, `world 5`, `phrase`, `phrases` → `phrases`
   - Keep existing `tier1`-`tier4` mappings

2. **Rewrite line parser** to handle multi-word phrases:
   - Trim line, normalize whitespace (collapse tabs / multiple spaces / non-breaking spaces)
   - Detect leading tier token (e.g. `Tier5`, `tier3`, `phrases`, `1`) case-insensitively
   - Strip the tier token from the front; the **entire remainder** of the line becomes the word/phrase (e.g. `Tier5 accuse A of B` → tier=`phrases`, word=`accuse A of B`)
   - If no tier token is present, fall back to current default behavior

3. **Update help/hint text** in the upload UI to show supported formats:
   - `1 ambiguous`
   - `tier3 profound`
   - `Tier5 account for`
   - `phrases give up`

4. **Dedup check** continues to use the full phrase string so `account for` and `account` are treated as distinct.

No DB schema changes (the `validate_word_tier` trigger already accepts `phrases`).