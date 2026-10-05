import { getSupabaseBrowserClient, isSupabaseConfigured } from './client';
import {
  ExpenseDocument,
  ExpenseItem,
  AccountPayable,
  AccountReceivable,
  MonthlyBudget,
} from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Genera o valida un UUID compatible con PostgreSQL
 */
export function ensureUUID(id?: string | null): string {
  if (id && UUID_RE.test(id)) {
    return id;
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Id del usuario con sesión real en Supabase (null si no hay sesión).
 * El RLS exige user_id = auth.uid(), por eso siempre se usa este valor al escribir.
 */
export async function getAuthUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user?.id) return sessionData.session.user.id;
    const { data: userData } = await supabase.auth.getUser();
    return userData?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Campos de la interfaz que no existen como columnas en expense_documents */
const DOC_VIRTUAL_FIELDS = [
  'items',
  'file_name',
  'file_url',
  'mime_type',
  'category_name',
  'reconciled_transaction_id',
  'is_reconciled',
] as const;

/**
 * Adapta un registro del frontend a la tabla SQL.
 * Las organizaciones del frontend (ej. 'org-personal') no existen en la tabla
 * organizations (FK uuid), por eso su valor se guarda en la columna de texto org_ref.
 */
function toDbRow(row: Record<string, any>, userId: string, drop: readonly string[] = []): Record<string, any> {
  const out: Record<string, any> = { ...row };
  for (const key of drop) delete out[key];
  out.user_id = userId;
  if ('organization_id' in out) {
    out.org_ref = out.organization_id ?? null;
    out.organization_id = null;
  }
  return out;
}

/** Para updates parciales: no fuerza user_id, solo traduce la organización */
function toDbUpdate(row: Record<string, any>, drop: readonly string[] = []): Record<string, any> {
  const out: Record<string, any> = { ...row };
  for (const key of drop) delete out[key];
  delete out.user_id;
  if ('organization_id' in out) {
    out.org_ref = out.organization_id ?? null;
    out.organization_id = null;
  }
  return out;
}

function fromDbRow<T>(row: any): T {
  const out = { ...row };
  if ('org_ref' in out) {
    out.organization_id = out.org_ref ?? null;
    delete out.org_ref;
  }
  return out as T;
}

/* ==============================================================================
 * BOLETAS Y GASTOS (expense_documents & expense_items)
 * ============================================================================== */

export async function dbFetchDocuments(): Promise<ExpenseDocument[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    if (!(await getAuthUserId())) return null;
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('expense_documents')
      .select('*, items:expense_items(*)')
      .order('document_date', { ascending: false });

    if (error) {
      console.warn('Error fetching expense_documents from Supabase:', error.message);
      return null;
    }
    return (data || []).map((d) => fromDbRow<ExpenseDocument>(d));
  } catch (err) {
    console.warn('dbFetchDocuments catch error:', err);
    return null;
  }
}

export async function dbInsertDocument(doc: ExpenseDocument): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      console.warn('dbInsertDocument: sin sesión de Supabase, el documento solo queda en este dispositivo.');
      return false;
    }
    const supabase = getSupabaseBrowserClient();
    const cleanDocId = ensureUUID(doc.id);
    const items = doc.items;

    // 1. Insertar Documento
    const { error: docError } = await supabase.from('expense_documents').insert([
      { ...toDbRow(doc, userId, DOC_VIRTUAL_FIELDS), id: cleanDocId },
    ]);

    if (docError) {
      console.warn('Error inserting expense_document to Supabase:', docError.message, docError.details || '');
      return false;
    }

    // 2. Insertar Ítems asociados si existen
    if (items && items.length > 0) {
      const itemsPayload = items.map((it) => ({
        ...it,
        id: ensureUUID(it.id),
        expense_document_id: cleanDocId,
        category_id: it.category_id && UUID_RE.test(it.category_id) ? it.category_id : null,
      }));

      const { error: itemsError } = await supabase.from('expense_items').insert(itemsPayload);
      if (itemsError) {
        console.warn('Error inserting expense_items to Supabase:', itemsError.message, itemsError.details || '');
      }
    }

    return true;
  } catch (err) {
    console.warn('dbInsertDocument catch error:', err);
    return false;
  }
}

export async function dbUpdateDocument(id: string, updates: Partial<ExpenseDocument>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    if (!(await getAuthUserId())) return false;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('expense_documents')
      .update(toDbUpdate(updates, DOC_VIRTUAL_FIELDS))
      .eq('id', id);

    if (error) {
      console.warn('Error updating expense_document:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('dbUpdateDocument catch error:', err);
    return false;
  }
}

export async function dbDeleteDocument(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    if (!(await getAuthUserId())) return false;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from('expense_documents').delete().eq('id', id);
    if (error) {
      console.warn('Error deleting expense_document:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('dbDeleteDocument catch error:', err);
    return false;
  }
}

/* ==============================================================================
 * CUENTAS POR PAGAR (account_payables)
 * ============================================================================== */

export async function dbFetchDebts(): Promise<AccountPayable[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    if (!(await getAuthUserId())) return null;
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('account_payables')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) {
      console.warn('Error fetching account_payables:', error.message);
      return null;
    }
    return (data || []).map((d) => fromDbRow<AccountPayable>(d));
  } catch (err) {
    console.warn('dbFetchDebts catch error:', err);
    return null;
  }
}

