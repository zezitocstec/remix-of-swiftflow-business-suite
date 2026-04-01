-- Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Add the hash_operator_pin trigger to operators table
CREATE TRIGGER hash_operator_pin_trigger
  BEFORE INSERT OR UPDATE ON public.operators
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_operator_pin();