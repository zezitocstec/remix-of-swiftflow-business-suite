DO $$
DECLARE
  v_user_id uuid := '848e717a-0ffb-4212-9f5f-2cf3569da246';
  v_company_id uuid;
BEGIN
  -- admin role
  INSERT INTO public.user_roles(user_id, role) VALUES (v_user_id, 'admin')
  ON CONFLICT DO NOTHING;

  -- reaproveita empresa existente se houver
  SELECT id INTO v_company_id FROM public.companies ORDER BY created_at ASC LIMIT 1;
  IF v_company_id IS NULL THEN
    INSERT INTO public.companies(nome) VALUES ('Minha Empresa') RETURNING id INTO v_company_id;
  END IF;

  INSERT INTO public.company_members(user_id, company_id, role)
  VALUES (v_user_id, v_company_id, 'owner')
  ON CONFLICT DO NOTHING;
END $$;