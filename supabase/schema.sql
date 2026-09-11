-- ==============================================================================
-- SCHEMA COMPLETO DEL SISTEMA DE BOLETAS Y GESTIÓN DE GASTOS (CHILE)
-- ==============================================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PERFILES DE USUARIOS (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    preferred_currency TEXT DEFAULT 'CLP',
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ORGANIZACIONES / EMPRESAS
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    rut TEXT,
    legal_name TEXT,
    activity TEXT,
    address TEXT,
    phone TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. MIEMBROS DE ORGANIZACIÓN (Multi-tenant access)
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')) DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- 4. COMERCIOS (Merchants)
CREATE TABLE IF NOT EXISTS public.merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    legal_name TEXT,
    rut TEXT,
    address TEXT,
    city TEXT,
    category_suggestion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CATEGORÍAS Y SUBCATEGORÍAS
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('business', 'personal', 'both')) DEFAULT 'both',
    icon TEXT,
    color TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. REGLAS DE CATEGORIZACIÓN DINÁMICA
CREATE TABLE IF NOT EXISTS public.subcategory_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    merchant_name TEXT,
    target_category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    target_subcategory TEXT,
    default_expense_type TEXT CHECK (default_expense_type IN ('business', 'personal', 'mixed')) DEFAULT 'business',
    confidence_threshold NUMERIC(3,2) DEFAULT 0.85,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ARCHIVOS SUBIDOS (Uploaded Files / Backups)
CREATE TABLE IF NOT EXISTS public.uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'receipts-private',
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    sha256_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. DOCUMENTOS DE GASTO (Boletas / Facturas / Comprobantes)
CREATE TABLE IF NOT EXISTS public.expense_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    uploaded_file_id UUID REFERENCES public.uploaded_files(id) ON DELETE SET NULL,
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
    
    -- Datos detectados de cabecera
    merchant_name TEXT NOT NULL,
    merchant_legal_name TEXT,
    merchant_rut TEXT,
    merchant_address TEXT,
    receipt_number TEXT,
    document_type TEXT DEFAULT 'boleta' CHECK (document_type IN ('boleta', 'factura', 'comprobante_transbank', 'ticket', 'otro')),
    document_date DATE,
    document_time TIME,
    currency TEXT NOT NULL DEFAULT 'CLP',
    
    -- Montos en CLP
    subtotal BIGINT DEFAULT 0,
    discount BIGINT DEFAULT 0,
    net_amount BIGINT DEFAULT 0,
    tax_amount BIGINT DEFAULT 0, -- IVA u otros impuestos
    tip BIGINT DEFAULT 0,
    total_amount BIGINT NOT NULL,
    
    -- Subtotales por tipo de gasto (Gastos Mixtos)
    business_total BIGINT DEFAULT 0,
    personal_total BIGINT DEFAULT 0,
    expense_type TEXT NOT NULL CHECK (expense_type IN ('business', 'personal', 'mixed')) DEFAULT 'personal',
    
    -- Información de pago
    payment_method TEXT,
    card_last_four TEXT,
    authorization_code TEXT,
    
    -- Estado del documento y flujo
    status TEXT NOT NULL CHECK (status IN ('uploaded', 'processing', 'needs_review', 'approved', 'rejected', 'failed')) DEFAULT 'uploaded',
    ocr_confidence NUMERIC(4,3) DEFAULT 0.0,
    ai_confidence NUMERIC(4,3) DEFAULT 0.0,
    requires_human_review BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Notas y metadatos
    purchase_summary TEXT,
    detected_items_reference JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    raw_ocr_text TEXT,
    ai_raw_response JSONB,
    warnings JSONB DEFAULT '[]'::jsonb,
    
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. DETALLE DE PRODUCTOS / ÍTEMS DE LA BOLETA
CREATE TABLE IF NOT EXISTS public.expense_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_document_id UUID NOT NULL REFERENCES public.expense_documents(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    
    original_name TEXT NOT NULL,
    normalized_name TEXT,
    sku TEXT,
    quantity NUMERIC(10,3) NOT NULL DEFAULT 1.0,
    unit TEXT DEFAULT 'unidad',
    unit_price BIGINT NOT NULL,
    discount BIGINT DEFAULT 0,
    line_total BIGINT NOT NULL,
    
    category_name TEXT,
    subcategory_name TEXT,
    
    expense_type TEXT NOT NULL CHECK (expense_type IN ('business', 'personal', 'mixed')) DEFAULT 'personal',
    business_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.0 CHECK (business_percentage >= 0 AND business_percentage <= 100),
    personal_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.0 CHECK (personal_percentage >= 0 AND personal_percentage <= 100),
    
    confidence NUMERIC(4,3) DEFAULT 0.0,
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. DETECCIÓN DE DUPLICADOS
CREATE TABLE IF NOT EXISTS public.duplicate_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_document_id UUID NOT NULL REFERENCES public.expense_documents(id) ON DELETE CASCADE,
    matched_document_id UUID NOT NULL REFERENCES public.expense_documents(id) ON DELETE CASCADE,
    match_score NUMERIC(4,3) NOT NULL,
    match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolution_action TEXT CHECK (resolution_action IN ('kept_both', 'rejected_new', 'deleted_old')),
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. PRESUPUESTOS MENSUALES
CREATE TABLE IF NOT EXISTS public.monthly_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    
    year INT NOT NULL,
    month INT NOT NULL CHECK (month >= 1 AND month <= 12),
    
    budget_type TEXT NOT NULL CHECK (budget_type IN ('total', 'business', 'personal', 'category')) DEFAULT 'total',
    amount BIGINT NOT NULL,
    alert_threshold_75 BOOLEAN DEFAULT TRUE,
    alert_threshold_90 BOOLEAN DEFAULT TRUE,
    alert_threshold_100 BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, organization_id, category_id, year, month, budget_type)
);

