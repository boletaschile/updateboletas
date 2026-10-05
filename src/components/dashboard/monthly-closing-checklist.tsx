'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckSquare,
  Square,
  Sparkles,
  Calendar,
  AlertCircle,
  ArrowRight,
  Landmark,
  Briefcase,
  Clock,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  stage: 'dia1' | 'dia15' | 'cierre';
  text: string;
  linkText?: string;
  href?: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  // DÍA 1: Arranca con la casa ordenada
  {
    id: 'd1_1',
    stage: 'dia1',
    text: 'Cerré el mes anterior y sé cuánto gané de verdad (ingresos vs gastos).',
  },
  {
    id: 'd1_2',
    stage: 'dia1',
    text: 'Revisé quién me quedó debiendo y cuánto (cartera de clientes).',
    linkText: 'Cuentas por Cobrar',
    href: '/cuentas-por-cobrar',
  },
  {
    id: 'd1_3',
    stage: 'dia1',
    text: 'Aparté mi IVA estimado del mes para que no me golpee el día 20.',
    linkText: 'Libro de Compras',
    href: '/libro-compras',
  },
  {
    id: 'd1_4',
    stage: 'dia1',
    text: 'Programé los pagos grandes del mes (arriendo, sueldos, proveedores clave).',
    linkText: 'Cuentas por Pagar',
    href: '/cuentas-por-pagar',
  },

  // DÍA 15: Media vuelta ¿voy como quería?
  {
    id: 'd15_1',
    stage: 'dia15',
    text: 'Miré mi caja de hoy vs. lo que viene: alcanza para la segunda quincena.',
  },
  {
    id: 'd15_2',
    stage: 'dia15',
    text: 'Dejé listas y pagadas las cotizaciones del equipo (Previred antes del día 13).',
    linkText: 'Ver Cuentas por Pagar',
    href: '/cuentas-por-pagar',
  },
  {
    id: 'd15_3',
    stage: 'dia15',
    text: 'Cobré lo vencido antes de que envejezca (cobranza activa desde el día 5 de mora).',
    linkText: 'Gestionar Cobros',
    href: '/cuentas-por-cobrar',
  },
  {
    id: 'd15_4',
    stage: 'dia15',
    text: 'Revisé que no se colaran gastos personales en la cuenta de la empresa.',
    linkText: 'Mis Boletas',
    href: '/receipts',
  },

  // CIERRE: El número claro del mes
  {
    id: 'c_1',
    stage: 'cierre',
    text: 'Tengo mi resultado del mes: ganancia real, flujo de caja y números claros.',
  },
  {
    id: 'c_2',
    stage: 'cierre',
    text: 'Concilié mis cuentas: cartola bancaria vs. boletas y facturas (todo cuadrado).',
    linkText: 'Conciliación Bancaria IA',
    href: '/conciliacion-bancaria',
  },
  {
    id: 'c_3',
    stage: 'cierre',
    text: 'Comparé con el mes pasado: sé qué mejoró en costos y qué se desvió.',
    linkText: 'Reportes y Métricas',
    href: '/reports',
  },
  {
    id: 'c_4',
    stage: 'cierre',
    text: 'Definí al menos 1 acción correctiva o de ahorro para el próximo mes.',
  },
];

interface MonthlyClosingChecklistProps {
  currentMonthKey: string;
}

