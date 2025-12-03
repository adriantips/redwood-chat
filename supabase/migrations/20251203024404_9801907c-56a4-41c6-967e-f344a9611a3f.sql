-- Drop the current INSERT policy
DROP POLICY IF EXISTS "Users can add participants to their conversations" ON public.conversation_participants;

-- Create a new policy that allows users to add themselves as participants
CREATE POLICY "Users can add themselves as participants" 
ON public.conversation_participants 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());