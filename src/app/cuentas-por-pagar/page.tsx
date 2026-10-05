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
import { AssignSalaryModal } from '@/components/payroll/assign-salary-modal';
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
  Briefcase,
  Sparkles,
} from 'lucide-react';

export default function CuentasPorPagarPage() {
  const { debts, addDebt, markDebtAsPaid, unmarkDebtAsPaid, updateDebt, deleteDebt } = useReceipts();
  const { activeOrg, activeOrgId } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignSalaryModalOpen, setIsAssignSalaryModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadFixedMessage, setLoadFixedMessage] = useState<string | null>(null);

  const handleLoadFixedExpenses = () => {
    if (!activeOrg || activeOrg.type !== 'business') {
      setLoadFixedMessage('Selecciona un perfil de empresa activo para cargar sus gastos fijos.');
      setTimeout(() => setLoadFixedMessage(null), 3500);
      return;
    }

    const exp = activeOrg.monthly_expenses || {};
    const salary = activeOrg.assigned_salary || exp.assigned_salary || 0;
    const team = (activeOrg.team_salaries || []).filter((emp) => emp.name && emp.amount > 0);
    const rent = exp.rent || 0;
    const internet = exp.internet || 0;
    const mobile = exp.mobile || 0;
    const electricity = exp.electricity || 0;
    const water = exp.water || 0;
    const otherFixed = exp.other_fixed || 0;

    if (!salary && !rent && !internet && !mobile && !electricity && !water && !otherFixed && team.length === 0) {
      setLoadFixedMessage('Esta empresa aún no tiene sueldo asignado ni gastos fijos configurados en Empresas y Perfiles o Costos Fijos.');
      setTimeout(() => setLoadFixedMessage(null), 4000);
      return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${currentYear}-${currentMonth}`;
    const endOfMonth = new Date(currentYear, now.getMonth() + 1, 0).toISOString().split('T')[0];
    const midOfMonth = `${monthPrefix}-15`;

    let countCreated = 0;
    let countUpdated = 0;

    const syncItem = (
      matchingKeywords: string[],
      targetAmount: number,
      createData: {
        supplier_name: string;
        document_number: string;
        document_type: 'servicio' | 'otro';
        category: 'sueldo_empresarial' | 'arriendo' | 'servicios_basicos' | 'servicio_suscripcion' | 'otro';
        issue_date: string;
        due_date: string;
        reminder_days_before: number;
        expense_type: 'business';
        notes: string;
      }
    ) => {
      const existing = orgDebts.find((d) => {
        const matchesDate = (d.due_date && d.due_date.startsWith(monthPrefix)) || (d.issue_date && d.issue_date.startsWith(monthPrefix));
        if (!matchesDate) return false;
        const nameLower = d.supplier_name.toLowerCase();
        return matchingKeywords.some((k) => nameLower.includes(k.toLowerCase()));
      });

      if (existing) {
        if (targetAmount > 0) {
          if (existing.amount !== targetAmount) {
            updateDebt(existing.id, {
              amount: targetAmount,
              due_date: createData.due_date,
              notes: createData.notes,
            });
            countUpdated++;
          }
        }
      } else if (targetAmount > 0) {
        addDebt({
          user_id: activeOrg.created_by || 'system',
          organization_id: activeOrg.id,
          ...createData,
          amount: targetAmount,
        });
        countCreated++;
      }
    };

    // 1. Sueldo Asignado Dueño
    syncItem(
      ['Sueldo Asignado', 'Sueldo Patronal'],
      salary,
      {
        supplier_name: `Sueldo Asignado Dueño (${activeOrg.name})`,
        document_number: `SUELDO-${monthPrefix}`,
        document_type: 'otro',
        category: 'sueldo_empresarial',
        issue_date: `${monthPrefix}-01`,
        due_date: endOfMonth,
        reminder_days_before: 5,
        expense_type: 'business',
        notes: 'Remuneración o asignación patronal fija mensual pactada para el dueño o socio.',
      }
    );

    // 2. Colaboradores
    team.forEach((emp) => {
      const empDueDate = `${monthPrefix}-${String(emp.payment_day || 30).padStart(2, '0')}`;
      syncItem(
        [`Sueldo: ${emp.name}`, emp.name],
        emp.amount,
        {
          supplier_name: `Sueldo: ${emp.name} (${emp.role || 'Colaborador'})`,
          document_number: `NOM-${monthPrefix}-${emp.name.replace(/\s+/g, '').substring(0, 5).toUpperCase()}`,
          document_type: 'otro',
          category: 'sueldo_empresarial',
          issue_date: `${monthPrefix}-01`,
          due_date: empDueDate > endOfMonth ? endOfMonth : empDueDate,
          reminder_days_before: 3,
          expense_type: 'business',
          notes: `Remuneración mensual pactada para ${emp.name}.`,
        }
      );
    });

    // 3. Arriendo
    syncItem(
      ['Arriendo'],
      rent,
      {
        supplier_name: `Arriendo Oficina / Local (${activeOrg.name})`,
        document_number: `ARR-${monthPrefix}`,
        document_type: 'servicio',
        category: 'arriendo',
        issue_date: `${monthPrefix}-01`,
        due_date: `${monthPrefix}-05`,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Gasto fijo mensual de arriendo de inmueble comercial.',
      }
    );

    // 4. Internet
    syncItem(
      ['Internet'],
      internet,
      {
        supplier_name: `Internet y Telecomunicaciones (${activeOrg.name})`,
        document_number: `TEL-${monthPrefix}`,
        document_type: 'servicio',
        category: 'servicios_basicos',
        issue_date: `${monthPrefix}-01`,
        due_date: `${monthPrefix}-10`,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Servicio mensual de internet y conectividad.',
      }
    );

    // 5. Mobile
    syncItem(
      ['Mobile', 'Celular', 'Móvil'],
      mobile,
      {
        supplier_name: `Telefonía Móvil / Mobile (${activeOrg.name})`,
        document_number: `MOB-${monthPrefix}`,
        document_type: 'servicio',
        category: 'servicios_basicos',
        issue_date: `${monthPrefix}-01`,
        due_date: `${monthPrefix}-16`,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Plan celular y telefonía móvil de la empresa.',
      }
    );

    // 6. Luz
    syncItem(
      ['Luz', 'Electricidad'],
      electricity,
      {
        supplier_name: `Luz / Electricidad (${activeOrg.name})`,
        document_number: `LUZ-${monthPrefix}`,
        document_type: 'servicio',
        category: 'servicios_basicos',
        issue_date: `${monthPrefix}-01`,
        due_date: midOfMonth,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Gasto operacional mensual de energía eléctrica.',
      }
    );

    // 7. Agua
    syncItem(
      ['Agua'],
      water,
      {
        supplier_name: `Agua Potable (${activeOrg.name})`,
        document_number: `AGUA-${monthPrefix}`,
        document_type: 'servicio',
        category: 'servicios_basicos',
        issue_date: `${monthPrefix}-01`,
        due_date: `${monthPrefix}-18`,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Servicio básico de agua potable.',
      }
    );

    // 8. Otros Fijos
    syncItem(
      ['Otros Gastos Fijos', 'Otros Fijos', 'Software'],
      otherFixed,
      {
        supplier_name: `Otros Gastos Fijos (${activeOrg.name})`,
        document_number: `FIJOS-${monthPrefix}`,
        document_type: 'servicio',
        category: 'servicio_suscripcion',
        issue_date: `${monthPrefix}-01`,
        due_date: endOfMonth,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Suscripciones mensuales fijas de software o servicios.',
      }
    );

    if (countCreated > 0 || countUpdated > 0) {
      const parts = [];
      if (countCreated > 0) parts.push(`${countCreated} nuevo(s)`);
      if (countUpdated > 0) parts.push(`${countUpdated} actualizado(s)`);
      setLoadFixedMessage(`¡Éxito! Se sincronizaron los compromisos fijos: ${parts.join(', ')}.`);
    } else {
      setLoadFixedMessage('Los gastos fijos de este mes ya se encuentran al día con sus valores correspondientes.');
    }
    setTimeout(() => setLoadFixedMessage(null), 4000);
  };

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

  const isPersonalMode = activeOrg?.type === 'personal' || activeOrgId === 'org-personal';

  // Scoping por organización activa: Aislamiento total de entorno
  const orgDebts = useMemo(() => {
    return debts.filter((d) => {
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
  }, [debts, activeOrgId, isPersonalMode]);

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
  const totalPaidAmount = paidDebts.reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);

  const paidBusinessAmount = paidDebts
    .filter((d) => d.expense_type === 'business')
    .reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);
  const paidPersonalAmount = paidDebts
    .filter((d) => d.expense_type === 'personal')
    .reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);

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
            {activeOrg?.type === 'business' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAssignSalaryModalOpen(true)}
                  className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-100 border-emerald-400/40 gap-1.5 text-xs font-semibold"
                  title="Configurar y asignar sueldo del dueño y colaboradores"
                >
                  <Briefcase className="h-4 w-4 text-emerald-300" />
                  <span>Asignar Sueldos</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadFixedExpenses}
                  className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-100 border-indigo-400/40 gap-1.5 text-xs font-semibold"
                  title="Cargar sueldo asignado y gastos fijos configurados para esta empresa"
                >
                  <Sparkles className="h-4 w-4 text-indigo-300" />
                  <span>Cargar Gastos Fijos</span>
                </Button>
              </>
            )}
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

        {/* Notificación de Carga de Gastos Fijos */}
        {loadFixedMessage && (
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center gap-2 text-xs text-blue-950 dark:text-blue-200 font-medium">
            <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span>{loadFixedMessage}</span>
          </div>
        )}

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
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-blue-700 dark:text-blue-300 font-medium">🏢 Empresa: {formatCLP(paidBusinessAmount)}</span>
              <span>•</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-medium">👤 Personal: {formatCLP(paidPersonalAmount)}</span>
            </div>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>Sumadas a Gastos de Empresa / Personal</span>
            </p>
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
                  <th className="px-3 py-3 text-center">Ámbito</th>
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
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
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
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              const nextType = debt.expense_type === 'business' ? 'personal' : 'business';
                              updateDebt(debt.id, {
                                expense_type: nextType,
                                organization_id:
                                  nextType === 'personal'
                                    ? 'org-personal'
                                    : activeOrgId !== 'all'
                                    ? activeOrgId
                                    : 'org-empresa-1',
                              });
                            }}
                            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all cursor-pointer font-medium hover:scale-105 active:scale-95 ${
                              debt.expense_type === 'business'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            }`}
                            title="Haz clic para alternar entre Gasto Empresa o Personal"
                          >
                            {debt.expense_type === 'business' ? (
                              <>
                                <Building2 className="h-2.5 w-2.5" />
                                <span>Empresa</span>
                              </>
                            ) : (
                              <>
                                <User className="h-2.5 w-2.5" />
                                <span>Personal</span>
                              </>
                            )}
                          </button>
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
                                onClick={() => {
                                  markDebtAsPaid(debt.id);
                                  if (!debt.organization_id || !debt.expense_type) {
                                    updateDebt(debt.id, {
                                      expense_type: debt.expense_type || (isPersonalMode ? 'personal' : 'business'),
                                      organization_id:
                                        debt.organization_id ||
                                        (isPersonalMode ? 'org-personal' : activeOrgId !== 'all' ? activeOrgId : 'org-empresa-1'),
                                    });
                                  }
                                }}
                                className="h-7 text-[10px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              >
                                <Check className="h-3 w-3" />
                                <span>Marcar Pagada</span>
                              </Button>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>{formatDateCL(debt.paid_at)}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => unmarkDebtAsPaid(debt.id)}
                                  className="text-[10px] text-muted-foreground hover:text-amber-600 underline ml-0.5"
                                  title="Reabrir / Marcar como pendiente"
                                >
                                  Reabrir
                                </button>
                              </div>
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
      <AssignSalaryModal
        isOpen={isAssignSalaryModalOpen}
        onClose={() => setIsAssignSalaryModalOpen(false)}
      />
    </AppLayout>
  );
}
