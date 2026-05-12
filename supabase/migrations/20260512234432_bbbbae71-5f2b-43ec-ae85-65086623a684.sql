CREATE TABLE public.mfa_backup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mfa_backup_codes_user ON public.mfa_backup_codes(user_id);
ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (via edge function) can read/write.