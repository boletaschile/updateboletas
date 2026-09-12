import { getSupabaseBrowserClient, isSupabaseConfigured } from './client';
import {
  ExpenseDocument,
  ExpenseItem,
  AccountPayable,
  AccountReceivable,
  MonthlyBudget,
} from '@/types';

/**
 * Genera o valida un UUID compatible con PostgreSQL
 */
export function ensureUUID(id?: string | null): string {
  if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
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

/* ==============================================================================
 * BOLETAS Y GASTOS (expense_documents & expense_items)
 * ============================================================================== */

export async function dbFetchDocuments(): Promise<ExpenseDocument[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('expense_documents')
      .select('*, items:expense_items(*)')
      .order('document_date', { ascending: false });

    if (error) {
      console.warn('Error fetching expense_documents from Supabase:', error.message);
      return null;
    }
    return data as ExpenseDocument[];
  } catch (err) {
    console.warn('dbFetchDocuments catch error:', err);
    return null;
  }
}

export async function dbInsertDocument(doc: ExpenseDocument): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getSupabaseBrowserClient();
    const cleanDocId = ensureUUID(doc.id);

    // 1. Insertar Documento
    const { items, ...docData } = doc;
    const { error: docError } = await supabase.from('expense_documents').insert([
      {
        ...docData,
        id: cleanDocId,
      },
    ]);

    if (docError) {
      console.warn('Error inserting expense_document to Supabase:', docError.message);
      return false;
    }

    // 2. Insertar Ítems asociados si existen
    if (items && items.length > 0) {
      const itemsPayload = items.map((it) => ({
        ...it,
        id: ensureUUID(it.id),
        expense_document_id: cleanDocId,
      }));

      const { error: itemsError } = await supabase.from('expense_items').insert(itemsPayload);
      if (itemsError) {
        console.warn('Error inserting expense_items to Supabase:', itemsError.message);
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
    const supabase = getSupabaseBrowserClient();
    const { items, ...cleanUpdates } = updates;
    const { error } = await supabase
      .from('expense_documents')
      .update(cleanUpdates)
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
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('account_payables')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) {
      console.warn('Error fetching account_payables:', error.message);
      return null;
    }
    return data as AccountPayable[];
  } catch (err) {
    console.warn('dbFetchDebts catch error:', err);
    return null;
  }
}

export async function dbInsertDebt(debt: AccountPayable): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getSupabaseBrowserClient();
    const cleanId = ensureUUID(debt.id);

    const { error } = await supabase.from('account_payables').insert([
      {
        ...debt,
        id: cleanId,
      },
    ]);

    if (error) {
      console.warn('Error inserting account_payable:', error.message);
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
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('account_payables')
      .update(updates)
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
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('accounts_receivable')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) {
      console.warn('Error fetching accounts_receivable:', error.message);
      return null;
    }
    return data as AccountReceivable[];
  } catch (err) {
    console.warn('dbFetchReceivables catch error:', err);
    return null;
  }
}

export async function dbInsertReceivable(rec: AccountReceivable): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getSupabaseBrowserClient();
    const cleanId = ensureUUID(rec.id);

    const { error } = await supabase.from('accounts_receivable').insert([
      {
        ...rec,
        id: cleanId,
      },
    ]);

    if (error) {
      console.warn('Error inserting accounts_receivable:', error.message);
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
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('accounts_receivable')
      .update(updates)
      .eq('id', id);

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
