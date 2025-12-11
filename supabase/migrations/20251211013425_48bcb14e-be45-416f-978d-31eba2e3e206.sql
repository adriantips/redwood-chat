-- Allow users to delete conversations they're part of
CREATE POLICY "Users can delete their conversations"
ON public.conversations
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM conversation_participants
  WHERE conversation_participants.conversation_id = conversations.id
  AND conversation_participants.user_id = auth.uid()
));

-- Allow deleting participants when conversation is deleted
CREATE POLICY "Users can delete participants from their conversations"
ON public.conversation_participants
FOR DELETE
USING (is_conversation_participant(conversation_id, auth.uid()));

-- Allow deleting messages when conversation is deleted
CREATE POLICY "Users can delete messages in their conversations"
ON public.messages
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM conversation_participants
  WHERE conversation_participants.conversation_id = messages.conversation_id
  AND conversation_participants.user_id = auth.uid()
));