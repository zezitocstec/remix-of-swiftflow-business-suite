
CREATE TABLE public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  credential_id text NOT NULL,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  device_name text DEFAULT 'Biometria',
  tenant_id uuid REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(credential_id)
);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.webauthn_credentials
  FOR ALL TO authenticated
  USING (tenant_id = get_my_company_id())
  WITH CHECK (tenant_id = get_my_company_id());

CREATE INDEX idx_webauthn_operator ON public.webauthn_credentials(operator_id);
CREATE INDEX idx_webauthn_credential ON public.webauthn_credentials(credential_id);
