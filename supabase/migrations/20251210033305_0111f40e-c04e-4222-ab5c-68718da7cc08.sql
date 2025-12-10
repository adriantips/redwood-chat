-- Create a function to add participants to a conversation (for the creator)
CREATE OR REPLACE FUNCTION public.add_conversation_participants(
  p_conversation_id uuid,
  p_user_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is a participant in the conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = p_conversation_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to add participants to this conversation';
  END IF;

  -- Insert the participants
  INSERT INTO conversation_participants (conversation_id, user_id)
  SELECT p_conversation_id, unnest(p_user_ids)
  ON CONFLICT DO NOTHING;
END;
$$;