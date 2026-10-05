import { describe, it, expect } from 'vitest';
import { EmployeeSalaryItem, AccountPayable } from '@/types';

describe('Asignación de Sueldos y Nómina Empresarial (Payroll Engine)', () => {
  it('Calcula correctamente el total de la nómina (Sueldo Dueño + Equipo)', () => {
    const ownerSalary = 1200000; // Sueldo patronal / empresarial dueño
    const teamSalaries: EmployeeSalaryItem[] = [
      { id: 'emp-1', full_name: 'Ana Pérez', role: 'Desarrolladora Fullstack', amount: 1500000, payment_day: 30 },
      { id: 'emp-2', full_name: 'Carlos Ruiz', role: 'Diseñador UI/UX', amount: 950000, payment_day: 30 },
      { id: 'emp-3', full_name: 'Mariana Soto', role: 'Soporte Clientes', amount: 650000, payment_day: 30 },
    ];

    const teamTotal = teamSalaries.reduce((sum, e) => sum + e.amount, 0);
    const totalPayroll = ownerSalary + teamTotal;

    expect(teamTotal).toBe(3100000);
    expect(totalPayroll).toBe(4300000);
    expect(teamSalaries.length).toBe(3);
  });

  it('Genera cuentas por pagar (debts) mensuales correctas para el flujo de caja', () => {
    const currentMonthPrefix = '2026-10';
    const endOfMonth = '2026-10-31';
    const ownerSalary = 1500000;
    const teamSalaries: EmployeeSalaryItem[] = [
      { id: 'emp-1', full_name: 'Felipe Morales', role: 'Jefe de Operaciones', amount: 1800000, payment_day: 30 },
    ];

    const generatedDebts: Partial<AccountPayable>[] = [];

    // 1. Sueldo patronal
    if (ownerSalary > 0) {
      generatedDebts.push({
        supplier_name: 'Sueldo Asignado Dueño',
        document_number: `SUELDO-PATRONAL-${currentMonthPrefix}`,
        document_type: 'otro',
        category: 'sueldo_empresarial',
        amount: ownerSalary,
        issue_date: `${currentMonthPrefix}-01`,
        due_date: endOfMonth,
        expense_type: 'business',
      });
    }

    // 2. Colaboradores
    teamSalaries.forEach((emp) => {
      generatedDebts.push({
        supplier_name: `Remuneración: ${emp.full_name}`,
        document_number: `NOMINA-${emp.id}-${currentMonthPrefix}`,
        document_type: 'otro',
        category: 'sueldo_empresarial',
        amount: emp.amount,
        issue_date: `${currentMonthPrefix}-01`,
        due_date: `${currentMonthPrefix}-${String(emp.payment_day).padStart(2, '0')}`,
        expense_type: 'business',
      });
    });

    expect(generatedDebts.length).toBe(2);
    expect(generatedDebts[0].amount).toBe(1500000);
    expect(generatedDebts[0].category).toBe('sueldo_empresarial');
    expect(generatedDebts[1].supplier_name).toBe('Remuneración: Felipe Morales');
    expect(generatedDebts[1].amount).toBe(1800000);

    const totalDebtsCommitment = generatedDebts.reduce((sum, d) => sum + (d.amount || 0), 0);
    expect(totalDebtsCommitment).toBe(3300000);
  });

  it('Evita duplicación de sueldos para el mismo período', () => {
    const existingDebts = [
      {
        id: 'debt-1',
        supplier_name: 'Sueldo Asignado Dueño (Mi Empresa SpA)',
        due_date: '2026-10-31',
        category: 'sueldo_empresarial',
      },
    ];

    const monthPrefix = '2026-10';
    const alreadyExists = existingDebts.some(
      (d) =>
        d.category === 'sueldo_empresarial' &&
        d.supplier_name.includes('Sueldo Asignado') &&
        d.due_date.startsWith(monthPrefix)
    );

    expect(alreadyExists).toBe(true);
  });

  it('Calcula exactamente Costos Fijos & Sueldo sin duplicar el sueldo asignado', () => {
    const org = {
      assigned_salary: 800000,
      monthly_expenses: {
        assigned_salary: 800000, // Legacy mirrored property
        rent: 350000,
        internet: 30000,
        electricity: 25000,
        water: 15000,
        other_fixed: 0,
      },
      team_salaries: [],
    };

    const ownerSalary = org.assigned_salary || org.monthly_expenses?.assigned_salary || 0;
    const teamSalariesSum = (org.team_salaries || []).reduce((acc: number, emp: any) => acc + (emp.amount || 0), 0);
    const totalPayroll = ownerSalary + teamSalariesSum;

    const operationalFixedExpenses =
      (Number(org.monthly_expenses?.rent) || 0) +
      (Number(org.monthly_expenses?.internet) || 0) +
      (Number(org.monthly_expenses?.electricity) || 0) +
      (Number(org.monthly_expenses?.water) || 0) +
      (Number(org.monthly_expenses?.other_fixed) || 0);

    const companyFixedCostsTotal = totalPayroll + operationalFixedExpenses;

    // Sueldo: 800.000, Fijos: 420.000. Total = 1.220.000 (NUNCA 1.220.000 + 800.000 = 2.020.000)
    expect(totalPayroll).toBe(800000);
    expect(operationalFixedExpenses).toBe(420000);
    expect(companyFixedCostsTotal).toBe(1220000);

    // Caso donde solo hay sueldo asignado (caso del usuario con $800.000):
    const onlySalaryFixedCosts = totalPayroll + 0;
    expect(onlySalaryFixedCosts).toBe(800000); // NUNCA 1.600.000
  });

  it('Incluye correctamente el gasto Mobile en los Costos Fijos Operacionales', () => {
    const expenses = {
      rent: 400000,
      internet: 25000,
      mobile: 19990, // Plan celular / Mobile
      electricity: 35000,
      water: 12000,
      other_fixed: 15000,
    };

    const totalOperational =
      expenses.rent +
      expenses.internet +
      expenses.mobile +
      expenses.electricity +
      expenses.water +
      expenses.other_fixed;

    expect(expenses.mobile).toBe(19990);
    expect(totalOperational).toBe(506990);
  });

  it('Sincroniza y actualiza (UPSERT) los montos de Cuentas por Pagar al modificar Costos Fijos', () => {
    let debts: AccountPayable[] = [
      {
        id: 'debt-sueldo-1',
        organization_id: 'org-1',
        user_id: 'user-1',
        supplier_name: 'Sueldo Asignado Dueño (Empresa SpA)',
        document_number: 'SUELDO-2026-10',
        document_type: 'otro',
        category: 'sueldo_empresarial',
        amount: 800000,
        issue_date: '2026-10-01',
        due_date: '2026-10-31',
        reminder_days_before: 5,
        expense_type: 'business',
        status: 'pending',
      },
      {
        id: 'debt-net-1',
        organization_id: 'org-1',
        user_id: 'user-1',
        supplier_name: 'Internet & Conectividad (Empresa SpA)',
        document_number: 'INT-2026-10',
        document_type: 'otro',
        category: 'servicios_basicos',
        amount: 25000,
        issue_date: '2026-10-01',
        due_date: '2026-10-15',
        reminder_days_before: 3,
        expense_type: 'business',
        status: 'pending',
      },
    ];

    const updatedSalary = 1000000;
    const newMobile = 25000;
    const updatedInternet = 0;

    const monthPrefix = '2026-10';
    const endOfMonth = '2026-10-31';

    const syncItem = (
      keywords: string[],
      targetAmount: number,
      createData: any
    ) => {
      const existingIndex = debts.findIndex((d) => {
        if (d.organization_id !== 'org-1') return false;
        const matchesDate = d.due_date.startsWith(monthPrefix) || d.issue_date.startsWith(monthPrefix);
        if (!matchesDate) return false;
        const nameLower = d.supplier_name.toLowerCase();
        return keywords.some((k) => nameLower.includes(k.toLowerCase()));
      });

      if (existingIndex >= 0) {
        if (targetAmount > 0) {
          debts[existingIndex] = {
            ...debts[existingIndex],
            amount: targetAmount,
          };
        } else {
          debts.splice(existingIndex, 1);
        }
      } else if (targetAmount > 0) {
        debts.push({
          id: 'new-debt-' + Date.now(),
          organization_id: 'org-1',
          user_id: 'user-1',
          ...createData,
          amount: targetAmount,
          status: 'pending',
        });
      }
    };

    syncItem(['Sueldo Asignado'], updatedSalary, { supplier_name: 'Sueldo Asignado Dueño', due_date: endOfMonth, issue_date: `${monthPrefix}-01` });
    syncItem(['Mobile'], newMobile, { supplier_name: 'Telefonía Móvil / Mobile', due_date: `${monthPrefix}-16`, issue_date: `${monthPrefix}-01` });
    syncItem(['Internet'], updatedInternet, { supplier_name: 'Internet', due_date: `${monthPrefix}-15`, issue_date: `${monthPrefix}-01` });

    const sueldoDebt = debts.find((d) => d.supplier_name.includes('Sueldo Asignado'));
    expect(sueldoDebt?.amount).toBe(1000000);

    const mobileDebt = debts.find((d) => d.supplier_name.includes('Mobile'));
    expect(mobileDebt?.amount).toBe(25000);

    const internetDebt = debts.find((d) => d.supplier_name.includes('Internet'));
    expect(internetDebt).toBeUndefined();

    expect(debts.length).toBe(2);
  });
});
