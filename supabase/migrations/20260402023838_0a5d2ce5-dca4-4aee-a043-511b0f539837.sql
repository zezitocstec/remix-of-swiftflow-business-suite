-- Fix the self-referencing bug in company_members INSERT policy
-- The old policy had cm.company_id = cm.company_id which always evaluates to true
DROP POLICY IF EXISTS "Users can create first membership" ON public.company_members;

CREATE POLICY "Users can create first membership"
ON public.company_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_members.company_id
  )
);