-- Drop the redundant policy since the new policy already includes own profile access
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;