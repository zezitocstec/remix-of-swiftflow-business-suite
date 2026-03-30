
-- 1. Tabela de empresas (tenants)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  endereco TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Membros da empresa (vínculo user ↔ company)
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- 3. Função SECURITY DEFINER para buscar company_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- 4. RLS para companies: usuário só vê sua própria empresa
CREATE POLICY "Users see own company"
  ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_my_company_id());

CREATE POLICY "Users update own company"
  ON public.companies FOR UPDATE TO authenticated
  USING (id = public.get_my_company_id())
  WITH CHECK (id = public.get_my_company_id());

CREATE POLICY "Anyone can create company"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (true);

-- 5. RLS para company_members
CREATE POLICY "Users see own memberships"
  ON public.company_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create membership"
  ON public.company_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 6. Adicionar tenant_id a TODAS as tabelas existentes
ALTER TABLE public.products ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.terminals ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.operators ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.sale_items ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.sale_payments ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.stock_movements ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.cash_registers ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.cash_withdrawals ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.cash_deposits ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.bills ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.debts ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.debt_payments ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.action_logs ADD COLUMN tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 7. Dropar TODAS as policies permissivas antigas e criar novas com filtro tenant_id
DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can manage terminals" ON public.terminals;
DROP POLICY IF EXISTS "Authenticated users can manage operators" ON public.operators;
DROP POLICY IF EXISTS "Authenticated users can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can manage sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can manage sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can manage sale_payments" ON public.sale_payments;
DROP POLICY IF EXISTS "Authenticated users can manage stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Authenticated users can manage cash_registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Authenticated users can manage cash_withdrawals" ON public.cash_withdrawals;
DROP POLICY IF EXISTS "Authenticated users can manage cash_deposits" ON public.cash_deposits;
DROP POLICY IF EXISTS "Authenticated users can manage bills" ON public.bills;
DROP POLICY IF EXISTS "Authenticated users can manage debts" ON public.debts;
DROP POLICY IF EXISTS "Authenticated users can manage debt_payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Authenticated users can manage action_logs" ON public.action_logs;

-- Novas policies com isolamento por tenant
CREATE POLICY "Tenant isolation" ON public.products FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.terminals FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.operators FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.clients FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.suppliers FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.sales FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.sale_items FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.sale_payments FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.stock_movements FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.cash_registers FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.cash_withdrawals FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.cash_deposits FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.bills FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.debts FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.debt_payments FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

CREATE POLICY "Tenant isolation" ON public.action_logs FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- 8. Índices para performance nas queries filtradas por tenant
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_terminals_tenant ON public.terminals(tenant_id);
CREATE INDEX idx_operators_tenant ON public.operators(tenant_id);
CREATE INDEX idx_clients_tenant ON public.clients(tenant_id);
CREATE INDEX idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX idx_sales_tenant ON public.sales(tenant_id);
CREATE INDEX idx_sale_items_tenant ON public.sale_items(tenant_id);
CREATE INDEX idx_sale_payments_tenant ON public.sale_payments(tenant_id);
CREATE INDEX idx_stock_movements_tenant ON public.stock_movements(tenant_id);
CREATE INDEX idx_cash_registers_tenant ON public.cash_registers(tenant_id);
CREATE INDEX idx_cash_withdrawals_tenant ON public.cash_withdrawals(tenant_id);
CREATE INDEX idx_cash_deposits_tenant ON public.cash_deposits(tenant_id);
CREATE INDEX idx_bills_tenant ON public.bills(tenant_id);
CREATE INDEX idx_debts_tenant ON public.debts(tenant_id);
CREATE INDEX idx_debt_payments_tenant ON public.debt_payments(tenant_id);
CREATE INDEX idx_action_logs_tenant ON public.action_logs(tenant_id);
