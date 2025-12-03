-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view public profile information" ON public.profiles;

-- Create a new policy that allows users to view profiles of people in their conversations
CREATE POLICY "Users can view profiles of conversation participants"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM conversation_participants cp1
    JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    WHERE cp1.user_id = auth.uid() AND cp2.user_id = profiles.id
  )
);