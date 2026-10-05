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
} from 'lucide-react';

interface AssignSalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetOrgId?: string;
  onSuccess?: () => void;
}

export function AssignSalaryModal({
  isOpen,
  onClose,
  targetOrgId,
  onSuccess,
}: AssignSalaryModalProps) {
  const { organizations, activeOrgId, activeOrg, updateOrganization } = useAuth();
  const { addDebt, debts } = useReceipts();

  // Empresa seleccionada (solo empresas, no personal)
  const businessOrgs = organizations.filter((o) => o.type === 'business');
  const defaultOrgId =
    targetOrgId ||
    (activeOrg?.type === 'business' ? activeOrg.id : businessOrgs[0]?.id || '');

  const [selectedOrgId, setSelectedOrgId] = useState<string>(defaultOrgId);

  useEffect(() => {
    if (defaultOrgId) {
      setSelectedOrgId(defaultOrgId);
    }
  }, [defaultOrgId, isOpen]);

  const currentOrg = organizations.find((o) => o.id === selectedOrgId);

  // Estados del Formulario
  const [assignedSalary, setAssignedSalary] = useState<number>(0);
  const [paymentDay, setPaymentDay] = useState<number>(30);
  const [syncToCurrentMonthDebts, setSyncToCurrentMonthDebts] = useState<boolean>(true);

  // Lista de Colaboradores / Equipo
  const [teamSalaries, setTeamSalaries] = useState<EmployeeSalaryItem[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cargar datos al abrir modal o cambiar empresa
  useEffect(() => {
    if (currentOrg) {
      setAssignedSalary(currentOrg.assigned_salary || currentOrg.monthly_expenses?.assigned_salary || 0);
      setTeamSalaries(currentOrg.team_salaries || []);
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

  // Cálculos de Totales de Nómina
  const totalTeamSalaries = teamSalaries.reduce((acc, emp) => acc + (emp.amount || 0), 0);
  const grandTotalPayroll = (assignedSalary || 0) + totalTeamSalaries;

  // Guardar y Aplicar
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;

    // 1. Actualizar organización en AuthContext
    const validTeam = teamSalaries.filter((emp) => emp.name.trim() && emp.amount > 0);
    const existingExpenses = currentOrg.monthly_expenses || {};

    updateOrganization(currentOrg.id, {
      name: currentOrg.name,
      legal_name: currentOrg.legal_name,
      rut: currentOrg.rut,
      type: 'business',
      assigned_salary: assignedSalary || 0,
      team_salaries: validTeam,
      monthly_expenses: {
        ...existingExpenses,
        assigned_salary: assignedSalary || 0,
      },
    });

    // 2. Generar compromisos en Cuentas por Pagar si está marcado
    if (syncToCurrentMonthDebts) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const monthPrefix = `${currentYear}-${currentMonth}`;
      const endOfMonth = new Date(currentYear, now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Helper para chequear si ya existe en este mes
      const alreadyExists = (snippet: string) => {
        return debts.some(
          (d) =>
            d.organization_id === currentOrg.id &&
            d.supplier_name.toLowerCase().includes(snippet.toLowerCase()) &&
            (d.due_date.startsWith(monthPrefix) || d.issue_date.startsWith(monthPrefix))
        );
      };

      // Sueldo Asignado Dueño
      if (assignedSalary > 0 && !alreadyExists('Sueldo Asignado')) {
        addDebt({
          user_id: currentOrg.created_by || 'system',
          organization_id: currentOrg.id,
          supplier_name: `Sueldo Asignado Dueño (${currentOrg.name})`,
          document_number: `SUELDO-${monthPrefix}`,
          document_type: 'otro',
          category: 'sueldo_empresarial',
          amount: assignedSalary,
          issue_date: `${monthPrefix}-01`,
          due_date: endOfMonth,
          reminder_days_before: 5,
          expense_type: 'business',
          notes: 'Remuneración empresarial mensual pactada para el dueño o socio.',
        });
      }

      // Sueldos Colaboradores
      validTeam.forEach((emp) => {
        const empSnippet = `Sueldo: ${emp.name}`;
        if (!alreadyExists(empSnippet)) {
          const empDueDate = `${monthPrefix}-${String(emp.payment_day || 30).padStart(2, '0')}`;
          addDebt({
            user_id: currentOrg.created_by || 'system',
            organization_id: currentOrg.id,
            supplier_name: `Sueldo: ${emp.name} (${emp.role || 'Colaborador'})`,
            document_number: `NOM-${monthPrefix}-${emp.name.replace(/\s+/g, '').substring(0, 5).toUpperCase()}`,
            document_type: 'otro',
            category: 'sueldo_empresarial',
            amount: emp.amount,
            issue_date: `${monthPrefix}-01`,
            due_date: empDueDate > endOfMonth ? endOfMonth : empDueDate,
            reminder_days_before: 3,
            expense_type: 'business',
            notes: `Remuneración mensual del colaborador (${emp.role || 'Equipo'}).`,
          });
        }
      });
    }

    setSuccessMessage('¡Sueldos asignados exitosamente! Se actualizaron Cuentas por Pagar y Flujo de Caja.');
    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 1200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Asignación de Sueldos & Remuneraciones</span>
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  Empresa
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Fija tu sueldo asignado como dueño y registra las remuneraciones de tu equipo para controlar el flujo de caja.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2 text-xs">
          {/* Selector de Empresa */}
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
              El <strong>Sueldo Empresarial</strong> (Art. 31 LIR) es la asignación mensual que retiras formalmente por tu trabajo en la empresa. Se descuenta de las ganancias de la empresa y pasa a tu cuenta personal.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-foreground">
                  Monto Líquido Mensual (CLP)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground text-xs font-mono">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="10000"
                    placeholder="1500000"
                    value={assignedSalary || ''}
                    onChange={(e) => setAssignedSalary(Number(e.target.value))}
                    className="pl-7 h-9 text-xs font-mono font-bold text-foreground"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {assignedSalary > 0 ? formatCLP(assignedSalary) + ' mensuales' : 'Sin sueldo asignado'}
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-foreground">
                  Día de Pago del Mes
                </Label>
                <div className="relative">
                  <Calendar className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                  <select
                    value={paymentDay}
                    onChange={(e) => setPaymentDay(parseInt(e.target.value, 10))}
                    className="w-full pl-8 h-9 rounded-lg border border-input bg-background text-foreground text-xs"
                  >
                    <option value={30}>Día 30 (Fin de mes estándar)</option>
                    <option value={5}>Día 5 del mes siguiente</option>
                    <option value={15}>Día 15 (Quincena)</option>
                    <option value={25}>Día 25</option>
                    <option value={28}>Día 28</option>
                  </select>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Se proyectará en el Flujo de Caja en esa fecha.
                </span>
              </div>
            </div>
          </div>

          {/* Bloque 2: Sueldos de Colaboradores / Equipo */}
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <span>2. Sueldos de Empleados y Colaboradores</span>
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Registra remuneraciones de personal contratado o colaboradores clave.
                </span>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddEmployee}
                className="h-7 text-[11px] gap-1 text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-50"
              >
                <Plus className="h-3 w-3" />
                <span>+ Agregar Colaborador</span>
              </Button>
            </div>

            {teamSalaries.length === 0 ? (
              <div className="p-4 rounded-lg bg-muted/30 border border-dashed text-center text-muted-foreground">
                <p className="text-[11px]">No hay colaboradores adicionales agregados a la nómina.</p>
                <p className="text-[10px] mt-0.5">
                  Si tienes empleados o asistentes, haz clic en "+ Agregar Colaborador".
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {teamSalaries.map((emp, index) => (
                  <div
                    key={emp.id}
                    className="p-2.5 rounded-lg border border-border/80 bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  >
                    <div className="flex-1 space-y-0.5">
                      <Input
                        placeholder="Nombre completo colaborador"
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
                          step="10000"
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

          {/* Resumen Total de Nómina */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-emerald-900/10 border border-blue-500/20 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Total Presupuesto Mensual de Remuneraciones:
              </span>
              <span className="text-[10px] text-muted-foreground">
                Sueldo dueño ({formatCLP(assignedSalary || 0)}) + Equipo ({formatCLP(totalTeamSalaries)})
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-black font-mono text-foreground block">
                {formatCLP(grandTotalPayroll)}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                Costo mensual fijo
              </span>
            </div>
          </div>

          {/* Opción de Sincronización Inmediata a Cuentas por Pagar */}
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
                Crear automáticamente los compromisos de pago en Cuentas por Pagar de este mes
              </span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                Aparecerán listados como compromisos pendientes a pagar a fin de mes y se proyectarán en el Flujo de Caja.
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
              <span>Guardar y Asignar Sueldos</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
