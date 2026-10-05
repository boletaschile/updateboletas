'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { MonthSelector } from '@/components/ui/month-selector';
import { ALL_MONTHS, currentMonthKey, formatMonthLabel, monthKeyOf } from '@/lib/month-utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { formatCLP, formatDateCL } from '@/lib/utils';
import { exportExpensesToExcel, exportExpensesToCSV } from '@/lib/export-utils';
import {
  Receipt,
  PlusCircle,
  Search,
  Filter,
  FileSpreadsheet,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Building2,
  User,
  Layers,
  UploadCloud,
} from 'lucide-react';

import { useAuth } from '@/lib/store/auth-context';
import { NewExpenseModal } from '@/components/receipts/new-expense-modal';

export default function ReceiptsListPage() {
  const router = useRouter();
  const { receipts, deleteReceipt, approveReceipt, debts } = useReceipts();
  const { activeOrgId, activeOrg } = useAuth();

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey());

  // Recordar el mes elegido entre visitas
  useEffect(() => {
    const saved = localStorage.getItem('subeboletas_selected_month_v1');
    if (saved) setSelectedMonth(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem('subeboletas_selected_month_v1', selectedMonth);
  }, [selectedMonth]);

  const inSelectedMonth = (value?: string | null) =>
    selectedMonth === ALL_MONTHS || monthKeyOf(value) === selectedMonth;

  const isPersonalMode = activeOrg?.type === 'personal' || activeOrgId === 'org-personal';

  const scopedPaidDebts = useMemo(() => {
    return debts.filter((d) => {
      if (d.status !== 'paid') return false;
      if (selectedMonth !== ALL_MONTHS) {
        const pKey = monthKeyOf(d.paid_at);
        const dKey = monthKeyOf(d.due_date);
        if (pKey !== selectedMonth && dKey !== selectedMonth) return false;
      }
      if (isPersonalMode) {
        return d.expense_type === 'personal' || d.organization_id === 'org-personal';
      } else {
        if (d.expense_type === 'personal') return false;
        if (activeOrgId && activeOrgId !== 'all') {
          return d.organization_id === activeOrgId || (!d.organization_id && d.expense_type === 'business');
        }
        return d.expense_type === 'business';
      }
    });
  }, [debts, activeOrgId, isPersonalMode, selectedMonth]);

  const paidDebtsBusiness = scopedPaidDebts
    .filter((d) => d.expense_type === 'business')
    .reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);

  const paidDebtsPersonal = scopedPaidDebts
    .filter((d) => d.expense_type === 'personal' || d.organization_id === 'org-personal')
    .reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);

  const totalPaidDebts = isPersonalMode ? paidDebtsPersonal : paidDebtsBusiness;

  // Boletas de la organización activa: separación estricta
  const orgReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (r.status === 'rejected') return false;
      if (isPersonalMode) {
        return r.expense_type === 'personal' || r.organization_id === 'org-personal';
      } else {
        if (r.expense_type === 'personal') return false;
        if (activeOrgId && activeOrgId !== 'all') {
          return r.organization_id === activeOrgId || (!r.organization_id && r.expense_type === 'business');
        }
        return r.expense_type === 'business';
      }
    });
  }, [receipts, activeOrgId, isPersonalMode]);

  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orgReceipts.forEach((r) => {
      const k = monthKeyOf(r.document_date);
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
    debts.forEach((d) => {
      if (d.status !== 'paid') return;
      if (isPersonalMode) {
        if (d.expense_type !== 'personal' && d.organization_id !== 'org-personal') return;
      } else {
        if (d.expense_type === 'personal') return;
      }
      const k = monthKeyOf(d.paid_at) || monthKeyOf(d.due_date);
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [orgReceipts, debts, isPersonalMode]);

  const filteredReceipts = useMemo(() => {
    return orgReceipts.filter((r) => {
      // Filtro por mes
      if (!inSelectedMonth(r.document_date)) return false;

      // Búsqueda por texto
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        r.merchant_name.toLowerCase().includes(term) ||
        (r.merchant_rut && r.merchant_rut.toLowerCase().includes(term)) ||
        (r.receipt_number && r.receipt_number.toLowerCase().includes(term)) ||
        (r.items && r.items.some((it) => it.original_name.toLowerCase().includes(term)));

      // Filtro por tipo de gasto
      const matchType = filterType === 'all' || r.expense_type === filterType;

      // Filtro por estado
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;

      return matchSearch && matchType && matchStatus;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgReceipts, selectedMonth, searchTerm, filterType, filterStatus]);

  const filteredPaidDebts = useMemo(() => {
    return scopedPaidDebts.filter((d) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        d.supplier_name.toLowerCase().includes(term) ||
        (d.supplier_rut && d.supplier_rut.toLowerCase().includes(term)) ||
        (d.document_number && d.document_number.toLowerCase().includes(term)) ||
        (d.notes && d.notes.toLowerCase().includes(term));

      const matchType =
        filterType === 'all' ||
        (filterType === 'personal' && (d.expense_type === 'personal' || d.organization_id === 'org-personal')) ||
        (filterType === 'business' && d.expense_type === 'business');

      const matchStatus = filterStatus === 'all' || filterStatus === 'approved';

      return matchSearch && matchType && matchStatus;
    });
  }, [scopedPaidDebts, searchTerm, filterType, filterStatus]);

  // Listado unificado para visualización en tabla
  const allExpenses = useMemo(() => {
    type UnifiedExpense = {
      id: string;
      kind: 'receipt' | 'debt';
      date: string;
      time?: string | null;
      merchant: string;
      rut?: string | null;
      summary?: string | null;
      docNumber: string;
      expenseType: 'business' | 'personal' | 'mixed';
      totalAmount: number;
      businessAmount: number;
      personalAmount: number;
      status: string;
      rawReceipt?: (typeof receipts)[number];
      rawDebt?: (typeof debts)[number];
    };

    const list: UnifiedExpense[] = [];

    filteredReceipts.forEach((r) => {
      list.push({
        id: r.id,
        kind: 'receipt',
        date: r.document_date || '',
        time: r.document_time,
        merchant: r.merchant_name,
        rut: r.merchant_rut,
        summary: r.purchase_summary,
        docNumber: r.receipt_number || '-',
        expenseType: r.expense_type,
        totalAmount: r.total_amount,
        businessAmount: r.business_total,
        personalAmount: r.personal_total,
        status: r.status,
        rawReceipt: r,
      });
    });

    filteredPaidDebts.forEach((d) => {
      const amt = d.paid_amount || d.installment_amount || d.amount;
      const isPersonal = d.expense_type === 'personal' || d.organization_id === 'org-personal';
      list.push({
        id: `debt-${d.id}`,
        kind: 'debt',
        date: d.paid_at ? d.paid_at.substring(0, 10) : d.due_date,
        time: d.paid_at && d.paid_at.includes('T') ? d.paid_at.substring(11, 16) : undefined,
        merchant: d.supplier_name,
        rut: d.supplier_rut,
        summary:
          d.notes ||
          (d.is_installment_credit
            ? `Crédito en cuotas (${d.installment_current || 1}/${d.installment_total || 1})`
            : `Compromiso / Servicio (${d.category.replace(/_/g, ' ')})`),
        docNumber:
          d.document_number ||
          (d.is_installment_credit ? `Cuota ${d.installment_current || 1}/${d.installment_total || 1}` : 'Compromiso'),
        expenseType: isPersonal ? 'personal' : 'business',
        totalAmount: amt,
        businessAmount: isPersonal ? 0 : amt,
        personalAmount: isPersonal ? amt : 0,
        status: 'approved',
        rawDebt: d,
      });
    });

    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [filteredReceipts, filteredPaidDebts]);

  const otherMonthsCount =
    orgReceipts.length - (selectedMonth === ALL_MONTHS ? 0 : monthCounts[selectedMonth] || 0);

  // Métricas rápidas del listado filtrado
  const totalAmount = filteredReceipts.reduce((acc, r) => acc + r.total_amount, 0);
  const totalBusiness = filteredReceipts.reduce((acc, r) => acc + r.business_total, 0);
  const totalPersonal = filteredReceipts.reduce((acc, r) => acc + r.personal_total, 0);
  const pendingReviewCount = filteredReceipts.filter((r) => r.status === 'needs_review').length;

  return (
    <AppLayout
      title="Mis Boletas y Gastos"
      description="Consulta, filtra, revisa y exporta todos los comprobantes y boletas registradas."
    >
      <div className="space-y-6">
        {/* Resumen Superior Aislado por Perfil */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tarjeta 1: Total del Perfil */}
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {isPersonalMode ? 'Gasto Total Personal' : 'Gasto Total Empresa'}
              </p>
              <h3 className={`text-xl font-bold mt-0.5 ${isPersonalMode ? 'text-emerald-600' : 'text-blue-600'}`}>
                {isPersonalMode
                  ? formatCLP(totalPersonal + paidDebtsPersonal)
                  : formatCLP(totalBusiness + paidDebtsBusiness)}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {isPersonalMode ? '100% compras particulares' : '100% compras operacionales'}
              </p>
            </div>
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                isPersonalMode
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600'
              }`}
            >
              {isPersonalMode ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
            </div>
          </Card>

          {/* Tarjeta 2: Boletas Registradas en este Perfil */}
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {isPersonalMode ? 'Boletas del Hogar' : 'Boletas y Facturas'}
              </p>
              <h3 className="text-xl font-bold text-foreground mt-0.5">
                {formatCLP(isPersonalMode ? totalPersonal : totalBusiness)}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {filteredReceipts.length} comprobante(s) en este período
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
          </Card>

          {/* Tarjeta 3: Compromisos Pagados del Perfil */}
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {isPersonalMode ? 'Cuentas del Hogar Pagadas' : 'Cuentas Empresa Pagadas'}
              </p>
              <h3 className="text-xl font-bold text-foreground mt-0.5">
                {formatCLP(isPersonalMode ? paidDebtsPersonal : paidDebtsBusiness)}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {scopedPaidDebts.length} compromiso(s) liquidado(s)
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </Card>

          {/* Tarjeta 4: Por Revisar */}
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Por Revisar</p>
              <h3 className="text-xl font-bold text-amber-600 mt-0.5">{pendingReviewCount}</h3>
              <p className="text-[11px] text-muted-foreground">Requieren confirmación</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
          </Card>
        </div>

        {/* Período: navegación por mes */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <MonthSelector value={selectedMonth} onChange={setSelectedMonth} monthCounts={monthCounts} />
          <p className="text-xs text-muted-foreground">
            {selectedMonth === ALL_MONTHS ? 'Mostrando todo el historial' : `Mostrando ${formatMonthLabel(selectedMonth)}`}
            {' · '}
            {allExpenses.length} {allExpenses.length === 1 ? 'gasto registrado' : 'gastos registrados'}
            {filteredPaidDebts.length > 0 && (
              <span className="text-emerald-600 font-medium"> ({filteredReceipts.length} boletas + {filteredPaidDebts.length} cuentas pagadas)</span>
            )}
            {pendingReviewCount > 0 && (
              <span className="text-amber-600 font-medium"> · {pendingReviewCount} por revisar</span>
            )}
          </p>
        </div>

        {/* Barra de Búsqueda, Filtros y Exportación */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar por comercio, RUT, N° boleta o ítem..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-10 px-3 rounded-lg border border-input bg-background text-xs"
              >
                <option value="all">Todos los tipos</option>
                <option value="business">Empresa</option>
                <option value="personal">Personal</option>
                <option value="mixed">Mixto</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 px-3 rounded-lg border border-input bg-background text-xs"
              >
                <option value="all">Todos los estados</option>
                <option value="needs_review">Pendiente de revisión</option>
                <option value="approved">Aprobados</option>
                <option value="rejected">Rechazados</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportExpensesToCSV(filteredReceipts)}
                className="gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>CSV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportExpensesToExcel(filteredReceipts, filteredPaidDebts)}
                className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Exportar Excel</span>
              </Button>
              <Link href="/receipts/import-excel">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                >
                  <UploadCloud className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Importar Excel</span>
                </Button>
              </Link>
              <Button
                size="sm"
                onClick={() => setIsAddExpenseOpen(true)}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>+ Agregar Gasto</span>
              </Button>
              <Link href={selectedMonth !== ALL_MONTHS ? `/receipts/new?month=${selectedMonth}` : '/receipts/new'}>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>Escanear Boleta (OCR)</span>
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Tabla de Documentos */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-semibold border-b">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Comercio / Emisor</th>
                  <th className="px-4 py-3">N° Doc</th>
                  <th className="px-4 py-3">Tipo Gasto</th>
                  <th className="px-4 py-3 text-right">Total CLP</th>
                  <th className="px-4 py-3 text-right">Empresa</th>
                  <th className="px-4 py-3 text-right">Personal</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      {selectedMonth !== ALL_MONTHS && otherMonthsCount > 0 ? (
                        <div className="space-y-2">
                          <p>
                            No hay gastos ni boletas en {formatMonthLabel(selectedMonth)}. Tienes {otherMonthsCount} en otros meses.
                          </p>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedMonth(ALL_MONTHS)}>
                            Ver todos los meses
                          </Button>
                        </div>
                      ) : selectedMonth !== ALL_MONTHS ? (
                        <p>Aún no hay gastos en {formatMonthLabel(selectedMonth)}. Usa el botón + Agregar Gasto o Escanear Boleta.</p>
                      ) : (
                        'No se encontraron gastos con los filtros seleccionados.'
                      )}
                    </td>
                  </tr>
                ) : (
                  allExpenses.map((item) => {
                    if (item.kind === 'receipt' && item.rawReceipt) {
                      const r = item.rawReceipt;
                      return (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            {formatDateCL(r.document_date)}
                            {r.document_time && (
                              <span className="text-[10px] text-muted-foreground block">{r.document_time}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {r.merchant_name}
                            {r.purchase_summary && (
                              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-normal block truncate max-w-xs">
                                {r.purchase_summary}
                              </span>
                            )}
                            {r.merchant_rut && (
                              <span className="text-[10px] text-muted-foreground block font-mono">
                                RUT: {r.merchant_rut}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px]">
                            {r.receipt_number || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                r.expense_type === 'business'
                                  ? 'info'
                                  : r.expense_type === 'personal'
                                  ? 'success'
                                  : 'purple'
                              }
                              className="text-[10px]"
                            >
                              {r.expense_type === 'business'
                                ? 'Empresa'
                                : r.expense_type === 'personal'
                                ? 'Personal'
                                : 'Mixto'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">
                            {formatCLP(r.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-blue-600">
                            {formatCLP(r.business_total)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600">
                            {formatCLP(r.personal_total)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant={
                                r.status === 'approved'
                                  ? 'success'
                                  : r.status === 'needs_review'
                                  ? 'warning'
                                  : r.status === 'rejected'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                              className="text-[10px]"
                            >
                              {r.status === 'approved'
                                ? 'Aprobado'
                                : r.status === 'needs_review'
                                ? 'Por Revisar'
                                : r.status === 'rejected'
                                ? 'Rechazado'
                                : r.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link href={`/receipts/${r.id}`}>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50" title="Revisar">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                              {r.status === 'needs_review' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => approveReceipt(r.id)}
                                  title="Aprobar rápidamente"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm(`¿Eliminar la boleta de ${r.merchant_name}?`)) {
                                    deleteReceipt(r.id);
                                  }
                                }}
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // Fila de Cuenta por Pagar Pagada (Compromiso o servicio liquidado)
                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors bg-emerald-500/5">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {formatDateCL(item.date)}
                          {item.time && (
                            <span className="text-[10px] text-muted-foreground block">{item.time}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{item.merchant}</span>
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1.5 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold"
                            >
                              Cuenta Pagada
                            </Badge>
                          </div>
                          {item.summary && (
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-300/80 font-normal block truncate max-w-xs">
                              {item.summary}
                            </span>
                          )}
                          {item.rut && (
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              RUT: {item.rut}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]">
                          {item.docNumber}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={item.expenseType === 'personal' ? 'success' : 'info'}
                            className="text-[10px]"
                          >
                            {item.expenseType === 'personal' ? 'Personal' : 'Empresa'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {formatCLP(item.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-blue-600">
                          {formatCLP(item.businessAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                          {formatCLP(item.personalAmount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="success" className="text-[10px]">
                            Pagada
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href="/cuentas-por-pagar">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 gap-1 px-2"
                                title="Ver en Cuentas por Pagar"
                              >
                                <Eye className="h-3 w-3" />
                                <span>Ver Cuenta</span>
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <NewExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        defaultExpenseType={isPersonalMode ? 'personal' : 'business'}
      />
    </AppLayout>
  );
}
