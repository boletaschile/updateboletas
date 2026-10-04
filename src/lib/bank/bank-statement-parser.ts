import * as XLSX from 'xlsx';
import { BankTransaction } from '@/types';

/**
 * Normaliza encabezados eliminando tildes, mayúsculas y caracteres no alfanuméricos
 */
function normalizeHeader(h: string): string {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Convierte formatos de fecha comunes en cartolas chilenas a YYYY-MM-DD
 */
function parseExcelDate(raw: any): string {
  if (!raw) return new Date().toISOString().split('T')[0];

  // Número de serie de fecha Excel (días desde 1900)
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

  // DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    let [, d, m, y] = dmyMatch;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const native = new Date(str);
  if (!isNaN(native.getTime())) {
    const y = native.getFullYear();
    const m = String(native.getMonth() + 1).padStart(2, '0');
    const d = String(native.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Limpia y parsea montos en pesos chilenos (CLP)
 */
function parseAmount(raw: any): number {
  if (typeof raw === 'number') return Math.abs(Math.round(raw));
  if (!raw) return 0;
  const cleaned = String(raw)
    .replace(/[$]/g, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/,.*$/, '')
    .trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Detecta banco a partir del nombre de archivo y las primeras filas
 */
function detectBankName(fileName: string, metadataSnippet: string): string {
  const text = `${fileName} ${metadataSnippet}`.toLowerCase();
  if (text.includes('chile')) return 'Banco de Chile';
  if (text.includes('santander')) return 'Banco Santander';
  if (text.includes('bci')) return 'Banco BCI';
  if (text.includes('estado')) return 'BancoEstado';
  if (text.includes('scotia')) return 'Scotiabank';
  if (text.includes('itau') || text.includes('itaú')) return 'Banco Itaú';
  if (text.includes('falabella')) return 'Banco Falabella';
  if (text.includes('security')) return 'Banco Security';
  if (text.includes('bice')) return 'Banco BICE';
  return 'Cartola Bancaria';
}

export interface ParsedBankStatementResult {
  transactions: BankTransaction[];
  bankName: string;
  totalCharges: number;
  fileName: string;
}

/**
 * Parsea un archivo de cartola bancaria (.xlsx, .xls, .csv, .txt)
 */
export async function parseBankStatementFile(
  file: File,
  organizationId?: string
): Promise<ParsedBankStatementResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('El archivo está vacío o no contiene filas legibles.');
  }

  // Extraer texto de metadatos de las primeras filas
  const metadataSnippet = rawRows
    .slice(0, 10)
    .map((r) => (Array.isArray(r) ? r.join(' ') : ''))
    .join(' ');
  const detectedBank = detectBankName(file.name, metadataSnippet);

  // Buscar la fila de encabezados
  let headerRowIdx = -1;
  let dateCol = -1;
  let descCol = -1;
  let opCol = -1;
  let cargoCol = -1;
  let montoCol = -1;

  for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    const rowNormalized = row.map((cell) => normalizeHeader(String(cell || '')));

    const hasDate = rowNormalized.some((h) => h.includes('fecha') || h.includes('fec'));
    const hasMoney = rowNormalized.some(
      (h) =>
        h.includes('cargo') ||
        h.includes('debito') ||
        h.includes('monto') ||
        h.includes('egreso') ||
        h.includes('valor') ||
        h.includes('saldo') ||
        h.includes('abono')
    );

    if (hasDate && hasMoney) {
      headerRowIdx = i;
      rowNormalized.forEach((colName, cIdx) => {
        if (dateCol === -1 && (colName.includes('fecha') || colName.includes('fec'))) {
          dateCol = cIdx;
        } else if (
          descCol === -1 &&
          (colName.includes('glosa') ||
            colName.includes('descrip') ||
            colName.includes('concepto') ||
            colName.includes('detalle') ||
            colName.includes('movimiento'))
        ) {
          descCol = cIdx;
        } else if (
          opCol === -1 &&
          (colName.includes('operacion') ||
            colName.includes('documento') ||
            colName.includes('doc') ||
            colName.includes('folio') ||
            colName.includes('referencia') ||
            colName.includes('nro'))
        ) {
          opCol = cIdx;
        } else if (
          cargoCol === -1 &&
          (colName.includes('cargo') ||
            colName.includes('debito') ||
            colName.includes('retiro') ||
            colName.includes('egreso'))
        ) {
          cargoCol = cIdx;
        } else if (
          montoCol === -1 &&
          (colName.includes('monto') || colName.includes('importe') || colName.includes('valor'))
        ) {
          montoCol = cIdx;
        }
      });
      break;
    }
  }

  // Fallback si no encontró cabecera explícita
  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    dateCol = 0;
    descCol = 1;
    cargoCol = 2;
  }

  const transactions: BankTransaction[] = [];
  const targetAmountCol = cargoCol !== -1 ? cargoCol : montoCol;

  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawDate = row[dateCol];
    if (!rawDate) continue;

    const dateStr = parseExcelDate(rawDate);
    const descStr =
      descCol !== -1 && row[descCol] ? String(row[descCol]).trim() : 'Movimiento Bancario';

    if (
      !descStr ||
      descStr.toLowerCase().includes('total') ||
      descStr.toLowerCase().includes('saldo inicial') ||
      descStr.toLowerCase().includes('saldo final')
    ) {
      continue;
    }

    const rawAmount = targetAmountCol !== -1 ? row[targetAmountCol] : 0;
    const amount = parseAmount(rawAmount);

    if (amount <= 0) continue;

    const opNumber =
      opCol !== -1 && row[opCol]
        ? String(row[opCol]).trim()
        : `OP-${Math.floor(100000 + Math.random() * 900000)}`;

    transactions.push({
      id: `btx-upload-${Date.now()}-${r}`,
      organization_id: organizationId || undefined,
      date: dateStr,
      description: descStr,
      amount,
      operation_number: opNumber,
      bank_name: detectedBank,
      account_name: 'Cuenta Corriente',
      status: 'unmatched',
    });
  }

  return {
    transactions,
    bankName: detectedBank,
    totalCharges: transactions.reduce((acc, t) => acc + t.amount, 0),
    fileName: file.name,
  };
}
