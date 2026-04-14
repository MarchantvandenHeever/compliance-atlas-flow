-- Drop the restrictive org-member-only SELECT policy
DROP POLICY IF EXISTS "Org members can view" ON public.organisations;

-- Allow all authenticated users to view all organisations (for client selection)
CREATE POLICY "Authenticated users can view organisations"
ON public.organisations
FOR SELECT
TO authenticated
USING (true);