'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ExpenseDocument,
  ExpenseItem,
  Category,
  MonthlyBudget,
  AccountPayable,
  DebtStatus,
  AccountReceivable,
  ReceivableStatus,
} from '@/types';
import { INITIAL_CATEGORIES } from './demo-data';
import { useAuth } from './auth-context';
import { calculateTotalsBreakdown } from '@/lib/utils';
import {
  ensureUUID,
  dbFetchDocuments,
  dbInsertDocument,
  dbUpdateDocument,
  dbDeleteDocument,
  dbFetchDebts,
  dbInsertDebt,
  dbUpdateDebt,
  dbDeleteDebt,
  dbFetchReceivables,
  dbInsertReceivable,
  dbUpdateReceivable,
  dbDeleteReceivable,
  dbClearAllUserData,
} from '@/lib/supabase/db-service';

interface ReceiptsContextType {
  receipts: ExpenseDocument[];
  categories: Category[];
  budgets: MonthlyBudget[];
  debts: AccountPayable[];
  receivables: AccountReceivable[];
  addReceipt: (newDoc: Partial<ExpenseDocument> & { items?: Partial<ExpenseItem>[] }) => ExpenseDocument;
  updateReceipt: (id: string, updatedFields: Partial<ExpenseDocument>) => void;
  deleteReceipt: (id: string) => void;
  updateReceiptItem: (docId: string, itemId: string, updatedFields: Partial<ExpenseItem>) => void;
  addReceiptItem: (docId: string, item: Partial<ExpenseItem>) => void;
  deleteReceiptItem: (docId: string, itemId: string) => void;
  approveReceipt: (id: string) => void;
  rejectReceipt: (id: string) => void;
  addCategory: (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => void;
  updateBudget: (budget: Partial<MonthlyBudget>) => void;
  addDebt: (newDebt: Omit<AccountPayable, 'id' | 'created_at' | 'updated_at' | 'status'>) => AccountPayable;
  markDebtAsPaid: (id: string, paymentMethod?: string) => void;
  unmarkDebtAsPaid: (id: string) => void;
  deleteDebt: (id: string) => void;
  updateDebt: (id: string, fields: Partial<AccountPayable>) => void;
  addReceivable: (newRec: Omit<AccountReceivable, 'id' | 'created_at' | 'updated_at' | 'status'>) => AccountReceivable;
  markReceivableAsCollected: (id: string, paymentMethod?: string) => void;
  unmarkReceivableAsCollected: (id: string) => void;
  deleteReceivable: (id: string) => void;
  updateReceivable: (id: string, fields: Partial<AccountReceivable>) => void;
  resetToDemo: () => void;
  clearAllData: () => Promise<boolean>;
}

const ReceiptsContext = createContext<ReceiptsContextType | undefined>(undefined);

const STORAGE_KEY_RECEIPTS = 'subeboletas_receipts_v1';
const STORAGE_KEY_CATEGORIES = 'subeboletas_categories_v1';
const STORAGE_KEY_BUDGETS = 'subeboletas_budgets_v1';
const STORAGE_KEY_DEBTS = 'subeboletas_debts_v1';
const STORAGE_KEY_RECEIVABLES = 'subeboletas_receivables_v1';
const SYNC_FLAG = 'subeboletas_cloud_synced_v1';

// Firmas de datos demo para filtrado y purga automática en clientes móviles/antiguos
const DEMO_RECEIPT_PREFIX = 'doc-demo-';
const DEMO_MERCHANTS = new Set([
  'Supermercados Lider Express',
  'Sodimac Homecenter',
  'Copec Pronto',
  'Restaurante La Mar',
  'Librería Antártica',
  'Notaría y Conservador Sanhattan',
]);

const DEMO_DEBT_IDS = new Set([
  'debt-1',
  'debt-2',
  'debt-3',
  'debt-4',
  'debt-5',
  'debt-6',
  'debt-7',
  'debt-8',
]);

const DEMO_SUPPLIERS = new Set([
  'Comercializadora e Importadora Papel SpA',
  'Servicio de Impuestos Internos (SII)',
  'Previred - Cotizaciones Previsionales',
  'Banco de Chile - Cuota Crédito Fogape SpA',
  'Entel Empresas Chile',
  'Inmobiliaria Nueva Providencia SpA',
  'Scotiabank Chile - Tarjeta Visa Infinite',
  'Scotiabank - Crédito Consumo Personal',
]);

const DEMO_BUDGET_IDS = new Set(['b-1', 'b-2', 'b-3']);

/**
 * Calcula el estado de vencimiento de cuentas por cobrar
 */
function computeReceivableStatus(dueDate: string, isCollected?: boolean): ReceivableStatus {
  if (isCollected) return 'collected';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 5) return 'due_soon';
  return 'pending';
}

