import { describe, it, expect } from 'vitest';
import {
  parseSalesInvoicesFile,
  parsePurchasesInvoicesFile,
} from '../src/lib/invoices-import-utils';

describe('Importación de Facturas de Venta y Compra', () => {
  const sampleSalesCSV = `Tipo Documento,Fecha,Numero,Emisor / Receptor,Rut,Neto,Exento,IVA,Otros impuestos,Total,Pagado,Impago
Factura electrónica emitida,11-09-2026,356,SOCIEDAD LEGAL Y DE COMUNICACIONES RADIO VIADUCTO LIMITADA,77.945.966-7,163607,0,31085,0,194692,0,194692
Factura electrónica emitida,14-09-2026,357,Comercial Sonnda SpA,77.749.784-7,27497,0,5224,0,32721,0,32721
Factura electrónica emitida,15-09-2026,358,COMERCIAL SERAFIN CHAVEZ Y COMPANIA LIMITADA,78.319.560-7,81869,0,15555,0,97424,97424,0
Factura electrónica emitida,17-09-2026,359,SERVICIOS MEDICOS PATRICIO PEREZ Y CIA LIMITADA,76.912.265-6,100000,0,19000,0,119000,0,119000
Factura electrónica emitida,24-09-2026,360,NUTRINGEN SPA,76.113.500-7,355001,0,67450,0,422451,422451,0
Factura electrónica emitida,24-09-2026,361,NUTRINGEN SPA,76.113.500-7,710002,0,134900,0,844902,0,844902
Factura electrónica emitida,25-09-2026,362,IMPORTADORA PACIFIC COLOR S.A.,77.525.500-5,550074,0,104514,0,654588,654588,0`;

  const samplePurchasesCSV = `Nro;Tipo Compra;RUT Proveedor;Razon Social;Folio;Fecha Docto;Fecha Recepcion;Fecha Acuse;Monto Exento;Monto Neto;Monto IVA Recuperable;Monto Iva No Recuperable;Codigo IVA No Rec.;Monto Total;Monto Neto Activo Fijo;IVA Activo Fijo;IVA uso Comun;Impto. Sin Derecho a Credito;IVA No Retenido;Tabacos Puros;Tabacos Cigarrillos;Tabacos Elaborados;NCE o NDE sobre Fact. de Compra;Codigo Otro Impuesto;Valor Otro Impuesto;Tasa Otro Impuesto
1;Del Giro;76399932-7;Koywe Billing SpA;41538;31/08/2026;01/09/2026 09:19:46;;0;9860;1873;;;11733;;;;;0;;;;0;;;;
2;Del Giro;78921690-8;WOM S.A.;18504315;16/09/2026;18/09/2026 05:03:06;;0;20963;3983;;;24946;;;;;0;;;;0;;;;
3;Del Giro;90635000-9;Telefonica Chile S.A;55094424;19/09/2026;20/09/2026 18:41:59;;0;10087;1917;;;12004;;;;;0;;;;0;;;;`;

  it('Debe procesar correctamente las Facturas de Venta emitidas', async () => {
    const summary = await parseSalesInvoicesFile(sampleSalesCSV);

    expect(summary.totalRows).toBe(7);
    expect(summary.validRows).toBe(7);
    expect(summary.invalidRows).toBe(0);
    expect(summary.totalAmount).toBe(2365778);
    expect(summary.totalNeto).toBe(1988050);
    expect(summary.totalIva).toBe(377728);
    expect(summary.totalPaid).toBe(1174463);
    expect(summary.totalUnpaid).toBe(1191315);

    // Primera factura: pendiente
    const row1 = summary.rows[0];
    expect(row1.invoiceNumber).toBe('356');
    expect(row1.clientName).toBe('SOCIEDAD LEGAL Y DE COMUNICACIONES RADIO VIADUCTO LIMITADA');
    expect(row1.clientRut).toBe('77.945.966-7');
    expect(row1.issueDate).toBe('2026-09-11');
    expect(row1.totalAmount).toBe(194692);
    expect(row1.status).toBe('pending');

    // Tercera factura: pagada
    const row3 = summary.rows[2];
    expect(row3.invoiceNumber).toBe('358');
    expect(row3.clientName).toBe('COMERCIAL SERAFIN CHAVEZ Y COMPANIA LIMITADA');
    expect(row3.paidAmount).toBe(97424);
    expect(row3.unpaidAmount).toBe(0);
    expect(row3.status).toBe('collected');
  });

  it('Debe procesar correctamente las Facturas de Compra RCV del SII con delimitador punto y coma', async () => {
    const summary = await parsePurchasesInvoicesFile(samplePurchasesCSV);

    expect(summary.totalRows).toBe(3);
    expect(summary.validRows).toBe(3);
    expect(summary.totalAmount).toBe(48683);
    expect(summary.totalNeto).toBe(40910);
    expect(summary.totalIva).toBe(7773);

    const f1 = summary.rows[0];
    expect(f1.supplierName).toBe('Koywe Billing SpA');
    expect(f1.supplierRut).toBe('76399932-7');
    expect(f1.folio).toBe('41538');
    expect(f1.documentDate).toBe('2026-08-31');
    expect(f1.totalAmount).toBe(11733);
    expect(f1.purchaseType).toBe('Del Giro');

    const f2 = summary.rows[1];
    expect(f2.supplierName).toBe('WOM S.A.');
    expect(f2.supplierRut).toBe('78921690-8');
    expect(f2.folio).toBe('18504315');
    expect(f2.documentDate).toBe('2026-09-16');
    expect(f2.totalAmount).toBe(24946);
  });
});
