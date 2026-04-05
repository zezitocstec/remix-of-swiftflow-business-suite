
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS razao_social text DEFAULT '',
  ADD COLUMN IF NOT EXISTS nome_fantasia text DEFAULT '',
  ADD COLUMN IF NOT EXISTS inscricao_estadual text DEFAULT '',
  ADD COLUMN IF NOT EXISTS inscricao_municipal text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cep text DEFAULT '',
  ADD COLUMN IF NOT EXISTS logradouro text DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero text DEFAULT '',
  ADD COLUMN IF NOT EXISTS complemento text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bairro text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cidade text DEFAULT '',
  ADD COLUMN IF NOT EXISTS uf text DEFAULT '';
