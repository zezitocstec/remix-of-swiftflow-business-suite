-- The operators table pin column stores bcrypt hashes (via the hash_operator_pin trigger).
-- The pin is never returned to the client (the frontend query explicitly excludes it).
-- The verify_operator_pin SECURITY DEFINER function handles all PIN verification server-side.
-- No schema changes needed - the current setup is secure. Adding a comment for documentation.
COMMENT ON COLUMN public.operators.pin IS 'Stores bcrypt-hashed PIN. Never expose to clients. Use verify_operator_pin() RPC for validation.';