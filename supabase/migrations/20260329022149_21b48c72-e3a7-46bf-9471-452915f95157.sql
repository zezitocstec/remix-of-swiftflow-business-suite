
-- Fix: use extensions schema for crypt/gen_salt
CREATE OR REPLACE FUNCTION public.verify_operator_pin(p_operator_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.operators
    WHERE id = p_operator_id
      AND pin = crypt(p_pin, pin)
  );
END;
$$;

-- Also fix the trigger function
CREATE OR REPLACE FUNCTION public.hash_operator_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF length(NEW.pin) < 60 THEN
    NEW.pin := crypt(NEW.pin, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;
