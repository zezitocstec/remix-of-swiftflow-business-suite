-- Adds default number of receipt copies (1, 2, or 3) to restaurant_settings.
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS receipt_copies smallint NOT NULL DEFAULT 1
  CHECK (receipt_copies >= 1 AND receipt_copies <= 3);
