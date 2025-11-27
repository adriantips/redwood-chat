-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a secure policy that only allows viewing own profile and profiles of users in shared conversations
CREATE POLICY "Users can view own profile and conversation participants"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id  -- Can view own profile
    OR 
    EXISTS (  -- Can view profiles of users in shared conversations
      SELECT 1 
      FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2 
        ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = auth.uid()
        AND cp2.user_id = profiles.id
    )
  );