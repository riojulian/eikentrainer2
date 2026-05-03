ALTER TABLE public.word_status ADD COLUMN IF NOT EXISTS mastery smallint NOT NULL DEFAULT 0;

UPDATE public.word_status SET mastery = 2 WHERE status = 'known';
UPDATE public.word_status SET mastery = 0 WHERE status = 'review';

ALTER TABLE public.word_status DROP COLUMN IF EXISTS status;

CREATE OR REPLACE FUNCTION public.validate_mastery()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.mastery < 0 OR NEW.mastery > 3 THEN
    RAISE EXCEPTION 'mastery must be between 0 and 3';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS word_status_mastery_check ON public.word_status;
CREATE TRIGGER word_status_mastery_check
BEFORE INSERT OR UPDATE ON public.word_status
FOR EACH ROW EXECUTE FUNCTION public.validate_mastery();