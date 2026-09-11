import { describe, it, expect } from 'vitest';
import { formatCLP, parseCLP, validateRUT, formatRUT, calculateTotalsBreakdown } from '../src/lib/utils';
import { AIReceiptAnalysisResponseSchema } from '../src/lib/ai/schema';

describe('Utilidades Contables y Formato Chileno', () => {
  it('Debe formatear montos en CLP correctamente sin decimales', () => {
    expect(formatCLP(1250000)).toBe('$1.250.000');
    expect(formatCLP(9000)).toBe('$9.000');
    expect(formatCLP(0)).toBe('$0');
    expect(formatCLP(null)).toBe('$0');
  });

  it('Debe parsear strings a montos enteros en CLP', () => {
    expect(parseCLP('$1.250.000')).toBe(1250000);
    expect(parseCLP('45.000')).toBe(45000);
    expect(parseCLP(10000)).toBe(10000);
  });

  it('Debe validar RUTs chilenos con algoritmo Módulo 11', () => {
    expect(validateRUT('99.520.000-7')).toBe(true); // Copec
    expect(validateRUT('76.123.456-0')).toBe(true);
    expect(validateRUT('11.111.111-9')).toBe(false); // RUT con DV incorrecto
    expect(validateRUT('12345')).toBe(false);
  });

  it('Debe formatear RUTs al estilo 12.345.678-K', () => {
    expect(formatRUT('761234567')).toBe('76.123.456-7');
    expect(formatRUT('77890123k')).toBe('77.890.123-K');
  });

  it('Debe calcular correctamente la separación de gastos mixtos', () => {
    const items = [
      {
        line_total: 65000,
        business_percentage: 100,
        personal_percentage: 0,
        expense_type: 'business',
      },
      {
        line_total: 35000,
        business_percentage: 0,
        personal_percentage: 100,
        expense_type: 'personal',
      },
    ];

    const result = calculateTotalsBreakdown(items);
    expect(result.itemsSum).toBe(100000);
    expect(result.businessTotal).toBe(65000);
    expect(result.personalTotal).toBe(35000);
    expect(result.balancedSum).toBe(100000);
  });

  it('Debe validar la respuesta estructurada de la IA con Zod', () => {
    const validAIResponse = {
      document: {
        merchant_name: 'Librería Central',
        legal_name: 'Comercial Central SpA',
        merchant_rut: '76.890.123-4',
        merchant_address: 'Moneda 1020, Santiago',
        receipt_number: 'B-98120',
        document_type: 'boleta',
        date: '2026-09-11',
        time: '12:30',
        currency: 'CLP',
        subtotal: 10000,
        discount: 1000,
        net_amount: 7563,
        tax_amount: 1437,
        tip: 0,
        total: 9000,
        payment_method: 'Débito',
        card_last_four: '1234',
        authorization_code: '581902',
        confidence: 0.95,
      },
      items: [
        {
          original_name: 'RESMA PAPEL CARTA',
          normalized_name: 'Resma Papel Carta 500 hojas',
          sku: 'SKU-001',
          quantity: 1,
          unit: 'unidad',
          unit_price: 10000,
          discount: 1000,
          line_total: 9000,
          category: 'Insumos de oficina',
          subcategory: 'Papelería',
          expense_type: 'business',
          business_percentage: 100,
          personal_percentage: 0,
          confidence: 0.96,
          requires_review: false,
        },
      ],
      warnings: [],
      requires_review: true,
    };

    const parsed = AIReceiptAnalysisResponseSchema.parse(validAIResponse);
    expect(parsed.document.total).toBe(9000);
    expect(parsed.items[0].category).toBe('Insumos de oficina');
  });
});
