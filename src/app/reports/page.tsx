'use client';

import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useReceipts } from '@/lib/store/receipts-context';
import { formatCLP, formatDateCL } from '@/lib/utils';
import { exportExpensesToExcel, exportExpensesToCSV } from '@/lib/export-utils';
import { useAuth } from '@/lib/store/auth-context';
import { FileSpreadsheet, Download, Filter, Calendar, BarChart3, Building2, User } from 'lucide-react';

export default function ReportsPage() {
  const { receipts, categories, debts } = useReceipts();
  const { activeOrgId } = useAuth();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  const scopedPaidDebts = useMemo(() => {
    return debts.filter((d) => {
      if (d.status !== 'paid') return false;
      if (activeOrgId !== 'all') {
        if (activeOrgId === 'org-personal') {
          if (d.expense_type !== 'personal' && d.organization_id !== 'org-personal') return false;
        } else {
          if (d.organization_id && d.organization_id !== activeOrgId) return false;
        }
      }
      const paidDate = d.paid_at ? d.paid_at.split('T')[0] : d.due_date;
      if (dateFrom && paidDate < dateFrom) return false;
      if (dateTo && paidDate > dateTo) return false;
      if (selectedType !== 'all' && d.expense_type !== selectedType) return false;
      return true;
    });
  }, [debts, activeOrgId, dateFrom, dateTo, selectedType]);

  const paidDebtsBusiness = scopedPaidDebts
    .filter((d) => d.expense_type === 'business')
    .reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);

  const paidDebtsPersonal = scopedPaidDebts
    .filter((d) => d.expense_type === 'personal')
    .reduce((acc, d) => acc + (d.paid_amount || d.installment_amount || d.amount), 0);

  const totalPaidDebts = paidDebtsBusiness + paidDebtsPersonal;

  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      // Scoping por organización activa
      if (activeOrgId !== 'all') {
        if (activeOrgId === 'org-personal') {
          if (r.expense_type !== 'personal' && r.organization_id !== 'org-personal') return false;
        } else {
          if (r.organization_id && r.organization_id !== activeOrgId) return false;
        }
      }

      if (dateFrom && r.document_date && r.document_date < dateFrom) return false;
      if (dateTo && r.document_date && r.document_date > dateTo) return false;
      if (selectedType !== 'all' && r.expense_type !== selectedType) return false;
      if (selectedCategory !== 'all') {
        const hasCategory = (r.items || []).some((it) => it.category_name === selectedCategory);
        if (!hasCategory) return false;
      }
      return true;
    });
  }, [receipts, activeOrgId, dateFrom, dateTo, selectedCategory, selectedType]);

  const receiptsSpent = filteredReceipts.reduce((acc, r) => acc + r.total_amount, 0);
  const receiptsBusiness = filteredReceipts.reduce((acc, r) => acc + r.business_total, 0);
  const receiptsPersonal = filteredReceipts.reduce((acc, r) => acc + r.personal_total, 0);

  const totalFiltered = receiptsSpent + totalPaidDebts;
  const totalBusiness = receiptsBusiness + paidDebtsBusiness;
  const totalPersonal = receiptsPersonal + paidDebtsPersonal;
  const totalTax = filteredReceipts.reduce((acc, r) => acc + (r.tax_amount || 0), 0);

  return (
    <AppLayout
      title="Informes y Exportación Contable"
      description="Genera reportes tributarios y descarga en Excel multi-hoja con desglose por ítem y documento."
    >
      <div className="space-y-6">
        {/* Filtros del Reporte */}
        <Card>
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-600" />
              <span>Parámetros del Informe</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">Desde Fecha</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Hasta Fecha</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Ámbito de Gasto</Label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="h-10 w-full px-3 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="all">Todos los gastos</option>
                  <option value="business">Sólo Empresa</option>
                  <option value="personal">Sólo Personal</option>
                  <option value="mixed">Gastos Mixtos</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Categoría Específica</Label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-10 w-full px-3 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen Contable del Reporte */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Seleccionado</span>
            <h3 className="text-xl font-bold text-foreground mt-1">{formatCLP(totalFiltered)}</h3>
            <span className="text-[10px] text-muted-foreground">
              {totalPaidDebts > 0
                ? `${filteredReceipts.length} boletas + ${scopedPaidDebts.length} deudas pagadas`
                : `${filteredReceipts.length} documentos`}
            </span>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] text-blue-600 uppercase font-semibold">Gasto Empresa (Deducible)</span>
            <h3 className="text-xl font-bold text-blue-600 mt-1">{formatCLP(totalBusiness)}</h3>
            <span className="text-[10px] text-muted-foreground">
              {paidDebtsBusiness > 0
                ? `Boletas: ${formatCLP(receiptsBusiness)} • Cuotas: ${formatCLP(paidDebtsBusiness)}`
                : 'Base contable empresarial'}
            </span>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] text-emerald-600 uppercase font-semibold">Gasto Personal</span>
            <h3 className="text-xl font-bold text-emerald-600 mt-1">{formatCLP(totalPersonal)}</h3>
            <span className="text-[10px] text-muted-foreground">
              {paidDebtsPersonal > 0
                ? `Boletas: ${formatCLP(receiptsPersonal)} • Cuotas: ${formatCLP(paidDebtsPersonal)}`
                : 'Gastos particulares'}
            </span>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] text-purple-600 uppercase font-semibold">IVA / Impuestos Estimados</span>
            <h3 className="text-xl font-bold text-purple-600 mt-1">{formatCLP(totalTax)}</h3>
            <span className="text-[10px] text-muted-foreground">Crédito / Débito fiscal estimado</span>
          </Card>
        </div>

        {/* Acciones de Descarga */}
        <Card className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base">Descargar Archivos de Exportación</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Genera el archivo Excel oficial con hojas para boletas, detalle de productos y compromisos/deudas pagadas.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportExpensesToCSV(filteredReceipts)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5"
            >
              <Download className="h-4 w-4" />
              <span>Descargar CSV</span>
            </Button>
            <Button
              size="sm"
              onClick={() => exportExpensesToExcel(filteredReceipts, scopedPaidDebts)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-md"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Descargar Excel (.xlsx)</span>
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
