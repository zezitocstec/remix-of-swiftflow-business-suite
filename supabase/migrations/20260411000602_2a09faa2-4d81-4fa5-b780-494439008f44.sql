
-- Vendedores (Salespeople)
CREATE TABLE public.vendedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  comissao numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  tenant_id uuid REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.vendedores FOR ALL TO authenticated
  USING (tenant_id = get_my_company_id())
  WITH CHECK (tenant_id = get_my_company_id());

-- Orçamentos (Quotes)
CREATE TABLE public.orcamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero serial,
  client_id uuid REFERENCES public.clients(id),
  client_name text,
  vendedor_id uuid REFERENCES public.vendedores(id),
  vendedor_name text,
  desconto_tipo text NOT NULL DEFAULT 'percent',
  desconto_valor numeric NOT NULL DEFAULT 0,
  validade date NOT NULL DEFAULT (CURRENT_DATE + interval '30 days'),
  status text NOT NULL DEFAULT 'rascunho',
  autorizado boolean NOT NULL DEFAULT false,
  observacoes text DEFAULT '',
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  tenant_id uuid REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.orcamentos FOR ALL TO authenticated
  USING (tenant_id = get_my_company_id())
  WITH CHECK (tenant_id = get_my_company_id());

-- Orçamento Items
CREATE TABLE public.orcamento_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  desconto_tipo text NOT NULL DEFAULT 'percent',
  desconto_valor numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  tenant_id uuid REFERENCES public.companies(id)
);
ALTER TABLE public.orcamento_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.orcamento_items FOR ALL TO authenticated
  USING (tenant_id = get_my_company_id())
  WITH CHECK (tenant_id = get_my_company_id());
