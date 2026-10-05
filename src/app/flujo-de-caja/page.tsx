'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import { formatCLP, formatDateCL } from '@/lib/utils';
import { monthKeyOf } from '@/lib/month-utils';
import { exportCashFlowToExcel, CashFlowExportData } from '@/lib/export-utils';
import { AssignSalaryModal } from '@/components/payroll/assign-salary-modal';
import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Building2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  HelpCircle,
  PlusCircle,
  Briefcase,
  Layers,
  ChevronRight,
  PiggyBank,
} from 'lucide-react';

export default function FlujoDeCajaPage() {
  const { receipts, receivables, debts } = useReceipts();
  const { activeOrg, activeOrgId } = useAuth();

  const [isAssignSalaryModalOpen, setIsAssignSalaryModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'all' | 'inflows' | 'outflows'>('all');

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const targetPeriodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const storageBalanceKey = `subeboletas_initial_cash_${activeOrgId || 'org-empresa-1'}_${targetPeriodKey}`;

  // Saldo inicial de caja bancaria (editable y persistido por mes y empresa)
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [isEditingInitial, setIsEditingInitial] = useState(false);
  const [tempBalanceInput, setTempBalanceInput] = useState<string>('0');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageBalanceKey);
      if (saved !== null) {
        const val = Number(saved) || 0;
        setInitialBalance(val);
        setTempBalanceInput(String(val));
      } else {
        setInitialBalance(0);
        setTempBalanceInput('0');
      }
    }
  }, [storageBalanceKey]);

  const handleSaveInitialBalance = () => {
    const val = Math.max(0, parseInt(tempBalanceInput.replace(/\D/g, '') || '0', 10));
    setInitialBalance(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageBalanceKey, String(val));
    }
    setIsEditingInitial(false);
  };

  const isPersonalMode = activeOrg?.type === 'personal' || activeOrgId === 'org-personal';

  // 1. Cobranzas y Entradas de Dinero (Receivables)
  const scopedReceivables = useMemo(() => {
    return receivables.filter((r) => {
      if (isPersonalMode) {
        if (r.income_type !== 'personal') return false;
      } else {
        if (r.income_type === 'personal') return false;
        if (activeOrgId && activeOrgId !== 'all') {
          if (r.organization_id && r.organization_id !== activeOrgId) return false;
        }
      }
      const dateToCheck = r.collected_at || r.issue_date;
      if (dateToCheck) {
        const k = monthKeyOf(dateToCheck);
        if (k && k !== targetPeriodKey) return false;
      }
      return true;
    });
  }, [receivables, activeOrgId, isPersonalMode, targetPeriodKey]);

  const realCollectedInflows = scopedReceivables
    .filter((r) => r.status === 'collected')
    .reduce((acc, r) => acc + (r.collected_amount || r.total_amount), 0);

  const pendingProjectedInflows = scopedReceivables
    .filter((r) => r.status !== 'collected')
    .reduce((acc, r) => acc + r.total_amount, 0);

  const totalInflows = realCollectedInflows + pendingProjectedInflows;

  // 2. Gastos Operacionales (Receipts)
  const scopedReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (r.status === 'rejected') return false;
      if (isPersonalMode) {
        if (r.expense_type !== 'personal') return false;
      } else {
        if (r.expense_type === 'personal') return false;
        if (activeOrgId && activeOrgId !== 'all') {
          if (r.organization_id && r.organization_id !== activeOrgId) return false;
        }
      }
      if (r.document_date) {
        const k = monthKeyOf(r.document_date);
        if (k && k !== targetPeriodKey) return false;
      }
      return true;
    });
  }, [receipts, activeOrgId, isPersonalMode, targetPeriodKey]);

  const realReceiptsOutflows = scopedReceipts.reduce(
    (acc, r) => acc + (isPersonalMode ? r.personal_total || r.total_amount : r.business_total || r.total_amount),
    0
  );

  // 3. Cuentas por Pagar y Compromisos (Debts)
  const scopedDebts = useMemo(() => {
    return debts.filter((d) => {
      if (isPersonalMode) {
        if (d.expense_type !== 'personal') return false;
      } else {
        if (d.expense_type === 'personal') return false;
        if (activeOrgId && activeOrgId !== 'all') {
          if (d.organization_id && d.organization_id !== activeOrgId) return false;
        }
      }
      const dateToCheck = d.paid_at ? d.paid_at.split('T')[0] : d.due_date;
      if (dateToCheck) {
        const k = monthKeyOf(dateToCheck);
        if (k && k !== targetPeriodKey) return false;
      }
      return true;
    });
  }, [debts, activeOrgId, isPersonalMode, targetPeriodKey]);

  const realDebtsPaidOutflows = scopedDebts
    .filter((d) => d.status === 'paid')
    .reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);

  const pendingDebtsOutflows = scopedDebts
    .filter((d) => d.status !== 'paid')
    .reduce((acc, d) => acc + d.amount, 0);

  // Costos fijos adicionales si no están ya en debts
  const assignedSalary = !isPersonalMode && activeOrg?.assigned_salary ? activeOrg.assigned_salary : 0;
  const hasSalaryInDebts = scopedDebts.some(
    (d) => d.category === 'sueldo_empresarial' || d.supplier_name.toLowerCase().includes('sueldo')
  );
  const extraSalaryOutflow = hasSalaryInDebts ? 0 : assignedSalary;

  const totalOutflows = realReceiptsOutflows + realDebtsPaidOutflows + pendingDebtsOutflows + extraSalaryOutflow;
  const realOutflowsDone = realReceiptsOutflows + realDebtsPaidOutflows;
  const pendingOutflowsToPay = pendingDebtsOutflows + extraSalaryOutflow;

  // 4. Posición Financiera y Saldos
  const realNetCashFlow = realCollectedInflows - realOutflowsDone;
  const totalProjectedNetCashFlow = totalInflows - totalOutflows;
  const finalProjectedBalance = initialBalance + totalProjectedNetCashFlow;
  const currentActualBalance = initialBalance + realNetCashFlow;

  // 5. Matriz Semanal de Flujo de Caja
  const weeklyCashFlow = useMemo(() => {
    // 4 Semanas estándar del mes chileno:
    // S1: 01 al 07 (Operación y servicios)
    // S2: 08 al 14 (Previred día 13)
    // S3: 15 al 21 (F29 IVA día 20)
    // S4: 22 al 31 (Sueldo dueño, arriendos, proveedores fin de mes)
    const weeks = [
      {
        week: 'Semana 1',
        period: '01 al 07 de ' + monthNames[selectedMonth - 1],
        inflows: 0,
        outflows: 0,
        criticalNote: 'Gastos de inicio de mes y suministros',
      },
      {
        week: 'Semana 2',
        period: '08 al 14 de ' + monthNames[selectedMonth - 1],
        inflows: 0,
        outflows: 0,
        criticalNote: '⚠️ Día 13: Pago de Cotizaciones Previred',
      },
      {
        week: 'Semana 3',
        period: '15 al 21 de ' + monthNames[selectedMonth - 1],
        inflows: 0,
        outflows: 0,
        criticalNote: '⚠️ Día 20: Declaración y Pago F29 (IVA)',
      },
      {
        week: 'Semana 4',
        period: '22 al 31 de ' + monthNames[selectedMonth - 1],
        inflows: 0,
        outflows: 0,
        criticalNote: '💼 Fin de mes: Sueldo asignado y arriendos',
      },
    ];

    const getWeekIndex = (dateStr: string) => {
      const day = parseInt(dateStr.split('-')[2] || '1', 10);
      if (day <= 7) return 0;
      if (day <= 14) return 1;
      if (day <= 21) return 2;
      return 3;
    };

    // Distribuir entradas
    scopedReceivables.forEach((r) => {
      const d = r.collected_at || r.due_date || r.issue_date;
      if (d) {
        const idx = getWeekIndex(d);
        weeks[idx].inflows += r.status === 'collected' ? (r.collected_amount || r.total_amount) : r.total_amount;
      }
    });

    // Distribuir gastos
    scopedReceipts.forEach((r) => {
      if (r.document_date) {
        const idx = getWeekIndex(r.document_date);
        weeks[idx].outflows += isPersonalMode ? r.personal_total || r.total_amount : r.business_total || r.total_amount;
      }
    });

    // Distribuir deudas
    scopedDebts.forEach((d) => {
      const dt = d.paid_at ? d.paid_at.split('T')[0] : d.due_date;
      if (dt) {
        const idx = getWeekIndex(dt);
        weeks[idx].outflows += d.status === 'paid' ? (d.paid_amount || d.amount) : d.amount;
      }
    });

    // Agregar sueldo si no estaba en deudas a semana 4
    if (extraSalaryOutflow > 0) {
      weeks[3].outflows += extraSalaryOutflow;
    }

    // Calcular saldos acumulados semana tras semana
    let runningBalance = initialBalance;
    return weeks.map((w) => {
      const net = w.inflows - w.outflows;
      runningBalance += net;
      return {
        ...w,
        net,
        balance: runningBalance,
        isNegative: runningBalance < 0,
      };
    });
  }, [
    scopedReceivables,
    scopedReceipts,
    scopedDebts,
    extraSalaryOutflow,
    initialBalance,
    selectedMonth,
    monthNames,
    isPersonalMode,
  ]);

  // Manejador de Exportación Excel
  const handleExportExcel = () => {
    const exportData: CashFlowExportData = {
      initialBalance,
      totalInflows,
      totalOutflows,
      netCashFlow: totalProjectedNetCashFlow,
      finalProjectedBalance,
      inflows: scopedReceivables.map((r) => ({
        date: r.collected_at || r.due_date || r.issue_date,
        concept: r.service_description,
        client: r.client_name,
        amount: r.status === 'collected' ? (r.collected_amount || r.total_amount) : r.total_amount,
        status: r.status === 'collected' ? 'COBRADO' : 'POR COBRAR',
      })),
      outflows: [
        ...scopedReceipts.map((r) => ({
          date: r.document_date || '',
          concept: r.notes || r.merchant_name,
          supplier: r.merchant_name,
          category: r.category_name || 'Operacional',
          amount: isPersonalMode ? r.personal_total || r.total_amount : r.business_total || r.total_amount,
          status: 'PAGADO',
        })),
        ...scopedDebts.map((d) => ({
          date: d.paid_at ? d.paid_at.split('T')[0] : d.due_date,
          concept: d.notes || d.supplier_name,
          supplier: d.supplier_name,
          category: d.category.replace(/_/g, ' '),
          amount: d.status === 'paid' ? (d.paid_amount || d.amount) : d.amount,
          status: d.status === 'paid' ? 'PAGADO' : 'POR PAGAR',
        })),
        ...(extraSalaryOutflow > 0
          ? [
              {
                date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-30`,
                concept: 'Sueldo Asignado Empresarial del Dueño',
                supplier: activeOrg?.legal_name || activeOrg?.name || 'Dueño de Empresa',
                category: 'Sueldo Asignado',
                amount: extraSalaryOutflow,
                status: 'POR PAGAR (FIN DE MES)',
              },
            ]
          : []),
      ],
      weeklySummary: weeklyCashFlow.map((w) => ({
        week: w.week,
        period: w.period,
        inflows: w.inflows,
        outflows: w.outflows,
        net: w.net,
        balance: w.balance,
      })),
    };

    exportCashFlowToExcel(exportData, activeOrg, selectedMonth, selectedYear);
  };

  return (
    <AppLayout
      title="Flujo de Caja Operacional & Proyectado"
      description="Control diario y semanal de liquidez real, cobranzas, pagos de proveedores, Previred y F29 de la empresa."
    >
      <div className="space-y-6">
        {/* Cabecera Principal y Período */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl border border-indigo-900/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-200 border-blue-400/30 text-xs">
                Período: {monthNames[selectedMonth - 1]} {selectedYear}
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                {activeOrg ? activeOrg.name : 'Vista Consolidada'}
              </Badge>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Wallet className="h-6 w-6 text-emerald-400" />
              <span>Flujo de Caja Real & Proyección de Liquidez</span>
            </h2>
            <p className="text-xs text-blue-200/80 max-w-xl">
              Monitorea el dinero disponible real en banco, ingresos por cobrar y fechas críticas de egresos (Previred, IVA F29 y sueldos).
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
            {!isPersonalMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssignSalaryModalOpen(true)}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/30 gap-1.5 text-xs font-medium"
              >
                <Briefcase className="h-4 w-4 text-amber-400" />
                <span>Asignar Sueldos</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold text-xs shadow-md"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Descargar Flujo Excel (.xlsx)</span>
            </Button>
            <Link href="/cuentas-por-cobrar?import=sales">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 text-xs font-medium"
              >
                <PlusCircle className="h-4 w-4 text-emerald-400" />
                <span>+ Subir Facturas Venta</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Barra de Filtros de Período y Saldo Inicial */}
        <Card className="p-4 shadow-sm border">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Selector de Mes y Año */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Mes:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="h-9 px-2.5 rounded-lg border border-input bg-background text-foreground text-xs"
                >
                  {monthNames.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Año:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="h-9 px-2.5 rounded-lg border border-input bg-background text-foreground text-xs"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>
              </div>
            </div>

            {/* Configuración de Saldo Inicial en Banco */}
            <div className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-xl border border-border">
              <PiggyBank className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="text-xs">
                <span className="text-muted-foreground block text-[11px]">
                  Saldo Inicial en Cuenta Bancaria (Día 1):
                </span>
                {isEditingInitial ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="text"
                      value={tempBalanceInput}
                      onChange={(e) => setTempBalanceInput(e.target.value)}
                      placeholder="$0"
                      className="h-7 w-32 text-xs font-mono font-bold"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveInitialBalance}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5"
                    >
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingInitial(false)}
                      className="h-7 text-xs text-muted-foreground px-2"
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground text-sm">
                      {formatCLP(initialBalance)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingInitial(true)}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      (Modificar)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Tarjetas KPI de los 5 Bloques del Flujo de Caja */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Saldo Inicial */}
          <Card className="p-3.5 border-l-4 border-l-slate-500 shadow-sm">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Saldo Inicial de Caja
            </span>
            <h3 className="text-xl font-black text-foreground font-mono mt-1">
              {formatCLP(initialBalance)}
            </h3>
            <span className="text-[10px] text-muted-foreground">Disponible al día 1</span>
          </Card>

          {/* 2. Entradas (+ Cobranzas) */}
          <Card className="p-3.5 border-l-4 border-l-emerald-600 shadow-sm bg-emerald-50/15 dark:bg-emerald-950/20">
            <span className="text-[10px] text-emerald-800 dark:text-emerald-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-600" />
              <span>Entradas de Dinero</span>
            </span>
            <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              +{formatCLP(totalInflows)}
            </h3>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
              <span>Cobrado: {formatCLP(realCollectedInflows)}</span>
              <span>Por cobrar: {formatCLP(pendingProjectedInflows)}</span>
            </div>
          </Card>

          {/* 3. Salidas (- Egresos y Deudas) */}
          <Card className="p-3.5 border-l-4 border-l-rose-600 shadow-sm bg-rose-50/15 dark:bg-rose-950/20">
            <span className="text-[10px] text-rose-800 dark:text-rose-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-rose-600" />
              <span>Salidas y Egresos</span>
            </span>
            <h3 className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">
              -{formatCLP(totalOutflows)}
            </h3>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
              <span>Pagado: {formatCLP(realOutflowsDone)}</span>
              <span>Por pagar: {formatCLP(pendingOutflowsToPay)}</span>
            </div>
          </Card>

          {/* 4. Flujo Neto Operacional */}
          <Card className="p-3.5 border-l-4 border-l-blue-600 shadow-sm">
            <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold tracking-wider">
              Flujo Neto del Mes
            </span>
            <h3
              className={`text-xl font-black font-mono mt-1 ${
                totalProjectedNetCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {totalProjectedNetCashFlow >= 0 ? '+' : ''}
              {formatCLP(totalProjectedNetCashFlow)}
            </h3>
            <span className="text-[10px] text-muted-foreground">Entradas menos Salidas</span>
          </Card>

          {/* 5. Saldo Final Proyectado de Caja */}
          <Card
            className={`p-3.5 border-l-4 shadow-sm ${
              finalProjectedBalance >= 0
                ? 'border-l-teal-600 bg-teal-50/15 dark:bg-teal-950/20'
                : 'border-l-rose-600 bg-rose-50/30 dark:bg-rose-950/30 animate-pulse'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider flex items-center justify-between">
              <span className={finalProjectedBalance >= 0 ? 'text-teal-800 dark:text-teal-400' : 'text-rose-800 dark:text-rose-400'}>
                Saldo Final Proyectado
              </span>
              {finalProjectedBalance >= 0 ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
              )}
            </span>
            <h3
              className={`text-xl font-black font-mono mt-1 ${
                finalProjectedBalance >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCLP(finalProjectedBalance)}
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {finalProjectedBalance >= 0 ? 'Caja con superávit' : '⚠️ Déficit de liquidez'}
            </span>
          </Card>
        </div>

        {/* Matriz Semanal de Flujo de Caja y Fechas Críticas */}
        <Card className="overflow-hidden shadow-sm border">
          <CardHeader className="py-3.5 px-4 bg-muted/40 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-foreground">
                Proyección Semanal de Liquidez (Semáforo de Caja Pyme)
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Vencimientos duros de Chile: Previred (13), F29 IVA (20), Sueldo (30)
            </span>
          </CardHeader>
          <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3.5">
            {weeklyCashFlow.map((w, index) => (
              <div
                key={w.week}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  w.isNegative
                    ? 'border-rose-400 bg-rose-50/30 dark:bg-rose-950/30'
                    : 'border-border bg-card'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-foreground">{w.week}</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        w.isNegative
                          ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {w.isNegative ? 'Riesgo Iliquidez' : 'Caja Positiva'}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground block mb-2">{w.period}</span>

                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>+ Entradas:</span>
                      <span className="font-semibold">{formatCLP(w.inflows)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 dark:text-rose-400">
                      <span>- Salidas:</span>
                      <span className="font-semibold">{formatCLP(w.outflows)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground pt-1 border-t border-border">
                      <span>Flujo Neto:</span>
                      <span className={w.net >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                        {w.net >= 0 ? '+' : ''}
                        {formatCLP(w.net)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground text-[11px]">Caja Final:</span>
                    <span
                      className={`font-mono font-black text-sm ${
                        w.balance >= 0 ? 'text-foreground' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCLP(w.balance)}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[10px] text-muted-foreground font-medium bg-muted/50 p-1.5 rounded-lg">
                    {w.criticalNote}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Tabla Detallada de Movimientos de Caja */}
        <Card className="overflow-hidden shadow-sm border">
          <CardHeader className="py-3 px-4 bg-muted/40 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground">
              Desglose Operacional de Entradas y Salidas
            </span>
            <div className="flex items-center gap-1.5 bg-background p-1 rounded-lg border border-border">
              <Button
                size="sm"
                variant={activeTab === 'all' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('all')}
                className="h-7 text-xs px-2.5"
              >
                Todos los Movimientos
              </Button>
              <Button
                size="sm"
                variant={activeTab === 'inflows' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('inflows')}
                className="h-7 text-xs px-2.5 text-emerald-700 dark:text-emerald-400"
              >
                + Entradas ({scopedReceivables.length})
              </Button>
              <Button
                size="sm"
                variant={activeTab === 'outflows' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('outflows')}
                className="h-7 text-xs px-2.5 text-rose-700 dark:text-rose-400"
              >
                - Salidas ({scopedReceipts.length + scopedDebts.length})
              </Button>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-bold border-b">
                <tr>
                  <th className="px-3 py-3">Tipo Flujo</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Concepto / Glosa</th>
                  <th className="px-3 py-3">Contraparte (Cliente / Proveedor)</th>
                  <th className="px-3 py-3 text-right">Monto (CLP)</th>
                  <th className="px-3 py-3 text-center">Estado de Cobro / Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y text-foreground">
                {/* Entradas */}
                {(activeTab === 'all' || activeTab === 'inflows') &&
                  scopedReceivables.map((r) => {
                    const isCollected = r.status === 'collected';
                    return (
                      <tr key={`rec-${r.id}`} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            <span>Entrada</span>
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-medium whitespace-nowrap text-muted-foreground">
                          {formatDateCL(r.collected_at || r.due_date || r.issue_date)}
                        </td>
                        <td className="px-3 py-2.5 max-w-xs truncate font-medium">
                          {r.service_description}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-foreground">
                          {r.client_name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{formatCLP(isCollected ? (r.collected_amount || r.total_amount) : r.total_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <Badge
                            className={`text-[10px] ${
                              isCollected
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {isCollected ? 'Cobrado Real' : 'Por Cobrar'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}

                {/* Salidas (Boletas y gastos) */}
                {(activeTab === 'all' || activeTab === 'outflows') &&
                  scopedReceipts.map((rc) => (
                    <tr key={`rc-${rc.id}`} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] gap-1">
                          <ArrowDownRight className="h-3 w-3" />
                          <span>Gasto</span>
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap text-muted-foreground">
                        {formatDateCL(rc.document_date)}
                      </td>
                      <td className="px-3 py-2.5 max-w-xs truncate font-medium">
                        {rc.notes || rc.merchant_name}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-foreground">
                        {rc.merchant_name}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        -{formatCLP(isPersonalMode ? rc.personal_total || rc.total_amount : rc.business_total || rc.total_amount)}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 text-[10px]">
                          Pagado
                        </Badge>
                      </td>
                    </tr>
                  ))}

                {/* Salidas (Deudas y compromisos) */}
                {(activeTab === 'all' || activeTab === 'outflows') &&
                  scopedDebts.map((d) => {
                    const isPaid = d.status === 'paid';
                    return (
                      <tr key={`debt-${d.id}`} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] gap-1">
                            <ArrowDownRight className="h-3 w-3" />
                            <span>Compromiso</span>
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-medium whitespace-nowrap text-muted-foreground">
                          {formatDateCL(d.paid_at ? d.paid_at.split('T')[0] : d.due_date)}
                        </td>
                        <td className="px-3 py-2.5 max-w-xs truncate font-medium">
                          {d.notes || d.supplier_name} ({d.category.replace(/_/g, ' ')})
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-foreground">
                          {d.supplier_name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          -{formatCLP(isPaid ? (d.paid_amount || d.amount) : d.amount)}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <Badge
                            className={`text-[10px] ${
                              isPaid
                                ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {isPaid ? 'Pagado' : 'Por Pagar'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <AssignSalaryModal
        isOpen={isAssignSalaryModalOpen}
        onClose={() => setIsAssignSalaryModalOpen(false)}
      />
    </AppLayout>
  );
}
