-- Fix infinite recursion in RLS policies for public.user_profiles
-- The policy "Admin Gerencia" references public.user_profiles inside its USING expression,
-- which can cause "infinite recursion detected in policy".

BEGIN;

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop the recursive policy if it exists
DROP POLICY IF EXISTS "Admin Gerencia" ON public.user_profiles;

-- (Optional safety) If there's any other legacy policy doing self-references, drop by known name(s)
-- You can add more DROP POLICY statements here if needed.

COMMIT;