-- 12. BITÁCORA DE AUDITORÍA (Audit Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    expense_document_id UUID REFERENCES public.expense_documents(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    changed_fields JSONB,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. CUENTAS POR PAGAR & VENCIMIENTOS (Account Payables)
CREATE TABLE IF NOT EXISTS public.account_payables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    supplier_name TEXT NOT NULL,
    supplier_rut TEXT,
    document_number TEXT,
    document_type TEXT NOT NULL CHECK (document_type IN ('factura', 'cuota_credito', 'impuesto', 'servicio', 'otro')) DEFAULT 'factura',
    category TEXT NOT NULL DEFAULT 'factura_proveedor',
    amount NUMERIC(14,2) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    reminder_days_before INT NOT NULL DEFAULT 5,
    expense_type TEXT NOT NULL CHECK (expense_type IN ('business', 'personal')) DEFAULT 'business',
    notes TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'due_soon', 'overdue', 'paid', 'cancelled')) DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    paid_amount NUMERIC(14,2),
    payment_method TEXT,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurring_frequency TEXT CHECK (recurring_frequency IN ('monthly', 'quarterly', 'annual')),
    
    -- Créditos y Préstamos en Cuotas
    is_installment_credit BOOLEAN DEFAULT FALSE,
    installment_current INT,
    installment_total INT,
    installment_amount BIGINT,
    total_credit_amount BIGINT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. MOVIMIENTOS BANCARIOS Y CONCILIACIÓN (Bank Transactions)
CREATE TABLE IF NOT EXISTS public.bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    operation_number TEXT,
    bank_name TEXT,
    account_name TEXT,
    matched_receipt_id UUID REFERENCES public.expense_documents(id) ON DELETE SET NULL,
    match_confidence NUMERIC(3,2),
    status TEXT NOT NULL CHECK (status IN ('matched', 'suggested', 'unmatched')) DEFAULT 'unmatched',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ÍNDICES PARA ALTO RENDIMIENTO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_expense_docs_user_date ON public.expense_documents(user_id, document_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_docs_org_date ON public.expense_documents(organization_id, document_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_docs_status ON public.expense_documents(status);
CREATE INDEX IF NOT EXISTS idx_expense_items_doc ON public.expense_items(expense_document_id);
CREATE INDEX IF NOT EXISTS idx_expense_items_cat ON public.expense_items(category_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_hash ON public.uploaded_files(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_budgets_lookup ON public.monthly_budgets(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_account_payables_due ON public.account_payables(due_date, status);
CREATE INDEX IF NOT EXISTS idx_account_payables_org ON public.account_payables(organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_org ON public.bank_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON public.bank_transactions(date);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategory_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: usuario puede ver y editar solo su perfil
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Categories: ver categorías de sistema o propias / de su organización
CREATE POLICY "Users can view accessible categories" ON public.categories FOR SELECT USING (
    is_system = TRUE OR user_id = auth.uid() OR organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);
CREATE POLICY "Users can manage own categories" ON public.categories FOR ALL USING (
    user_id = auth.uid() OR organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
);

-- Expense Documents: aislamiento total por usuario u organización
CREATE POLICY "Users can view own or org expense documents" ON public.expense_documents FOR SELECT USING (
    user_id = auth.uid() OR organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);
CREATE POLICY "Users can insert own expense documents" ON public.expense_documents FOR INSERT WITH CHECK (
    user_id = auth.uid()
);
CREATE POLICY "Users can update own expense documents" ON public.expense_documents FOR UPDATE USING (
    user_id = auth.uid() OR organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
);
CREATE POLICY "Users can delete own expense documents" ON public.expense_documents FOR DELETE USING (
    user_id = auth.uid() OR organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
);

-- Expense Items: permiso heredado del documento
CREATE POLICY "Users can view items of accessible documents" ON public.expense_items FOR SELECT USING (
    expense_document_id IN (SELECT id FROM public.expense_documents WHERE user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Users can manage items of own documents" ON public.expense_items FOR ALL USING (
    expense_document_id IN (SELECT id FROM public.expense_documents WHERE user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')))
);

-- Presupuestos (Monthly Budgets)
CREATE POLICY "Users can view own budgets" ON public.monthly_budgets FOR SELECT USING (
    user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can manage own budgets" ON public.monthly_budgets FOR ALL USING (
    user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Cuentas por Pagar (Account Payables)
CREATE POLICY "Users can view own or org account payables" ON public.account_payables FOR SELECT USING (
    user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can manage own or org account payables" ON public.account_payables FOR ALL USING (
    user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Movimientos Bancarios (Bank Transactions)
CREATE POLICY "Users can view own or org bank transactions" ON public.bank_transactions FOR SELECT USING (
    user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can manage own or org bank transactions" ON public.bank_transactions FOR ALL USING (
    user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Trigger para auto-crear perfil al registrarse en Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
