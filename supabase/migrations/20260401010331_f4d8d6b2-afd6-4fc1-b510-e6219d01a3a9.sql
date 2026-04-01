-- Drop the current permissive INSERT policy
DROP POLICY IF EXISTS "Users can create membership" ON public.company_members;

-- New policy: user can only INSERT if they are the FIRST member of that company
CREATE POLICY "Users can create first membership"
ON public.company_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_id
  )
);