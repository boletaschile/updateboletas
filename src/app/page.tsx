'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
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
  const { activeOrgId, activeOrg } = useAuth();

  // Cuentas por Cobrar y Facturas de Venta filtradas
  const scopedReceivables = useMemo(() => {
    return (receivables || []).filter((r) => {
      if (activeOrgId === 'all') return true;
      if (activeOrgId === 'org-personal') return r.income_type === 'personal' || r.organization_id === 'org-personal';
      return r.organization_id === activeOrgId || (r.income_type === 'business' && (!r.organization_id || r.organization_id === 'org-empresa-1'));
    });
  }, [receivables, activeOrgId]);

  const pendingReceivables = useMemo(() => scopedReceivables.filter((r) => r.status !== 'collected'), [scopedReceivables]);
  const totalPendingReceivable = useMemo(() => pendingReceivables.reduce((acc, r) => acc + r.total_amount, 0), [pendingReceivables]);

  // Métricas del mes actual filtradas por la empresa o perfil seleccionado
  const currentMonthReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (r.status === 'rejected') return false;
      if (activeOrgId === 'all') return true;
      if (activeOrgId === 'org-personal') {
        return r.expense_type === 'personal' || r.organization_id === 'org-personal';
      }
      return r.organization_id === activeOrgId || (r.expense_type === 'business' && (!r.organization_id || r.organization_id === 'org-empresa-1'));
    });
  }, [receipts, activeOrgId]);

  // Deudas y Compromisos filtrados por la empresa seleccionada
  const scopedDebts = useMemo(() => {
    return debts.filter((d) => {
      if (activeOrgId === 'all') return true;
      if (activeOrgId === 'org-personal') return d.expense_type === 'personal' || d.organization_id === 'org-personal';
      return d.organization_id === activeOrgId || (d.expense_type === 'business' && (!d.organization_id || d.organization_id === 'org-empresa-1'));
    });
  }, [debts, activeOrgId]);

  // Compromisos y deudas marcadas como pagadas (liquidadas)
  const paidDebts = useMemo(() => scopedDebts.filter((d) => d.status === 'paid'), [scopedDebts]);

  const paidDebtsBusiness = useMemo(() => {
    return paidDebts
      .filter((d) => d.expense_type === 'business')
      .reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);
  }, [paidDebts]);

  const paidDebtsPersonal = useMemo(() => {
    return paidDebts
      .filter((d) => d.expense_type === 'personal')
      .reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);
  }, [paidDebts]);

  const totalPaidDebts = paidDebtsBusiness + paidDebtsPersonal;

  // Gastos de boletas
  const receiptsSpent = currentMonthReceipts.reduce((acc, r) => acc + r.total_amount, 0);
  const receiptsBusiness = currentMonthReceipts.reduce((acc, r) => acc + r.business_total, 0);
  const receiptsPersonal = currentMonthReceipts.reduce((acc, r) => acc + r.personal_total, 0);

  // Totales consolidados (Boletas + Compromisos/Deudas pagadas)
  const totalSpent = receiptsSpent + totalPaidDebts;
  const totalBusiness = receiptsBusiness + paidDebtsBusiness;
  const totalPersonal = receiptsPersonal + paidDebtsPersonal;
  const pendingReviewCount = currentMonthReceipts.filter((r) => r.status === 'needs_review').length;

  const totalBudget = budgets.find((b) => b.budget_type === 'total')?.amount || 800000;
  const budgetUsagePercent = Math.min(100, Math.round((totalSpent / totalBudget) * 100));
  const remainingBudget = Math.max(0, totalBudget - totalSpent);

  const overdueDebts = scopedDebts.filter((d) => d.status === 'overdue');
  const dueSoonDebts = scopedDebts.filter((d) => d.status === 'due_soon');
  const totalUrgentDebt = [...overdueDebts, ...dueSoonDebts].reduce((acc, d) => acc + d.amount, 0);

  // Datos para Gráfico de Categorías (Boletas + Compromisos Pagados)
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthReceipts.forEach((r) => {
      (r.items || []).forEach((item) => {
        const cat = item.category_name || 'Varios';
        map[cat] = (map[cat] || 0) + item.line_total;
      });
    });

    paidDebts.forEach((d) => {
      const cat = d.is_installment_credit || d.category === 'credito_bancario'
        ? 'Créditos y Préstamos'
        : d.category === 'impuesto_f29'
        ? 'Impuestos F29'
        : d.category === 'previred'
        ? 'Cotizaciones Previred'
        : d.category === 'arriendo'
        ? 'Arriendo Oficina'
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
  }, [currentMonthReceipts, paidDebts]);

  // Datos para Gráfico Comparativo Empresa vs Personal calculados dinámicamente
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
        if (activeOrgId !== 'all') {
          if (activeOrgId === 'org-personal') {
            if (r.expense_type !== 'personal' && r.organization_id !== 'org-personal') return false;
          } else {
            if (r.organization_id && r.organization_id !== activeOrgId) return false;
          }
        }
        return r.document_date && r.document_date.startsWith(monthPrefix);
      });

      const mPaidDebts = scopedDebts.filter((d) => {
        if (d.status !== 'paid') return false;
        const pDate = d.paid_at ? d.paid_at.substring(0, 7) : d.due_date.substring(0, 7);
        return pDate === monthPrefix;
      });

      const recBus = mReceipts.reduce((acc, r) => acc + r.business_total, 0);
      const recPer = mReceipts.reduce((acc, r) => acc + r.personal_total, 0);
      const debtBus = mPaidDebts.filter((d) => d.expense_type === 'business').reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);
      const debtPer = mPaidDebts.filter((d) => d.expense_type === 'personal').reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);

      return {
        name: isCurrent ? `${monthNames[month]} (Actual)` : monthNames[month],
        empresa: isCurrent ? totalBusiness : recBus + debtBus,
        personal: isCurrent ? totalPersonal : recPer + debtPer,
      };
    });
  }, [receipts, scopedDebts, activeOrgId, totalBusiness, totalPersonal]);

  const currentPeriodName = useMemo(() => {
    const fullMonths = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const now = new Date();
    return `${fullMonths[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  // Top Comercios
  const topMerchants = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    currentMonthReceipts.forEach((r) => {
      if (!map[r.merchant_name]) map[r.merchant_name] = { total: 0, count: 0 };
      map[r.merchant_name].total += r.total_amount;
      map[r.merchant_name].count += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [currentMonthReceipts]);

  return (
    <AppLayout
      title="Panel de Control Financiero"
      description="Resumen de gastos mensuales, presupuesto disponible, cuentas por pagar y detección de documentos."
    >
      <div className="space-y-6">
        {/* Banner de Bienvenida y Acciones */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-blue-950/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-200 border-blue-400/30 text-xs">
                Período: {currentPeriodName}
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                Chile (CLP)
              </Badge>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              Control y Categorización Inteligente de Boletas
            </h2>
            <p className="text-xs text-blue-200/80 max-w-xl">
              Procesa tus comprobantes con OCR e IA, separa gastos personales y de empresa y valida tus totales en pesos chilenos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/cuentas-por-cobrar">
              <Button variant="outline" className="border-blue-400/30 bg-blue-950/40 text-blue-100 hover:bg-blue-900/60 gap-1.5 font-medium text-xs">
                <Briefcase className="h-4 w-4 text-emerald-400" />
                <span>Cuentas por Cobrar</span>
              </Button>
            </Link>
            <Link href="/receipts/new">
              <Button className="bg-white text-slate-950 hover:bg-slate-100 gap-2 font-semibold shadow-md text-xs">
                <PlusCircle className="h-4 w-4 text-blue-600" />
                <span>Nueva Boleta</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Alerta de Cuentas por Cobrar Pendientes */}
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
                  Gestión activa de cobranza y facturación a clientes.
                </p>
              </div>
            </div>
            <Link href="/cuentas-por-cobrar">
              <Button size="sm" variant="outline" className="text-xs border-emerald-300 bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-200 whitespace-nowrap font-medium">
                Gestionar Cobros
              </Button>
            </Link>
          </div>
        )}

        {/* Alerta de Cuentas por Pagar Urgentes */}
        {(overdueDebts.length > 0 || dueSoonDebts.length > 0) && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-rose-950 dark:text-rose-200">
                  Recordatorio de Pagos: {formatCLP(totalUrgentDebt)} por vencer o vencidos
                </p>
                <p className="text-rose-800 dark:text-rose-300 text-[11px]">
                  {overdueDebts.length > 0 ? `${overdueDebts.length} cuenta(s) vencida(s) • ` : ''}
                  {dueSoonDebts.length} compromiso(s) por vencer en los próximos días (F29, Previred o Proveedores).
                </p>
              </div>
            </div>
            <Link href="/cuentas-por-pagar">
              <Button size="sm" variant="outline" className="text-xs border-rose-300 bg-white dark:bg-slate-900 text-rose-900 dark:text-rose-200 whitespace-nowrap">
                Ver Cuentas por Pagar
              </Button>
            </Link>
          </div>
        )}

        {/* Tarjetas de Indicadores Clave (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Gastado */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Gasto Total del Mes</span>
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-extrabold text-foreground mt-2">{formatCLP(totalSpent)}</h3>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
              {totalPaidDebts > 0 ? (
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Boletas: {formatCLP(receiptsSpent)} + Cuotas/Deudas: {formatCLP(totalPaidDebts)}
                </span>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  <span>-4.2% respecto a agosto</span>
                </div>
              )}
            </div>
          </Card>

          {/* Gastos de Empresa */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Gastos de Empresa</span>
              <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-extrabold text-indigo-600 mt-2">{formatCLP(totalBusiness)}</h3>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
              {paidDebtsBusiness > 0 ? (
                <span>Boletas: {formatCLP(receiptsBusiness)} • Cuotas/Deudas: {formatCLP(paidDebtsBusiness)}</span>
              ) : (
                <span>{Math.round((totalBusiness / (totalSpent || 1)) * 100)}% del gasto total</span>
              )}
            </div>
          </Card>

          {/* Gastos Personales */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Gastos Personales</span>
              <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-extrabold text-emerald-600 mt-2">{formatCLP(totalPersonal)}</h3>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
              {paidDebtsPersonal > 0 ? (
                <span>Boletas: {formatCLP(receiptsPersonal)} • Cuotas/Deudas: {formatCLP(paidDebtsPersonal)}</span>
              ) : (
                <span>{Math.round((totalPersonal / (totalSpent || 1)) * 100)}% del gasto total</span>
              )}
            </div>
          </Card>

          {/* Presupuesto y Saldo */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Presupuesto Mensual</span>
              <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center">
                <PieChartIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <h3 className="text-2xl font-extrabold text-foreground">{formatCLP(remainingBudget)}</h3>
              <span className="text-xs text-muted-foreground">de {formatCLP(totalBudget)}</span>
            </div>
            <div className="mt-3 space-y-1">
              <Progress
                value={budgetUsagePercent}
                indicatorColor={budgetUsagePercent > 90 ? 'bg-red-500' : budgetUsagePercent > 75 ? 'bg-amber-500' : 'bg-blue-600'}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{budgetUsagePercent}% consumido</span>
                <span>Disponible</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Alertas y Observaciones Contables */}
        {pendingReviewCount > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Tienes {pendingReviewCount} documento(s) pendiente(s) de revisión humana
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Revisa los datos extraídos por la IA y confirma los montos antes de la contabilización final.
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

        {/* Gráficos Principales (2 Columnas) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Evolución Mensual: Empresa vs Personal (7 columnas) */}
          <Card className="lg:col-span-7">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm">Evolución de Gastos (Empresa vs Personal)</CardTitle>
              <CardDescription className="text-xs">Comparativa de montos en CLP de los últimos meses.</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyComparisonData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any) => [formatCLP(Number(val)), '']}
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="empresa" name="Gasto Empresa" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="personal" name="Gasto Personal" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Distribución por Categoría (5 columnas) */}
          <Card className="lg:col-span-5">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm">Distribución por Categorías</CardTitle>
              <CardDescription className="text-xs">Categorías con mayor impacto en el período.</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-[280px] w-full">
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
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección Inferior: Top Comercios y Últimas Boletas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top Comercios */}
          <Card className="lg:col-span-5">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm">Principales Comercios</CardTitle>
              <CardDescription className="text-xs">Lugares donde se concentra el mayor gasto.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 divide-y">
              {topMerchants.map((m, idx) => (
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
              ))}
            </CardContent>
          </Card>

          {/* Últimas Boletas Procesadas */}
          <Card className="lg:col-span-7">
            <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Últimas Boletas Registradas</CardTitle>
                <CardDescription className="text-xs">Movimientos recientes ingresados al sistema.</CardDescription>
              </div>
              <Link href="/receipts">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 gap-1">
                  <span>Ver todas</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {receipts.slice(0, 4).map((r) => (
                <div key={r.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{r.merchant_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateCL(r.document_date)} • {r.expense_type === 'business' ? 'Empresa' : r.expense_type === 'personal' ? 'Personal' : 'Mixto'}
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
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
