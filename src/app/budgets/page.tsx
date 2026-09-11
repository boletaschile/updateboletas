'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import { formatCLP } from '@/lib/utils';
import { PieChart, AlertTriangle, CheckCircle2, TrendingUp, Sparkles, Building2, User } from 'lucide-react';

export default function BudgetsPage() {
  const { receipts, budgets, updateBudget } = useReceipts();
  const { activeOrgId } = useAuth();

  const scopedReceipts = receipts.filter((r) => {
    if (r.status === 'rejected') return false;
    if (activeOrgId !== 'all') {
      if (activeOrgId === 'org-personal') {
        if (r.expense_type !== 'personal' && r.organization_id !== 'org-personal') return false;
      } else {
        if (r.organization_id && r.organization_id !== activeOrgId) return false;
      }
    }
    return true;
  });

  const totalSpent = scopedReceipts.reduce((acc, r) => acc + r.total_amount, 0);
  const totalBusiness = scopedReceipts.reduce((acc, r) => acc + r.business_total, 0);
  const totalPersonal = scopedReceipts.reduce((acc, r) => acc + r.personal_total, 0);

  const totalBudget = budgets.find((b) => b.budget_type === 'total') || { id: 'b-1', amount: 800000 };
  const businessBudget = budgets.find((b) => b.budget_type === 'business') || { id: 'b-2', amount: 500000 };
  const personalBudget = budgets.find((b) => b.budget_type === 'personal') || { id: 'b-3', amount: 300000 };

  const [totalAmountInput, setTotalAmountInput] = useState(totalBudget.amount);
  const [businessAmountInput, setBusinessAmountInput] = useState(businessBudget.amount);
  const [personalAmountInput, setPersonalAmountInput] = useState(personalBudget.amount);

  const handleSaveBudgets = () => {
    updateBudget({ id: totalBudget.id, amount: totalAmountInput });
    updateBudget({ id: businessBudget.id, amount: businessAmountInput });
    updateBudget({ id: personalBudget.id, amount: personalAmountInput });
    alert('Presupuestos actualizados con éxito.');
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-red-600';
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 75) return 'bg-amber-500';
    return 'bg-blue-600';
  };

  const calcPercent = (spent: number, budget: number) => Math.min(100, Math.round((spent / (budget || 1)) * 100));

  const totalPercent = calcPercent(totalSpent, totalBudget.amount);
  const businessPercent = calcPercent(totalBusiness, businessBudget.amount);
  const personalPercent = calcPercent(totalPersonal, personalBudget.amount);

  return (
    <AppLayout
      title="Presupuestos y Límites Mensuales"
      description="Configura umbrales de gasto y alertas automáticas (75%, 90% y 100%) para control preventivo."
    >
      <div className="space-y-6">
        {/* Observaciones Inteligentes */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span>Observaciones Financieras del Período:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-blue-900 dark:text-blue-300 pl-2">
            <li>El presupuesto total presenta un consumo del {totalPercent}% con {formatCLP(Math.max(0, totalBudget.amount - totalSpent))} disponible.</li>
            <li>El gasto empresarial se mantiene controlado en {formatCLP(totalBusiness)} ({businessPercent}% del límite).</li>
            <li>Se han procesado {receipts.length} comprobantes en el mes en curso.</li>
          </ul>
        </div>

        {/* Tarjetas de Presupuesto con Barras de Progreso */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Presupuesto Total */}
          <Card>
            <CardHeader className="py-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Presupuesto Global</CardTitle>
                <Badge variant={totalPercent >= 90 ? 'destructive' : totalPercent >= 75 ? 'warning' : 'info'}>
                  {totalPercent}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Gastado: {formatCLP(totalSpent)}</span>
                  <span>Límite: {formatCLP(totalBudget.amount)}</span>
                </div>
                <Progress value={totalPercent} indicatorColor={getProgressColor(totalPercent)} />
              </div>
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs">Editar Límite Mensual (CLP)</Label>
                <Input
                  type="number"
                  value={totalAmountInput}
                  onChange={(e) => setTotalAmountInput(parseInt(e.target.value) || 0)}
                  className="text-xs font-semibold"
                />
              </div>
            </CardContent>
          </Card>

          {/* Presupuesto Empresa */}
          <Card>
            <CardHeader className="py-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span>Presupuesto Empresa</span>
                </CardTitle>
                <Badge variant={businessPercent >= 90 ? 'destructive' : businessPercent >= 75 ? 'warning' : 'info'}>
                  {businessPercent}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Gastado: {formatCLP(totalBusiness)}</span>
                  <span>Límite: {formatCLP(businessBudget.amount)}</span>
                </div>
                <Progress value={businessPercent} indicatorColor={getProgressColor(businessPercent)} />
              </div>
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs">Editar Límite Empresa (CLP)</Label>
                <Input
                  type="number"
                  value={businessAmountInput}
                  onChange={(e) => setBusinessAmountInput(parseInt(e.target.value) || 0)}
                  className="text-xs font-semibold"
                />
              </div>
            </CardContent>
          </Card>

          {/* Presupuesto Personal */}
          <Card>
            <CardHeader className="py-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <User className="h-4 w-4 text-emerald-600" />
                  <span>Presupuesto Personal</span>
                </CardTitle>
                <Badge variant={personalPercent >= 90 ? 'destructive' : personalPercent >= 75 ? 'warning' : 'info'}>
                  {personalPercent}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Gastado: {formatCLP(totalPersonal)}</span>
                  <span>Límite: {formatCLP(personalBudget.amount)}</span>
                </div>
                <Progress value={personalPercent} indicatorColor={getProgressColor(personalPercent)} />
              </div>
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs">Editar Límite Personal (CLP)</Label>
                <Input
                  type="number"
                  value={personalAmountInput}
                  onChange={(e) => setPersonalAmountInput(parseInt(e.target.value) || 0)}
                  className="text-xs font-semibold"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveBudgets} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Guardar Configuración de Presupuestos</span>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
