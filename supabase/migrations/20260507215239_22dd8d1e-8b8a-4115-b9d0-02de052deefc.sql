
-- 1. Company members
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_members' AND policyname = 'Users can view own memberships') THEN
    CREATE POLICY "Users can view own memberships"
      ON public.company_members FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 2. get_my_company_id
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 3. Restaurant settings
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE,
  service_fee_enabled BOOLEAN DEFAULT false,
  service_fee_pct NUMERIC DEFAULT 10,
  couvert_enabled BOOLEAN DEFAULT false,
  couvert_amount NUMERIC DEFAULT 0,
  receipt_copies INTEGER DEFAULT 1,
  kitchen_print_enabled BOOLEAN DEFAULT false,
  kitchen_categories JSONB DEFAULT '[]'::jsonb,
  bar_categories JSONB DEFAULT '[]'::jsonb,
  waiter_commission_pct NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS waiter_commission_pct NUMERIC DEFAULT 0;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'restaurant_settings' AND policyname = 'Tenant can view settings') THEN
    CREATE POLICY "Tenant can view settings"
      ON public.restaurant_settings FOR SELECT TO authenticated
      USING (tenant_id = public.get_my_company_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'restaurant_settings' AND policyname = 'Tenant can manage settings') THEN
    CREATE POLICY "Tenant can manage settings"
      ON public.restaurant_settings FOR ALL TO authenticated
      USING (tenant_id = public.get_my_company_id())
      WITH CHECK (tenant_id = public.get_my_company_id());
  END IF;
END $$;
