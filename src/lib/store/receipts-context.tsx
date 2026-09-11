'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ExpenseDocument, ExpenseItem, Category, MonthlyBudget, AccountPayable, DebtStatus } from '@/types';
import { DEMO_RECEIPTS, INITIAL_CATEGORIES, DEMO_BUDGETS } from './demo-data';
import { DEMO_DEBTS } from './demo-debts';
import { calculateTotalsBreakdown } from '@/lib/utils';

interface ReceiptsContextType {
  receipts: ExpenseDocument[];
  categories: Category[];
  budgets: MonthlyBudget[];
  debts: AccountPayable[];
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
  deleteDebt: (id: string) => void;
  updateDebt: (id: string, fields: Partial<AccountPayable>) => void;
  resetToDemo: () => void;
  clearAllData: () => void;
}

const ReceiptsContext = createContext<ReceiptsContextType | undefined>(undefined);

const STORAGE_KEY_RECEIPTS = 'subeboletas_receipts_v1';
const STORAGE_KEY_CATEGORIES = 'subeboletas_categories_v1';
const STORAGE_KEY_BUDGETS = 'subeboletas_budgets_v1';
const STORAGE_KEY_DEBTS = 'subeboletas_debts_v1';

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
  const [receipts, setReceipts] = useState<ExpenseDocument[]>(DEMO_RECEIPTS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [budgets, setBudgets] = useState<MonthlyBudget[]>(DEMO_BUDGETS);
  const [debts, setDebts] = useState<AccountPayable[]>(DEMO_DEBTS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar de LocalStorage si existe
  useEffect(() => {
    try {
      const savedRecs = localStorage.getItem(STORAGE_KEY_RECEIPTS);
      const savedCats = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      const savedBuds = localStorage.getItem(STORAGE_KEY_BUDGETS);
      const savedDebts = localStorage.getItem(STORAGE_KEY_DEBTS);

      if (savedRecs) setReceipts(JSON.parse(savedRecs));
      if (savedCats) setCategories(JSON.parse(savedCats));
      if (savedBuds) setBudgets(JSON.parse(savedBuds));
      if (savedDebts) {
        const parsedDebts: AccountPayable[] = JSON.parse(savedDebts);
        setDebts(
          parsedDebts.map((d) => ({
            ...d,
            status: computeDebtStatus(d.due_date, !!d.paid_at),
          }))
        );
      }
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
    } catch (e) {
      console.warn('Error guardando en LocalStorage:', e);
    }
  }, [receipts, categories, budgets, debts, isLoaded]);

  const addReceipt = (newDoc: Partial<ExpenseDocument> & { items?: Partial<ExpenseItem>[] }) => {
    const docId = `doc-${Date.now()}`;
    const formattedItems: ExpenseItem[] = (newDoc.items || []).map((it, idx) => ({
      id: `item-${Date.now()}-${idx}`,
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
      user_id: 'user-demo-1',
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
  };

  const deleteReceipt = (id: string) => {
    setReceipts((prev) => prev.filter((d) => d.id !== id));
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
    const debtId = `debt-${Date.now()}`;
    const status = computeDebtStatus(newDebt.due_date, false);

    const created: AccountPayable = {
      ...newDebt,
      id: debtId,
      user_id: 'user-demo-1',
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setDebts((prev) => [created, ...prev]);
    return created;
  };

  const markDebtAsPaid = (id: string, paymentMethod?: string) => {
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        return {
          ...d,
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_amount: d.amount,
          payment_method: paymentMethod || 'Transferencia Bancaria',
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  const deleteDebt = (id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
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
  };

  const resetToDemo = () => {
    setReceipts(DEMO_RECEIPTS);
    setCategories(INITIAL_CATEGORIES);
    setBudgets(DEMO_BUDGETS);
    setDebts(DEMO_DEBTS);
    localStorage.removeItem(STORAGE_KEY_RECEIPTS);
    localStorage.removeItem(STORAGE_KEY_CATEGORIES);
    localStorage.removeItem(STORAGE_KEY_BUDGETS);
    localStorage.removeItem(STORAGE_KEY_DEBTS);
  };

  const clearAllData = () => {
    setReceipts([]);
    setDebts([]);
    localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify([]));
  };

  return (
    <ReceiptsContext.Provider
      value={{
        receipts,
        categories,
        budgets,
        debts,
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
        deleteDebt,
        updateDebt,
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
