
CREATE TABLE public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_key text NOT NULL UNIQUE,
  challenge text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.webauthn_challenges
  FOR ALL USING (false);

-- Auto-cleanup old challenges (older than 5 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_old_challenges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.webauthn_challenges WHERE created_at < now() - interval '5 minutes';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_challenges
  AFTER INSERT ON public.webauthn_challenges
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_challenges();
