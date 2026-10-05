'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/store/auth-context';
import { useReceipts } from '@/lib/store/receipts-context';
import { formatCLP } from '@/lib/utils';
import { EmployeeSalaryItem, Organization } from '@/types';
import {
  Briefcase,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  Building2,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Calendar,
  Sparkles,
  Home,
  Wifi,
  Lightbulb,
  Droplets,
  Receipt,
  Landmark,
  Smartphone,
} from 'lucide-react';

interface AssignSalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetOrgId?: string;
  onSuccess?: () => void;
  initialTab?: 'salaries' | 'fixed_costs';
}

export function AssignSalaryModal({
  isOpen,
  onClose,
  targetOrgId,
  onSuccess,
  initialTab = 'salaries',
}: AssignSalaryModalProps) {
  const { organizations, activeOrgId, activeOrg, updateOrganization } = useAuth();
  const { addDebt, updateDebt, deleteDebt, debts } = useReceipts();

  // Empresa seleccionada (solo empresas, no personal)
  const businessOrgs = organizations.filter((o) => o.type === 'business');
  const defaultOrgId =
    targetOrgId ||
    (activeOrg?.type === 'business' ? activeOrg.id : businessOrgs[0]?.id || '');

  const [selectedOrgId, setSelectedOrgId] = useState<string>(defaultOrgId);
  const [activeTab, setActiveTab] = useState<'salaries' | 'fixed_costs'>(initialTab);

  useEffect(() => {
    if (defaultOrgId) {
      setSelectedOrgId(defaultOrgId);
    }
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [defaultOrgId, initialTab, isOpen]);

  const currentOrg = organizations.find((o) => o.id === selectedOrgId);

  // Estados del Formulario: Sueldos
  const [assignedSalary, setAssignedSalary] = useState<number>(0);
  const [paymentDay, setPaymentDay] = useState<number>(30);
  const [teamSalaries, setTeamSalaries] = useState<EmployeeSalaryItem[]>([]);

  // Estados del Formulario: Gastos Fijos Operacionales
  const [rent, setRent] = useState<number>(0);
  const [internet, setInternet] = useState<number>(0);
  const [mobile, setMobile] = useState<number>(0);
  const [electricity, setElectricity] = useState<number>(0);
  const [water, setWater] = useState<number>(0);
  const [otherFixed, setOtherFixed] = useState<number>(0);

  // Sincronización a Cuentas por Pagar
  const [syncToCurrentMonthDebts, setSyncToCurrentMonthDebts] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cargar datos al abrir modal o cambiar empresa
  useEffect(() => {
    if (currentOrg) {
      const exp = currentOrg.monthly_expenses || {};
      setAssignedSalary(currentOrg.assigned_salary || exp.assigned_salary || 0);
      setTeamSalaries(currentOrg.team_salaries || []);
      setRent(exp.rent || 0);
      setInternet(exp.internet || 0);
      setMobile(exp.mobile || 0);
      setElectricity(exp.electricity || 0);
      setWater(exp.water || 0);
      setOtherFixed(exp.other_fixed || 0);
      setSuccessMessage(null);
    }
  }, [currentOrg, isOpen]);

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
  };

  const handleUpdateEmployee = (id: string, field: keyof EmployeeSalaryItem, value: any) => {
    setTeamSalaries((prev) =>
      prev.map((emp) => (emp.id === id ? { ...emp, [field]: value } : emp))
    );
  };

  const handleRemoveEmployee = (id: string) => {
    setTeamSalaries((prev) => prev.filter((emp) => emp.id !== id));
  };

  // Cálculos de Totales
  const totalTeamSalaries = teamSalaries.reduce((acc, emp) => acc + (emp.amount || 0), 0);
  const totalPayroll = (assignedSalary || 0) + totalTeamSalaries;
  const totalOperationalFixed =
    (rent || 0) + (internet || 0) + (mobile || 0) + (electricity || 0) + (water || 0) + (otherFixed || 0);
  const grandTotalFixedAndSalaries = totalPayroll + totalOperationalFixed;

  // Guardar y Aplicar
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;

    // 1. Actualizar organización en AuthContext
    const validTeam = teamSalaries.filter((emp) => emp.name.trim() && emp.amount > 0);

    updateOrganization(currentOrg.id, {
      name: currentOrg.name,
      legal_name: currentOrg.legal_name,
      rut: currentOrg.rut,
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
        assigned_salary: assignedSalary || 0, // Mantenido para retrocompatibilidad
      },
    });

    // 2. Generar o actualizar compromisos en Cuentas por Pagar si está marcado (UPSERT)
    if (syncToCurrentMonthDebts) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const monthPrefix = `${currentYear}-${currentMonth}`;
      const endOfMonth = new Date(currentYear, now.getMonth() + 1, 0).toISOString().split('T')[0];

      const syncItem = (
        matchingKeywords: string[],
        targetAmount: number,
        createData: {
          supplier_name: string;
          document_number: string;
          document_type: 'servicio' | 'otro';
          category: 'sueldo_empresarial' | 'arriendo' | 'servicios_basicos' | 'otro';
          issue_date: string;
          due_date: string;
          reminder_days_before: number;
          expense_type: 'business';
          notes: string;
        }
      ) => {
        const existing = debts.find((d) => {
          if (d.organization_id !== currentOrg.id) return false;
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
            }
          } else {
            if (existing.status !== 'paid') {
              deleteDebt(existing.id);
            }
          }
        } else if (targetAmount > 0) {
          addDebt({
            user_id: currentOrg.created_by || 'system',
            organization_id: currentOrg.id,
            ...createData,
            amount: targetAmount,
          });
        }
      };

      // A) Sueldo Asignado Dueño
      syncItem(
        ['Sueldo Asignado', 'Sueldo Patronal'],
        assignedSalary,
        {
          supplier_name: `Sueldo Asignado Dueño (${currentOrg.name})`,
          document_number: `SUELDO-${monthPrefix}`,
          document_type: 'otro',
          category: 'sueldo_empresarial',
          issue_date: `${monthPrefix}-01`,
          due_date: endOfMonth,
          reminder_days_before: 5,
          expense_type: 'business',
          notes: 'Remuneración empresarial mensual pactada para el dueño o socio.',
        }
      );

      // B) Sueldos Colaboradores
      validTeam.forEach((emp) => {
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
            notes: `Remuneración mensual del colaborador (${emp.role || 'Equipo'}).`,
          }
        );
      });

      // C) Gastos Fijos Operacionales
      syncItem(
        ['Arriendo'],
        rent,
        {
          supplier_name: `Arriendo Oficina / Local (${currentOrg.name})`,
          document_number: `ARR-${monthPrefix}`,
          document_type: 'otro',
          category: 'arriendo',
          issue_date: `${monthPrefix}-01`,
          due_date: `${monthPrefix}-05`,
          reminder_days_before: 3,
          expense_type: 'business',
          notes: 'Gasto fijo mensual de arriendo de oficinas o local comercial.',
        }
      );

      syncItem(
        ['Internet'],
        internet,
        {
          supplier_name: `Internet & Conectividad (${currentOrg.name})`,
          document_number: `INT-${monthPrefix}`,
          document_type: 'otro',
          category: 'servicios_basicos',
          issue_date: `${monthPrefix}-01`,
          due_date: `${monthPrefix}-15`,
          reminder_days_before: 3,
          expense_type: 'business',
          notes: 'Servicio mensual de internet y enlaces.',
        }
      );

      syncItem(
        ['Mobile', 'Celular', 'Móvil'],
        mobile,
        {
          supplier_name: `Telefonía Móvil / Mobile (${currentOrg.name})`,
          document_number: `MOB-${monthPrefix}`,
          document_type: 'otro',
          category: 'servicios_basicos',
          issue_date: `${monthPrefix}-01`,
          due_date: `${monthPrefix}-16`,
          reminder_days_before: 3,
          expense_type: 'business',
          notes: 'Plan celular y telefonía móvil de la empresa.',
        }
      );

      syncItem(
        ['Luz', 'Electricidad'],
        electricity,
        {
          supplier_name: `Luz / Electricidad (${currentOrg.name})`,
          document_number: `LUZ-${monthPrefix}`,
          document_type: 'otro',
          category: 'servicios_basicos',
          issue_date: `${monthPrefix}-01`,
          due_date: `${monthPrefix}-18`,
          reminder_days_before: 3,
          expense_type: 'business',
          notes: 'Gasto fijo de suministro eléctrico.',
        }
      );

      syncItem(
        ['Agua'],
        water,
        {
          supplier_name: `Agua Potable (${currentOrg.name})`,
          document_number: `AGUA-${monthPrefix}`,
          document_type: 'otro',
          category: 'servicios_basicos',
          issue_date: `${monthPrefix}-01`,
          due_date: `${monthPrefix}-20`,
          reminder_days_before: 3,
          expense_type: 'business',
          notes: 'Gasto fijo de agua potable.',
        }
      );

      syncItem(
        ['Otros Fijos', 'Otros Gastos Fijos', 'Software'],
        otherFixed,
        {
          supplier_name: `Otros Gastos Fijos / Software (${currentOrg.name})`,
          document_number: `FIJ-${monthPrefix}`,
          document_type: 'otro',
          category: 'otro',
          issue_date: `${monthPrefix}-01`,
          due_date: endOfMonth,
          reminder_days_before: 3,
          expense_type: 'business',
          notes: 'Otros costos fijos mensuales (software SaaS, contabilidad externa, etc.).',
        }
      );
    }

    setSuccessMessage('¡Costos fijos y sueldos guardados exitosamente! Se actualizaron Cuentas por Pagar y Flujo de Caja.');
    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 1200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Costos Fijos & Sueldos de la Empresa</span>
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  Empresa
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configura tu sueldo asignado como dueño, remuneraciones del equipo y servicios fijos mensuales (arriendo, luz, agua, internet).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2 text-xs">
          {/* Selector de Empresa si hay más de 1 */}
          {businessOrgs.length > 1 && (
            <div className="space-y-1 bg-muted/30 p-2.5 rounded-xl border border-border">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                <span>Empresa Destino</span>
              </Label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-foreground text-xs"
              >
                {businessOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} {org.rut ? `(RUT: ${org.rut})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Navegación por Pestañas */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('salaries')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-bold text-xs transition-all ${
                activeTab === 'salaries'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>Sueldos & Nómina ({formatCLP(totalPayroll)})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fixed_costs')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-bold text-xs transition-all ${
                activeTab === 'fixed_costs'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Servicios & Fijos ({formatCLP(totalOperationalFixed)})</span>
            </button>
          </div>

          {/* ============================================================== */}
          {/* PESTAÑA 1: SUELDOS & NÓMINA                                    */}
          {/* ============================================================== */}
          {activeTab === 'salaries' && (
            <div className="space-y-4">
              {/* Bloque 1: Sueldo Asignado del Dueño (Sueldo Patronal) */}
              <div className="p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/20 dark:bg-blue-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4 text-blue-600" />
                    <span>1. Sueldo Asignado del Dueño / Socio (Patronal)</span>
                  </span>
                  <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700 bg-blue-50">
                    Gasto Deducible SII
                  </Badge>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  El <strong>Sueldo Empresarial</strong> (Art. 31 LIR) es la asignación mensual que retiras formalmente por tu trabajo en la empresa. Se descuenta de las utilidades de la empresa como gasto aceptado y pasa a tu cuenta personal.
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
                        onChange={(e) => setAssignedSalary(Number(e.target.value) || 0)}
                        placeholder="Ej: 800000"
                        className="pl-7 font-mono font-bold text-sm"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      {assignedSalary > 0 ? `${formatCLP(assignedSalary)} mensuales` : 'Sin sueldo patronal'}
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
                        onChange={(e) => setPaymentDay(parseInt(e.target.value, 10))}
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-foreground text-xs"
                      >
                        <option value={30}>Día 30 (Fin de mes estándar)</option>
                        <option value={28}>Día 28</option>
                        <option value={25}>Día 25</option>
                        <option value={5}>Día 5 (Mes vencido)</option>
                        <option value={10}>Día 10</option>
                      </select>
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      Se proyectará en el Flujo de Caja en esa fecha.
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloque 2: Sueldos de Colaboradores / Empleados */}
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-emerald-600" />
                      <span>2. Sueldos de Empleados y Colaboradores</span>
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Registra remuneraciones de personal contratado o colaboradores clave.
                    </p>
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

                {teamSalaries.length === 0 ? (
                  <div className="p-5 text-center border border-dashed rounded-xl text-muted-foreground space-y-1">
                    <p className="text-xs">No hay colaboradores adicionales agregados a la nómina.</p>
                    <p className="text-[11px]">Si tienes empleados o asistentes, haz clic en &quot;+ Agregar Colaborador&quot;.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teamSalaries.map((emp, index) => (
                      <div
                        key={emp.id}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border"
                      >
                        <div className="flex-1 space-y-0.5">
                          <Input
                            placeholder="Nombre Completo (ej: Juan Soto)"
                            value={emp.name}
                            onChange={(e) => handleUpdateEmployee(emp.id, 'name', e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="w-full sm:w-36 space-y-0.5">
                          <Input
                            placeholder="Cargo / Rol (ej: Ventas)"
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
                              placeholder="Monto líquido"
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
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 2: SERVICIOS & GASTOS FIJOS OPERACIONALES              */}
          {/* ============================================================== */}
          {activeTab === 'fixed_costs' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Home className="h-4 w-4 text-amber-600" />
                    <span>Gastos Fijos Mensuales Base (Servicios & Arriendos)</span>
                  </span>
                  <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700 bg-amber-50">
                    Operación Pyme
                  </Badge>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Compromisos indispensables que tu negocio debe pagar cada mes independientemente de sus ventas. Se consideran en el cálculo del flujo de caja de semanas 1, 2 y 3.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Arriendo */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium flex items-center gap-1 text-foreground">
                      <Home className="h-3.5 w-3.5 text-amber-600" />
                      <span>Arriendo Oficina / Local / Bodega</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                      <Input
                        type="number"
                        min="0"
                        value={rent || ''}
                        onChange={(e) => setRent(Number(e.target.value) || 0)}
                        placeholder="Ej: 450000"
                        className="pl-7 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  {/* Telefonía Móvil / Mobile */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium flex items-center gap-1 text-foreground">
                      <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                      <span>Telefonía Móvil / Plan Celular (Mobile)</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                      <Input
                        type="number"
                        min="0"
                        value={mobile || ''}
                        onChange={(e) => setMobile(Number(e.target.value) || 0)}
                        placeholder="Ej: 19990"
                        className="pl-7 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  {/* Internet */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium flex items-center gap-1 text-foreground">
                      <Wifi className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Internet / Telecomunicaciones</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                      <Input
                        type="number"
                        min="0"
                        value={internet || ''}
                        onChange={(e) => setInternet(Number(e.target.value) || 0)}
                        placeholder="Ej: 35000"
                        className="pl-7 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  {/* Luz */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium flex items-center gap-1 text-foreground">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                      <span>Luz (Electricidad)</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                      <Input
                        type="number"
                        min="0"
                        value={electricity || ''}
                        onChange={(e) => setElectricity(Number(e.target.value) || 0)}
                        placeholder="Ej: 40000"
                        className="pl-7 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  {/* Agua */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium flex items-center gap-1 text-foreground">
                      <Droplets className="h-3.5 w-3.5 text-cyan-600" />
                      <span>Agua Potable</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                      <Input
                        type="number"
                        min="0"
                        value={water || ''}
                        onChange={(e) => setWater(Number(e.target.value) || 0)}
                        placeholder="Ej: 15000"
                        className="pl-7 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  {/* Otros Gastos Fijos */}
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs font-medium flex items-center gap-1 text-foreground">
                      <Receipt className="h-3.5 w-3.5 text-slate-500" />
                      <span>Otros Gastos Fijos (Software SaaS, Alarmas, Contador)</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">$</span>
                      <Input
                        type="number"
                        min="0"
                        value={otherFixed || ''}
                        onChange={(e) => setOtherFixed(Number(e.target.value) || 0)}
                        placeholder="Ej: 15000"
                        className="pl-7 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* RESUMEN GLOBAL CONSOLIDADO                                     */}
          {/* ============================================================== */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-teal-900/10 border border-blue-500/20 space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
              <span className="font-bold text-xs text-foreground">
                Resumen de Costos Fijos & Sueldos del Mes:
              </span>
              <span className="text-xl font-black font-mono text-blue-700 dark:text-blue-300">
                {formatCLP(grandTotalFixedAndSalaries)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
              <div>
                <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Sueldo Dueño:</span>
                <span className="font-bold text-foreground font-mono">{formatCLP(assignedSalary || 0)}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Nómina Equipo:</span>
                <span className="font-bold text-foreground font-mono">{formatCLP(totalTeamSalaries)}</span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Gastos Operacionales:</span>
                <span className="font-bold text-foreground font-mono">{formatCLP(totalOperationalFixed)}</span>
              </div>
            </div>
          </div>

          {/* Sincronización Automática a Cuentas por Pagar */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border">
            <input
              type="checkbox"
              id="syncDebts"
              checked={syncToCurrentMonthDebts}
              onChange={(e) => setSyncToCurrentMonthDebts(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="syncDebts" className="text-xs text-foreground cursor-pointer select-none">
              <span className="font-semibold block">
                Crear automáticamente los compromisos en Cuentas por Pagar de este mes
              </span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                Genera los registros para sueldos y servicios configurados en este mes, proyectándolos en el Flujo de Caja y evitando duplicidades.
              </span>
            </label>
          </div>

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Guardar Costos Fijos & Sueldos</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
