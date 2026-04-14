
-- Add portal columns to orcamentos
ALTER TABLE public.orcamentos
  ADD COLUMN portal_token text UNIQUE,
  ADD COLUMN portal_senha text;

-- Create index for fast token lookup
CREATE INDEX idx_orcamentos_portal_token ON public.orcamentos (portal_token) WHERE portal_token IS NOT NULL;