/**
 * Calcula el estado de vencimiento según la fecha actual
 */
function computeDebtStatus(dueDate: string, isPaid?: boolean): DebtStatus {
  if (isPaid) return 'paid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 5) return 'due_soon';
  return 'pending';
}

export function ReceiptsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const currentUserId = user?.id || 'user-active';

  const [receipts, setReceipts] = useState<ExpenseDocument[]>([]);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [debts, setDebts] = useState<AccountPayable[]>([]);
  const [receivables, setReceivables] = useState<AccountReceivable[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar de LocalStorage si existe y purgar automáticamente residuos de datos demo
  useEffect(() => {
    try {
      const savedRecs = localStorage.getItem(STORAGE_KEY_RECEIPTS);
      const savedCats = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      const savedBuds = localStorage.getItem(STORAGE_KEY_BUDGETS);
      const savedDebts = localStorage.getItem(STORAGE_KEY_DEBTS);
      const savedReceivables = localStorage.getItem(STORAGE_KEY_RECEIVABLES);

      if (savedRecs) {
        const parsed: ExpenseDocument[] = JSON.parse(savedRecs);
        const cleanRecs = parsed.filter(
          (r) => !r.id.startsWith(DEMO_RECEIPT_PREFIX) && !DEMO_MERCHANTS.has(r.merchant_name)
        );
        setReceipts(cleanRecs);
        localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(cleanRecs));
      } else {
        setReceipts([]);
      }

      if (savedCats) setCategories(JSON.parse(savedCats));

      if (savedBuds) {
        const parsedBuds: MonthlyBudget[] = JSON.parse(savedBuds);
        const cleanBuds = parsedBuds.filter((b) => !DEMO_BUDGET_IDS.has(b.id));
        setBudgets(cleanBuds);
        localStorage.setItem(STORAGE_KEY_BUDGETS, JSON.stringify(cleanBuds));
      } else {
        setBudgets([]);
      }

      if (savedDebts) {
        const parsedDebts: AccountPayable[] = JSON.parse(savedDebts);
        const cleanDebts = parsedDebts.filter(
          (d) => !DEMO_DEBT_IDS.has(d.id) && !DEMO_SUPPLIERS.has(d.supplier_name)
        );
        const mappedDebts = cleanDebts.map((d) => ({
          ...d,
          status: computeDebtStatus(d.due_date, !!d.paid_at),
        }));
        setDebts(mappedDebts);
        localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(mappedDebts));
      } else {
        setDebts([]);
      }

      if (savedReceivables) {
        const parsedReceivables: AccountReceivable[] = JSON.parse(savedReceivables);
        setReceivables(
          parsedReceivables.map((r) => ({
            ...r,
            status: computeReceivableStatus(r.due_date, !!r.collected_at),
          }))
        );
      } else {
        setReceivables([]);
      }

      // Sincronizar con Supabase (fuente de verdad cuando hay sesión real).
      // La primera vez en cada dispositivo, sube lo que solo existe localmente;
      // después, el estado es exactamente lo que hay en la base de datos.
      const alreadySynced = localStorage.getItem(SYNC_FLAG) === '1';

      const syncCollection = async <T extends { id: string }>(
        fetchRemote: () => Promise<T[] | null>,
        insertRemote: (item: T) => Promise<boolean>,
        localItems: T[],
        apply: (items: T[]) => void
      ): Promise<boolean> => {
        const remote = await fetchRemote();
        if (remote === null) return false; // sin sesión o error: se mantiene lo local
        if (alreadySynced) {
          apply(remote);
          return true;
        }
        const remoteIds = new Set(remote.map((r) => r.id));
        const localOnly = localItems.filter((l) => !remoteIds.has(l.id));
        const results = await Promise.all(localOnly.map((l) => insertRemote(l)));
        // Nunca descartar datos locales: si una subida falla, el item se conserva
        // en este dispositivo y se reintenta en la próxima carga.
        apply([...remote, ...localOnly]);
        return results.every(Boolean);
      };

      const localRecs: ExpenseDocument[] = savedRecs ? JSON.parse(savedRecs) : [];
      const localDebts: AccountPayable[] = savedDebts ? JSON.parse(savedDebts) : [];
      const localRecv: AccountReceivable[] = savedReceivables ? JSON.parse(savedReceivables) : [];

      Promise.all([
        syncCollection(dbFetchDocuments, dbInsertDocument, localRecs, setReceipts),
        syncCollection(
          dbFetchDebts,
          dbInsertDebt,
          localDebts,
          (items) =>
            setDebts(items.map((d) => ({ ...d, status: computeDebtStatus(d.due_date, !!d.paid_at) })))
        ),
        syncCollection(
          dbFetchReceivables,
          dbInsertReceivable,
          localRecv,
          (items) =>
            setReceivables(
              items.map((r) => ({ ...r, status: computeReceivableStatus(r.due_date, !!r.collected_at) }))
            )
        ),
      ]).then((oks) => {
        if (oks.every(Boolean)) localStorage.setItem(SYNC_FLAG, '1');
      });
    } catch (e) {
      console.warn('Error cargando datos de LocalStorage:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Guardar en LocalStorage ante cambios
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(receipts));
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
      localStorage.setItem(STORAGE_KEY_BUDGETS, JSON.stringify(budgets));
      localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(debts));
      localStorage.setItem(STORAGE_KEY_RECEIVABLES, JSON.stringify(receivables));
    } catch (e) {
      console.warn('Error guardando en LocalStorage:', e);
    }
  }, [receipts, categories, budgets, debts, receivables, isLoaded]);

  const addReceipt = (newDoc: Partial<ExpenseDocument> & { items?: Partial<ExpenseItem>[] }) => {
    const docId = ensureUUID();
    const formattedItems: ExpenseItem[] = (newDoc.items || []).map((it) => ({
      id: ensureUUID(it.id),
      expense_document_id: docId,
      original_name: it.original_name || 'Ítem sin nombre',
      normalized_name: it.normalized_name || it.original_name || 'Ítem sin nombre',
      sku: it.sku || null,
      quantity: it.quantity ?? 1,
      unit: it.unit || 'unidad',
      unit_price: it.unit_price ?? 0,
      discount: it.discount ?? 0,
      line_total: it.line_total ?? (it.unit_price ?? 0) * (it.quantity ?? 1),
      category_id: it.category_id || null,
      category_name: it.category_name || 'Varios',
      subcategory_name: it.subcategory_name || null,
      expense_type: it.expense_type || (newDoc.expense_type as any) || 'personal',
      business_percentage: it.business_percentage ?? (newDoc.expense_type === 'business' ? 100 : 0),
      personal_percentage: it.personal_percentage ?? (newDoc.expense_type === 'personal' ? 100 : 0),
      confidence: it.confidence ?? 0.9,
      requires_review: it.requires_review ?? false,
      notes: it.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const breakdown = calculateTotalsBreakdown(formattedItems);

    const doc: ExpenseDocument = {
      id: docId,
      user_id: currentUserId,
      merchant_name: newDoc.merchant_name || 'Comercio por verificar',
      merchant_legal_name: newDoc.merchant_legal_name || null,
      merchant_rut: newDoc.merchant_rut || null,
      merchant_address: newDoc.merchant_address || null,
      receipt_number: newDoc.receipt_number || `B-${Math.floor(100000 + Math.random() * 900000)}`,
      document_type: newDoc.document_type || 'boleta',
      document_date: newDoc.document_date || new Date().toISOString().split('T')[0],
      document_time: newDoc.document_time || '12:00',
      currency: newDoc.currency || 'CLP',
      subtotal: newDoc.subtotal ?? breakdown.itemsSum,
      discount: newDoc.discount ?? 0,
      net_amount: newDoc.net_amount ?? Math.round((newDoc.total_amount || breakdown.itemsSum) / 1.19),
      tax_amount: newDoc.tax_amount ?? Math.round(((newDoc.total_amount || breakdown.itemsSum) * 0.19) / 1.19),
      tip: newDoc.tip ?? 0,
      total_amount: newDoc.total_amount ?? breakdown.itemsSum,
      business_total: breakdown.businessTotal,
      personal_total: breakdown.personalTotal,
      expense_type: newDoc.expense_type || (breakdown.businessTotal > 0 && breakdown.personalTotal > 0 ? 'mixed' : breakdown.businessTotal > 0 ? 'business' : 'personal'),
      payment_method: newDoc.payment_method || 'Débito',
      status: newDoc.status || 'needs_review',
      ocr_confidence: newDoc.ocr_confidence ?? 0.88,
      ai_confidence: newDoc.ai_confidence ?? 0.90,
      requires_human_review: newDoc.requires_human_review ?? true,
      purchase_summary: newDoc.purchase_summary || null,
      detected_items_reference: newDoc.detected_items_reference || null,
      category_name: newDoc.category_name || null,
      warnings: newDoc.warnings || [],
      file_name: newDoc.file_name || 'documento_subido.jpg',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: formattedItems,
    };

    setReceipts((prev) => [doc, ...prev]);
    dbInsertDocument(doc);
    return doc;
  };

  const updateReceipt = (id: string, updatedFields: Partial<ExpenseDocument>) => {
    setReceipts((prev) =>
      prev.map((doc) => {
        if (doc.id !== id) return doc;
        const updated = { ...doc, ...updatedFields, updated_at: new Date().toISOString() };
        if (updated.items) {
          const breakdown = calculateTotalsBreakdown(updated.items);
          updated.business_total = breakdown.businessTotal;
          updated.personal_total = breakdown.personalTotal;
          if (breakdown.businessTotal > 0 && breakdown.personalTotal > 0) {
            updated.expense_type = 'mixed';
          }
        }
        return updated;
      })
    );
    dbUpdateDocument(id, updatedFields);
  };

  const deleteReceipt = (id: string) => {
    setReceipts((prev) => prev.filter((d) => d.id !== id));
    dbDeleteDocument(id);
  };

  const updateReceiptItem = (docId: string, itemId: string, updatedFields: Partial<ExpenseItem>) => {
    setReceipts((prev) =>
      prev.map((doc) => {
        if (doc.id !== docId || !doc.items) return doc;
        const updatedItems = doc.items.map((item) => {
          if (item.id !== itemId) return item;
          const updatedItem = { ...item, ...updatedFields, updated_at: new Date().toISOString() };
          if (updatedFields.quantity !== undefined || updatedFields.unit_price !== undefined || updatedFields.discount !== undefined) {
            const qty = updatedFields.quantity ?? item.quantity;
            const price = updatedFields.unit_price ?? item.unit_price;
            const disc = updatedFields.discount ?? item.discount;
            updatedItem.line_total = Math.max(0, qty * price - disc);
          }
          return updatedItem;
        });

        const breakdown = calculateTotalsBreakdown(updatedItems);
        return {
          ...doc,
          items: updatedItems,
          business_total: breakdown.businessTotal,
          personal_total: breakdown.personalTotal,
          expense_type:
            breakdown.businessTotal > 0 && breakdown.personalTotal > 0
              ? 'mixed'
              : breakdown.businessTotal > 0
              ? 'business'
              : 'personal',
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  const addReceiptItem = (docId: string, item: Partial<ExpenseItem>) => {
    setReceipts((prev) =>
      prev.map((doc) => {
        if (doc.id !== docId) return doc;
        const newItem: ExpenseItem = {
          id: `item-${Date.now()}`,
          expense_document_id: docId,
          original_name: item.original_name || 'Nuevo ítem',
          normalized_name: item.normalized_name || item.original_name || 'Nuevo ítem',
          sku: item.sku || null,
          quantity: item.quantity ?? 1,
          unit: item.unit || 'unidad',
          unit_price: item.unit_price ?? 0,
          discount: item.discount ?? 0,
          line_total: item.line_total ?? (item.unit_price ?? 0) * (item.quantity ?? 1),
          category_id: item.category_id || null,
          category_name: item.category_name || 'Varios',
          subcategory_name: item.subcategory_name || null,
          expense_type: item.expense_type || 'personal',
          business_percentage: item.business_percentage ?? 0,
          personal_percentage: item.personal_percentage ?? 100,
          confidence: 1.0,
          requires_review: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const updatedItems = [...(doc.items || []), newItem];
        const breakdown = calculateTotalsBreakdown(updatedItems);

        return {
          ...doc,
          items: updatedItems,
          business_total: breakdown.businessTotal,
          personal_total: breakdown.personalTotal,
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  const deleteReceiptItem = (docId: string, itemId: string) => {
    setReceipts((prev) =>
      prev.map((doc) => {
        if (doc.id !== docId || !doc.items) return doc;
        const updatedItems = doc.items.filter((i) => i.id !== itemId);
        const breakdown = calculateTotalsBreakdown(updatedItems);
        return {
          ...doc,
          items: updatedItems,
          business_total: breakdown.businessTotal,
          personal_total: breakdown.personalTotal,
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  const approveReceipt = (id: string) => {
    updateReceipt(id, {
      status: 'approved',
      requires_human_review: false,
      approved_at: new Date().toISOString(),
      approved_by: 'user-demo-1',
    });
  };

  const rejectReceipt = (id: string) => {
    updateReceipt(id, {
      status: 'rejected',
      requires_human_review: false,
    });
  };

  const addCategory = (cat: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => {
    const newCat: Category = {
      ...cat,
      id: `cat-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setCategories((prev) => [...prev, newCat]);
  };

  const updateBudget = (updated: Partial<MonthlyBudget>) => {
    setBudgets((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...b, ...updated, updated_at: new Date().toISOString() } : b))
    );
  };

  // Métodos de Cuentas por Pagar y Deudas
  const addDebt = (newDebt: Omit<AccountPayable, 'id' | 'created_at' | 'updated_at' | 'status'>) => {
    const debtId = ensureUUID();
    const status = computeDebtStatus(newDebt.due_date, false);

    const created: AccountPayable = {
      ...newDebt,
      id: debtId,
      user_id: currentUserId,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setDebts((prev) => [created, ...prev]);
    dbInsertDebt(created);
    return created;
  };

  const markDebtAsPaid = (id: string, paymentMethod?: string) => {
    const paidAt = new Date().toISOString();
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const paidAmount = d.is_installment_credit ? (d.installment_amount || d.amount) : d.amount;
        return {
          ...d,
          status: 'paid',
          paid_at: paidAt,
          paid_amount: paidAmount,
          payment_method: paymentMethod || 'Transferencia Bancaria',
          updated_at: paidAt,
        };
      })
    );
    dbUpdateDebt(id, {
      status: 'paid',
      paid_at: paidAt,
      payment_method: paymentMethod || 'Transferencia Bancaria',
      updated_at: paidAt,
    });
  };

  const unmarkDebtAsPaid = (id: string) => {
    const updatedAt = new Date().toISOString();
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        return {
          ...d,
          status: computeDebtStatus(d.due_date, false),
          paid_at: null,
          paid_amount: null,
          payment_method: null,
          updated_at: updatedAt,
        };
      })
    );
    dbUpdateDebt(id, {
      status: 'pending',
      paid_at: null,
      paid_amount: null,
      payment_method: null,
      updated_at: updatedAt,
    });
  };

  const deleteDebt = (id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
    dbDeleteDebt(id);
  };

  const updateDebt = (id: string, fields: Partial<AccountPayable>) => {
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const updated = { ...d, ...fields, updated_at: new Date().toISOString() };
        if (fields.due_date || fields.paid_at !== undefined) {
          updated.status = computeDebtStatus(updated.due_date, !!updated.paid_at);
        }
        return updated;
      })
    );
    dbUpdateDebt(id, fields);
  };

  // Métodos de Cuentas por Cobrar y Facturas de Venta
  const addReceivable = (newRec: Omit<AccountReceivable, 'id' | 'created_at' | 'updated_at' | 'status'>) => {
    const recId = ensureUUID();
    const status = computeReceivableStatus(newRec.due_date, false);

    const created: AccountReceivable = {
      ...newRec,
      id: recId,
      user_id: currentUserId,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setReceivables((prev) => [created, ...prev]);
    dbInsertReceivable(created);
    return created;
  };

  const markReceivableAsCollected = (id: string, paymentMethod?: string) => {
    const collectedAt = new Date().toISOString();
    setReceivables((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          status: 'collected',
          collected_at: collectedAt,
          collected_amount: r.total_amount,
          payment_method: paymentMethod || 'Transferencia Bancaria',
          updated_at: collectedAt,
        };
      })
    );
    dbUpdateReceivable(id, {
      status: 'collected',
      collected_at: collectedAt,
      payment_method: paymentMethod || 'Transferencia Bancaria',
      updated_at: collectedAt,
    });
  };

  const unmarkReceivableAsCollected = (id: string) => {
    const updatedAt = new Date().toISOString();
    setReceivables((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          status: computeReceivableStatus(r.due_date, false),
          collected_at: null,
          collected_amount: null,
          payment_method: null,
          updated_at: updatedAt,
        };
      })
    );
    dbUpdateReceivable(id, {
      status: 'pending',
      collected_at: null,
      collected_amount: null,
      payment_method: null,
      updated_at: updatedAt,
    });
  };

  const deleteReceivable = (id: string) => {
    setReceivables((prev) => prev.filter((r) => r.id !== id));
    dbDeleteReceivable(id);
  };

  const updateReceivable = (id: string, fields: Partial<AccountReceivable>) => {
    setReceivables((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...fields, updated_at: new Date().toISOString() };
        if (fields.due_date || fields.collected_at !== undefined) {
          updated.status = computeReceivableStatus(updated.due_date, !!updated.collected_at);
        }
        return updated;
      })
    );
    dbUpdateReceivable(id, fields);
  };

  const resetToDemo = () => {
    clearAllData();
  };

  const clearAllData = async (): Promise<boolean> => {
    setReceipts([]);
    setDebts([]);
    setReceivables([]);
    setCategories(INITIAL_CATEGORIES);
    setBudgets([]);
    localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_RECEIVABLES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_BUDGETS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
    localStorage.setItem(SYNC_FLAG, '1');

    const ok = await dbClearAllUserData();
    return ok;
  };

  return (
    <ReceiptsContext.Provider
      value={{
        receipts,
        categories,
        budgets,
        debts,
        receivables,
        addReceipt,
        updateReceipt,
        deleteReceipt,
        updateReceiptItem,
        addReceiptItem,
        deleteReceiptItem,
        approveReceipt,
        rejectReceipt,
        addCategory,
        updateBudget,
        addDebt,
        markDebtAsPaid,
        unmarkDebtAsPaid,
        deleteDebt,
        updateDebt,
        addReceivable,
        markReceivableAsCollected,
        unmarkReceivableAsCollected,
        deleteReceivable,
        updateReceivable,
        resetToDemo,
        clearAllData,
      }}
    >
      {children}
    </ReceiptsContext.Provider>
  );
}

export function useReceipts() {
  const context = useContext(ReceiptsContext);
  if (!context) {
    throw new Error('useReceipts debe utilizarse dentro de un ReceiptsProvider');
  }
  return context;
}