export function MonthlyClosingChecklist({ currentMonthKey }: MonthlyClosingChecklistProps) {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(true);

  const storageKey = `subeboletas_checklist_${currentMonthKey}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCheckedIds(JSON.parse(saved));
      } else {
        setCheckedIds({});
      }
    } catch {
      setCheckedIds({});
    }
  }, [storageKey]);

  const toggleItem = (id: string) => {
    setCheckedIds((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  const handleReset = () => {
    if (confirm('¿Deseas reiniciar el checklist de este mes?')) {
      setCheckedIds({});
      localStorage.removeItem(storageKey);
    }
  };

  const totalCount = CHECKLIST_ITEMS.length;
  const completedCount = CHECKLIST_ITEMS.filter((item) => !!checkedIds[item.id]).length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const dia1Items = CHECKLIST_ITEMS.filter((i) => i.stage === 'dia1');
  const dia15Items = CHECKLIST_ITEMS.filter((i) => i.stage === 'dia15');
  const cierreItems = CHECKLIST_ITEMS.filter((i) => i.stage === 'cierre');

  return (
    <Card className="border-indigo-200 dark:border-indigo-900 bg-gradient-to-b from-indigo-50/30 to-background dark:from-indigo-950/20 shadow-sm overflow-hidden">
      <CardHeader className="py-4 px-5 border-b flex flex-row items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-600 text-white border-0 text-[10px] font-bold">
              Checklist Pyme Chile
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground">
              {completedCount} de {totalCount} completadas ({progressPercent}%)
            </span>
          </div>
          <CardTitle className="text-sm md:text-base flex items-center gap-2 font-bold text-foreground">
            <CheckCircle2 className="h-4 w-4 text-indigo-600" />
            <span>Ritual de Cierre Financiero Mensual (en 3 Momentos)</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Cierra tus números cada mes como una empresa profesional — sin sorpresas de fin de mes ni apuros de última hora.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground gap-1"
              title="Reiniciar checklist"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Reiniciar</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
            title={isExpanded ? 'Contraer' : 'Expandir'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <div className="px-5 pt-3 pb-1">
        <Progress
          value={progressPercent}
          indicatorColor={progressPercent === 100 ? 'bg-emerald-600' : progressPercent > 50 ? 'bg-indigo-600' : 'bg-blue-500'}
          className="h-2"
        />
      </div>

      {isExpanded && (
        <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* MOMENTO 1: DÍA 1 */}
          <div className="space-y-3 p-3.5 rounded-xl bg-background border shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="font-bold text-xs text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 text-[10px] font-black">
                  DÍA 1
                </span>
                <span>Arranca Ordenado</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {dia1Items.filter((i) => checkedIds[i.id]).length}/{dia1Items.length}
              </span>
            </div>

            <div className="space-y-2">
              {dia1Items.map((item) => {
                const isChecked = !!checkedIds[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/40 text-muted-foreground line-through'
                        : 'hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <button type="button" className="mt-0.5 flex-shrink-0 text-indigo-600">
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <div className="text-[11px] leading-tight space-y-1">
                      <p>{item.text}</p>
                      {item.linkText && item.href && (
                        <Link
                          href={item.href}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline no-underline"
                        >
                          <span>{item.linkText}</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MOMENTO 2: DÍA 15 */}
          <div className="space-y-3 p-3.5 rounded-xl bg-background border shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="font-bold text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 text-[10px] font-black">
                  DÍA 15
                </span>
                <span>Media Vuelta (Control)</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {dia15Items.filter((i) => checkedIds[i.id]).length}/{dia15Items.length}
              </span>
            </div>

            <div className="space-y-2">
              {dia15Items.map((item) => {
                const isChecked = !!checkedIds[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-blue-50/60 dark:bg-blue-950/40 text-muted-foreground line-through'
                        : 'hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <button type="button" className="mt-0.5 flex-shrink-0 text-blue-600">
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <div className="text-[11px] leading-tight space-y-1">
                      <p>{item.text}</p>
                      {item.linkText && item.href && (
                        <Link
                          href={item.href}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline no-underline"
                        >
                          <span>{item.linkText}</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MOMENTO 3: CIERRE */}
          <div className="space-y-3 p-3.5 rounded-xl bg-background border shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-black">
                  CIERRE
                </span>
                <span>El Número Claro</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {cierreItems.filter((i) => checkedIds[i.id]).length}/{cierreItems.length}
              </span>
            </div>

            <div className="space-y-2">
              {cierreItems.map((item) => {
                const isChecked = !!checkedIds[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/40 text-muted-foreground line-through'
                        : 'hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <button type="button" className="mt-0.5 flex-shrink-0 text-emerald-600">
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <div className="text-[11px] leading-tight space-y-1">
                      <p>{item.text}</p>
                      {item.linkText && item.href && (
                        <Link
                          href={item.href}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline no-underline"
                        >
                          <span>{item.linkText}</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
