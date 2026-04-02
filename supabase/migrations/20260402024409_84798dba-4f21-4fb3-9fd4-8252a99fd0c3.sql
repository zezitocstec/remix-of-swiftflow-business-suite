-- Create a secure function for atomic company + membership creation
CREATE OR REPLACE FUNCTION public.create_company_with_membership(p_nome text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a company
  IF EXISTS (SELECT 1 FROM public.company_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;

  -- Create company
  INSERT INTO public.companies (nome)
  VALUES (p_nome)
  RETURNING id INTO v_company_id;

  -- Create membership atomically
  INSERT INTO public.company_members (user_id, company_id, role)
  VALUES (v_user_id, v_company_id, 'owner');

  RETURN v_company_id;
END;
$$;

-- Remove the direct INSERT policy (membership creation goes through the RPC)
DROP POLICY IF EXISTS "Users can create first membership" ON public.company_members;

-- Add a restrictive policy: no direct inserts allowed (only via SECURITY DEFINER function)
CREATE POLICY "No direct inserts"
ON public.company_members
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Add explicit DELETE policy for companies
CREATE POLICY "Users delete own company"
ON public.companies
FOR DELETE
TO authenticated
USING (id = get_my_company_id());