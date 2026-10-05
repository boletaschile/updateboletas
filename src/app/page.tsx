'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { MonthSelector } from '@/components/ui/month-selector';
import { ALL_MONTHS, currentMonthKey, formatMonthLabel, monthKeyOf } from '@/lib/month-utils';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import { formatCLP, formatDateCL } from '@/lib/utils';
import {
  TrendingUp,
  Receipt,
  Building2,
  User,
  AlertCircle,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  ShieldAlert,
  Calendar,
  Sparkles,
  Layers,
  Clock,
  Bell,
  BookOpen,
  Landmark,
  Briefcase,
  Wallet,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  PiggyBank,
  ShieldCheck,
  Check,
  UploadCloud,
} from 'lucide-react';
import { MonthlyClosingChecklist } from '@/components/dashboard/monthly-closing-checklist';
import { NewExpenseModal } from '@/components/receipts/new-expense-modal';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#64748B'];

export default function DashboardPage() {
  const { receipts, budgets, debts, receivables } = useReceipts();
  const { activeOrgId, activeOrg, organizations, setActiveOrgId, user } = useAuth();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  const businessOrgs = useMemo(() => organizations.filter((o) => o.type !== 'personal'), [organizations]);
  const personalOrgs = useMemo(() => organizations.filter((o) => o.type === 'personal'), [organizations]);

  const currentBusinessOrg = useMemo(
    () => businessOrgs.find((o) => o.id === activeOrgId) || businessOrgs[0],
    [businessOrgs, activeOrgId]
  );
  const currentPersonalOrg = useMemo(
    () => personalOrgs.find((o) => o.id === activeOrgId) || personalOrgs[0],
    [personalOrgs, activeOrgId]
  );

  const isPersonalMode = activeOrg?.type === 'personal' || activeOrgId === 'org-personal';

  // Cuentas por Cobrar e Ingresos filtradas estrictamente según el perfil activo
  const scopedReceivables = useMemo(() => {
    return (receivables || []).filter((r) => {
      if (isPersonalMode) {
        return r.income_type === 'personal' || r.organization_id === 'org-personal';
      }
      if (r.income_type === 'personal') return false; // CERO mezclas
      return (
        r.organization_id === activeOrgId ||
        (r.income_type === 'business' && (!r.organization_id || r.organization_id === 'org-empresa-1'))
      );
    });
  }, [receivables, activeOrgId, isPersonalMode]);

  const pendingReceivables = useMemo(
    () => scopedReceivables.filter((r) => r.status !== 'collected'),
    [scopedReceivables]
  );
  const totalPendingReceivable = useMemo(
    () => pendingReceivables.reduce((acc, r) => acc + r.total_amount, 0),
    [pendingReceivables]
  );

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey());

  useEffect(() => {
    const saved = localStorage.getItem('subeboletas_selected_month_v1');
    if (saved) setSelectedMonth(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem('subeboletas_selected_month_v1', selectedMonth);
  }, [selectedMonth]);

  const inSelectedMonth = (value?: string | null) =>
    selectedMonth === ALL_MONTHS || monthKeyOf(value) === selectedMonth;

  // Boletas de la organización activa con aislamiento estricto
  const orgReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (r.status === 'rejected') return false;
      if (isPersonalMode) {
        return r.expense_type === 'personal' || r.organization_id === 'org-personal';
      }
      if (r.expense_type === 'personal') return false; // CERO boletas personales en la empresa
      return (
        r.organization_id === activeOrgId ||
        (!r.organization_id || r.organization_id === 'org-empresa-1')
      );
    });
  }, [receipts, activeOrgId, isPersonalMode]);

  // Compromisos y Cuentas por pagar con aislamiento estricto
  const scopedDebts = useMemo(() => {
    return debts.filter((d) => {
      if (isPersonalMode) {
        return d.expense_type === 'personal' || d.organization_id === 'org-personal';
      }
      if (d.expense_type === 'personal') return false; // CERO deudas personales en la empresa
      return (
        d.organization_id === activeOrgId ||
        (!d.organization_id || d.organization_id === 'org-empresa-1')
      );
    });
  }, [debts, activeOrgId, isPersonalMode]);

  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orgReceipts.forEach((r) => {
      const k = monthKeyOf(r.document_date);
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
    scopedDebts.forEach((d) => {
      if (d.status === 'paid') {
        const k = monthKeyOf(d.paid_at) || monthKeyOf(d.due_date);
        if (k) counts[k] = (counts[k] || 0) + 1;
      }
    });
    return counts;
  }, [orgReceipts, scopedDebts]);

  // Boletas del mes seleccionado
  const currentMonthReceipts = useMemo(() => {
    return orgReceipts.filter((r) => inSelectedMonth(r.document_date));
  }, [orgReceipts, selectedMonth]);

  // Compromisos y deudas marcadas como pagadas en el mes (coincide si vence o se pagó en el período)
  const paidDebts = useMemo(() => {
    return scopedDebts.filter((d) => {
      if (d.status !== 'paid') return false;
      if (selectedMonth === ALL_MONTHS) return true;
      const pKey = monthKeyOf(d.paid_at);
      const dKey = monthKeyOf(d.due_date);
      return pKey === selectedMonth || dKey === selectedMonth;
    });
  }, [scopedDebts, selectedMonth]);

  const paidDebtsAmount = useMemo(() => {
    return paidDebts.reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);
  }, [paidDebts]);

  // Gastos de boletas en el período
  const receiptsSpent = useMemo(() => {
    return currentMonthReceipts.reduce((acc, r) => {
      if (isPersonalMode) return acc + (r.personal_total || r.total_amount);
      return acc + (r.business_total || r.total_amount);
    }, 0);
  }, [currentMonthReceipts, isPersonalMode]);

  // Total consolidado (Boletas + Compromisos pagados)
  const totalSpent = receiptsSpent + paidDebtsAmount;
  const pendingReviewCount = currentMonthReceipts.filter((r) => r.status === 'needs_review').length;

  // Presupuesto asignado según el modo de trabajo activo
  const activeBudget = useMemo(() => {
    if (isPersonalMode) {
      return budgets.find((b) => b.budget_type === 'personal') || budgets.find((b) => b.budget_type === 'total');
    }
    return budgets.find((b) => b.budget_type === 'business') || budgets.find((b) => b.budget_type === 'total');
  }, [budgets, isPersonalMode]);

  const totalBudget = activeBudget?.amount || 0;
  const budgetUsagePercent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;
  const remainingBudget = Math.max(0, totalBudget - totalSpent);

  const overdueDebts = scopedDebts.filter((d) => d.status === 'overdue');
  const dueSoonDebts = scopedDebts.filter((d) => d.status === 'due_soon');
  const totalUrgentDebt = [...overdueDebts, ...dueSoonDebts].reduce((acc, d) => acc + d.amount, 0);

  // Costos Fijos Base y Sueldo Asignado de la Empresa
  const assignedSalary = !isPersonalMode && activeOrg?.assigned_salary ? activeOrg.assigned_salary : 0;
  const fixedExpensesSum =
    !isPersonalMode && activeOrg?.monthly_expenses
      ? Object.values(activeOrg.monthly_expenses).reduce((a, b) => a + (Number(b) || 0), 0)
      : 0;
  const companyFixedCostsTotal = assignedSalary + fixedExpensesSum;

  // Ventas o Ingresos del período
  const currentMonthReceivables = useMemo(() => {
    return scopedReceivables.filter((r) => inSelectedMonth(r.issue_date || r.created_at));
  }, [scopedReceivables, selectedMonth]);

  const currentMonthSales = useMemo(() => {
    return currentMonthReceivables.reduce((acc, r) => acc + r.total_amount, 0);
  }, [currentMonthReceivables]);

  // Ingreso Personal: Facturación personal o Sueldo Empresarial asignado
  const personalIncome = useMemo(() => {
    if (currentMonthSales > 0) return currentMonthSales;
    return currentBusinessOrg?.assigned_salary || 0;
  }, [currentMonthSales, currentBusinessOrg]);

  const personalSurplus = personalIncome - totalSpent;

  // -------------------------------------------------------------
  // MÉTRICAS EMPRESA: LOS 4 NÚMEROS DE SALUD PYME (Guía itsave)
  // -------------------------------------------------------------
  const realProfit = currentMonthSales - totalSpent;

  const collectedCash = useMemo(() => {
    return scopedReceivables
      .filter((r) => r.status === 'collected' && inSelectedMonth(r.collected_at || r.issue_date))
      .reduce((acc, r) => acc + r.total_amount, 0);
  }, [scopedReceivables, selectedMonth]);

  const operationalCashFlow = collectedCash - totalSpent;

  const overdueMore30Days = useMemo(() => {
    const nowMs = Date.now();
    return pendingReceivables.filter((r) => {
      if (!r.due_date) return false;
      const dueMs = new Date(r.due_date).getTime();
      return nowMs - dueMs > 30 * 24 * 60 * 60 * 1000;
    });
  }, [pendingReceivables]);

  const totalOverdueMore30 = useMemo(() => {
    return overdueMore30Days.reduce((acc, r) => acc + r.total_amount, 0);
  }, [overdueMore30Days]);

  // IVA Estimado F29 (Día 20)
  const estimatedIvaDebito = Math.round((currentMonthSales * 0.19) / 1.19);
  const estimatedIvaCredito = currentMonthReceipts.reduce(
    (acc, r) => acc + (r.tax_amount || Math.round(((r.business_total || r.total_amount) * 0.19) / 1.19)),
    0
  );
  const estimatedF29IvaToPay = Math.max(0, estimatedIvaDebito - estimatedIvaCredito);

  // Fechas Duras Tributarias Chile
  const today = new Date();
  const currentDay = today.getDate();
  const daysToPrevired = 13 - currentDay;
  const daysToF29 = 20 - currentDay;

  // Detección de Gastos Personales ingresados con la Empresa (Alerta de Prevención SII)
  const personalExpensesInBusinessCount = useMemo(() => {
    if (isPersonalMode) return 0;
    return receipts.filter((r) => {
      if (r.status === 'rejected') return false;
      return (
        (r.organization_id === activeOrgId || (!r.organization_id && activeOrgId === 'org-empresa-1')) &&
        (r.expense_type === 'personal' || (r.personal_total || 0) > 0)
      );
    }).length;
  }, [isPersonalMode, receipts, activeOrgId]);

  const personalExpensesInBusinessAmount = useMemo(() => {
    if (isPersonalMode) return 0;
    return receipts
      .filter((r) => {
        if (r.status === 'rejected') return false;
        return (
          (r.organization_id === activeOrgId || (!r.organization_id && activeOrgId === 'org-empresa-1')) &&
          (r.expense_type === 'personal' || (r.personal_total || 0) > 0)
        );
      })
      .reduce((acc, r) => acc + (r.personal_total || r.total_amount), 0);
  }, [isPersonalMode, receipts, activeOrgId]);

  // Datos para Gráfico de Categorías (Boletas + Compromisos Pagados)
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthReceipts.forEach((r) => {
      if (r.items && r.items.length > 0) {
        r.items.forEach((item) => {
          const cat = item.category_name || r.category_name || 'Varios';
          map[cat] = (map[cat] || 0) + item.line_total;
        });
      } else {
        const cat = r.category_name || 'Varios';
        const amt = isPersonalMode ? r.personal_total || r.total_amount : r.business_total || r.total_amount;
        map[cat] = (map[cat] || 0) + amt;
      }
    });

    paidDebts.forEach((d) => {
      const cat =
        d.is_installment_credit || d.category === 'credito_bancario'
          ? 'Créditos y Préstamos'
          : d.category === 'impuesto_f29'
          ? 'Impuestos F29'
          : d.category === 'previred'
          ? 'Cotizaciones Previred'
          : d.category === 'sueldo_empresarial'
          ? 'Sueldo Asignado Dueño'
          : d.category === 'servicios_basicos'
          ? 'Servicios Básicos'
          : d.category === 'arriendo'
          ? isPersonalMode
            ? 'Arriendo Hogar'
            : 'Arriendo Oficina'
          : d.category === 'tarjeta_credito'
          ? 'Tarjeta de Crédito'
          : 'Compromisos Pagados';
      const amt = d.paid_amount || d.installment_amount || d.amount;
      map[cat] = (map[cat] || 0) + amt;
    });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [currentMonthReceipts, paidDebts, isPersonalMode]);

  // Datos para Gráfico de Evolución Mensual Aislada
  const monthlyComparisonData = useMemo(() => {
    const monthNames = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
    ];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const months = [
      new Date(currentYear, currentMonth - 2, 1),
      new Date(currentYear, currentMonth - 1, 1),
      new Date(currentYear, currentMonth, 1),
    ];

    return months.map((m) => {
      const year = m.getFullYear();
      const month = m.getMonth();
      const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      const isCurrent = month === currentMonth && year === currentYear;

      const mReceipts = receipts.filter((r) => {
        if (r.status === 'rejected') return false;
        if (isPersonalMode) {
          if (r.expense_type !== 'personal' && r.organization_id !== 'org-personal') return false;
        } else {
          if (r.expense_type === 'personal') return false;
          if (r.organization_id && r.organization_id !== activeOrgId) return false;
        }
        return r.document_date && r.document_date.startsWith(monthPrefix);
      });

      const mPaidDebts = scopedDebts.filter((d) => {
        if (d.status !== 'paid') return false;
        const pKey = monthKeyOf(d.paid_at);
        const dKey = monthKeyOf(d.due_date);
        return pKey === monthPrefix || dKey === monthPrefix;
      });

      const recTotal = mReceipts.reduce((acc, r) => {
        if (isPersonalMode) return acc + (r.personal_total || r.total_amount);
        return acc + (r.business_total || r.total_amount);
      }, 0);

      const debtTotal = mPaidDebts.reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);

      return {
        name: isCurrent ? `${monthNames[month]} (Actual)` : monthNames[month],
        gasto: isCurrent ? totalSpent : recTotal + debtTotal,
      };
    });
  }, [receipts, scopedDebts, activeOrgId, isPersonalMode, totalSpent]);

  // Top Comercios aislados por perfil
  const topMerchants = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    currentMonthReceipts.forEach((r) => {
      if (!map[r.merchant_name]) map[r.merchant_name] = { total: 0, count: 0 };
      const amt = isPersonalMode ? r.personal_total || r.total_amount : r.business_total || r.total_amount;
      map[r.merchant_name].total += amt;
      map[r.merchant_name].count += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [currentMonthReceipts, isPersonalMode]);

  return (
    <AppLayout
      title="Panel de Control Financiero"
      description="Resumen de gastos mensuales, presupuesto disponible, cuentas por pagar y detección de documentos."
    >
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* SELECTOR PROMINENTE DE PERFIL: EMPRESA VS PERSONA NATURAL (INICIO)       */}
        {/* ========================================================================= */}
        <div className="bg-card border-2 border-border/80 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                Perfil Activo:
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl">
              {/* Botón Modo Empresa */}
              <button
                type="button"
                onClick={() => {
                  if (currentBusinessOrg) setActiveOrgId(currentBusinessOrg.id);
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  !isPersonalMode
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span className="truncate">
                  🏢 Empresa {currentBusinessOrg ? `(${currentBusinessOrg.name})` : ''}
                </span>
                {!isPersonalMode && <Check className="h-3.5 w-3.5 ml-0.5" />}
              </button>

              {/* Botón Modo Persona Natural */}
              <button
                type="button"
                onClick={() => {
                  if (currentPersonalOrg) setActiveOrgId(currentPersonalOrg.id);
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  isPersonalMode
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <User className="h-4 w-4" />
                <span className="truncate">👤 Persona Natural</span>
                {isPersonalMode && <Check className="h-3.5 w-3.5 ml-0.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 text-xs pt-2 md:pt-0 border-t md:border-t-0 border-border">
            {isPersonalMode ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 gap-1.5 py-1 px-3">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Modo Personal: Gastos del hogar y vida diaria sin mezcla con empresa</span>
              </Badge>
            ) : (
              <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/30 gap-1.5 py-1 px-3">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span>Modo Empresa: Contabilidad, IVA F29 y gastos operacionales de negocio</span>
              </Badge>
            )}
            <Link
              href="/profile"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-[11px] whitespace-nowrap"
            >
              Configurar Perfiles
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BANNER DINÁMICO SEGÚN MODO ACTIVO                                         */}
        {/* ========================================================================= */}
        {!isPersonalMode ? (
          /* BANNER MODO EMPRESA */
          <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-blue-950/30">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-blue-500/20 text-blue-200 border-blue-400/30 text-xs">
                  🏢 Empresa: {activeOrg?.name || 'Webunica Chile SpA'}
                </Badge>
                {activeOrg?.rut && (
                  <Badge className="bg-slate-700/60 text-slate-200 border-slate-600/30 text-xs font-mono">
                    RUT: {activeOrg.rut}
                  </Badge>
                )}
                <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                  Período: {selectedMonth === ALL_MONTHS ? 'Historial Completo' : formatMonthLabel(selectedMonth)}
                </Badge>
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                Panel Financiero y Tributario de la Empresa
              </h2>
              <p className="text-xs text-blue-200/80 max-w-xl">
                Control operacional, cálculo de IVA F29, boletas deducibles y facturas de venta. Cero mezcla con gastos personales.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link href="/cuentas-por-cobrar">
                <Button
                  variant="outline"
                  className="border-blue-400/30 bg-blue-950/40 text-blue-100 hover:bg-blue-900/60 gap-1.5 font-medium text-xs"
                >
                  <Briefcase className="h-4 w-4 text-emerald-400" />
                  <span>Cuentas por Cobrar</span>
                </Button>
              </Link>
              <Link href="/cuentas-por-pagar">
                <Button
                  variant="outline"
                  className="border-blue-400/30 bg-blue-950/40 text-blue-100 hover:bg-blue-900/60 gap-1.5 font-medium text-xs"
                >
                  <Landmark className="h-4 w-4 text-amber-400" />
                  <span>Cuentas por Pagar</span>
                </Button>
              </Link>
              <Button
                onClick={() => setIsAddExpenseOpen(true)}
                className="bg-white text-slate-950 hover:bg-slate-100 gap-2 font-semibold shadow-md text-xs"
              >
                <PlusCircle className="h-4 w-4 text-blue-600" />
                <span>+ Agregar Gasto</span>
              </Button>
              <Link
                href={
                  selectedMonth !== ALL_MONTHS
                    ? `/receipts/new?month=${selectedMonth}&type=business`
                    : '/receipts/new?type=business'
                }
              >
                <Button
                  variant="outline"
                  className="border-blue-400/30 bg-blue-950/40 text-blue-100 hover:bg-blue-900/60 gap-1.5 font-medium text-xs"
                >
                  <UploadCloud className="h-4 w-4 text-blue-300" />
                  <span>Escanear Boleta</span>
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* BANNER MODO PERSONA NATURAL */
          <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-emerald-950/30">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                  👤 Finanzas Personales
                </Badge>
                {activeOrg?.rut && (
                  <Badge className="bg-slate-700/60 text-slate-200 border-slate-600/30 text-xs font-mono">
                    RUT: {activeOrg.rut}
                  </Badge>
                )}
                <Badge className="bg-teal-500/20 text-teal-200 border-teal-400/30 text-xs">
                  Período: {selectedMonth === ALL_MONTHS ? 'Historial Completo' : formatMonthLabel(selectedMonth)}
                </Badge>
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                Control de Finanzas Personales y del Hogar
              </h2>
              <p className="text-xs text-teal-200/80 max-w-xl">
                Compras particulares, supermercado, salud, vestuario y presupuesto familiar. Totalmente independiente de la empresa.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link href="/cuentas-por-pagar">
                <Button
                  variant="outline"
                  className="border-teal-400/30 bg-teal-950/40 text-teal-100 hover:bg-teal-900/60 gap-1.5 font-medium text-xs"
                >
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  <span>Compromisos del Hogar</span>
                </Button>
              </Link>
              <Button
                onClick={() => setIsAddExpenseOpen(true)}
                className="bg-white text-slate-950 hover:bg-slate-100 gap-2 font-semibold shadow-md text-xs"
              >
                <PlusCircle className="h-4 w-4 text-emerald-600" />
                <span>+ Agregar Gasto</span>
              </Button>
              <Link
                href={
                  selectedMonth !== ALL_MONTHS
                    ? `/receipts/new?month=${selectedMonth}&type=personal`
                    : '/receipts/new?type=personal'
                }
              >
                <Button
                  variant="outline"
                  className="border-teal-400/30 bg-teal-950/40 text-teal-100 hover:bg-teal-900/60 gap-1.5 font-medium text-xs"
                >
                  <UploadCloud className="h-4 w-4 text-teal-300" />
                  <span>Escanear Boleta</span>
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Barra de Período Mensual del Dashboard */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
          <MonthSelector value={selectedMonth} onChange={setSelectedMonth} monthCounts={monthCounts} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {selectedMonth === ALL_MONTHS
                ? 'Mostrando todo el historial'
                : `Viendo gastos de ${formatMonthLabel(selectedMonth)}`}
            </span>
            <span>•</span>
            <Link
              href={selectedMonth !== ALL_MONTHS ? `/receipts?month=${selectedMonth}` : '/receipts'}
              className="text-blue-600 hover:underline font-medium"
            >
              Ver detalle en Mis Boletas ({currentMonthReceipts.length})
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ALERTAS ESPECÍFICAS SEGÚN MODO                                            */}
        {/* ========================================================================= */}
        {!isPersonalMode ? (
          <>
            {/* Alerta de Cuentas por Cobrar Pendientes (Empresa) */}
            {pendingReceivables.length > 0 && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-950 dark:text-emerald-200">
                      Flujo de Ingresos por Cobrar: {formatCLP(totalPendingReceivable)} ({pendingReceivables.length} factura/servicio pendiente)
                    </p>
                    <p className="text-emerald-800 dark:text-emerald-300 text-[11px]">
                      Gestión activa de cobranza y facturación a clientes de la empresa.
                    </p>
                  </div>
                </div>
                <Link href="/cuentas-por-cobrar">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-emerald-300 bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-200 whitespace-nowrap font-medium"
                  >
                    Gestionar Cobros
                  </Button>
                </Link>
              </div>
            )}

            {/* Alerta de Cuentas por Pagar Urgentes (Empresa: Proveedores / F29 / Previred) */}
            {(overdueDebts.length > 0 || dueSoonDebts.length > 0) && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-rose-950 dark:text-rose-200">
                      Compromisos de la Empresa: {formatCLP(totalUrgentDebt)} por vencer o vencidos
                    </p>
                    <p className="text-rose-800 dark:text-rose-300 text-[11px]">
                      {overdueDebts.length > 0 ? `${overdueDebts.length} cuenta(s) vencida(s) • ` : ''}
                      {dueSoonDebts.length} compromiso(s) por vencer en los próximos días (F29, Previred o Proveedores).
                    </p>
                  </div>
                </div>
                <Link href="/cuentas-por-pagar">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-rose-300 bg-white dark:bg-slate-900 text-rose-900 dark:text-rose-200 whitespace-nowrap"
                  >
                    Ver Cuentas por Pagar
                  </Button>
                </Link>
              </div>
            )}

            {/* Fechas Duras del Calendario Tributario Chile (Solo Empresa) */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-800/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">Fechas Duras del Mes (Chile)</span>
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] py-0">
                      Sin Prórroga
                    </Badge>
                  </div>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    Fechas clave para evitar multas de la DT y recargos por mora ante el SII.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <div>
                    <span className="font-semibold text-slate-200">Día 13: Previred</span>
                    <span className="text-[10px] text-slate-400 block">
                      {daysToPrevired > 0
                        ? `Quedan ${daysToPrevired} día(s)`
                        : daysToPrevired === 0
                        ? '¡Vence HOY!'
                        : 'Período cumplido'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80">
                  <FileCheck2 className="h-3.5 w-3.5 text-blue-400" />
                  <div>
                    <span className="font-semibold text-slate-200">Día 20: F29 (SII)</span>
                    <span className="text-[10px] text-slate-400 block">
                      {daysToF29 > 0
                        ? `Quedan ${daysToF29} día(s)`
                        : daysToF29 === 0
                        ? '¡Vence HOY!'
                        : 'Declarado/Vencido'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <div>
                    <span className="font-semibold text-slate-200">Abril: F22</span>
                    <span className="text-[10px] text-slate-400 block">Operación Renta</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerta de Auditoría: Gastos Personales en Cuenta Empresa (Error #4 de la guía itsave) */}
            {personalExpensesInBusinessCount > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-amber-950 dark:text-amber-200">
                        Alerta de Cierre: Gastos Personales Detectados en la Empresa
                      </p>
                      <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300">
                        {personalExpensesInBusinessCount} boleta(s) • {formatCLP(personalExpensesInBusinessAmount)}
                      </Badge>
                    </div>
                    <p className="text-amber-800 dark:text-amber-300 text-[11px] max-w-4xl">
                      Mezclar gastos personales en la empresa distorsiona tu margen real y genera contingencias por{' '}
                      <strong>gastos rechazados (Art. 21 LIR, 40% de castigo)</strong> ante el SII. Asigna un sueldo o retiro de dueño en lugar de pasar boletas personales.
                    </p>
                  </div>
                </div>
                <Link href="/receipts?type=personal">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-amber-400 bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 whitespace-nowrap"
                  >
                    Revisar Boletas
                  </Button>
                </Link>
              </div>
            )}

            {/* Los 4 Números de Salud Pyme (Metodología itsave) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-blue-600/10 text-blue-600 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-bold text-base text-foreground">
                    Los 4 Números de Salud de tu Negocio
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Diagnóstico rápido para saber si tu empresa gana dinero y tiene liquidez real.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Ganancia Real */}
                <Card className="p-4 border-l-4 border-l-emerald-500 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      1. Ganancia Real del Mes
                    </span>
                    <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <h4
                      className={`text-xl font-extrabold ${
                        realProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCLP(realProfit)}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      Ventas ({formatCLP(currentMonthSales)}) - Gastos Empresa ({formatCLP(totalSpent)})
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[10px]">
                    <span className={realProfit >= 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                      {realProfit >= 0 ? 'Margen Operativo Sano' : 'Alerta: Margen negativo'}
                    </span>
                    <span className="text-muted-foreground">Resultado neto</span>
                  </div>
                </Card>

                {/* 2. Saldo Operativo de Caja */}
                <Card className="p-4 border-l-4 border-l-blue-500 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      2. Saldo Operativo de Caja
                    </span>
                    <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                      <Wallet className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <h4
                      className={`text-xl font-extrabold ${
                        operationalCashFlow >= 0 ? 'text-foreground' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCLP(operationalCashFlow)}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      Cobrado ({formatCLP(collectedCash)}) - Pagado ({formatCLP(totalSpent)})
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[10px]">
                    <span className="text-blue-600 font-medium">Liquidez en Caja</span>
                    <span className="text-muted-foreground">Flujo neto</span>
                  </div>
                </Card>

                {/* 3. Cartera por Cobrar */}
                <Card className="p-4 border-l-4 border-l-purple-500 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      3. Cartera por Cobrar
                    </span>
                    <div className="h-7 w-7 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
                      <Briefcase className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <h4 className="text-xl font-extrabold text-purple-700 dark:text-purple-300">
                      {formatCLP(totalPendingReceivable)}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      {pendingReceivables.length} factura(s) por recaudar
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[10px]">
                    {totalOverdueMore30 > 0 ? (
                      <span className="text-rose-600 font-semibold flex items-center gap-1 truncate">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        {formatCLP(totalOverdueMore30)} con &gt;30d mora
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium">Sin mora &gt;30d</span>
                    )}
                    <Link href="/cuentas-por-cobrar" className="text-purple-600 hover:underline flex-shrink-0">
                      Cobranza
                    </Link>
                  </div>
                </Card>

                {/* 4. IVA Estimado F29 (Día 20) */}
                <Card className="p-4 border-l-4 border-l-amber-500 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      4. IVA Estimado F29 (Día 20)
                    </span>
                    <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                      <FileCheck2 className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <h4 className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                      {formatCLP(estimatedF29IvaToPay)}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      Débito ({formatCLP(estimatedIvaDebito)}) - Crédito ({formatCLP(estimatedIvaCredito)})
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[10px]">
                    <span className="text-amber-600 font-medium">Apartar para el día 20</span>
                    <Link href="/libro-compras" className="text-amber-600 hover:underline flex-shrink-0">
                      F29
                    </Link>
                  </div>
                </Card>
              </div>
            </div>

            {/* Checklist de Cierre Financiero Mensual */}
            <MonthlyClosingChecklist currentMonthKey={selectedMonth} />
          </>
        ) : (
          <>
            {/* Alerta de Compromisos Personales Urgentes (Hogar, servicios, etc.) */}
            {(overdueDebts.length > 0 || dueSoonDebts.length > 0) && (
              <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-600 flex items-center justify-center flex-shrink-0">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-teal-950 dark:text-teal-200">
                      Compromisos Personales: {formatCLP(totalUrgentDebt)} por pagar en el mes
                    </p>
                    <p className="text-teal-800 dark:text-teal-300 text-[11px]">
                      {overdueDebts.length > 0 ? `${overdueDebts.length} cuenta(s) vencida(s) • ` : ''}
                      {dueSoonDebts.length} cuenta(s) por vencer (Arriendo personal, servicios del hogar o cuotas).
                    </p>
                  </div>
                </div>
                <Link href="/cuentas-por-pagar">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-teal-300 bg-white dark:bg-slate-900 text-teal-900 dark:text-teal-200 whitespace-nowrap"
                  >
                    Ver Cuentas del Hogar
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* TARJETAS DE INDICADORES CLAVE (AISLADAS 100%)                             */}
        {/* ========================================================================= */}
        {!isPersonalMode ? (
          /* KPI CARDS MODO EMPRESA (Cero datos personales) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Gasto Operacional Total de Empresa */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Gasto Operacional Empresa</span>
                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
                {formatCLP(totalSpent)}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
                {paidDebtsAmount > 0 ? (
                  <span>Boletas: {formatCLP(receiptsSpent)} + Proveedores/Cuotas: {formatCLP(paidDebtsAmount)}</span>
                ) : (
                  <span>100% compras y servicios operacionales</span>
                )}
              </div>
            </Card>

            {/* 2. Ventas Facturadas del Mes */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Ventas Facturadas</span>
                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center">
                  <Briefcase className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
                {formatCLP(currentMonthSales)}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
                <span>{currentMonthReceivables.length} documento(s) emitido(s) en el período</span>
              </div>
            </Card>

            {/* 3. Costos Fijos Base & Sueldo Dueño */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Costos Fijos & Sueldo</span>
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center">
                  <Landmark className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">
                {companyFixedCostsTotal > 0 ? formatCLP(companyFixedCostsTotal) : 'Sin Configurar'}
              </h3>
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span className="truncate">
                  {assignedSalary > 0 ? `Sueldo: ${formatCLP(assignedSalary)}` : 'Sueldo asignado'}
                </span>
                <Link href="/profile" className="text-blue-600 hover:underline font-medium ml-1">
                  Editar
                </Link>
              </div>
            </Card>

            {/* 4. Presupuesto Operacional de la Empresa */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Presupuesto Empresa</span>
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center">
                  <PieChartIcon className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <h3 className="text-2xl font-extrabold text-foreground">
                  {totalBudget > 0 ? formatCLP(remainingBudget) : 'Sin Límite'}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {totalBudget > 0 ? `de ${formatCLP(totalBudget)}` : '0 configurado'}
                </span>
              </div>
              <div className="mt-3 space-y-1">
                <Progress
                  value={budgetUsagePercent}
                  indicatorColor={
                    budgetUsagePercent > 90 ? 'bg-red-500' : budgetUsagePercent > 75 ? 'bg-amber-500' : 'bg-blue-600'
                  }
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{totalBudget > 0 ? `${budgetUsagePercent}% consumido` : 'Gasto libre'}</span>
                  <span>{totalBudget > 0 ? 'Disponible' : 'Configurar'}</span>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          /* KPI CARDS MODO PERSONA NATURAL (Cero datos de empresa) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Gasto Total Personal del Mes */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Gasto Personal del Mes</span>
                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
                {formatCLP(totalSpent)}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
                {paidDebtsAmount > 0 ? (
                  <span>Boletas: {formatCLP(receiptsSpent)} + Cuotas/Servicios: {formatCLP(paidDebtsAmount)}</span>
                ) : (
                  <span>100% compras y gastos particulares</span>
                )}
              </div>
            </Card>

            {/* 2. Ingresos Personales Registrados / Sueldo Asignado */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Ingresos Personales</span>
                <div className="h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-600 flex items-center justify-center">
                  <PiggyBank className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 mt-2">
                {formatCLP(personalIncome)}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
                <span>
                  {currentMonthSales > 0 ? 'Ingresos y honorarios registrados' : 'Sueldo asignado desde la empresa'}
                </span>
              </div>
            </Card>

            {/* 3. Capacidad de Ahorro / Superávit Personal */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Capacidad de Ahorro</span>
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <h3
                className={`text-2xl font-extrabold mt-2 ${
                  personalSurplus >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCLP(personalSurplus)}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
                <span>{personalSurplus >= 0 ? 'Superávit disponible' : 'Déficit sobre ingresos'}</span>
              </div>
            </Card>

            {/* 4. Presupuesto Familiar / Personal */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Presupuesto Hogar</span>
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center">
                  <PieChartIcon className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <h3 className="text-2xl font-extrabold text-foreground">
                  {totalBudget > 0 ? formatCLP(remainingBudget) : 'Sin Límite'}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {totalBudget > 0 ? `de ${formatCLP(totalBudget)}` : '0 configurado'}
                </span>
              </div>
              <div className="mt-3 space-y-1">
                <Progress
                  value={budgetUsagePercent}
                  indicatorColor={
                    budgetUsagePercent > 90 ? 'bg-red-500' : budgetUsagePercent > 75 ? 'bg-amber-500' : 'bg-emerald-600'
                  }
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{totalBudget > 0 ? `${budgetUsagePercent}% consumido` : 'Sin tope mensual'}</span>
                  <span>{totalBudget > 0 ? 'Disponible' : 'Configurar'}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Guía de Salud Financiera Personal (Solo Visible en Modo Persona Natural) */}
        {isPersonalMode && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 border-l-4 border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <h4 className="font-bold text-xs text-emerald-950 dark:text-emerald-200">
                  Separación Blindada
                </h4>
              </div>
              <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 mt-1">
                Tus compras personales no se informan al SII en el F29 de tu empresa, protegiéndote de contingencias por gastos rechazados.
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-l-blue-500 bg-blue-50/40 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-blue-600" />
                <h4 className="font-bold text-xs text-blue-950 dark:text-blue-200">
                  Regla del 50 / 30 / 20
                </h4>
              </div>
              <p className="text-[11px] text-blue-900/80 dark:text-blue-300/80 mt-1">
                Destina 50% a necesidades básicas (hogar/comida), 30% a gustos personales y 20% a tu fondo de ahorro o emergencia.
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-l-teal-500 bg-teal-50/40 dark:bg-teal-950/20">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-teal-600" />
                <h4 className="font-bold text-xs text-teal-950 dark:text-teal-200">
                  Sueldo de Dueño Asignado
                </h4>
              </div>
              <p className="text-[11px] text-teal-900/80 dark:text-teal-300/80 mt-1">
                La forma correcta de pagar tus gastos privados es transferirte un sueldo asignado desde la cuenta de la empresa a tu cuenta personal.
              </p>
            </Card>
          </div>
        )}

        {/* Alerta de Documentos por Revisar */}
        {pendingReviewCount > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Tienes {pendingReviewCount} documento(s) pendiente(s) de revisión en este perfil
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Revisa los datos extraídos por el OCR y valida los montos antes del cierre.
                </p>
              </div>
            </div>
            <Link href="/receipts?status=needs_review">
              <Button size="sm" variant="outline" className="text-xs border-amber-400 bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200">
                Revisar Ahora
              </Button>
            </Link>
          </div>
        )}

        {/* ========================================================================= */}
        {/* GRÁFICOS PRINCIPALES (AISLADOS SEGÚN MODO)                                */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Evolución Mensual: 100% aislada según perfil activo */}
          <Card className="lg:col-span-7">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm">
                {!isPersonalMode ? 'Evolución de Gastos de la Empresa' : 'Evolución de Gastos Personales'}
              </CardTitle>
              <CardDescription className="text-xs">
                Historial de montos en CLP de los últimos meses sin cruce de datos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyComparisonData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any) => [
                        formatCLP(Number(val)),
                        !isPersonalMode ? 'Gasto Empresa' : 'Gasto Personal',
                      ]}
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar
                      dataKey="gasto"
                      name={!isPersonalMode ? 'Gasto Empresa' : 'Gasto Personal'}
                      fill={!isPersonalMode ? '#4F46E5' : '#10B981'}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Distribución por Categoría: Solo categorías del perfil activo */}
          <Card className="lg:col-span-5">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm">
                {!isPersonalMode ? 'Categorías de Gastos Empresa' : 'Categorías de Gastos Personales'}
              </CardTitle>
              <CardDescription className="text-xs">
                Distribución de egresos en el período seleccionado.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-[280px] w-full">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [formatCLP(Number(val)), 'Total']}
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs">
                    <PieChartIcon className="h-8 w-8 mb-2 opacity-40" />
                    <span>No hay gastos registrados en este período</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* SECCIÓN INFERIOR: TOP COMERCIOS Y ÚLTIMAS BOLETAS (AISLADAS)             */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top Comercios */}
          <Card className="lg:col-span-5">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm">
                {!isPersonalMode ? 'Principales Proveedores Empresa' : 'Principales Comercios Personales'}
              </CardTitle>
              <CardDescription className="text-xs">
                Comercios y proveedores con mayor gasto en el perfil activo.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 divide-y">
              {topMerchants.length > 0 ? (
                topMerchants.map((m, idx) => (
                  <div key={m.name} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.count} comprobante(s)</p>
                      </div>
                    </div>
                    <span className="font-bold text-foreground">{formatCLP(m.total)}</span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Sin comercios registrados en este período.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimas Boletas Procesadas */}
          <Card className="lg:col-span-7">
            <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">
                  {!isPersonalMode ? 'Últimas Boletas de la Empresa' : 'Últimas Boletas Personales'}
                </CardTitle>
                <CardDescription className="text-xs">Movimientos recientes ingresados a este perfil.</CardDescription>
              </div>
              <Link href={!isPersonalMode ? '/receipts?type=business' : '/receipts?type=personal'}>
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 gap-1">
                  <span>Ver todas</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {orgReceipts.slice(0, 4).map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                        isPersonalMode
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600'
                          : 'bg-blue-50 dark:bg-blue-950 text-blue-600'
                      }`}
                    >
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{r.merchant_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateCL(r.document_date)} • {r.expense_type === 'business' ? 'Empresa' : 'Personal'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{formatCLP(r.total_amount)}</p>
                    <Badge
                      variant={
                        r.status === 'approved'
                          ? 'success'
                          : r.status === 'needs_review'
                          ? 'warning'
                          : 'destructive'
                      }
                      className="text-[9px] px-1.5 py-0"
                    >
                      {r.status === 'approved' ? 'Aprobado' : r.status === 'needs_review' ? 'Por Revisar' : r.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {orgReceipts.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No hay comprobantes registrados en este perfil todavía.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <NewExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        defaultExpenseType={isPersonalMode ? 'personal' : 'business'}
      />
    </AppLayout>
  );
}
