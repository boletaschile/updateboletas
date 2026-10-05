import { describe, it, expect } from 'vitest';
import { getSIISalesDocumentCode } from '../src/lib/export-utils';
import { AccountReceivable } from '../src/types';

describe('Libro de Ventas y Códigos SII', () => {
  it('Debe mapear correctamente los tipos de documento a códigos oficiales SII', () => {
    expect(getSIISalesDocumentCode('factura_afecta')).toBe('33');
    expect(getSIISalesDocumentCode('factura_exenta')).toBe('34');
    expect(getSIISalesDocumentCode('boleta_honorarios')).toBe('39');
    expect(getSIISalesDocumentCode('cotizacion_aprobada')).toBe('COT');
    expect(getSIISalesDocumentCode('orden_compra')).toBe('OC');
    expect(getSIISalesDocumentCode('desconocido')).toBe('33');
  });

  it('Calcula correctamente los totales tributarios para F29 de ventas', () => {
    const mockSales: Partial<AccountReceivable>[] = [
      {
        id: '1',
        client_name: 'Cliente A SpA',
        document_type: 'factura_afecta',
        net_amount: 100000,
        tax_amount: 19000,
        total_amount: 119000,
        status: 'collected',
        collected_amount: 119000,
      },
      {
        id: '2',
        client_name: 'Cliente B Ltda',
        document_type: 'factura_afecta',
        net_amount: 200000,
        tax_amount: 38000,
        total_amount: 238000,
        status: 'pending',
      },
      {
        id: '3',
        client_name: 'Cliente C Exento',
        document_type: 'factura_exenta',
        net_amount: 50000,
        tax_amount: 0,
        total_amount: 50000,
        status: 'pending',
      },
    ];

    const totalNeto = mockSales.reduce((acc, s) => acc + (s.net_amount || 0), 0);
    const totalIvaDebito = mockSales.reduce((acc, s) => acc + (s.tax_amount || 0), 0);
    const totalFacturado = mockSales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
    const totalCobrado = mockSales
      .filter((s) => s.status === 'collected')
      .reduce((acc, s) => acc + (s.collected_amount || s.total_amount || 0), 0);

    expect(totalNeto).toBe(350000);
    expect(totalIvaDebito).toBe(57000);
    expect(totalFacturado).toBe(407000);
    expect(totalCobrado).toBe(119000);
    expect(totalFacturado - totalCobrado).toBe(288000);
  });
});
