import * as XLSX from 'xlsx';
import { ExpenseDocument, Organization, BankTransaction, AccountPayable } from '@/types';
import { formatDateCL, formatCLP } from './utils';

/**
 * Retorna el código de documento tributario según el SII de Chile
 */
export function getSIIDocumentCode(docType: string): string {
  switch (docType) {
    case 'factura':
      return '33'; // Factura Electrónica
    case 'boleta':
      return '39'; // Boleta Electrónica
    case 'comprobante_transbank':
      return '48'; // Comprobante Pago Electrónico / Voucher
    case 'ticket':
      return '39';
    default:
      return '39';
  }
}

/**
 * Exporta el reporte de Cuentas por Pagar y Vencimientos a Excel
 */
export function exportDebtsToExcel(
  debts: AccountPayable[],
  company?: Organization | null
) {
  const rows = debts.map((d, idx) => ({
    'N°': idx + 1,
    'Proveedor / Acreedor': d.supplier_name,
    'RUT': d.supplier_rut || '-',
    'N° Documento': d.document_number || 'S/N',
    'Tipo Deuda': d.category.replace(/_/g, ' ').toUpperCase(),
    'Monto Compromiso (CLP)': d.amount,
    'Fecha Emisión': formatDateCL(d.issue_date),
    'Fecha Límite Vencimiento': formatDateCL(d.due_date),
    'Estado': d.status === 'paid' ? 'PAGADA' : d.status === 'overdue' ? 'VENCIDA (ALERTA)' : d.status === 'due_soon' ? 'POR VENCER PRONTO' : 'PENDIENTE',
    'Fecha de Pago': d.paid_at ? formatDateCL(d.paid_at) : '-',
    'Medio de Pago': d.payment_method || '-',
    'Ámbito': d.expense_type === 'business' ? 'Empresa' : 'Personal',
    'Notas': d.notes || '',
  }));

  const pendingDebts = debts.filter((d) => d.status !== 'paid');
  const overdueDebts = debts.filter((d) => d.status === 'overdue');
  const totalPendingAmount = pendingDebts.reduce((acc, d) => acc + d.amount, 0);
  const totalOverdueAmount = overdueDebts.reduce((acc, d) => acc + d.amount, 0);

  const summary = [
    { 'Concepto': 'Empresa / Cuenta', 'Valor': company?.name || 'Estudio Creativo SpA' },
    { 'Concepto': 'Fecha del Reporte', 'Valor': formatDateCL(new Date()) },
    { 'Concepto': 'Total Cuentas Registradas', 'Valor': debts.length },
    { 'Concepto': 'Cuentas Pendientes de Pago', 'Valor': pendingDebts.length },
    { 'Concepto': 'Cuentas Vencidas en Alerta', 'Valor': overdueDebts.length },
    { 'Concepto': 'Monto Total Pendiente por Pagar', 'Valor': totalPendingAmount },
    { 'Concepto': 'Monto Vencido Expirado', 'Valor': totalOverdueAmount },
  ];

  const wb = XLSX.utils.book_new();
  const wsRows = XLSX.utils.json_to_sheet(rows);
  const wsSummary = XLSX.utils.json_to_sheet(summary);

  XLSX.utils.book_append_sheet(wb, wsRows, 'Cuentas por Pagar');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Financiero');

  const fileName = `Cuentas_por_Pagar_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Exporta el Informe de Conciliación Bancaria en Excel (.xlsx)
 */
export function exportBankReconciliationExcel(
  transactions: BankTransaction[],
  company?: Organization | null
) {
  const rows = transactions.map((tx, idx) => {
    const isMatched = tx.status === 'matched' || (tx.status === 'suggested' && tx.matched_receipt);
    return {
      'N° Operación': tx.operation_number || `OP-${idx + 1}`,
      'Fecha Banco': formatDateCL(tx.date),
      'Glosa / Descripción Banco': tx.description,
      'Cargo Banco (CLP)': tx.amount,
      'Estado Conciliación': isMatched ? 'CONCILIADO' : 'PENDIENTE DE BOLETA',
      'Comercio Cotejado': tx.matched_receipt?.merchant_name || 'Sin Boleta',
      'N° Boleta Vinculada': tx.matched_receipt?.receipt_number || '-',
      'Total Boleta (CLP)': tx.matched_receipt ? tx.matched_receipt.total_amount : 0,
      'Diferencia (CLP)': tx.matched_receipt ? tx.amount - tx.matched_receipt.total_amount : tx.amount,
      'Confianza Cotejo': tx.match_confidence ? `${Math.round(tx.match_confidence * 100)}%` : '0%',
    };
  });

  const matchedCount = transactions.filter((t) => t.status === 'matched').length;
  const pendingCount = transactions.length - matchedCount;
  const totalBankAmount = transactions.reduce((acc, t) => acc + t.amount, 0);
  const matchedBankAmount = transactions.filter((t) => t.status === 'matched').reduce((acc, t) => acc + t.amount, 0);

  const summary = [
    { 'Concepto Conciliación': 'Empresa', 'Valor': company?.name || 'Estudio Creativo SpA' },
    { 'Concepto Conciliación': 'RUT Empresa', 'Valor': company?.rut || '76.890.123-4' },
    { 'Concepto Conciliación': 'Total Movimientos Bancarios', 'Valor': transactions.length },
    { 'Concepto Conciliación': 'Cargos Conciliados con Boletas', 'Valor': matchedCount },
    { 'Concepto Conciliación': 'Cargos Pendientes de Respaldo', 'Valor': pendingCount },
    { 'Concepto Conciliación': 'Monto Total Cargos Bancarios', 'Valor': totalBankAmount },
    { 'Concepto Conciliación': 'Monto Total Respaldado', 'Valor': matchedBankAmount },
    { 'Concepto Conciliación': '% de Conciliación Bancaria', 'Valor': `${Math.round((matchedBankAmount / (totalBankAmount || 1)) * 100)}%` },
  ];

  const wb = XLSX.utils.book_new();
  const wsRows = XLSX.utils.json_to_sheet(rows);
  const wsSummary = XLSX.utils.json_to_sheet(summary);

  XLSX.utils.book_append_sheet(wb, wsRows, 'Detalle de Conciliacion');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Conciliacion');

  const fileName = `Conciliacion_Bancaria_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Exporta el Libro de Compras oficial de Chile (Registro de Compras RCV) en formato Excel (.xlsx)
 */
export function exportLibroComprasExcel(
  receipts: ExpenseDocument[],
  company?: Organization | null,
  periodMonth: number = 9,
  periodYear: number = 2026
) {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const periodText = `${monthNames[periodMonth - 1]} ${periodYear}`;

  const businessReceipts = receipts.filter((r) => r.status !== 'rejected');

  let totalNeto = 0;
  let totalIVA = 0;
  let totalExento = 0;
  let totalGeneral = 0;
  let totalEmpresaDeducible = 0;

  const rows = businessReceipts.map((r, index) => {
    const docCode = getSIIDocumentCode(r.document_type);
    const docName = r.document_type === 'factura' ? 'Factura Electrónica (33)' : r.document_type === 'comprobante_transbank' ? 'Comprobante Voucher (48)' : 'Boleta Electrónica (39)';
    
    const isBusiness = r.expense_type === 'business' || r.expense_type === 'mixed';
    const ivaRecuperable = isBusiness ? r.tax_amount : 0;
    const netoAmount = isBusiness ? r.net_amount : 0;
    const exentoAmount = 0;

    totalNeto += netoAmount;
    totalIVA += ivaRecuperable;
    totalGeneral += r.total_amount;
    totalEmpresaDeducible += r.business_total;

    return {
      'N°': index + 1,
      'Cód. SII': docCode,
      'Tipo Documento': docName,
      'Folio / N°': r.receipt_number || 'S/N',
      'Fecha Emisión': formatDateCL(r.document_date),
      'RUT Proveedor': r.merchant_rut || '',
      'Razón Social Proveedor': r.merchant_legal_name || r.merchant_name,
      'Monto Exento (CLP)': exentoAmount,
      'Monto Neto (CLP)': netoAmount,
      'IVA Crédito Fiscal (19%)': ivaRecuperable,
      'Total Documento (CLP)': r.total_amount,
      'Gasto Deducible Empresa': r.business_total,
      'Gasto No Deducible / Personal': r.personal_total,
      'Medio de Pago': r.payment_method || 'Transferencia / Tarjeta',
      'Tipo Compra': r.expense_type === 'business' ? 'Giro Deducible' : r.expense_type === 'mixed' ? 'Compra Mixta' : 'Gasto Particular',
      'Estado Revisión': r.status === 'approved' ? 'Aprobado' : 'Pendiente Revisión',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  const summaryData = [
    { 'Concepto Tributario F29': 'Empresa / Razón Social', 'Valor': company?.legal_name || company?.name || 'Estudio Creativo SpA' },
    { 'Concepto Tributario F29': 'RUT Empresa', 'Valor': company?.rut || '76.890.123-4' },
    { 'Concepto Tributario F29': 'Período Tributario', 'Valor': periodText },
    { 'Concepto Tributario F29': 'Cantidad Total de Documentos', 'Valor': businessReceipts.length },
    { 'Concepto Tributario F29': 'Base Imponible Total (Monto Neto)', 'Valor': totalNeto },
    { 'Concepto Tributario F29': 'Total IVA Crédito Fiscal (Línea F29 - Crédito)', 'Valor': totalIVA },
    { 'Concepto Tributario F29': 'Total Gastos Empresa Deducibles', 'Valor': totalEmpresaDeducible },
    { 'Concepto Tributario F29': 'Total Bruto Contabilizado', 'Valor': totalGeneral },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Libro de Compras');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen F29 SII');

  const fileName = `Libro_de_Compras_${company?.name?.replace(/\s+/g, '_') || 'Empresa'}_${periodYear}_${String(periodMonth).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportLibroComprasCSV(
  receipts: ExpenseDocument[],
  company?: Organization | null,
  periodMonth: number = 9,
  periodYear: number = 2026
) {
  const businessReceipts = receipts.filter((r) => r.status !== 'rejected');

  const headers = [
    'NRO_OPERACION',
    'TIPO_DOC_SII',
    'FOLIO',
    'FECHA_DOCTO',
    'RUT_PROVEEDOR',
    'RAZON_SOCIAL',
    'MONTO_EXENTO',
    'MONTO_NETO',
    'IVA_RECUPERABLE',
    'MONTO_TOTAL',
    'GASTO_EMPRESA',
    'GASTO_PERSONAL',
    'TIPO_COMPRA',
  ];

  const rows = businessReceipts.map((r, idx) => [
    idx + 1,
    getSIIDocumentCode(r.document_type),
    r.receipt_number || '',
    r.document_date || '',
    r.merchant_rut || '',
    `"${(r.merchant_legal_name || r.merchant_name).replace(/"/g, '""')}"`,
    0,
    r.net_amount || 0,
    r.tax_amount || 0,
    r.total_amount || 0,
    r.business_total || 0,
    r.personal_total || 0,
    r.expense_type,
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `Libro_Compras_RCV_${periodYear}_${String(periodMonth).padStart(2, '0')}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportExpensesToExcel(receipts: ExpenseDocument[]) {
  const documentsData = receipts.map((r) => ({
    'ID Documento': r.id,
    'Fecha': formatDateCL(r.document_date),
    'Hora': r.document_time || '',
    'Comercio': r.merchant_name,
    'RUT Emisor': r.merchant_rut || '',
    'N° Boleta / Factura': r.receipt_number || '',
    'Tipo Documento': r.document_type,
    'Tipo Gasto': r.expense_type === 'business' ? 'Empresa' : r.expense_type === 'personal' ? 'Personal' : 'Mixto',
    'Total Documento (CLP)': r.total_amount,
    'Gasto Empresa (CLP)': r.business_total,
    'Gasto Personal (CLP)': r.personal_total,
    'Neto (CLP)': r.net_amount,
    'IVA / Impuestos (CLP)': r.tax_amount,
    'Descuento (CLP)': r.discount,
    'Propina (CLP)': r.tip,
    'Medio de Pago': r.payment_method || '',
    'Estado': r.status,
    'Revisión Humana': r.requires_human_review ? 'Pendiente' : 'Aprobado',
  }));

  const itemsData: any[] = [];
  receipts.forEach((r) => {
    (r.items || []).forEach((item) => {
      itemsData.push({
        'ID Boleta': r.id,
        'Comercio': r.merchant_name,
        'Fecha': formatDateCL(r.document_date),
        'Producto Original': item.original_name,
        'Producto Normalizado': item.normalized_name || item.original_name,
        'Categoría': item.category_name || '',
        'Subcategoría': item.subcategory_name || '',
        'Cantidad': item.quantity,
        'Unidad': item.unit,
        'Precio Unitario (CLP)': item.unit_price,
        'Descuento (CLP)': item.discount,
        'Total Línea (CLP)': item.line_total,
        'Tipo Ítem': item.expense_type,
        '% Asignado Empresa': `${item.business_percentage}%`,
        '% Asignado Personal': `${item.personal_percentage}%`,
        'Monto Empresa (CLP)': Math.round((item.line_total * item.business_percentage) / 100),
        'Monto Personal (CLP)': Math.round((item.line_total * item.personal_percentage) / 100),
        'Confianza IA': `${Math.round(item.confidence * 100)}%`,
      });
    });
  });

  const workbook = XLSX.utils.book_new();
  const wsDocuments = XLSX.utils.json_to_sheet(documentsData);
  XLSX.utils.book_append_sheet(workbook, wsDocuments, 'Boletas y Comprobantes');

  const wsItems = XLSX.utils.json_to_sheet(itemsData);
  XLSX.utils.book_append_sheet(workbook, wsItems, 'Detalle de Productos');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `reporte_gastos_boletas_${dateStr}.xlsx`);
}

export function exportExpensesToCSV(receipts: ExpenseDocument[]) {
  const rows = [
    [
      'ID',
      'Fecha',
      'Comercio',
      'RUT',
      'N_Boleta',
      'Tipo_Gasto',
      'Total_CLP',
      'Empresa_CLP',
      'Personal_CLP',
      'Neto_CLP',
      'IVA_CLP',
      'Estado',
    ],
    ...receipts.map((r) => [
      r.id,
      r.document_date || '',
      `"${r.merchant_name.replace(/"/g, '""')}"`,
      r.merchant_rut || '',
      r.receipt_number || '',
      r.expense_type,
      r.total_amount,
      r.business_total,
      r.personal_total,
      r.net_amount,
      r.tax_amount,
      r.status,
    ]),
  ];

  const csvContent = '\uFEFF' + rows.map((e) => e.join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `gastos_boletas_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
