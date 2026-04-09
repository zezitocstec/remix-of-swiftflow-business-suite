CREATE OR REPLACE FUNCTION public.cleanup_old_challenges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.webauthn_challenges WHERE created_at < now() - interval '5 minutes';
  RETURN NEW;
END;
$$;