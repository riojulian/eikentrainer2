ALTER TABLE public.words ADD COLUMN tier text;

CREATE OR REPLACE FUNCTION public.validate_word_tier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tier IS NOT NULL AND NEW.tier NOT IN ('tier1','tier2','tier3','tier4','phrases') THEN
    RAISE EXCEPTION 'tier must be one of tier1, tier2, tier3, tier4, phrases (got %)', NEW.tier;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER words_validate_tier
BEFORE INSERT OR UPDATE ON public.words
FOR EACH ROW EXECUTE FUNCTION public.validate_word_tier();

CREATE INDEX IF NOT EXISTS idx_words_tier ON public.words(tier);