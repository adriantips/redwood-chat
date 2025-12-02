-- Fix infinite recursion by creating a security definer function
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conversation_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_participants
    WHERE conversation_participants.conversation_id = is_conversation_participant.conversation_id
      AND conversation_participants.user_id = is_conversation_participant.user_id
  );
$$;

-- Drop existing policies on conversation_participants
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to their conversations" ON conversation_participants;

-- Create new policies using the security definer function
CREATE POLICY "Users can view participants in their conversations"
ON conversation_participants
FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can add participants to their conversations"
ON conversation_participants
FOR INSERT
WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

-- Fix public_profiles exposure by allowing public read access to profiles
-- (profiles table contains no sensitive data after email removal)
CREATE POLICY "Anyone can view public profile information"
ON profiles
FOR SELECT
USING (true);