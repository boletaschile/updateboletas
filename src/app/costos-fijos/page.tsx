'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/store/auth-context';
import { useReceipts } from '@/lib/store/receipts-context';
import { formatCLP } from '@/lib/utils';
import { EmployeeSalaryItem, Organization } from '@/types';
import Link from 'next/link';
import {
  Landmark,
  Briefcase,
  Users,
  Home,
  Wifi,
  Smartphone,
  Lightbulb,
  Droplets,
  Receipt,
  Plus,
  Trash2,
  CheckCircle2,
  Building2,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Wallet,
  Clock,
  Save,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';

export default function CostosFijosPage() {
  const { organizations, activeOrgId, activeOrg, updateOrganization, setActiveOrgId } = useAuth();
  const { addDebt, debts } = useReceipts();

  // Filtrar organizaciones tipo empresa
  const businessOrgs = useMemo(
    () => organizations.filter((o) => o.type === 'business'),
    [organizations]
  );

  const isPersonalMode = activeOrg?.type === 'personal' || activeOrgId === 'org-personal';

  // Si estamos en personal mode pero hay empresas, podemos apuntar a la primera empresa
  const currentBusinessOrg = useMemo(() => {
    if (activeOrg && activeOrg.type === 'business') return activeOrg;
    return businessOrgs[0] || activeOrg;
  }, [activeOrg, businessOrgs]);

  const targetOrgId = currentBusinessOrg?.id || '';

  // Estados del Formulario: Sueldos
  const [assignedSalary, setAssignedSalary] = useState<number>(0);
  const [paymentDay, setPaymentDay] = useState<number>(30);
  const [teamSalaries, setTeamSalaries] = useState<EmployeeSalaryItem[]>([]);

  // Estados del Formulario: Servicios y Gastos Operacionales
  const [rent, setRent] = useState<number>(0);
  const [internet, setInternet] = useState<number>(0);
  const [mobile, setMobile] = useState<number>(0);
  const [electricity, setElectricity] = useState<number>(0);
  const [water, setWater] = useState<number>(0);
  const [otherFixed, setOtherFixed] = useState<number>(0);

  // Estados de interfaz y feedback
  const [isSaved, setIsSaved] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Cargar datos de la empresa activa
  useEffect(() => {
    if (currentBusinessOrg) {
      const exp = currentBusinessOrg.monthly_expenses || {};
      setAssignedSalary(currentBusinessOrg.assigned_salary || exp.assigned_salary || 0);
      setTeamSalaries(currentBusinessOrg.team_salaries || []);
      setRent(exp.rent || 0);
      setInternet(exp.internet || 0);
      setMobile(exp.mobile || 0);
      setElectricity(exp.electricity || 0);
      setWater(exp.water || 0);
      setOtherFixed(exp.other_fixed || 0);
      setIsSaved(false);
    }
  }, [currentBusinessOrg]);

  // Manejo de Colaboradores
  const handleAddEmployee = () => {
    const newItem: EmployeeSalaryItem = {
      id: 'emp-' + Date.now(),
      name: '',
      role: '',
      amount: 0,
      payment_day: 30,
      contract_type: 'indefinido',
    };
    setTeamSalaries((prev) => [...prev, newItem]);
    setIsSaved(false);
  };

  const handleUpdateEmployee = (id: string, field: keyof EmployeeSalaryItem, value: any) => {
    setTeamSalaries((prev) =>
      prev.map((emp) => (emp.id === id ? { ...emp, [field]: value } : emp))
    );
    setIsSaved(false);
  };

  const handleRemoveEmployee = (id: string) => {
    setTeamSalaries((prev) => prev.filter((emp) => emp.id !== id));
    setIsSaved(false);
  };

  // Cálculos de Totales
  const totalTeamSalaries = useMemo(
    () => teamSalaries.reduce((acc, emp) => acc + (Number(emp.amount) || 0), 0),
    [teamSalaries]
  );
  const totalPayroll = (assignedSalary || 0) + totalTeamSalaries;
  const totalOperationalFixed =
    (rent || 0) + (internet || 0) + (mobile || 0) + (electricity || 0) + (water || 0) + (otherFixed || 0);
  const grandTotalFixedCosts = totalPayroll + totalOperationalFixed;
  const dailyBreakEven = Math.round(grandTotalFixedCosts / 30);

  // Guardar Cambios
  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentBusinessOrg) return;

    const validTeam = teamSalaries.filter((emp) => emp.name.trim() && emp.amount > 0);

    updateOrganization(currentBusinessOrg.id, {
      name: currentBusinessOrg.name,
      legal_name: currentBusinessOrg.legal_name,
      rut: currentBusinessOrg.rut,
      type: 'business',
      assigned_salary: assignedSalary || 0,
      team_salaries: validTeam,
      monthly_expenses: {
        rent: rent || 0,
        internet: internet || 0,
        mobile: mobile || 0,
        electricity: electricity || 0,
        water: water || 0,
        other_fixed: otherFixed || 0,
        assigned_salary: assignedSalary || 0,
      },
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3500);
  };

  // Sincronizar automáticamente con Cuentas por Pagar del mes actual
  const handleSyncToCurrentMonthDebts = () => {
    if (!currentBusinessOrg) return;

    handleSave();

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${currentYear}-${currentMonth}`;
    const endOfMonth = new Date(currentYear, now.getMonth() + 1, 0).toISOString().split('T')[0];

    const alreadyExists = (snippet: string) => {
      return debts.some(
        (d) =>
          d.organization_id === currentBusinessOrg.id &&
          d.supplier_name.toLowerCase().includes(snippet.toLowerCase()) &&
          (d.due_date.startsWith(monthPrefix) || d.issue_date.startsWith(monthPrefix))
      );
    };

    let count = 0;

    // 1. Sueldo Asignado Dueño
    if (assignedSalary > 0 && !alreadyExists('Sueldo Asignado')) {
      addDebt({
        user_id: currentBusinessOrg.created_by || 'system',
        organization_id: currentBusinessOrg.id,
        supplier_name: `Sueldo Asignado Dueño (${currentBusinessOrg.name})`,
        document_number: `SUELDO-${monthPrefix}`,
        document_type: 'otro',
        category: 'sueldo_empresarial',
        amount: assignedSalary,
        issue_date: `${monthPrefix}-01`,
        due_date: endOfMonth,
        reminder_days_before: 5,
        expense_type: 'business',
        notes: 'Remuneración patronal fija mensual acordada para el socio/dueño.',
      });
      count++;
    }

    // 2. Colaboradores del Equipo
    teamSalaries
      .filter((emp) => emp.name.trim() && emp.amount > 0)
      .forEach((emp) => {
        const empSnippet = `Sueldo: ${emp.name}`;
        if (!alreadyExists(empSnippet)) {
          const empDueDate = `${monthPrefix}-${String(emp.payment_day || 30).padStart(2, '0')}`;
          addDebt({
            user_id: currentBusinessOrg.created_by || 'system',
            organization_id: currentBusinessOrg.id,
            supplier_name: `Sueldo: ${emp.name} (${emp.role || 'Colaborador'})`,
            document_number: `NOM-${monthPrefix}-${emp.name.replace(/\s+/g, '').substring(0, 5).toUpperCase()}`,
            document_type: 'otro',
            category: 'sueldo_empresarial',
            amount: emp.amount,
            issue_date: `${monthPrefix}-01`,
            due_date: empDueDate > endOfMonth ? endOfMonth : empDueDate,
            reminder_days_before: 3,
            expense_type: 'business',
            notes: `Remuneración mensual pactada para ${emp.name}.`,
          });
          count++;
        }
      });

    // 3. Arriendo
    if (rent > 0 && !alreadyExists('Arriendo')) {
      addDebt({
        user_id: currentBusinessOrg.created_by || 'system',
        organization_id: currentBusinessOrg.id,
        supplier_name: `Arriendo Oficina / Local (${currentBusinessOrg.name})`,
        document_number: `ARR-${monthPrefix}`,
        document_type: 'servicio',
        category: 'arriendo',
        amount: rent,
        issue_date: `${monthPrefix}-01`,
        due_date: `${monthPrefix}-05`,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Gasto fijo mensual de arriendo de oficinas o dependencias.',
      });
      count++;
    }

    // 4. Internet
    if (internet > 0 && !alreadyExists('Internet')) {
      addDebt({
        user_id: currentBusinessOrg.created_by || 'system',
        organization_id: currentBusinessOrg.id,
        supplier_name: `Internet & Telecomunicaciones (${currentBusinessOrg.name})`,
        document_number: `INT-${monthPrefix}`,
        document_type: 'servicio',
        category: 'servicios_basicos',
        amount: internet,
        issue_date: `${monthPrefix}-01`,
        due_date: `${monthPrefix}-15`,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Servicio mensual de internet y conectividad fibra.',
      });
      count++;
    }

    // 5. Telefonía Móvil / Mobile
    if (mobile > 0 && !alreadyExists('Mobile') && !alreadyExists('Celular') && !alreadyExists('Móvil')) {
      addDebt({
        user_id: currentBusinessOrg.created_by || 'system',
        organization_id: currentBusinessOrg.id,
        supplier_name: `Telefonía Móvil / Mobile (${currentBusinessOrg.name})`,
        document_number: `MOB-${monthPrefix}`,
        document_type: 'servicio',
        category: 'servicios_basicos',
        amount: mobile,
        issue_date: `${monthPrefix}-01`,
        due_date: `${monthPrefix}-16`,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Plan celular y telefonía móvil de la empresa.',
      });
      count++;
    }

    // 6. Luz
    if (electricity > 0 && !alreadyExists('Luz')) {
      addDebt({
        user_id: currentBusinessOrg.created_by || 'system',
        organization_id: currentBusinessOrg.id,
        supplier_name: `Luz / Electricidad (${currentBusinessOrg.name})`,
        document_number: `LUZ-${monthPrefix}`,
        document_type: 'servicio',
        category: 'servicios_basicos',
        amount: electricity,
        issue_date: `${monthPrefix}-01`,
        due_date: `${monthPrefix}-18`,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Suministro eléctrico del mes.',
      });
      count++;
    }

    // 7. Agua
    if (water > 0 && !alreadyExists('Agua')) {
      addDebt({
        user_id: currentBusinessOrg.created_by || 'system',
        organization_id: currentBusinessOrg.id,
        supplier_name: `Agua Potable (${currentBusinessOrg.name})`,
        document_number: `AGUA-${monthPrefix}`,
        document_type: 'servicio',
        category: 'servicios_basicos',
        amount: water,
        issue_date: `${monthPrefix}-01`,
        due_date: `${monthPrefix}-20`,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Consumo de agua potable.',
      });
      count++;
    }

    // 8. Otros fijos
    if (otherFixed > 0 && !alreadyExists('Otros Fijos')) {
      addDebt({
        user_id: currentBusinessOrg.created_by || 'system',
        organization_id: currentBusinessOrg.id,
        supplier_name: `Otros Gastos Fijos / Software (${currentBusinessOrg.name})`,
        document_number: `FIJ-${monthPrefix}`,
        document_type: 'otro',
        category: 'otro',
        amount: otherFixed,
        issue_date: `${monthPrefix}-01`,
        due_date: endOfMonth,
        reminder_days_before: 3,
        expense_type: 'business',
        notes: 'Otros costos fijos mensuales (software SaaS, contabilidad externa, etc.).',
      });
      count++;
    }

    if (count > 0) {
      setSyncMessage(`¡Se cargaron ${count} compromiso(s) en Cuentas por Pagar y Flujo de Caja para este mes!`);
    } else {
      setSyncMessage('Todos los compromisos ya se encontraban creados para este período.');
    }

    setTimeout(() => setSyncMessage(null), 4000);
  };

  return (
    <AppLayout
      title="Costos Fijos & Sueldos de la Empresa"
      description="Controla la base de gastos fijos mensuales de tu negocio: sueldo empresarial, remuneraciones de equipo, arriendo, planes móviles y servicios básicos."
    >
      <div className="space-y-6">
        {/* Banner Superior */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl border border-indigo-900/40">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-200 border-blue-400/30 text-xs">
                🏢 {currentBusinessOrg?.name || 'Empresa Activa'}
              </Badge>
              {currentBusinessOrg?.rut && (
                <Badge className="bg-slate-700/60 text-slate-200 border-slate-600/30 text-xs font-mono">
                  RUT: {currentBusinessOrg.rut}
                </Badge>
              )}
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                Punto de Equilibrio: {formatCLP(dailyBreakEven)} / día
              </Badge>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-6 w-6 text-blue-400" />
              <span>Estructura de Costos Fijos & Sueldos</span>
            </h2>
            <p className="text-xs text-indigo-200/80 max-w-xl">
              Fija los gastos operacionales mínimos para que tu empresa funcione cada mes. Estos montos alimentan las proyecciones semanales del Flujo de Caja.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            <Button
              onClick={handleSyncToCurrentMonthDebts}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-semibold text-xs shadow-md"
              title="Genera los compromisos en Cuentas por Pagar para el mes actual"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Cargar a Cuentas por Pagar</span>
            </Button>
            <Link href="/flujo-de-caja">
              <Button
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 text-xs font-medium"
              >
                <Wallet className="h-4 w-4 text-emerald-400" />
                <span>Ver Flujo de Caja</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Notificaciones */}
        {syncMessage && (
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center gap-2 text-xs text-blue-950 dark:text-blue-200 font-medium animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        {isSaved && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-950 dark:text-emerald-200 font-medium animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>¡Configuración de costos fijos y sueldos guardada exitosamente!</span>
          </div>
        )}

        {/* Tarjetas KPI Resumen Superior */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Costos Fijos */}
          <Card className="p-4 border shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Compromiso Mensual
              </span>
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black font-mono text-blue-700 dark:text-blue-300 mt-2">
              {formatCLP(grandTotalFixedCosts)}
            </h3>
            <span className="text-[11px] text-muted-foreground block mt-1">
              Sueldos + Servicios indispensables
            </span>
          </Card>

          {/* 2. Sueldos & Nómina */}
          <Card className="p-4 border shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nómina & Remuneraciones
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center">
                <Briefcase className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
              {formatCLP(totalPayroll)}
            </h3>
            <span className="text-[11px] text-muted-foreground block mt-1">
              Dueño ({formatCLP(assignedSalary || 0)}) + Equipo ({formatCLP(totalTeamSalaries)})
            </span>
          </Card>

          {/* 3. Servicios & Conectividad */}
          <Card className="p-4 border shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Servicios & Fijos Base
              </span>
              <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
                <Home className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-2">
              {formatCLP(totalOperationalFixed)}
            </h3>
            <span className="text-[11px] text-muted-foreground block mt-1">
              Arriendo, móvil, internet, luz y agua
            </span>
          </Card>

          {/* 4. Meta Diaria de Cobertura */}
          <Card className="p-4 border shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cobertura Diaria Requerida
              </span>
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-2">
              {formatCLP(dailyBreakEven)}
            </h3>
            <span className="text-[11px] text-muted-foreground block mt-1">
              Venta diaria promedio para cubrir costos fijos
            </span>
          </Card>
        </div>

        {/* Selector de Empresa si hay múltiples */}
        {businessOrgs.length > 1 && (
          <div className="p-3.5 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-foreground">Gestionar Costos Fijos de la Empresa:</span>
            </div>
            <select
              value={targetOrgId}
              onChange={(e) => setActiveOrgId(e.target.value)}
              className="h-8 px-3 rounded-lg border border-input bg-background text-foreground text-xs"
            >
              {businessOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} {org.rut ? `(RUT: ${org.rut})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Formulario Principal de Configuración */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SECCIÓN 1: SERVICIOS Y GASTOS OPERACIONALES */}
            <Card className="border shadow-sm">
              <CardHeader className="py-4 border-b bg-muted/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-indigo-600" />
                    <div>
                      <CardTitle className="text-sm font-bold">1. Servicios Básicos & Gastos Operacionales</CardTitle>
                      <CardDescription className="text-xs">
                        Arriendos, conectividad, suministros y planes celulares.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                    {formatCLP(totalOperationalFixed)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 text-xs">
                {/* 1. Arriendo */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center justify-between text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Home className="h-4 w-4 text-amber-600" />
                      <span>Arriendo Oficina / Local / Bodega</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">Vence aprox. día 05</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                    <Input
                      type="number"
                      min="0"
                      value={rent || ''}
                      onChange={(e) => {
                        setRent(Number(e.target.value) || 0);
                        setIsSaved(false);
                      }}
                      placeholder="Ej: 450000"
                      className="pl-7 font-mono font-bold text-xs"
                    />
                  </div>
                </div>

                {/* 2. Telefonía Móvil / Mobile */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center justify-between text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-blue-600" />
                      <span>Telefonía Móvil / Plan Celular (Mobile)</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">Vence aprox. día 16</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                    <Input
                      type="number"
                      min="0"
                      value={mobile || ''}
                      onChange={(e) => {
                        setMobile(Number(e.target.value) || 0);
                        setIsSaved(false);
                      }}
                      placeholder="Ej: 19990"
                      className="pl-7 font-mono font-bold text-xs"
                    />
                  </div>
                </div>

                {/* 3. Internet & Conectividad */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center justify-between text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Wifi className="h-4 w-4 text-indigo-600" />
                      <span>Internet & Telecomunicaciones</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">Vence aprox. día 15</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                    <Input
                      type="number"
                      min="0"
                      value={internet || ''}
                      onChange={(e) => {
                        setInternet(Number(e.target.value) || 0);
                        setIsSaved(false);
                      }}
                      placeholder="Ej: 35000"
                      className="pl-7 font-mono font-bold text-xs"
                    />
                  </div>
                </div>

                {/* 4. Luz */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center justify-between text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      <span>Luz (Electricidad)</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">Vence aprox. día 18</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                    <Input
                      type="number"
                      min="0"
                      value={electricity || ''}
                      onChange={(e) => {
                        setElectricity(Number(e.target.value) || 0);
                        setIsSaved(false);
                      }}
                      placeholder="Ej: 40000"
                      className="pl-7 font-mono font-bold text-xs"
                    />
                  </div>
                </div>

                {/* 5. Agua Potable */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center justify-between text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Droplets className="h-4 w-4 text-cyan-600" />
                      <span>Agua Potable</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">Vence aprox. día 20</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                    <Input
                      type="number"
                      min="0"
                      value={water || ''}
                      onChange={(e) => {
                        setWater(Number(e.target.value) || 0);
                        setIsSaved(false);
                      }}
                      placeholder="Ej: 15000"
                      className="pl-7 font-mono font-bold text-xs"
                    />
                  </div>
                </div>

                {/* 6. Otros Fijos */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center justify-between text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Receipt className="h-4 w-4 text-slate-500" />
                      <span>Otros Gastos Fijos (Software SaaS, Alarmas, Contador)</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">Fin de mes</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                    <Input
                      type="number"
                      min="0"
                      value={otherFixed || ''}
                      onChange={(e) => {
                        setOtherFixed(Number(e.target.value) || 0);
                        setIsSaved(false);
                      }}
                      placeholder="Ej: 15000"
                      className="pl-7 font-mono font-bold text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓN 2: SUELDOS Y NÓMINA EMPRESARIAL */}
            <div className="space-y-6">
              {/* Sueldo Asignado Dueño */}
              <Card className="border shadow-sm">
                <CardHeader className="py-4 border-b bg-muted/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-blue-600" />
                      <div>
                        <CardTitle className="text-sm font-bold">2. Sueldo Asignado del Dueño / Socio</CardTitle>
                        <CardDescription className="text-xs">
                          Sueldo Patronal conforme al Art. 31 LIR (Deducible como gasto SII).
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                      Gasto Deducible
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-3 text-xs">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Asignación mensual formal que retiras por tu trabajo regular en la empresa. Se descuenta de las utilidades tributarias y pasa a tus finanzas personales.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">
                        Monto Líquido Mensual (CLP)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                        <Input
                          type="number"
                          min="0"
                          value={assignedSalary || ''}
                          onChange={(e) => {
                            setAssignedSalary(Number(e.target.value) || 0);
                            setIsSaved(false);
                          }}
                          placeholder="Ej: 1000000"
                          className="pl-7 font-mono font-bold text-sm"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground block">
                        {assignedSalary > 0 ? `${formatCLP(assignedSalary)} mensuales` : 'Sin sueldo asignado'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">
                        Día de Pago del Mes
                      </Label>
                      <div className="relative">
                        <Calendar className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
                        <select
                          value={paymentDay}
                          onChange={(e) => {
                            setPaymentDay(parseInt(e.target.value, 10));
                            setIsSaved(false);
                          }}
                          className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-foreground text-xs"
                        >
                          <option value={30}>Día 30 (Fin de mes estándar)</option>
                          <option value={28}>Día 28</option>
                          <option value={25}>Día 25</option>
                          <option value={5}>Día 5 (Mes siguiente)</option>
                        </select>
                      </div>
                      <span className="text-[10px] text-muted-foreground block">
                        Fecha que alimenta el Flujo de Caja
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Nómina de Colaboradores */}
              <Card className="border shadow-sm">
                <CardHeader className="py-4 border-b bg-muted/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-emerald-600" />
                      <div>
                        <CardTitle className="text-sm font-bold">3. Nómina de Empleados y Equipo</CardTitle>
                        <CardDescription className="text-xs">
                          Colaboradores contratados o personal de soporte clave.
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddEmployee}
                      className="text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      <Plus className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Agregar Colaborador</span>
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-3 text-xs">
                  {teamSalaries.length === 0 ? (
                    <div className="p-6 text-center border border-dashed rounded-xl text-muted-foreground space-y-1">
                      <p className="text-xs font-medium">No hay colaboradores registrados en la nómina.</p>
                      <p className="text-[11px]">Si tienes trabajadores o asistentes, agrégalos para proyectar sus pagos.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {teamSalaries.map((emp) => (
                        <div
                          key={emp.id}
                          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border"
                        >
                          <div className="flex-1 space-y-0.5">
                            <Input
                              placeholder="Nombre (ej: María González)"
                              value={emp.name}
                              onChange={(e) => handleUpdateEmployee(emp.id, 'name', e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="w-full sm:w-36 space-y-0.5">
                            <Input
                              placeholder="Rol (ej: Diseñador)"
                              value={emp.role}
                              onChange={(e) => handleUpdateEmployee(emp.id, 'role', e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="w-full sm:w-32 space-y-0.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1.5 text-muted-foreground text-xs font-mono">$</span>
                              <Input
                                type="number"
                                min="0"
                                placeholder="Líquido"
                                value={emp.amount || ''}
                                onChange={(e) => handleUpdateEmployee(emp.id, 'amount', Number(e.target.value))}
                                className="pl-6 h-8 text-xs font-mono font-semibold"
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveEmployee(emp.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                            title="Eliminar colaborador"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Barra de Guardado Inferior */}
          <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm sticky bottom-4 z-10 backdrop-blur-md bg-background/90">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Total Mensual Comprometido:</span>
              <span className="font-mono font-black text-sm text-blue-700 dark:text-blue-300">
                {formatCLP(grandTotalFixedCosts)}
              </span>
              <span className="hidden sm:inline text-[11px] text-muted-foreground">
                ({formatCLP(totalPayroll)} sueldos + {formatCLP(totalOperationalFixed)} fijos)
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleSyncToCurrentMonthDebts}
                className="gap-1.5 text-xs border-indigo-300 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>Cargar a Cuentas por Pagar</span>
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Guardar Costos Fijos</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
