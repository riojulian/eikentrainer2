CREATE POLICY "anon can read tier1 words"
ON public.words FOR SELECT TO anon
USING (tier = 'tier1' AND is_active = true);