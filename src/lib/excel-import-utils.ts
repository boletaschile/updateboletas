import * as XLSX from 'xlsx';
import { ExpenseDocument, ExpenseItem, DocumentType, ExpenseType } from '@/types';
import { defaultDateForMonth, currentMonthKey } from './month-utils';

export interface ParsedExpenseRow {
  rowNumber: number;
  date: string;
  merchantName: string;
  merchantRut?: string;
  receiptNumber?: string;
  documentType: DocumentType;
  expenseType: ExpenseType;
  categoryName: string;
  totalAmount: number;
  netAmount?: number;
  taxAmount?: number;
  paymentMethod: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

export interface ExcelImportSummary {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  totalAmount: number;
  businessAmount: number;
  personalAmount: number;
  rows: ParsedExpenseRow[];
}

/**
 * Normaliza encabezados para mapear columnas sin importar mayúsculas, tildes o variaciones
 */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Convierte una fecha de Excel (número de serie o texto) a formato YYYY-MM-DD
 */
function parseExcelDate(raw: any, fallbackMonth?: string): string {
  if (!raw) return defaultDateForMonth(fallbackMonth || currentMonthKey());

  // Si viene como número de serie de Excel (días desde 1900)
  if (typeof raw === 'number') {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(raw).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Si no se puede parsear, intentar Date nativo
  const nativeDate = new Date(str);
  if (!isNaN(nativeDate.getTime())) {
    const y = nativeDate.getFullYear();
    const m = String(nativeDate.getMonth() + 1).padStart(2, '0');
    const d = String(nativeDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return defaultDateForMonth(fallbackMonth || currentMonthKey());
}

/**
 * Limpia y parsea un monto a entero en pesos chilenos (CLP)
 */
function parseAmountCLP(raw: any): number {
  if (typeof raw === 'number') {
    return Math.round(raw);
  }
  if (!raw) return 0;
  // Elimina $, puntos de miles, espacios, etc.
  const cleaned = String(raw)
    .replace(/[$]/g, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/,.*$/, '')
    .trim();
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Lee y analiza un archivo Excel/CSV con boletas y gastos
 */
export async function parseExpensesExcelFile(
  file: File,
  fallbackMonth?: string
): Promise<ExcelImportSummary> {
  let rawData: any[][] = [];
  const fileName = file.name.toLowerCase();
  const isCSV = fileName.endsWith('.csv');

  if (isCSV) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('El archivo CSV está vacío o solo contiene encabezados.');
    }

    const firstLine = lines[0];
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semiCount >= commaCount && semiCount > 0 ? ';' : ',';

    rawData = lines.map((line) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

    // Tomar la primera hoja (o la que se llame 'Gastos y Boletas')
    const sheetName =
      workbook.SheetNames.find((n) => n.toLowerCase().includes('gasto') || n.toLowerCase().includes('boleta') || n.toLowerCase().includes('compra')) ||
      workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error('La planilla no contiene hojas de cálculo válidas.');
    }

    rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  }

  if (rawData.length < 2) {
    throw new Error('La planilla está vacía o solo contiene encabezados.');
  }

  // 1. Encontrar la fila de encabezados
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const rowStr = rawData[i].map((c) => String(c).toLowerCase()).join(' ');
    if (
      rowStr.includes('comercio') ||
      rowStr.includes('monto') ||
      rowStr.includes('fecha') ||
      rowStr.includes('total') ||
      rowStr.includes('razon social') ||
      rowStr.includes('rut proveedor')
    ) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = rawData[headerRowIndex].map((h) => String(h || '').trim());
  const headerMap: Record<string, number> = {};

  rawHeaders.forEach((h, colIdx) => {
    const norm = normalizeHeader(h);
    headerMap[norm] = colIdx;
  });

  const isSiiRcv = Object.keys(headerMap).some(
    (k) => k.includes('rutproveedor') || k.includes('razonsocial') || k.includes('montoivarecuperable')
  );

  // Encontrar índices de columnas con variantes comunes
  const getCol = (patterns: string[]): number => {
    for (const pat of patterns) {
      for (const [norm, idx] of Object.entries(headerMap)) {
        if (norm.includes(pat)) return idx;
      }
    }
    return -1;
  };

  const colDate = getCol(['fechadocto', 'fechadoc', 'fecha', 'date']);
  const colMerchant = getCol(['razonsocial', 'comercio', 'proveedor', 'negocio', 'local', 'empresaemisor']);
  const colRut = getCol(['rutproveedor', 'rut', 'rutcomercio', 'rutemisor']);
  const colDocNumber = getCol(['folio', 'ndocumento', 'nboleta', 'nfactura', 'documento', 'numero']);
  const colDocType = getCol(['tipodocumento', 'tipodoc', 'documento']);
  const colExpenseType = getCol(['tipogasto', 'ambito', 'tipo', 'destino']);
  const colCategory = getCol(['categoria', 'rubro', 'tipocompra']);
  const colAmount = getCol(['montototal', 'monto', 'total', 'totalclp', 'valor']);
  const colNet = getCol(['montoneto', 'neto']);
  const colIva = getCol(['montoivarecuperable', 'ivarecuperable', 'iva', 'montoiva']);
  const colPayment = getCol(['mediopago', 'formapago', 'pago']);
  const colNotes = getCol(['detalle', 'notas', 'observaciones', 'descripcion', 'tipocompra']);

  const rows: ParsedExpenseRow[] = [];

  for (let r = headerRowIndex + 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || row.every((c) => c === '' || c === null || c === undefined)) {
      continue; // Fila vacía
    }

    const errors: string[] = [];
    const merchantRaw = colMerchant !== -1 ? String(row[colMerchant] || '').trim() : '';
    const dateRaw = colDate !== -1 ? row[colDate] : null;
    const amountRaw = colAmount !== -1 ? row[colAmount] : 0;
    const amount = parseAmountCLP(amountRaw);
    const netRaw = colNet !== -1 ? parseAmountCLP(row[colNet]) : undefined;
    const ivaRaw = colIva !== -1 ? parseAmountCLP(row[colIva]) : undefined;

    if (!merchantRaw) {
      errors.push('Falta el nombre del comercio o proveedor.');
    }

    if (amount <= 0 && (!netRaw || netRaw <= 0)) {
      errors.push('El monto total debe ser un valor numérico mayor a 0 CLP.');
    }

    const date = parseExcelDate(dateRaw, fallbackMonth);

    // Tipo de gasto
    let expenseType: ExpenseType = isSiiRcv ? 'business' : 'personal';
    if (colExpenseType !== -1) {
      const et = String(row[colExpenseType] || '').toLowerCase().trim();
      if (et.includes('empresa') || et.includes('negocio') || et.includes('business') || et.includes('giro')) {
        expenseType = 'business';
      } else if (et.includes('mixt') || et.includes('mix')) {
        expenseType = 'mixed';
      } else if (et.includes('person')) {
        expenseType = 'personal';
      }
    }

    // Tipo de documento
    let documentType: DocumentType = isSiiRcv ? 'factura' : 'boleta';
    if (colDocType !== -1) {
      const dt = String(row[colDocType] || '').toLowerCase().trim();
      if (dt.includes('factura')) documentType = 'factura';
      else if (dt.includes('transbank') || dt.includes('voucher') || dt.includes('tarjeta')) documentType = 'comprobante_transbank';
      else if (dt.includes('ticket')) documentType = 'ticket';
      else if (dt.includes('boleta')) documentType = 'boleta';
    }

    // Categoría
    let categoryName = colCategory !== -1 && row[colCategory] ? String(row[colCategory]).trim() : (isSiiRcv ? 'Facturas de Compra (RCV)' : 'Varios');
    if (isSiiRcv && categoryName === 'Del Giro') {
      categoryName = 'Compras Operacionales (Del Giro)';
    }

    // Medio de pago
    const paymentMethod = colPayment !== -1 && row[colPayment] ? String(row[colPayment]).trim() : 'Transferencia';

    // Folio y RUT
    const receiptNumber = colDocNumber !== -1 && row[colDocNumber] ? String(row[colDocNumber]).trim() : undefined;
    const merchantRut = colRut !== -1 && row[colRut] ? String(row[colRut]).trim() : undefined;
    const notes = colNotes !== -1 && row[colNotes] ? String(row[colNotes]).trim() : undefined;

    const effectiveAmount = amount > 0 ? amount : ((netRaw || 0) + (ivaRaw || 0));

    rows.push({
      rowNumber: r + 1,
      date,
      merchantName: merchantRaw || 'Comercio Desconocido',
      merchantRut,
      receiptNumber,
      documentType,
      expenseType,
      categoryName,
      totalAmount: effectiveAmount,
      netAmount: netRaw,
      taxAmount: ivaRaw,
      paymentMethod,
      notes,
      isValid: errors.length === 0,
      errors,
    });
  }

  const validRows = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);
  const totalAmount = validRows.reduce((acc, r) => acc + r.totalAmount, 0);
  const businessAmount = validRows.filter((r) => r.expenseType === 'business').reduce((acc, r) => acc + r.totalAmount, 0);
  const personalAmount = validRows.filter((r) => r.expenseType === 'personal').reduce((acc, r) => acc + r.totalAmount, 0);

  return {
    fileName: file.name,
    totalRows: rows.length,
    validRows: validRows.length,
    invalidRows: invalidRows.length,
    totalAmount,
    businessAmount,
    personalAmount,
    rows,
  };
}

/**
 * Genera y descarga en el navegador una plantilla Excel (.xlsx) oficial lista para rellenar
 */
export function downloadExpensesTemplateExcel() {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Fecha (AAAA-MM-DD)',
    'Comercio / Proveedor',
    'RUT Comercio',
    'N° Documento',
    'Tipo Documento',
    'Tipo Gasto (empresa / personal / mixto)',
    'Categoría',
    'Monto Total CLP',
    'Medio de Pago',
    'Detalle / Notas',
  ];