export async function dbInsertDebt(debt: AccountPayable): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const userId = await getAuthUserId();
    if (!userId) return false;
    const supabase = getSupabaseBrowserClient();
    const cleanId = ensureUUID(debt.id);

    const { error } = await supabase.from('account_payables').insert([
      { ...toDbRow(debt, userId), id: cleanId },
    ]);

    if (error) {
      console.warn('Error inserting account_payable:', error.message, error.details || '');
      return false;
    }
    return true;
  } catch (err) {
    console.warn('dbInsertDebt catch error:', err);
    return false;
  }
}

export async function dbUpdateDebt(id: string, updates: Partial<AccountPayable>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    if (!(await getAuthUserId())) return false;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('account_payables')
      .update(toDbUpdate(updates))
      .eq('id', id);

    if (error) {
      console.warn('Error updating account_payable:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('dbUpdateDebt catch error:', err);
    return false;
  }
}

export async function dbDeleteDebt(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    if (!(await getAuthUserId())) return false;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from('account_payables').delete().eq('id', id);
    if (error) {
      console.warn('Error deleting account_payable:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('dbDeleteDebt catch error:', err);
    return false;
  }
}

/* ==============================================================================
 * CUENTAS POR COBRAR (accounts_receivable)
 * ============================================================================== */

export async function dbFetchReceivables(): Promise<AccountReceivable[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    if (!(await getAuthUserId())) return null;
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('accounts_receivable')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) {
      console.warn('Error fetching accounts_receivable:', error.message);
      return null;
    }
    return (data || []).map((d) => fromDbRow<AccountReceivable>(d));
  } catch (err) {
    console.warn('dbFetchReceivables catch error:', err);
    return null;
  }
}

export async function dbInsertReceivable(rec: AccountReceivable): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const userId = await getAuthUserId();
    if (!userId) return false;
    const supabase = getSupabaseBrowserClient();
    const cleanId = ensureUUID(rec.id);

    const payload: Record<string, any> = { ...toDbRow(rec, userId), id: cleanId };

    let { error } = await supabase.from('accounts_receivable').insert([payload]);

    if (error && (error.message.includes('file_') || error.message.includes('column'))) {
      delete payload.file_name;
      delete payload.file_url;
      delete payload.file_size;
      const retry = await supabase.from('accounts_receivable').insert([payload]);
      error = retry.error;
    }

    if (error) {
      console.warn('Error inserting accounts_receivable:', error.message, error.details || '');
      return false;
    }
    return true;
  } catch (err) {
    console.warn('dbInsertReceivable catch error:', err);
    return false;
  }
}

export async function dbUpdateReceivable(id: string, updates: Partial<AccountReceivable>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    if (!(await getAuthUserId())) return false;
    const supabase = getSupabaseBrowserClient();
    const updatePayload: Record<string, any> = toDbUpdate(updates);

    let { error } = await supabase
      .from('accounts_receivable')
      .update(updatePayload)
      .eq('id', id);

    if (error && (error.message.includes('file_') || error.message.includes('column'))) {
      delete updatePayload.file_name;
      delete updatePayload.file_url;
      delete updatePayload.file_size;
      const retry = await supabase
        .from('accounts_receivable')
        .update(updatePayload)
        .eq('id', id);
      error = retry.error;
    }

    if (error) {
      console.warn('Error updating accounts_receivable:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('dbUpdateReceivable catch error:', err);
    return false;
  }
}

export async function dbDeleteReceivable(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    if (!(await getAuthUserId())) return false;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from('accounts_receivable').delete().eq('id', id);
    if (error) {
      console.warn('Error deleting accounts_receivable:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('dbDeleteReceivable catch error:', err);
    return false;
  }
}

/**
 * Elimina todas las boletas, deudas, cobros y presupuestos del usuario en la base de datos Supabase
 */
export async function dbClearAllUserData(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  try {
    const supabase = getSupabaseBrowserClient();
    const userId = await getAuthUserId();
    if (!userId) return false;

    // 1. Borrar boletas y facturas (la cascada en PostgreSQL borra expense_items)
    try {
      await supabase.from('expense_documents').delete().eq('user_id', userId);
      await supabase.from('expense_documents').delete().not('id', 'is', null);
    } catch (e) {
      console.warn('Error clearing expense_documents:', e);
    }

    // 2. Borrar cuentas por pagar
    try {
      await supabase.from('account_payables').delete().eq('user_id', userId);
      await supabase.from('account_payables').delete().not('id', 'is', null);
    } catch (e) {
      console.warn('Error clearing account_payables:', e);
    }

    // 3. Borrar cuentas por cobrar
    try {
      await supabase.from('accounts_receivable').delete().eq('user_id', userId);
      await supabase.from('accounts_receivable').delete().not('id', 'is', null);
    } catch (e) {
      console.warn('Error clearing accounts_receivable:', e);
    }

    // 4. Borrar presupuestos
    try {
      await supabase.from('monthly_budgets').delete().eq('user_id', userId);
      await supabase.from('monthly_budgets').delete().not('id', 'is', null);
    } catch (e) {
      console.warn('Error clearing monthly_budgets:', e);
    }

    // 5. Borrar transacciones bancarias
    try {
      await supabase.from('bank_transactions').delete().eq('user_id', userId);
      await supabase.from('bank_transactions').delete().not('id', 'is', null);
    } catch (e) {
      // Ignorar si la tabla no existe en la base de datos
    }

    return true;
  } catch (err) {
    console.warn('dbClearAllUserData error:', err);
    return false;
  }
}

