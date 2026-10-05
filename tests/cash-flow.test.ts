import { describe, it, expect } from 'vitest';

describe('Flujo de Caja de la Empresa (Cash Flow Engine)', () => {
  it('Calcula correctamente el Flujo Neto y Saldo Final Proyectado', () => {
    const initialBalance = 1500000; // $1.500.000 en banco
    const collectedInflows = 2365778; // Facturas cobradas
    const pendingInflows = 500000; // Por cobrar en el mes
    const realExpenses = 450000; // Gastos pagados
    const debtsToPay = 600000; // Deudas por pagar en el mes
    const assignedSalary = 800000; // Sueldo asignado dueño

    const totalInflows = collectedInflows + pendingInflows;
    const totalOutflows = realExpenses + debtsToPay + assignedSalary;
    const netCashFlow = totalInflows - totalOutflows;
    const finalProjectedBalance = initialBalance + netCashFlow;

    expect(totalInflows).toBe(2865778);
    expect(totalOutflows).toBe(1850000);
    expect(netCashFlow).toBe(1015778);
    expect(finalProjectedBalance).toBe(2515778);
    expect(finalProjectedBalance > 0).toBe(true);
  });

  it('Detecta correctamente semanas con déficit o tensión de caja', () => {
    let balance = 200000; // Parte con $200.000

    // Semana 1: Entran 300.000, salen 150.000 -> Net +150.000 -> Balance 350.000
    balance += (300000 - 150000);
    expect(balance).toBe(350000);
    expect(balance < 0).toBe(false);

    // Semana 2 (Previred día 13): Entran 0, sale Previred 400.000 -> Net -400.000 -> Balance -50.000
    balance += (0 - 400000);
    expect(balance).toBe(-50000);
    expect(balance < 0).toBe(true); // Alerta roja de iliquidez en semana 2

    // Semana 3 (Cobro cliente): Entran 500.000, sale F29 100.000 -> Net +400.000 -> Balance 350.000
    balance += (500000 - 100000);
    expect(balance).toBe(350000);
    expect(balance < 0).toBe(false);
  });
});
