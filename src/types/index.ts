export type ExpenseType = 'business' | 'personal' | 'mixed';

export type DocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'failed';

export type DocumentType =
  | 'boleta'
  | 'factura'
  | 'comprobante_transbank'
  | 'ticket'
  | 'otro';

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export type DebtStatus = 'pending' | 'due_soon' | 'overdue' | 'paid';
export type DebtCategory = 'factura_proveedor' | 'credito_bancario' | 'impuesto_f29' | 'previred' | 'servicio_suscripcion' | 'arriendo' | 'tarjeta_credito' | 'otro';

export interface Profile {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  preferred_currency: string;
  date_format: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  rut?: string | null;
  legal_name?: string | null;
  activity?: string | null;
  address?: string | null;
  phone?: string | null;
  type: 'business' | 'personal';
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  members_count?: number;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'business' | 'personal' | 'both';
  icon?: string | null;
  color?: string | null;
  is_active: boolean;
  is_system: boolean;
  user_id?: string | null;
  organization_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseDocument {
  id: string;
  user_id: string;
  organization_id?: string | null;
  uploaded_file_id?: string | null;
  merchant_id?: string | null;

  // Merchant / Document Data
  merchant_name: string;
  merchant_legal_name?: string | null;
  merchant_rut?: string | null;
  merchant_address?: string | null;
  receipt_number?: string | null;
  document_type: DocumentType;
  document_date?: string | null;
  document_time?: string | null;
  currency: string;

  // Amounts in CLP (Integers)
  subtotal: number;
  discount: number;
  net_amount: number;
  tax_amount: number; // IVA
  tip: number;
  total_amount: number;

  // Split Amounts (Mixed Expenses)
  business_total: number;
  personal_total: number;
  expense_type: ExpenseType;

  // Payment
  payment_method?: string | null;
  card_last_four?: string | null;
  authorization_code?: string | null;

  // Status & AI Feedback
  status: DocumentStatus;
  ocr_confidence: number;
  ai_confidence: number;
  requires_human_review: boolean;

  notes?: string | null;
  raw_ocr_text?: string | null;
  ai_raw_response?: Record<string, any> | null;
  warnings?: string[] | null;

  purchase_summary?: string | null;
  detected_items_reference?: string[] | null;
  category_name?: string | null;

  file_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;

  // Conciliación Bancaria
  reconciled_transaction_id?: string | null;
  is_reconciled?: boolean;

  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;

  items?: ExpenseItem[];
}

export interface ExpenseItem {
  id: string;
  expense_document_id: string;
  category_id?: string | null;

  original_name: string;
  normalized_name?: string | null;
  sku?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  line_total: number;

  category_name?: string | null;
  subcategory_name?: string | null;

  expense_type: ExpenseType;
  business_percentage: number;
  personal_percentage: number;

  confidence: number;
  requires_review: boolean;
  notes?: string | null;

  created_at: string;
  updated_at: string;
}

export interface AccountPayable {
  id: string;
  user_id: string;
  organization_id?: string | null;
  supplier_name: string;
  supplier_rut?: string | null;
  document_number?: string | null; // N° Factura o comprobante
  document_type: 'factura' | 'cuota_credito' | 'impuesto' | 'servicio' | 'otro';
  category: DebtCategory;
  amount: number; // Monto en CLP
  issue_date: string; // Fecha de emisión
  due_date: string; // Fecha límite de pago
  reminder_days_before: number; // Días antes para alertar
  expense_type: 'business' | 'personal';
  notes?: string | null;
  status: DebtStatus;
  paid_at?: string | null;
  paid_amount?: number | null;
  payment_method?: string | null;
  is_recurring?: boolean;
  recurring_frequency?: 'monthly' | 'quarterly' | 'annual';

  // Créditos y Préstamos en Cuotas
  is_installment_credit?: boolean;
  installment_current?: number | null; // N° de cuota actual (ej: 4)
  installment_total?: number | null; // Total de cuotas pactadas (ej: 24)
  installment_amount?: number | null; // Valor de la cuota mensual en CLP
  total_credit_amount?: number | null; // Monto total o saldo del crédito en CLP

  created_at: string;
  updated_at: string;
}

export interface MonthlyBudget {
  id: string;
  user_id: string;
  organization_id?: string | null;
  category_id?: string | null;
  year: number;
  month: number;
  budget_type: 'total' | 'business' | 'personal' | 'category';
  amount: number;
  alert_threshold_75: boolean;
  alert_threshold_90: boolean;
  alert_threshold_100: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: string;
  user_id?: string | null;
  organization_id?: string | null;
  date: string;
  description: string;
  amount: number;
  operation_number?: string | null;
  account_name?: string | null;
  bank_name?: string | null;
  matched_receipt_id?: string | null;
  matched_receipt?: ExpenseDocument | null;
  match_confidence?: number;
  status: 'matched' | 'suggested' | 'unmatched';
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  organization_id?: string | null;
  expense_document_id?: string | null;
  action: string;
  previous_state?: string | null;
  new_state?: string | null;
  changed_fields?: Record<string, any> | null;
  details?: string | null;
  created_at: string;
}
