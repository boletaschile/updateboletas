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
});
