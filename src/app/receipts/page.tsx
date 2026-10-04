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

export default function ReceiptsListPage() {
  const router = useRouter();
  const { receipts, deleteReceipt, approveReceipt, debts } = useReceipts();
  const { activeOrgId } = useAuth();

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

  const scopedPaidDebts = useMemo(() => {
    return debts.filter((d) => {
      if (d.status !== 'paid') return false;
      if (!inSelectedMonth(d.paid_at || d.due_date)) return false;
      if (activeOrgId !== 'all') {
        if (activeOrgId === 'org-personal') {
          if (d.expense_type !== 'personal' && d.organization_id !== 'org-personal') return false;
        } else {
          if (d.organization_id && d.organization_id !== activeOrgId) return false;
        }
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debts, activeOrgId, selectedMonth]);

  const paidDebtsBusiness = scopedPaidDebts
    .filter((d) => d.expense_type === 'business')
    .reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);

  const paidDebtsPersonal = scopedPaidDebts
    .filter((d) => d.expense_type === 'personal')
    .reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);

  const totalPaidDebts = paidDebtsBusiness + paidDebtsPersonal;

  // Boletas de la organización activa (antes de filtrar por mes), para contar por mes
  const orgReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (activeOrgId === 'all') return true;
      if (activeOrgId === 'org-personal') {
        return !(r.expense_type !== 'personal' && r.organization_id !== 'org-personal');
      }
      return !(r.organization_id && r.organization_id !== activeOrgId);
    });
  }, [receipts, activeOrgId]);

  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orgReceipts.forEach((r) => {
      const k = monthKeyOf(r.document_date);
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [orgReceipts]);

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

  const otherMonthsCount = orgReceipts.length - (selectedMonth === ALL_MONTHS ? 0 : monthCounts[selectedMonth] || 0);

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
        {/* Resumen Superior */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Filtrado</p>
              <h3 className="text-xl font-bold text-foreground mt-0.5">{formatCLP(totalAmount + totalPaidDebts)}</h3>
              <p className="text-[11px] text-muted-foreground">
                {totalPaidDebts > 0
                  ? `${filteredReceipts.length} boletas + ${scopedPaidDebts.length} deudas pagadas`
                  : `${filteredReceipts.length} documentos`}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Gastos Empresa</p>
              <h3 className="text-xl font-bold text-blue-600 mt-0.5">{formatCLP(totalBusiness + paidDebtsBusiness)}</h3>
              <p className="text-[11px] text-muted-foreground">
                {paidDebtsBusiness > 0
                  ? `Boletas: ${formatCLP(totalBusiness)} • Cuotas: ${formatCLP(paidDebtsBusiness)}`
                  : 'Deducibles / Operacionales'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Gastos Personales</p>
              <h3 className="text-xl font-bold text-emerald-600 mt-0.5">{formatCLP(totalPersonal + paidDebtsPersonal)}</h3>
              <p className="text-[11px] text-muted-foreground">
                {paidDebtsPersonal > 0
                  ? `Boletas: ${formatCLP(totalPersonal)} • Cuotas: ${formatCLP(paidDebtsPersonal)}`
                  : 'Gastos particulares'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
          </Card>

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
            {filteredReceipts.length} {filteredReceipts.length === 1 ? 'boleta' : 'boletas'}
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
                onClick={() => exportExpensesToExcel(filteredReceipts)}
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
              <Link href={selectedMonth !== ALL_MONTHS ? `/receipts/new?month=${selectedMonth}` : '/receipts/new'}>
                <Button size="sm" className="gap-1.5 text-xs">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Nueva Boleta</span>
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
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      {selectedMonth !== ALL_MONTHS && otherMonthsCount > 0 ? (
                        <div className="space-y-2">
                          <p>
                            No hay boletas en {formatMonthLabel(selectedMonth)}. Tienes {otherMonthsCount} en otros meses.
                          </p>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedMonth(ALL_MONTHS)}>
                            Ver todos los meses
                          </Button>
                        </div>
                      ) : selectedMonth !== ALL_MONTHS ? (
                        <p>Aún no hay boletas en {formatMonthLabel(selectedMonth)}. Usa el botón Nueva Boleta para subir la primera.</p>
                      ) : (
                        'No se encontraron boletas con los filtros seleccionados.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((r) => {
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
