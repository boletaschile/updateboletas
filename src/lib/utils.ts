import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como pesos chilenos (sin decimales, con punto de miles y signo $)
 * Ejemplo: 1250000 -> "$1.250.000"
 */
export function formatCLP(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0';
  }
  const rounded = Math.round(amount);
  return '$' + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parsea un string con formato de moneda chilena a número entero
 */
export function parseCLP(value: string | number): number {
  if (typeof value === 'number') return Math.round(value);
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Valida un RUT chileno usando el algoritmo Módulo 11
 */
export function validateRUT(rut: string): boolean {
  if (!rut || typeof rut !== 'string') return false;
  const cleaned = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleaned.length < 8 || cleaned.length > 9) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  let expectedDv = '0';
  if (remainder === 11) expectedDv = '0';
  else if (remainder === 10) expectedDv = 'K';
  else expectedDv = remainder.toString();

  return dv === expectedDv;
}

/**
 * Formatea un RUT al estilo 12.345.678-K
 */
export function formatRUT(rut: string | null | undefined): string {
  if (!rut) return '';
  const cleaned = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleaned.length < 2) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${dv}`;
}

/**
 * Formatea fecha en formato chileno DD/MM/YYYY
 */
export function formatDateCL(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Calcula los totales de ítems separados por gastos empresariales y personales
 */
export function calculateTotalsBreakdown(
  items: Array<{
    line_total: number;
    business_percentage: number;
    personal_percentage: number;
    expense_type: string;
  }>
) {
  let businessTotal = 0;
  let personalTotal = 0;
  let itemsSum = 0;

  for (const item of items) {
    itemsSum += item.line_total || 0;
    const bPerc = item.business_percentage ?? (item.expense_type === 'business' ? 100 : 0);
    const pPerc = item.personal_percentage ?? (item.expense_type === 'personal' ? 100 : 0);

    businessTotal += Math.round((item.line_total * bPerc) / 100);
    personalTotal += Math.round((item.line_total * pPerc) / 100);
  }

  return {
    itemsSum,
    businessTotal,
    personalTotal,
    balancedSum: businessTotal + personalTotal,
  };
}
