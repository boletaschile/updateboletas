-- Ejecutar UNA vez en el SQL Editor de Supabase. Seguro de repetir.

-- 1) Columna para guardar la organizaciÃ³n del frontend (ej. 'org-personal')
ALTER TABLE public.expense_documents  ADD COLUMN IF NOT EXISTS org_ref TEXT;
ALTER TABLE public.account_payables   ADD COLUMN IF NOT EXISTS org_ref TEXT;
ALTER TABLE public.accounts_receivable ADD COLUMN IF NOT EXISTS org_ref TEXT;

-- 2) Columnas que la app envÃ­a y podrÃ­an faltar en esquemas antiguos

-- 3) Perfiles para usuarios creados antes del trigger (evita error de clave foránea en user_id)
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, raw_user_meta_data->>'full_name' FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4) Permitir 'cotizacion_aprobada' en el check de tipo de documento
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts_receivable') THEN
    ALTER TABLE public.accounts_receivable DROP CONSTRAINT IF EXISTS accounts_receivable_document_type_check;
    ALTER TABLE public.accounts_receivable ADD CONSTRAINT accounts_receivable_document_type_check 
      CHECK (document_type IN ('factura_afecta', 'factura_exenta', 'boleta_honorarios', 'orden_compra', 'cotizacion_aprobada', 'sin_facturar'));
  END IF;
END $$;
