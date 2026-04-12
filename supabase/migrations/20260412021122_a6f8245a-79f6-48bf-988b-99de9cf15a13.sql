CREATE TABLE public.orcamento_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL,
  orcamento_numero INTEGER NOT NULL,
  acao TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  usuario_email TEXT,
  tenant_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamento_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.orcamento_historico
  FOR ALL
  TO authenticated
  USING (tenant_id = get_my_company_id())
  WITH CHECK (tenant_id = get_my_company_id());

CREATE INDEX idx_orcamento_historico_orcamento_id ON public.orcamento_historico(orcamento_id);
CREATE INDEX idx_orcamento_historico_tenant_id ON public.orcamento_historico(tenant_id);