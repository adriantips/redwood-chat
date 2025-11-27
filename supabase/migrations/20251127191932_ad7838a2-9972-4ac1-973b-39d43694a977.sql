-- Create a view for public profile information that excludes sensitive fields
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  display_name,
  avatar_url,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Update the RLS policy to be more restrictive - only allow full profile access to own profile
DROP POLICY IF EXISTS "Users can view own profile and conversation participants" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- For viewing other users' profiles in conversations, the application should use the public_profiles view instead