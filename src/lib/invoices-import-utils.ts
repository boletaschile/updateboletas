import * as XLSX from 'xlsx';
import { AccountReceivable, ExpenseDocument, ExpenseItem } from '@/types';
import { defaultDateForMonth, currentMonthKey } from './month-utils';

/**
 * Normaliza nombres de encabezados eliminando tildes, espacios y caracteres especiales
 */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Convierte cualquier fecha (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD o serial de Excel) a YYYY-MM-DD
 */
export function parseChileanDate(raw: any, fallbackMonth?: string): string {
  if (!raw) return defaultDateForMonth(fallbackMonth || currentMonthKey());

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

  // DD/MM/YYYY o DD-MM-YYYY (con o sin hora adjunta como "01/09/2026 09:19:46")
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Si no coincide, intentar Date nativo
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
 * Parsea montos chilenos (CLP) enteros
 */
export function parseChileanAmount(raw: any): number {
  if (typeof raw === 'number') {
    return Math.round(raw);
  }
  if (!raw) return 0;
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
 * Divide una línea CSV respetando comillas
 */
function parseCSVLine(line: string, delimiter: string): string[] {
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
}

/**
 * Convierte un archivo CSV o Excel a matriz bidimensional de datos
 */
async function readDataMatrix(input: File | string): Promise<any[][]> {
  if (typeof input === 'string') {
    const text = input.trim();
    if (!text) return [];

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    // Detectar si el delimitador es punto y coma ';' o coma ','
    const firstLine = lines[0];
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semiCount >= commaCount && semiCount > 0 ? ';' : ',';

    return lines.map((line) => parseCSVLine(line, delimiter));
  }

  // Es un File del navegador
  const isCSV = input.name.toLowerCase().endsWith('.csv');
  if (isCSV) {
    const text = await input.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const firstLine = lines[0];
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semiCount >= commaCount && semiCount > 0 ? ';' : ',';

    return lines.map((line) => parseCSVLine(line, delimiter));
  }

  // Es un archivo Excel (.xlsx / .xls)
  const buffer = await input.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];

  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
}

// ============================================================================
// FACTURAS DE VENTA / EMITIDAS (Cuentas por Cobrar e Ingresos)
// ============================================================================

export interface ParsedSalesInvoiceRow {
  rowNumber: number;
  documentType: string;
  issueDate: string;
  invoiceNumber: string;
  clientName: string;
  clientRut: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  status: 'collected' | 'pending';
  isValid: boolean;
  errors: string[];
}

export interface SalesInvoicesImportSummary {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  totalNeto: number;
  totalIva: number;
  totalAmount: number;
  totalPaid: number;
  totalUnpaid: number;
  rows: ParsedSalesInvoiceRow[];
}

export async function parseSalesInvoicesFile(
  input: File | string,
  fileName: string = 'Facturas_Emitidas.csv'
): Promise<SalesInvoicesImportSummary> {
  const matrix = await readDataMatrix(input);
  if (matrix.length < 2) {
    throw new Error('El archivo no contiene filas de facturas de venta.');
  }

  // 1. Detectar encabezados
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, matrix.length); i++) {
    const rowStr = matrix[i].map((c) => String(c).toLowerCase()).join(' ');
    if (rowStr.includes('emisor') || rowStr.includes('receptor') || rowStr.includes('numero') || rowStr.includes('folio') || rowStr.includes('total')) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = matrix[headerRowIndex].map((h) => String(h || '').trim());
  const headerMap: Record<string, number> = {};
  rawHeaders.forEach((h, idx) => {
    headerMap[normalizeHeader(h)] = idx;
  });

  const getCol = (patterns: string[]): number => {
    for (const pat of patterns) {
      for (const [norm, idx] of Object.entries(headerMap)) {
        if (norm.includes(pat)) return idx;
      }
    }
    return -1;
  };

  const colDocType = getCol(['tipodocumento', 'tipodoc', 'documento']);
  const colDate = getCol(['fecha', 'fechaemision', 'emision', 'date']);
  const colNumber = getCol(['numero', 'folio', 'nfactura', 'num']);
  const colClient = getCol(['emisorreceptor', 'receptor', 'cliente', 'razonsocial', 'empresa']);
  const colRut = getCol(['rut', 'rutreceptor', 'rutcliente']);
  const colNeto = getCol(['neto', 'montoneto']);
  const colIva = getCol(['iva', 'montoiva', 'ivadebito']);
  const colTotal = getCol(['total', 'montototal', 'bruto']);
  const colPaid = getCol(['pagado', 'cobrado', 'montopagado']);
  const colUnpaid = getCol(['impago', 'saldo', 'porcobrar', 'pendiente']);

  const rows: ParsedSalesInvoiceRow[] = [];
  let totalNeto = 0;
  let totalIva = 0;
  let totalAmount = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.every((c) => c === '' || c === null || c === undefined)) continue;

    const errors: string[] = [];
    const clientName = colClient !== -1 ? String(row[colClient] || '').trim() : '';
    const clientRut = colRut !== -1 ? String(row[colRut] || '').trim() : '';
    const invoiceNumber = colNumber !== -1 ? String(row[colNumber] || '').trim() : '';
    const rawDate = colDate !== -1 ? row[colDate] : null;
    const docTypeRaw = colDocType !== -1 ? String(row[colDocType] || '').trim() : 'Factura electrónica emitida';

    const net = colNeto !== -1 ? parseChileanAmount(row[colNeto]) : 0;
    const iva = colIva !== -1 ? parseChileanAmount(row[colIva]) : 0;
    let tot = colTotal !== -1 ? parseChileanAmount(row[colTotal]) : 0;

    if (tot === 0 && net > 0) {
      tot = net + (iva > 0 ? iva : Math.round(net * 0.19));
    }

    const paid = colPaid !== -1 ? parseChileanAmount(row[colPaid]) : 0;
    const unpaid = colUnpaid !== -1 ? parseChileanAmount(row[colUnpaid]) : (paid > 0 ? Math.max(0, tot - paid) : tot);

    if (!clientName) {
      errors.push('Falta la razón social o nombre del cliente receptor.');
    }
    if (tot <= 0) {
      errors.push('El monto total de la factura debe ser mayor a 0 CLP.');
    }

    const issueDate = parseChileanDate(rawDate);
    const isCollected = unpaid === 0 || paid >= tot;
    const status: 'collected' | 'pending' = isCollected ? 'collected' : 'pending';

    const isValid = errors.length === 0;
    if (isValid) {
      totalNeto += net > 0 ? net : Math.round(tot / 1.19);
      totalIva += iva > 0 ? iva : Math.round((tot * 0.19) / 1.19);
      totalAmount += tot;
      totalPaid += paid;
      totalUnpaid += unpaid;
    }

    rows.push({
      rowNumber: r + 1,
      documentType: docTypeRaw || 'Factura electrónica emitida',
      issueDate,
      invoiceNumber: invoiceNumber || `F-${r}`,
      clientName: clientName || 'Cliente No Especificado',
      clientRut: clientRut || '',
      netAmount: net > 0 ? net : Math.round(tot / 1.19),
      taxAmount: iva > 0 ? iva : Math.round((tot * 0.19) / 1.19),
      totalAmount: tot,
      paidAmount: paid,
      unpaidAmount: unpaid,
      status,
      isValid,
      errors,
    });
  }

  return {
    fileName,
    totalRows: rows.length,
    validRows: rows.filter((r) => r.isValid).length,
    invalidRows: rows.filter((r) => !r.isValid).length,
    totalNeto,
    totalIva,
    totalAmount,
    totalPaid,
    totalUnpaid,
    rows,
  };
}

