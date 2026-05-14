
-- 0. Functions used by policies (must exist before policies reference them)
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid() ORDER BY created_at ASC LIMIT 1;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Companies
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  endereco TEXT DEFAULT '',
  razao_social TEXT DEFAULT '',
  nome_fantasia TEXT DEFAULT '',
  inscricao_estadual TEXT DEFAULT '',
  inscricao_municipal TEXT DEFAULT '',
  cep TEXT DEFAULT '',
  logradouro TEXT DEFAULT '',
  numero TEXT DEFAULT '',
  complemento TEXT DEFAULT '',
  bairro TEXT DEFAULT '',
  cidade TEXT DEFAULT '',
  uf TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own company" ON public.companies;
CREATE POLICY "Users see own company" ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_my_company_id());
DROP POLICY IF EXISTS "Users update own company" ON public.companies;
CREATE POLICY "Users update own company" ON public.companies FOR UPDATE TO authenticated
  USING (id = public.get_my_company_id()) WITH CHECK (id = public.get_my_company_id());

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  barcode TEXT DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  category TEXT DEFAULT 'Outros',
  image_url TEXT,
  ncm TEXT DEFAULT '',
  cfop TEXT DEFAULT '',
  cst TEXT DEFAULT '',
  csosn TEXT DEFAULT '',
  icms_aliquota NUMERIC DEFAULT 0,
  pis_aliquota NUMERIC DEFAULT 0,
  cofins_aliquota NUMERIC DEFAULT 0,
  cest TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  origem TEXT DEFAULT '0',
  unidade TEXT DEFAULT 'UN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.products;
CREATE POLICY "Tenant isolation" ON public.products FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Terminals
CREATE TABLE IF NOT EXISTS public.terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  cupom_inicio INTEGER NOT NULL DEFAULT 100000,
  cupom_atual INTEGER NOT NULL DEFAULT 100000,
  cupom_fim INTEGER NOT NULL DEFAULT 999999,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.terminals;
CREATE POLICY "Tenant isolation" ON public.terminals FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Operators
CREATE TABLE IF NOT EXISTS public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  pin TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  perm_abrir_caixa BOOLEAN NOT NULL DEFAULT true,
  perm_cancelar_item BOOLEAN NOT NULL DEFAULT false,
  perm_cancelar_cupom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.operators;
CREATE POLICY "Tenant isolation" ON public.operators FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf_cnpj TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  data_nascimento TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_used NUMERIC(12,2) NOT NULL DEFAULT 0,
  compras INTEGER NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.clients;
CREATE POLICY "Tenant isolation" ON public.clients FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.suppliers;
CREATE POLICY "Tenant isolation" ON public.suppliers FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Cash registers
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  operator_name TEXT NOT NULL,
  terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL,
  terminal_name TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.cash_registers;
CREATE POLICY "Tenant isolation" ON public.cash_registers FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Sales
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  cupom_numero INTEGER,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL,
  terminal_name TEXT,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  operator_name TEXT,
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.sales;
CREATE POLICY "Tenant isolation" ON public.sales FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Sale items
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.sale_items;
CREATE POLICY "Tenant isolation" ON public.sale_items FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Sale payments
CREATE TABLE IF NOT EXISTS public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.sale_payments;
CREATE POLICY "Tenant isolation" ON public.sale_payments FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Stock movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada','saida','cancelamento','venda')),
  quantity INTEGER NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.stock_movements;
CREATE POLICY "Tenant isolation" ON public.stock_movements FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Cash withdrawals
CREATE TABLE IF NOT EXISTS public.cash_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.cash_withdrawals;
CREATE POLICY "Tenant isolation" ON public.cash_withdrawals FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Cash deposits
CREATE TABLE IF NOT EXISTS public.cash_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_deposits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.cash_deposits;
CREATE POLICY "Tenant isolation" ON public.cash_deposits FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Bills
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date TIMESTAMPTZ NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  category TEXT DEFAULT 'outros',
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.bills;
CREATE POLICY "Tenant isolation" ON public.bills FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Debts
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.debts;
CREATE POLICY "Tenant isolation" ON public.debts FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Debt payments
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'dinheiro',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.debt_payments;
CREATE POLICY "Tenant isolation" ON public.debt_payments FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Action logs
CREATE TABLE IF NOT EXISTS public.action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('abertura_caixa','fechamento_caixa','venda','cancelamento_item','cancelamento_cupom','sangria','reforco')),
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  terminal_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2),
  sale_id TEXT,
  authorized_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.action_logs;
CREATE POLICY "Tenant isolation" ON public.action_logs FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Vendedores
CREATE TABLE IF NOT EXISTS public.vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  comissao NUMERIC NOT NULL DEFAULT 0,
  meta_mensal NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.vendedores;
