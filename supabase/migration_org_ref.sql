-- Ejecutar UNA vez en el SQL Editor de Supabase. Seguro de repetir.

-- 1) Columna para guardar la organizaciÃ³n del frontend (ej. 'org-personal')
ALTER TABLE public.expense_documents  ADD COLUMN IF NOT EXISTS org_ref TEXT;
ALTER TABLE public.account_payables   ADD COLUMN IF NOT EXISTS org_ref TEXT;
ALTER TABLE public.accounts_receivable ADD COLUMN IF NOT EXISTS org_ref TEXT;

-- 2) Columnas que la app envÃ­a y podrÃ­an faltar en esquemas antiguos

-- 3) Perfiles para usuarios creados antes del trigger (evita error de clave forÃ¡nea en user_id)
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, raw_user_meta_data->>'full_name' FROM auth.users
ON CONFLICT (id) DO NOTHING;
