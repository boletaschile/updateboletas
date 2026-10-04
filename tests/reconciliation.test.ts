import { describe, it, expect } from 'vitest';
import { reconcileTransactions } from '../src/lib/bank/reconciliation-service';
import { DEMO_BANK_TRANSACTIONS } from '../src/lib/bank/demo-bank-statement';
import { DEMO_RECEIPTS } from '../src/lib/store/demo-data';
import { BankTransaction, ExpenseDocument } from '../src/types';

describe('Conciliación Bancaria Automática', () => {
  it('debe conciliar transacciones bancarias idénticas con sus boletas (Monto + Fecha + Glosa)', () => {
    const transactions: BankTransaction[] = [
      {
        id: 'tx-1',
        date: '2026-09-10',
        description: 'COMPRA COPEC ESTACION LAS CONDES',
        amount: 42000,
        operation_number: 'OP-001',
        bank_name: 'Banco de Chile',
        status: 'unmatched',
      },
    ];

    const receipts: ExpenseDocument[] = [
      {
        id: 'rec-1',
        user_id: 'user-1',
        merchant_name: 'Copec Estación Las Condes',
        document_date: '2026-09-10',
        total_amount: 42000,
        expense_type: 'business',
        status: 'approved',
        currency: 'CLP',
        net_amount: 35294,
        tax_amount: 6706,
        subtotal: 42000,
        discount: 0,
        tip: 0,
        receipt_number: 'B-771923',
        document_type: 'boleta',
        file_name: 'boleta.jpg',
        created_at: '2026-09-10',
        updated_at: '2026-09-10',
        items: [],
      },
    ];

    const result = reconcileTransactions(transactions, receipts);
    expect(result[0].status).toBe('matched');
    expect(result[0].matched_receipt_id).toBe('rec-1');
    expect(result[0].match_confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('debe sugerir coincidencia cuando el monto coincide pero hay variación de días o nombre parcial', () => {
    const transactions: BankTransaction[] = [
      {
        id: 'tx-2',
        date: '2026-09-11',
        description: 'LIDER EXPRESS SANTA ISABEL',
        amount: 45400,
        operation_number: 'OP-002',
        status: 'unmatched',
      },
    ];

    const receipts: ExpenseDocument[] = [
      {
        id: 'rec-2',
        user_id: 'user-1',
        merchant_name: 'Supermercados Lider Express',
        document_date: '2026-09-08',
        total_amount: 45400,
        expense_type: 'personal',
        status: 'approved',
        currency: 'CLP',
        net_amount: 38151,
        tax_amount: 7249,
        subtotal: 45400,
        discount: 0,
        tip: 0,
        receipt_number: 'B-1029',
        document_type: 'boleta',
        file_name: 'boleta.jpg',
        created_at: '2026-09-08',
        updated_at: '2026-09-08',
        items: [],
      },
    ];

    const result = reconcileTransactions(transactions, receipts);
    expect(result[0].status).toMatch(/matched|suggested/);
    expect(result[0].matched_receipt_id).toBe('rec-2');
  });

  it('debe marcar como "unmatched" cuando no existe boleta con el mismo monto', () => {
    const transactions: BankTransaction[] = [
      {
        id: 'tx-unmatched',
        date: '2026-09-01',
        description: 'CARGO MENSUAL MANTENCION CUENTA',
        amount: 14500,
        operation_number: 'COM-001',
        status: 'unmatched',
      },
    ];

    const receipts: ExpenseDocument[] = [
      {
        id: 'rec-other',
        user_id: 'user-1',
        merchant_name: 'Copec',
        document_date: '2026-09-01',
        total_amount: 42000,
        expense_type: 'business',
        status: 'approved',
        currency: 'CLP',
        net_amount: 35294,
        tax_amount: 6706,
        subtotal: 42000,
        discount: 0,
        tip: 0,
        receipt_number: 'B-1',
        document_type: 'boleta',
        file_name: 'boleta.jpg',
        created_at: '2026-09-01',
        updated_at: '2026-09-01',
        items: [],
      },
    ];

    const result = reconcileTransactions(transactions, receipts);
    expect(result[0].status).toBe('unmatched');
    expect(result[0].matched_receipt_id).toBeNull();
  });

  it('debe conciliar correctamente la cartola demo contra los comprobantes demo', () => {
    const result = reconcileTransactions(DEMO_BANK_TRANSACTIONS, DEMO_RECEIPTS);

    const matched = result.filter((t) => t.status === 'matched');
    const suggested = result.filter((t) => t.status === 'suggested');
    const unmatched = result.filter((t) => t.status === 'unmatched');

    // Debe encontrar al menos 4 coincidencias exactas (Copec, Prat, Lider, Sodimac, Adobe)
    expect(matched.length).toBeGreaterThanOrEqual(4);

    // Debe dejar sin conciliar cargos sin boleta como mantención de cuenta y giro cajero
    expect(unmatched.length).toBeGreaterThanOrEqual(3);

    // No debe asignar el mismo comprobante a dos cargos distintos
    const matchedDocIds = result
      .map((t) => t.matched_receipt_id)
      .filter((id): id is string => Boolean(id));
    const uniqueDocIds = new Set(matchedDocIds);
    expect(matchedDocIds.length).toBe(uniqueDocIds.size);
  });
});
