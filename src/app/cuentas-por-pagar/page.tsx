'use client';

import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import { NewDebtModal } from '@/components/debts/new-debt-modal';
import { formatCLP, formatDateCL } from '@/lib/utils';
import { exportDebtsToExcel } from '@/lib/export-utils';
import { AccountPayable } from '@/types';
import {
  Clock,
  PlusCircle,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Search,
  Filter,
  Trash2,
  Building2,
  User,
  CreditCard,
  Layers,
  Bell,
  Check,
} from 'lucide-react';

export default function CuentasPorPagarPage() {
  const { debts, markDebtAsPaid, deleteDebt } = useReceipts();
  const { activeOrg, activeOrgId } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Cálculos de Días y Estados en Vivo
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysRemainingText = (dueDate: string, isPaid?: boolean) => {
    if (isPaid) return { text: 'Pagada', color: 'text-emerald-600 font-semibold' };
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `Vencida hace ${Math.abs(diffDays)} día(s)`,
        color: 'text-red-600 font-bold',
      };
    }
    if (diffDays === 0) {
      return {
        text: '¡Vence Hoy!',
        color: 'text-red-600 font-extrabold animate-pulse',
      };
    }
    if (diffDays <= 3) {
      return {
        text: `Vence en ${diffDays} día(s)`,
        color: 'text-amber-600 font-bold',
      };
    }
    return {
      text: `En ${diffDays} días (${formatDateCL(dueDate)})`,
      color: 'text-muted-foreground',
    };
  };

  // Scoping por organización activa
  const orgDebts = useMemo(() => {
    return debts.filter((d) => {
      if (activeOrgId !== 'all') {
        if (activeOrgId === 'org-personal') {
          if (d.expense_type !== 'personal' && d.organization_id !== 'org-personal') return false;
        } else {
          if (d.organization_id && d.organization_id !== activeOrgId) return false;
        }
      }
      return true;
    });
  }, [debts, activeOrgId]);

  // Filtrado de la lista
  const filteredDebts = useMemo(() => {
    return orgDebts.filter((d) => {
      const matchSearch =
        !searchTerm ||
        d.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.supplier_rut && d.supplier_rut.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.document_number && d.document_number.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus =
        filterStatus === 'all'
          ? true
          : filterStatus === 'pending_all'
          ? d.status !== 'paid'
          : d.status === filterStatus;

      const matchType =
        filterType === 'all'
          ? true
          : filterType === 'installments'
          ? Boolean(d.is_installment_credit || d.category === 'credito_bancario')
          : d.expense_type === filterType;

      return matchSearch && matchStatus && matchType;
    });
  }, [orgDebts, searchTerm, filterStatus, filterType]);

  // Métricas Financieras (Scoped)
  const pendingDebts = orgDebts.filter((d) => d.status !== 'paid');
  const overdueDebts = orgDebts.filter((d) => d.status === 'overdue');
  const dueSoonDebts = orgDebts.filter((d) => d.status === 'due_soon');
  const paidDebts = orgDebts.filter((d) => d.status === 'paid');

  const installmentDebts = orgDebts.filter((d) => d.is_installment_credit || d.category === 'credito_bancario');
  const activeInstallments = installmentDebts.filter((d) => d.status !== 'paid');
  const totalInstallmentMonthly = activeInstallments.reduce((acc, d) => acc + (d.installment_amount || d.amount), 0);

  const totalPendingAmount = pendingDebts.reduce((acc, d) => acc + d.amount, 0);
  const totalOverdueAmount = overdueDebts.reduce((acc, d) => acc + d.amount, 0);
  const totalDueSoonAmount = dueSoonDebts.reduce((acc, d) => acc + d.amount, 0);
  const totalPaidAmount = paidDebts.reduce((acc, d) => acc + (d.paid_amount || d.amount), 0);

  return (
    <AppLayout
      title="Cuentas por Pagar & Recordatorios de Vencimiento"
      description="Controla tus facturas por pagar, impuestos F29, cuotas bancarias y recibe alertas previas antes de cada fecha de corte."
    >
      <div className="space-y-6">
        {/* Banner Superior */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950 to-indigo-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl border border-rose-900/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-rose-500/20 text-rose-200 border-rose-400/30 text-xs">
                {overdueDebts.length > 0 ? `${overdueDebts.length} Vencidas en Alerta` : 'Sin deudas vencidas'}
              </Badge>
              <Badge className="bg-blue-500/20 text-blue-200 border-blue-400/30 text-xs">
                {activeOrg ? activeOrg.name : 'Vista Consolidada'}
              </Badge>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Clock className="h-6 w-6 text-rose-400" />
              <span>Programación de Pagos y Compromisos</span>
            </h2>
            <p className="text-xs text-rose-200/80 max-w-xl">
              Evita multas e intereses por mora. Programa recordatorios con 3 a 7 días de anticipación para facturas, créditos y tributos.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportDebtsToExcel(filteredDebts, activeOrg)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 text-xs"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Exportar Excel</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-2 font-semibold text-xs shadow-md"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Nueva Cuenta por Pagar</span>
            </Button>
          </div>
        </div>

        {/* Alerta de Vencimientos Críticos */}
        {(overdueDebts.length > 0 || dueSoonDebts.length > 0) && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 animate-bounce" />
              </div>
              <div>
                <p className="font-bold text-amber-950 dark:text-amber-200 text-sm">
                  Atención: Requieres {formatCLP(totalOverdueAmount + totalDueSoonAmount)} para cubrir compromisos inmediatos
                </p>
                <p className="text-amber-800 dark:text-amber-300 text-[11px] mt-0.5">
                  Tienes {overdueDebts.length} cuenta(s) vencida(s) y {dueSoonDebts.length} por vencer en los próximos días (F29, Previred o Facturas).
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFilterStatus('pending_all')}
              className="text-xs border-amber-400 bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 whitespace-nowrap"
            >
              Ver Compromisos Urgentes
            </Button>
          </div>
        )}

        {/* KPIs de Cuentas por Pagar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="p-4 border-l-4 border-l-slate-600">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Total Pendiente por Pagar
            </span>
            <h3 className="text-xl font-black text-foreground mt-1">{formatCLP(totalPendingAmount)}</h3>
            <span className="text-[11px] text-muted-foreground">{pendingDebts.length} cuentas por liquidar</span>
          </Card>

          <Card className="p-4 border-l-4 border-l-blue-600 bg-blue-50/20 dark:bg-blue-950/20">
            <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-bold tracking-wider flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" />
              <span>Cuotas de Créditos</span>
            </span>
            <h3 className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">
              {formatCLP(totalInstallmentMonthly)}
            </h3>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
              {activeInstallments.length} crédito(s) en cuotas activos
            </span>
          </Card>

          <Card className="p-4 border-l-4 border-l-red-600 bg-red-50/20 dark:bg-red-950/20">
            <span className="text-[10px] text-red-700 dark:text-red-300 uppercase font-bold tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Deudas Vencidas (Mora)</span>
            </span>
            <h3 className="text-xl font-black text-red-700 dark:text-red-300 mt-1">
              {formatCLP(totalOverdueAmount)}
            </h3>
            <span className="text-[11px] text-red-600 font-medium">
              {overdueDebts.length} compromisos expirados
            </span>
          </Card>

          <Card className="p-4 border-l-4 border-l-amber-600 bg-amber-50/20 dark:bg-amber-950/20">
            <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-bold tracking-wider flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>Por Vencer en 5 Días</span>
            </span>
            <h3 className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">
              {formatCLP(totalDueSoonAmount)}
            </h3>
            <span className="text-[11px] text-amber-600 font-medium">
              {dueSoonDebts.length} pagos programados próximos
            </span>
          </Card>

          <Card className="p-4 border-l-4 border-l-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/20">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-bold tracking-wider flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Pagadas en el Mes</span>
            </span>
            <h3 className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
              {formatCLP(totalPaidAmount)}
            </h3>
            <span className="text-[11px] text-emerald-600 font-medium">
              {paidDebts.length} compromisos liquidados
            </span>
          </Card>
        </div>

        {/* Barra de Búsqueda y Filtros */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Buscar por proveedor, RUT o N° factura..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 px-3 rounded-lg border border-input bg-background text-xs"
              >
                <option value="all">Todos los estados ({debts.length})</option>
                <option value="pending_all">Todas las pendientes ({pendingDebts.length})</option>
                <option value="overdue">🔴 Vencidas ({overdueDebts.length})</option>
                <option value="due_soon">🟡 Por Vencer Pronto ({dueSoonDebts.length})</option>
                <option value="paid">🟢 Pagadas ({paidDebts.length})</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-10 px-3 rounded-lg border border-input bg-background text-xs"
              >
                <option value="all">Empresa y Personal</option>
                <option value="business">Solo Empresa</option>
                <option value="personal">Solo Personal</option>
                <option value="installments">💳 Solo Créditos en Cuotas ({installmentDebts.length})</option>
              </select>

              <Button
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Agregar Cuenta</span>
              </Button>
            </div>
          </div>
        </Card>

        {/* Tabla de Cuentas por Pagar */}
        <Card className="overflow-hidden">
          <CardHeader className="py-3 px-4 bg-muted/40 border-b flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-foreground">
              Detalle de Compromisos y Fechas de Vencimiento
            </span>
            <span className="text-[11px] text-muted-foreground">
              {filteredDebts.length} compromisos listados
            </span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-bold border-b">
                <tr>
                  <th className="px-3 py-3">Proveedor / Acreedor</th>
                  <th className="px-3 py-3">N° Factura / Folio</th>
                  <th className="px-3 py-3">Categoría</th>
                  <th className="px-3 py-3 text-right">Monto (CLP)</th>
                  <th className="px-3 py-3">Vencimiento</th>
                  <th className="px-3 py-3">Tiempo Restante</th>
                  <th className="px-3 py-3 text-center">Estado</th>
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDebts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      No hay cuentas por pagar con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredDebts.map((debt) => {
                    const daysInfo = getDaysRemainingText(debt.due_date, debt.status === 'paid');

                    return (
                      <tr key={debt.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-3 font-semibold text-foreground">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{debt.supplier_name}</span>
                            {debt.is_installment_credit && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                Cuota {debt.installment_current || 1} de {debt.installment_total || 1}
                              </Badge>
                            )}
                          </div>
                          {debt.is_installment_credit && debt.installment_total && (
                            <div className="mt-1 flex items-center gap-2 max-w-[170px]">
                              <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-blue-600 h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(100, Math.round(((debt.installment_current || 1) / debt.installment_total) * 100))}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[9px] text-muted-foreground font-mono">
                                {Math.round(((debt.installment_current || 1) / debt.installment_total) * 100)}%
                              </span>
                            </div>
                          )}
                          {debt.supplier_rut && (
                            <span className="text-[10px] text-muted-foreground block font-mono mt-0.5">
                              RUT: {debt.supplier_rut}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px]">
                          {debt.document_number || 'S/N'}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {debt.is_installment_credit ? 'Crédito en Cuotas' : debt.category.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-extrabold text-foreground block">
                            {formatCLP(debt.installment_amount || debt.amount)}
                          </span>
                          {debt.is_installment_credit && (
                            <span className="text-[10px] text-muted-foreground block">
                              valor cuota
                            </span>
                          )}
                          {debt.total_credit_amount && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 block font-semibold">
                              Total: {formatCLP(debt.total_credit_amount)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium whitespace-nowrap">
                          {formatDateCL(debt.due_date)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`text-[11px] ${daysInfo.color}`}>
                            {daysInfo.text}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge
                            variant={
                              debt.status === 'paid'
                                ? 'success'
                                : debt.status === 'overdue'
                                ? 'destructive'
                                : debt.status === 'due_soon'
                                ? 'warning'
                                : 'info'
                            }
                            className="text-[9px]"
                          >
                            {debt.status === 'paid'
                              ? 'Pagada'
                              : debt.status === 'overdue'
                              ? 'Vencida'
                              : debt.status === 'due_soon'
                              ? 'Por Vencer'
                              : 'Al Día'}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {debt.status !== 'paid' ? (
                              <Button
                                size="sm"
                                onClick={() => markDebtAsPaid(debt.id)}
                                className="h-7 text-[10px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              >
                                <Check className="h-3 w-3" />
                                <span>Marcar Pagada</span>
                              </Button>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>{formatDateCL(debt.paid_at)}</span>
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`¿Eliminar el registro de ${debt.supplier_name}?`)) {
                                  deleteDebt(debt.id);
                                }
                              }}
                              className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
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

      <NewDebtModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </AppLayout>
  );
}
