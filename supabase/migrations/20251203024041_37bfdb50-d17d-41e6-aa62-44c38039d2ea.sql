-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Create a permissive policy for authenticated users
CREATE POLICY "Users can create conversations" 
ON public.conversations 
FOR INSERT 
TO authenticated
WITH CHECK (true);