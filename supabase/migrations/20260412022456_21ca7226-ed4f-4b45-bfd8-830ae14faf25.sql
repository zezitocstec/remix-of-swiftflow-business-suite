-- 1. Fix non-deterministic get_my_company_id()
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT company_id FROM public.company_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- 2. Fix permissive INSERT policy on companies (only allow via RPC)
DROP POLICY IF EXISTS "Anyone can create company" ON public.companies;
CREATE POLICY "Anyone can create company"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
  )
);

-- 3. Restrict operator pin column exposure
-- Revoke direct SELECT on pin column and grant access to other columns
-- First, revoke all and re-grant without pin
REVOKE ALL ON public.operators FROM anon, authenticated;
GRANT SELECT (id, tenant_id, created_at, nome, ativo, perm_abrir_caixa, perm_cancelar_cupom, perm_cancelar_item) ON public.operators TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.operators TO authenticated;