// ============================================================================
// FACTURAS DE COMPRA (RCV del SII - Registro de Compras de Chile)
// ============================================================================

export interface ParsedPurchaseInvoiceRow {
  rowNumber: number;
  supplierName: string;
  supplierRut: string;
  folio: string;
  documentDate: string;
  receptionDate?: string;
  purchaseType: string;
  exemptAmount: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  isValid: boolean;
  errors: string[];
}

export interface PurchaseInvoicesImportSummary {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  totalNeto: number;
  totalIva: number;
  totalExento: number;
  totalAmount: number;
  rows: ParsedPurchaseInvoiceRow[];
}

export async function parsePurchasesInvoicesFile(
  input: File | string,
  fileName: string = 'Facturas_Compra_RCV.csv',
  fallbackMonth?: string
): Promise<PurchaseInvoicesImportSummary> {
  const matrix = await readDataMatrix(input);
  if (matrix.length < 2) {
    throw new Error('El archivo no contiene filas de facturas de compra.');
  }

  // 1. Detectar fila de encabezados
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, matrix.length); i++) {
    const rowStr = matrix[i].map((c) => String(c).toLowerCase()).join(' ');
    if (
      rowStr.includes('rut proveedor') ||
      rowStr.includes('razon social') ||
      rowStr.includes('folio') ||
      rowStr.includes('monto neto') ||
      rowStr.includes('iva recuperable')
    ) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = matrix[headerRowIndex].map((h) => String(h || '').trim());
  const headerMap: Record<string, number> = {};
  rawHeaders.forEach((h, idx) => {
    headerMap[normalizeHeader(h)] = idx;
  });

  const getCol = (patterns: string[]): number => {
    for (const pat of patterns) {
      for (const [norm, idx] of Object.entries(headerMap)) {
        if (norm.includes(pat)) return idx;
      }
    }
    return -1;
  };

  const colSupplier = getCol(['razonsocial', 'proveedor', 'comercio', 'emisor']);
  const colRut = getCol(['rutproveedor', 'rut', 'rutemisor']);
  const colFolio = getCol(['folio', 'ndocumento', 'numero', 'nfactura']);
  const colDate = getCol(['fechadocto', 'fechadoc', 'fecha', 'fechaemision']);
  const colReceptionDate = getCol(['fecharecepcion', 'recepcion']);
  const colPurchaseType = getCol(['tipocompra', 'tipo']);
  const colExempt = getCol(['montoexento', 'exento']);
  const colNeto = getCol(['montoneto', 'neto']);
  const colIva = getCol(['montoivarecuperable', 'ivarecuperable', 'iva', 'montoiva']);
  const colTotal = getCol(['montototal', 'total', 'bruto']);

  const rows: ParsedPurchaseInvoiceRow[] = [];
  let totalNeto = 0;
  let totalIva = 0;
  let totalExento = 0;
  let totalAmount = 0;

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.every((c) => c === '' || c === null || c === undefined)) continue;

    const errors: string[] = [];
    const supplierName = colSupplier !== -1 ? String(row[colSupplier] || '').trim() : '';
    const supplierRut = colRut !== -1 ? String(row[colRut] || '').trim() : '';
    const folio = colFolio !== -1 ? String(row[colFolio] || '').trim() : '';
    const rawDate = colDate !== -1 ? row[colDate] : null;
    const rawReceptionDate = colReceptionDate !== -1 ? String(row[colReceptionDate] || '').trim() : undefined;
    const purchaseType = colPurchaseType !== -1 ? String(row[colPurchaseType] || '').trim() : 'Del Giro';

    const exempt = colExempt !== -1 ? parseChileanAmount(row[colExempt]) : 0;
    const net = colNeto !== -1 ? parseChileanAmount(row[colNeto]) : 0;
    const iva = colIva !== -1 ? parseChileanAmount(row[colIva]) : 0;
    let tot = colTotal !== -1 ? parseChileanAmount(row[colTotal]) : 0;

    if (tot === 0 && (net > 0 || exempt > 0)) {
      tot = net + iva + exempt;
    }

    if (!supplierName) {
      errors.push('Falta la razón social o nombre del proveedor.');
    }
    if (tot <= 0) {
      errors.push('El monto total debe ser un valor numérico mayor a 0 CLP.');
    }

    const documentDate = parseChileanDate(rawDate, fallbackMonth);
    const isValid = errors.length === 0;

    if (isValid) {
      totalNeto += net;
      totalIva += iva;
      totalExento += exempt;
      totalAmount += tot;
    }

    rows.push({
      rowNumber: r + 1,
      supplierName: supplierName || 'Proveedor No Especificado',
      supplierRut,
      folio: folio || `F-${r}`,
      documentDate,
      receptionDate: rawReceptionDate,
      purchaseType: purchaseType || 'Del Giro',
      exemptAmount: exempt,
      netAmount: net,
      taxAmount: iva,
      totalAmount: tot,
      isValid,
      errors,
    });
  }

  return {
    fileName,
    totalRows: rows.length,
    validRows: rows.filter((r) => r.isValid).length,
    invalidRows: rows.filter((r) => !r.isValid).length,
    totalNeto,
    totalIva,
    totalExento,
    totalAmount,
    rows,
  };
}
