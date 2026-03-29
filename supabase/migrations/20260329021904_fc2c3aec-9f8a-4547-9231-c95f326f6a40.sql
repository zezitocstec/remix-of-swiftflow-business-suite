
-- 1. Produtos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  barcode TEXT DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  category TEXT DEFAULT 'Outros',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Terminais (com numeração de cupom)
CREATE TABLE public.terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  cupom_inicio INTEGER NOT NULL DEFAULT 100000,
  cupom_atual INTEGER NOT NULL DEFAULT 100000,
  cupom_fim INTEGER NOT NULL DEFAULT 999999,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Operadores
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  pin TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  perm_abrir_caixa BOOLEAN NOT NULL DEFAULT true,
  perm_cancelar_item BOOLEAN NOT NULL DEFAULT false,
  perm_cancelar_cupom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Clientes
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 5. Fornecedores
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Vendas
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cupom_numero INTEGER,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL,
  terminal_name TEXT,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  operator_name TEXT,
  cash_register_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Itens da venda
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 8. Pagamentos da venda
CREATE TABLE public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 9. Movimentações de estoque
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada','saida','cancelamento','venda')),
  quantity INTEGER NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Sessões de caixa
CREATE TABLE public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  operator_name TEXT NOT NULL,
  terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL,
  terminal_name TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 11. Sangrias
CREATE TABLE public.cash_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Reforços
CREATE TABLE public.cash_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Contas a pagar
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 14. Fiado (dívidas de clientes)
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. Pagamentos de fiado
CREATE TABLE public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'dinheiro',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. Logs de auditoria
CREATE TABLE public.action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Adicionar FK de cash_register_id na sales
ALTER TABLE public.sales
  ADD CONSTRAINT sales_cash_register_id_fkey
  FOREIGN KEY (cash_register_id) REFERENCES public.cash_registers(id) ON DELETE SET NULL;

-- Políticas RLS abertas temporariamente (sem auth ainda)
-- Quando autenticação for implementada, substituir por políticas restritivas

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to products" ON public.products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to terminals" ON public.terminals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to operators" ON public.operators FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sale_payments" ON public.sale_payments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to cash_registers" ON public.cash_registers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.cash_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to cash_withdrawals" ON public.cash_withdrawals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.cash_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to cash_deposits" ON public.cash_deposits FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to bills" ON public.bills FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to debts" ON public.debts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to debt_payments" ON public.debt_payments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to action_logs" ON public.action_logs FOR ALL USING (true) WITH CHECK (true);
