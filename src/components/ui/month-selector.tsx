'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { ALL_MONTHS, currentMonthKey, formatMonthLabel, shiftMonth } from '@/lib/month-utils';

interface MonthSelectorProps {
  value: string; // 'all' | 'YYYY-MM'
  onChange: (value: string) => void;
  /** Meses que tienen datos, con su cantidad (para mostrarlos en el selector) */
  monthCounts?: Record<string, number>;
  className?: string;
}

export function MonthSelector({ value, onChange, monthCounts = {}, className = '' }: MonthSelectorProps) {
  const thisMonth = currentMonthKey();
  const isAll = value === ALL_MONTHS;

  // Meses disponibles: los que tienen datos + el actual + el seleccionado, del más nuevo al más antiguo
  const keys = new Set<string>([...Object.keys(monthCounts), thisMonth]);
  if (!isAll) keys.add(value);
  const options = Array.from(keys).sort().reverse();

  const go = (delta: number) => onChange(shiftMonth(isAll ? thisMonth : value, delta));

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={isAll}
        aria-label="Mes anterior"
        className="h-10 w-10 rounded-lg border border-input bg-background flex items-center justify-center hover:bg-muted disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="relative">
        <CalendarDays className="h-4 w-4 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Filtrar por mes"
          className="h-10 pl-9 pr-3 rounded-lg border border-input bg-background text-xs font-semibold min-w-[170px]"
        >
          <option value={ALL_MONTHS}>Todos los meses</option>
          {options.map((k) => (
            <option key={k} value={k}>
              {formatMonthLabel(k)}
              {monthCounts[k] ? ` (${monthCounts[k]})` : ''}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => go(1)}
        disabled={isAll}
        aria-label="Mes siguiente"
        className="h-10 w-10 rounded-lg border border-input bg-background flex items-center justify-center hover:bg-muted disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {value !== thisMonth && (
        <button
          type="button"
          onClick={() => onChange(thisMonth)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-xs font-medium hover:bg-muted"
        >
          Este mes
        </button>
      )}
    </div>
  );
}
