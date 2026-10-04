/**
 * Utilidades de períodos mensuales. Una "clave de mes" es 'YYYY-MM'.
 * Se evita `new Date('YYYY-MM-DD')` para no correr el día por zona horaria.
 */

export const ALL_MONTHS = 'all';

export function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(): string {
  return monthKeyFromDate(new Date());
}

/** 'YYYY-MM-DD' o ISO completo -> 'YYYY-MM' (null si no hay fecha válida) */
export function monthKeyOf(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value) && value.length === 10) return value.slice(0, 7);
  const d = new Date(value);
  if (isNaN(d.getTime())) return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : null;
  return monthKeyFromDate(d);
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKeyFromDate(new Date(y, m - 1 + delta, 1));
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Fecha 'YYYY-MM-DD' razonable para un mes: hoy si es el mes actual, si no el último día del mes */
export function defaultDateForMonth(key: string): string {
  const today = new Date();
  if (key === monthKeyFromDate(today)) {
    return `${key}-${String(today.getDate()).padStart(2, '0')}`;
  }
  const [y, m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${key}-${String(last).padStart(2, '0')}`;
}