  const sampleRows = [
    ['2026-10-02', 'Supermercados Lider Express', '76.123.456-7', 'B-102931', 'boleta', 'personal', 'Supermercado', 45900, 'Débito', 'Compra semanal de abarrotes'],
    ['2026-10-03', 'Sodimac Homecenter', '96.792.430-K', 'F-889120', 'factura', 'empresa', 'Insumos de oficina', 82990, 'Transferencia', 'Materiales eléctricos oficina'],
    ['2026-10-04', 'Copec Pronto', '99.520.000-7', 'B-44120', 'boleta', 'empresa', 'Transporte y combustible', 35000, 'Tarjeta Débito', 'Combustible visitas a terreno'],
    ['2026-10-04', 'Restaurante El Huerto', '77.890.123-4', 'B-1284', 'boleta', 'personal', 'Alimentación', 28500, 'Crédito', 'Almuerzo familiar fin de semana'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 32 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 35 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Gastos y Boletas');

  // Hoja 2: Guía de uso
  const guideHeaders = ['Columna', 'Descripción', 'Valores Permitidos / Ejemplos'];
  const guideRows = [
    ['Fecha', 'Fecha en formato AAAA-MM-DD o DD/MM/AAAA', '2026-10-04 o 04/10/2026'],
    ['Comercio / Proveedor', 'Nombre del local o razón social del emisor', 'Lider, Sodimac, Copec, Chilexpress, Uber'],
    ['RUT Comercio', 'RUT chileno del emisor con guión (opcional)', '76.123.456-7, 96.792.430-K'],
    ['N° Documento', 'Número de folio o comprobante (opcional)', 'B-89120, Factura 4519'],
    ['Tipo Documento', 'Clasificación tributaria', 'boleta, factura, comprobante_transbank, ticket'],
    ['Tipo Gasto', 'Destino del gasto', 'empresa (deducible F29), personal, o mixto'],
    ['Categoría', 'Clasificación presupuestaria', 'Supermercado, Insumos de oficina, Combustible, etc.'],
    ['Monto Total CLP', 'Monto en pesos chilenos sin puntos ni signos', '45900, 82990, 15000'],
    ['Medio de Pago', 'Forma de pago utilizada', 'Débito, Crédito, Transferencia, Efectivo'],
    ['Detalle / Notas', 'Observaciones o resumen del gasto', 'Compra materiales, almuerzo cliente, etc.'],
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet([guideHeaders, ...guideRows]);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 45 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Guía de Columnas');

  XLSX.writeFile(wb, 'plantilla_gastos_boletaschile.xlsx');
}
