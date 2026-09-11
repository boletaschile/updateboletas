'use client';

import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import { formatCLP, formatDateCL } from '@/lib/utils';
import { exportLibroComprasExcel, exportLibroComprasCSV, getSIIDocumentCode } from '@/lib/export-utils';
import {
  BookOpen,
  FileSpreadsheet,
  Download,
  Building2,
  Calendar,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  Filter,
  FileText,
} from 'lucide-react';

export default function LibroComprasPage() {
  const { receipts } = useReceipts();
  const { activeOrg, activeOrgId, organizations } = useAuth();

  const [selectedMonth, setSelectedMonth] = useState<number>(9);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Filtrar boletas y facturas
  const libroReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (r.status === 'rejected') return false;
      if (activeOrgId !== 'all') {
        if (activeOrgId === 'org-personal') {
          if (r.expense_type !== 'personal' && r.organization_id !== 'org-personal') return false;
        } else {
          if (r.organization_id && r.organization_id !== activeOrgId) return false;
        }
      }
      if (docTypeFilter !== 'all' && r.document_type !== docTypeFilter) return false;
      return true;
    });
  }, [receipts, activeOrgId, docTypeFilter]);

  // Cálculos Tributarios para Formulario F29
  const totalDocumentos = libroReceipts.length;
  const totalNeto = libroReceipts.reduce((acc, r) => acc + (r.expense_type !== 'personal' ? r.net_amount : 0), 0);
  const totalIVACredito = libroReceipts.reduce((acc, r) => acc + (r.expense_type !== 'personal' ? r.tax_amount : 0), 0);
  const totalEmpresaDeducible = libroReceipts.reduce((acc, r) => acc + r.business_total, 0);
  const totalGeneralBruto = libroReceipts.reduce((acc, r) => acc + r.total_amount, 0);

  return (
    <AppLayout
      title="Libro de Compras Oficial (Registro RCV - SII)"
      description="Generación y exportación oficial del Libro de Compras con IVA Crédito Fiscal para declaración de impuestos F29 en Chile."
    >
      <div className="space-y-6">
        {/* Cabecera de la Empresa y Período */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl border border-blue-900/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-200 border-blue-400/30 text-xs">
                Período Tributario: {monthNames[selectedMonth - 1]} {selectedYear}
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                {activeOrg ? activeOrg.name : 'Vista Consolidada'}
              </Badge>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-blue-400" />
              <span>Libro de Compras & Crédito Fiscal IVA</span>
            </h2>
            <p className="text-xs text-blue-200/80 max-w-xl">
              {activeOrg?.rut ? `RUT Empresa: ${activeOrg.rut} • ` : ''}
              Estructura formal con desglose de facturas (33), boletas (39), vouchers y cálculo automático del Crédito Fiscal F29.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportLibroComprasCSV(libroReceipts, activeOrg, selectedMonth, selectedYear)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 text-xs"
            >
              <Download className="h-4 w-4" />
              <span>Exportar CSV (SII)</span>
            </Button>
            <Button
              size="sm"
              onClick={() => exportLibroComprasExcel(libroReceipts, activeOrg, selectedMonth, selectedYear)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold text-xs shadow-md"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Descargar Libro Excel Oficial (.xlsx)</span>
            </Button>
          </div>
        </div>

        {/* Resumen F29 - Crédito Fiscal y Base Imponible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-blue-600">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Documentos en el Período
            </span>
            <h3 className="text-2xl font-black text-foreground mt-1">{totalDocumentos}</h3>
            <span className="text-[11px] text-muted-foreground">Comprobantes procesados</span>
          </Card>

          <Card className="p-4 border-l-4 border-l-indigo-600">
            <span className="text-[10px] text-indigo-700 dark:text-indigo-400 uppercase font-bold tracking-wider">
              Monto Neto Total (Base Imponible)
            </span>
            <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {formatCLP(totalNeto)}
            </h3>
            <span className="text-[11px] text-muted-foreground">Gastos de empresa sin IVA</span>
          </Card>

          <Card className="p-4 border-l-4 border-l-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/20">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-bold tracking-wider flex items-center gap-1">
              <Calculator className="h-3.5 w-3.5" />
              <span>IVA Crédito Fiscal (19% a Favor)</span>
            </span>
            <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
              {formatCLP(totalIVACredito)}
            </h3>
            <span className="text-[11px] text-emerald-600 font-medium">Línea Crédito Fiscal Formulario F29</span>
          </Card>

          <Card className="p-4 border-l-4 border-l-amber-600">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold tracking-wider">
              Total Bruto Contabilizado
            </span>
            <h3 className="text-2xl font-black text-foreground mt-1">
              {formatCLP(totalGeneralBruto)}
            </h3>
            <span className="text-[11px] text-muted-foreground">Empresa: {formatCLP(totalEmpresaDeducible)}</span>
          </Card>
        </div>

        {/* Filtros de Tipo de Documento y Período */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Mes:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="h-9 px-2.5 rounded-lg border border-input bg-background text-xs"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold">Año:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="h-9 px-2.5 rounded-lg border border-input bg-background text-xs"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Documento:</span>
                <select
                  value={docTypeFilter}
                  onChange={(e) => setDocTypeFilter(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="all">Todos los comprobantes</option>
                  <option value="factura">Facturas Electrónicas (33)</option>
                  <option value="boleta">Boletas Electrónicas (39)</option>
                  <option value="comprobante_transbank">Vouchers Transbank (48)</option>
                </select>
              </div>
            </div>

            <Badge variant="outline" className="text-xs bg-muted/40">
              {libroReceipts.length} registros en el libro
            </Badge>
          </div>
        </Card>

        {/* Tabla Oficial del Libro de Compras */}
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="py-3 px-4 bg-muted/40 border-b flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-foreground">
              Registro Detallado de Compras del Período
            </span>
            <span className="text-[11px] text-muted-foreground">
              Moneda: Pesos Chilenos (CLP) • Tasa IVA: 19%
            </span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-bold border-b">
                <tr>
                  <th className="px-3 py-3">N°</th>
                  <th className="px-3 py-3">Tipo Docto</th>
                  <th className="px-3 py-3">Folio</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">RUT Proveedor</th>
                  <th className="px-3 py-3">Razón Social</th>
                  <th className="px-3 py-3 text-right">Neto (CLP)</th>
                  <th className="px-3 py-3 text-right">IVA 19%</th>
                  <th className="px-3 py-3 text-right">Total (CLP)</th>
                  <th className="px-3 py-3">Tipo Compra</th>
                  <th className="px-3 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {libroReceipts.map((r, index) => {
                  const docCode = getSIIDocumentCode(r.document_type);
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant="outline" className="font-mono text-[10px] bg-background">
                          {docCode === '33' ? 'Factura (33)' : docCode === '48' ? 'Voucher (48)' : 'Boleta (39)'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold">{r.receipt_number || 'S/N'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatDateCL(r.document_date)}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">{r.merchant_rut || '-'}</td>
                      <td className="px-3 py-2.5 font-medium max-w-[200px] truncate" title={r.merchant_name}>
                        {r.merchant_legal_name || r.merchant_name}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {formatCLP(r.net_amount)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCLP(r.tax_amount)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-foreground">
                        {formatCLP(r.total_amount)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant={
                            r.expense_type === 'business'
                              ? 'info'
                              : r.expense_type === 'personal'
                              ? 'success'
                              : 'purple'
                          }
                          className="text-[9px]"
                        >
                          {r.expense_type === 'business'
                            ? 'Deducible'
                            : r.expense_type === 'personal'
                            ? 'Personal'
                            : 'Mixta'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge
                          variant={r.status === 'approved' ? 'success' : 'warning'}
                          className="text-[9px]"
                        >
                          {r.status === 'approved' ? 'Aprobado' : 'Revisión'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/80 font-bold border-t text-xs">
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-right uppercase">
                    Totales del Período:
                  </td>
                  <td className="px-3 py-3 text-right text-indigo-700 dark:text-indigo-300">
                    {formatCLP(totalNeto)}
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-300">
                    {formatCLP(totalIVACredito)}
                  </td>
                  <td className="px-3 py-3 text-right text-foreground">
                    {formatCLP(totalGeneralBruto)}
                  </td>
                  <td colSpan={2} className="px-3 py-3 text-right text-muted-foreground text-[11px]">
                    {libroReceipts.length} Documentos
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
