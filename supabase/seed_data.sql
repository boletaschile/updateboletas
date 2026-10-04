-- ==============================================================================
-- SCRIPT DE POBLADO DE DATOS (SEED DATA) PARA SUPABASE - BOLETAS CHILE
-- Ejecutar en el SQL Editor de tu proyecto Supabase despues de schema.sql y seed.sql
-- ==============================================================================

DO $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_doc_lider UUID := gen_random_uuid();
    v_doc_sodimac UUID := gen_random_uuid();
    v_doc_copec UUID := gen_random_uuid();
BEGIN
    -- 1. Obtener el usuario activo de Supabase Auth
    SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'AVISO: No se encontro ningun usuario en auth.users. Registrate primero en la app o crea un usuario en Authentication > Users de Supabase y vuelve a ejecutar este script.';
        RETURN;
    END IF;

    -- 2. Asegurar que exista el perfil en public.profiles
    INSERT INTO public.profiles (id, email, full_name, preferred_currency, date_format)
    SELECT v_user_id, email, COALESCE(raw_user_meta_data->>'full_name', 'Usuario BoletasChile'), 'CLP', 'DD/MM/YYYY'
    FROM auth.users WHERE id = v_user_id
    ON CONFLICT (id) DO NOTHING;

    -- 3. Crear Organizacion Empresa si no existe
    SELECT id INTO v_org_id FROM public.organizations WHERE created_by = v_user_id LIMIT 1;
    IF v_org_id IS NULL THEN
        v_org_id := gen_random_uuid();
        INSERT INTO public.organizations (id, name, rut, legal_name, activity, address, phone, created_by)
        VALUES (
            v_org_id,
            'Innovaciones SpA',
            '76.980.123-K',
            'Innovaciones y Tecnologia SpA',
            'Servicios Informaticos y Consultoria',
            'Av. Providencia 1208, Of. 601, Santiago',
            '+56 9 8765 4321',
            v_user_id
        );

        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (v_org_id, v_user_id, 'owner')
        ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;

    -- 4. Insertar Boleta 1: Supermercado Lider (Gasto Personal)
    INSERT INTO public.expense_documents (
        id, user_id, organization_id, merchant_name, merchant_legal_name, merchant_rut,
        merchant_address, receipt_number, document_type, document_date, document_time,
        currency, subtotal, discount, net_amount, tax_amount, tip, total_amount,
        business_total, personal_total, expense_type, payment_method, card_last_four,
        status, ocr_confidence, ai_confidence, requires_human_review, purchase_summary, notes
    ) VALUES (
        v_doc_lider, v_user_id, NULL, 'Supermercados Lider Express', 'Walmart Chile S.A.', '76.123.456-7',
        'Av. Providencia 1234, Santiago', 'B-894120', 'boleta', CURRENT_DATE - INTERVAL '4 days', '18:45',
        'CLP', 48900, 3500, 38151, 7249, 0, 45400,
        0, 45400, 'personal', 'Tarjeta Debito', '4592',
        'approved', 0.96, 0.98, FALSE, 'Compra semanal de abarrotes y aseo del hogar', 'Compra personal fin de semana'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.expense_items (
        id, expense_document_id, original_name, normalized_name, quantity, unit,
        unit_price, discount, line_total, category_name, expense_type, business_percentage, personal_percentage, confidence
    ) VALUES
    (gen_random_uuid(), v_doc_lider, 'LECHE DESCREMADA 1L', 'Leche Descremada 1L Colun', 4, 'unidad', 1190, 0, 4760, 'Supermercado', 'personal', 0, 100, 0.98),
    (gen_random_uuid(), v_doc_lider, 'ARROZ GRADO 1 1KG', 'Arroz Grado 1 Miraflores 1kg', 2, 'unidad', 1690, 0, 3380, 'Supermercado', 'personal', 0, 100, 0.97),
    (gen_random_uuid(), v_doc_lider, 'DETERGENTE LIQUIDO 3L', 'Detergente Omo 3 Litros', 1, 'unidad', 14990, 3500, 11490, 'Supermercado', 'personal', 0, 100, 0.95),
    (gen_random_uuid(), v_doc_lider, 'PACK CARNE MOLIDA 5% 500G', 'Carne Vacuno Molida 5%', 2, 'unidad', 5990, 0, 11980, 'Supermercado', 'personal', 0, 100, 0.96)
    ON CONFLICT (id) DO NOTHING;

    -- 5. Insertar Boleta 2: Sodimac Homecenter (Gasto Mixto Empresa/Personal)
    INSERT INTO public.expense_documents (
        id, user_id, organization_id, merchant_name, merchant_legal_name, merchant_rut,
        merchant_address, receipt_number, document_type, document_date, document_time,
        currency, subtotal, discount, net_amount, tax_amount, tip, total_amount,
        business_total, personal_total, expense_type, payment_method, card_last_four,
        status, ocr_confidence, ai_confidence, requires_human_review, purchase_summary, notes
    ) VALUES (
        v_doc_sodimac, v_user_id, v_org_id, 'Sodimac Homecenter', 'Sodimac S.A.', '96.792.430-K',
        'Av. Las Condes 11049, Las Condes', 'F-451298', 'factura', CURRENT_DATE - INTERVAL '2 days', '11:20',
        'CLP', 82990, 0, 69739, 13251, 0, 82990,
        55000, 27990, 'mixed', 'Transferencia', NULL,
        'approved', 0.94, 0.95, FALSE, 'Materiales de iluminacion oficina y repisas bodega', 'Factura electronica con RUT de empresa'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.expense_items (
        id, expense_document_id, original_name, normalized_name, quantity, unit,
        unit_price, discount, line_total, category_name, expense_type, business_percentage, personal_percentage, confidence
    ) VALUES
    (gen_random_uuid(), v_doc_sodimac, 'PANEL LED EMBUTIDO 60X60', 'Panel LED 60x60 para techo oficina', 2, 'unidad', 27500, 0, 55000, 'Equipos tecnologicos', 'business', 100, 0, 0.95),
    (gen_random_uuid(), v_doc_sodimac, 'ORGANIZADOR PLASTICO 4C', 'Caja Organizadora Plastica 40L', 2, 'unidad', 13995, 0, 27990, 'Insumos de oficina', 'personal', 0, 100, 0.92)
    ON CONFLICT (id) DO NOTHING;

    -- 6. Insertar Boleta 3: Copec Pronto (Gasto Empresa Combustible)
    INSERT INTO public.expense_documents (
        id, user_id, organization_id, merchant_name, merchant_legal_name, merchant_rut,
        merchant_address, receipt_number, document_type, document_date, document_time,
        currency, subtotal, discount, net_amount, tax_amount, tip, total_amount,
        business_total, personal_total, expense_type, payment_method,
        status, ocr_confidence, ai_confidence, requires_human_review, purchase_summary
    ) VALUES (
        v_doc_copec, v_user_id, v_org_id, 'Copec Pronto', 'Compania de Petroleos de Chile Copec S.A.', '99.520.000-7',
        'Autopista Central Km 14, Santiago', 'B-1192834', 'boleta', CURRENT_DATE - INTERVAL '1 days', '08:30',
        'CLP', 38000, 0, 31933, 6067, 0, 38000,
        38000, 0, 'business', 'Tarjeta Debito',
        'approved', 0.98, 0.97, FALSE, 'Carga de combustible diesel para visitas a terreno'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.expense_items (
        id, expense_document_id, original_name, normalized_name, quantity, unit,
        unit_price, discount, line_total, category_name, expense_type, business_percentage, personal_percentage, confidence
    ) VALUES
    (gen_random_uuid(), v_doc_copec, 'DIESEL ULTRA LIMPIO', 'Combustible Diesel 34 Litros', 34, 'litro', 1117, 0, 38000, 'Transporte y combustible', 'business', 100, 0, 0.99)
    ON CONFLICT (id) DO NOTHING;

    -- 7. Insertar Cuentas por Pagar (Account Payables)
    INSERT INTO public.account_payables (
        id, user_id, organization_id, supplier_name, supplier_rut, document_number,
        document_type, category, amount, issue_date, due_date, reminder_days_before,
        expense_type, notes, status, is_recurring, recurring_frequency
    ) VALUES
    (
        gen_random_uuid(), v_user_id, v_org_id, 'Servicio de Impuestos Internos (SII)', '60.805.000-0',
        'F29-09-2026', 'impuesto', 'impuesto_f29', 215000, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '8 days',
        5, 'business', 'Declaracion y pago mensual Formulario 29 (IVA)', 'due_soon', TRUE, 'monthly'
    ),
    (
        gen_random_uuid(), v_user_id, v_org_id, 'Previred - Cotizaciones Previsionales', '96.950.120-K',
        'PREV-202609', 'impuesto', 'previred', 185000, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '2 days',
        3, 'business', 'Cotizaciones previsionales AFP, Fonasa y Mutual', 'due_soon', TRUE, 'monthly'
    ),
    (
        gen_random_uuid(), v_user_id, v_org_id, 'Comercializadora e Importadora Papel SpA', '76.890.450-2',
        'F-88912', 'factura', 'factura_proveedor', 340000, CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '10 days',
        5, 'business', 'Compra de resmas e insumos a 30 dias credito', 'pending', FALSE, NULL
    );

    -- 8. Insertar Cuentas por Cobrar (Accounts Receivable)
    INSERT INTO public.accounts_receivable (
        id, user_id, organization_id, client_name, client_rut, client_contact,
        service_description, document_type, invoice_number, net_amount, tax_amount, total_amount,
        issue_date, due_date, reminder_days_before, income_type, status, notes
    ) VALUES
    (
        gen_random_uuid(), v_user_id, v_org_id, 'Retail & Logistica del Sur S.A.', '77.234.567-8', 'contacto@retailsur.cl',
        'Desarrollo e integracion de modulo de reporteria financiera en la nube', 'factura_afecta', 'F-00124',
        1850000, 351500, 2201500, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days',
        5, 'business', 'pending', 'Pago acordado a 30 dias fecha factura'
    ),
    (
        gen_random_uuid(), v_user_id, v_org_id, 'Consultora Creativa Valparaiso Ltda.', '76.456.789-1', 'finanzas@consultoracreativa.cl',
        'Consultoria de optimizacion contable y automatizacion de gastos', 'factura_afecta', 'F-00125',
        750000, 142500, 892500, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days',
        5, 'business', 'pending', 'Factura emitida con orden de compra OC-992'
    );

    RAISE NOTICE 'Datos sembrados con exito en la base de datos de Supabase para el usuario %', v_user_id;
END $$;
