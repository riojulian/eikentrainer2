
CREATE OR REPLACE FUNCTION public.validate_chunk_attempt_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.kind NOT IN ('stage','weekly','monthly') THEN
    RAISE EXCEPTION 'kind must be stage, weekly, or monthly (got %)', NEW.kind;
  END IF;
  RETURN NEW;
END;
$function$;
