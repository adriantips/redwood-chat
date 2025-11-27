-- Remove the email column from profiles table to eliminate exposure risk
-- Email is already stored securely in auth.users and should not be duplicated
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;