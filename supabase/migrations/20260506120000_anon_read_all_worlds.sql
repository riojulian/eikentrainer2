-- Allow anonymous (guest) users to read active words across all worlds for the free preview
DROP POLICY IF EXISTS "anon can read tier1 words" ON public.words;

CREATE POLICY "anon can read active words"
ON public.words
FOR SELECT
TO anon
USING (is_active = true);
