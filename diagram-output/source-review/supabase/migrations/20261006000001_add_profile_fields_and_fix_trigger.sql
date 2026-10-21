-- ========================================================
-- 06: ADD PROFILE FIELDS AND ENFORCE PUBLIC PROFILES SYNC
-- ========================================================

-- Add passenger_category and avatar_url to public.profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS passenger_category TEXT DEFAULT 'Regular';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update trigger function to handle metadata from OAuth (Google/Facebook) and Email Sign-Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        phone,
        role,
        passenger_category,
        avatar_url
    )
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            SPLIT_PART(NEW.email, '@', 1)
        ),
        NEW.email,
        NEW.raw_user_meta_data->>'phone',
        'passenger',
        COALESCE(NEW.raw_user_meta_data->>'passenger_category', 'Regular'),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Ensure authenticated users can insert their own profile matching auth.uid()
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = id);

-- Ensure authenticated users can update their own profile fields
DROP POLICY IF EXISTS "Users can update own profile except role" ON public.profiles;
CREATE POLICY "Users can update own profile except role" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id AND role = (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())));