CREATE POLICY "Tenant isolation" ON public.vendedores FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Orcamentos
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  numero SERIAL,
  client_id UUID REFERENCES public.clients(id),
  client_name TEXT,
  vendedor_id UUID REFERENCES public.vendedores(id),
  vendedor_name TEXT,
  desconto_tipo TEXT NOT NULL DEFAULT 'percent',
  desconto_valor NUMERIC NOT NULL DEFAULT 0,
  validade DATE NOT NULL DEFAULT (CURRENT_DATE + interval '30 days'),
  status TEXT NOT NULL DEFAULT 'rascunho',
  autorizado BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT DEFAULT '',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  portal_token TEXT UNIQUE,
  portal_senha TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.orcamentos;
CREATE POLICY "Tenant isolation" ON public.orcamentos FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());
CREATE INDEX IF NOT EXISTS idx_orcamentos_portal_token ON public.orcamentos (portal_token) WHERE portal_token IS NOT NULL;

-- Orcamento items
CREATE TABLE IF NOT EXISTS public.orcamento_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  desconto_tipo TEXT NOT NULL DEFAULT 'percent',
  desconto_valor NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0
);
ALTER TABLE public.orcamento_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.orcamento_items;
CREATE POLICY "Tenant isolation" ON public.orcamento_items FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());

-- Orcamento historico
CREATE TABLE IF NOT EXISTS public.orcamento_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  orcamento_id UUID NOT NULL,
  orcamento_numero INTEGER NOT NULL,
  acao TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  usuario_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamento_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.orcamento_historico;
CREATE POLICY "Tenant isolation" ON public.orcamento_historico FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());
CREATE INDEX IF NOT EXISTS idx_orcamento_historico_orcamento_id ON public.orcamento_historico(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_historico_tenant_id ON public.orcamento_historico(tenant_id);

-- WebAuthn credentials
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_name TEXT DEFAULT 'Biometria',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON public.webauthn_credentials;
CREATE POLICY "Tenant isolation" ON public.webauthn_credentials FOR ALL TO authenticated
  USING (tenant_id = public.get_my_company_id()) WITH CHECK (tenant_id = public.get_my_company_id());
CREATE INDEX IF NOT EXISTS idx_webauthn_operator ON public.webauthn_credentials(operator_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credential ON public.webauthn_credentials(credential_id);

-- WebAuthn challenges
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_key TEXT NOT NULL UNIQUE,
  challenge TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON public.webauthn_challenges;
CREATE POLICY "Service role only" ON public.webauthn_challenges FOR ALL USING (false);

-- Functions / triggers
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.verify_operator_pin(p_operator_id UUID, p_pin TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM public.operators WHERE id = p_operator_id AND pin = crypt(p_pin, pin)); END;
$$;

CREATE OR REPLACE FUNCTION public.hash_operator_pin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN IF length(NEW.pin) < 60 THEN NEW.pin := crypt(NEW.pin, gen_salt('bf')); END IF; RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS hash_operator_pin_trigger ON public.operators;
CREATE TRIGGER hash_operator_pin_trigger
  BEFORE INSERT OR UPDATE ON public.operators
  FOR EACH ROW EXECUTE FUNCTION public.hash_operator_pin();

CREATE OR REPLACE FUNCTION public.cleanup_old_challenges()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN DELETE FROM public.webauthn_challenges WHERE created_at < now() - interval '5 minutes'; RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_cleanup_challenges ON public.webauthn_challenges;
CREATE TRIGGER trg_cleanup_challenges
  AFTER INSERT ON public.webauthn_challenges FOR EACH STATEMENT EXECUTE FUNCTION public.cleanup_old_challenges();

CREATE OR REPLACE FUNCTION public.create_company_with_membership(p_nome TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_company_id UUID; v_user_id UUID := auth.uid();
BEGIN IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
IF EXISTS (SELECT 1 FROM public.company_members WHERE user_id = v_user_id) THEN RAISE EXCEPTION 'User already belongs to a company'; END IF;
INSERT INTO public.companies (nome) VALUES (p_nome) RETURNING id INTO v_company_id;
INSERT INTO public.company_members (user_id, company_id, role) VALUES (v_user_id, v_company_id, 'owner');
RETURN v_company_id; END;
$$;

-- Operator column restrictions
REVOKE ALL ON public.operators FROM anon, authenticated;
GRANT SELECT (id, tenant_id, created_at, nome, ativo, perm_abrir_caixa, perm_cancelar_cupom, perm_cancelar_item) ON public.operators TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.operators TO authenticated;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_terminals_tenant ON public.terminals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_operators_tenant ON public.operators(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant ON public.sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant ON public.sale_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_tenant ON public.sale_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON public.stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_tenant ON public.cash_registers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_withdrawals_tenant ON public.cash_withdrawals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_deposits_tenant ON public.cash_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bills_tenant ON public.bills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_debts_tenant ON public.debts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_tenant ON public.debt_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_tenant ON public.action_logs(tenant_id);
