-- Crea solo lo que falta (accounts_receivable). Seguro de ejecutar varias veces.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.accounts_receivable (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    client_rut TEXT,
    client_contact TEXT,
    service_description TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('factura_afecta', 'factura_exenta', 'boleta_honorarios', 'orden_compra', 'sin_facturar')) DEFAULT 'factura_afecta',
    invoice_number TEXT,
    net_amount BIGINT NOT NULL DEFAULT 0,
    tax_amount BIGINT NOT NULL DEFAULT 0,
    total_amount BIGINT NOT NULL DEFAULT 0,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    reminder_days_before INT NOT NULL DEFAULT 5,
    income_type TEXT NOT NULL CHECK (income_type IN ('business', 'personal')) DEFAULT 'business',
    status TEXT NOT NULL CHECK (status IN ('pending', 'due_soon', 'overdue', 'collected')) DEFAULT 'pending',
    collected_at TIMESTAMPTZ,
    collected_amount BIGINT,
    payment_method TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_receivable_due ON public.accounts_receivable(due_date, status);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_org ON public.accounts_receivable(organization_id);

ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or org accounts receivable" ON public.accounts_receivable;
CREATE POLICY "Users can view own or org accounts receivable" ON public.accounts_receivable FOR SELECT USING (
    user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can manage own or org accounts receivable" ON public.accounts_receivable;
CREATE POLICY "Users can manage own or org accounts receivable" ON public.accounts_receivable FOR ALL USING (
    user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);
