-- Add message_type and media_url columns to messages table
ALTER TABLE public.messages 
ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'voice')),
ADD COLUMN media_url TEXT;

-- Create storage bucket for chat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to chat-media bucket
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- Allow anyone to view chat media (messages are already protected by RLS)
CREATE POLICY "Anyone can view chat media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-media');