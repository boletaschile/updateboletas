'use client';

import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import { formatCLP, formatDateCL } from '@/lib/utils';
import { exportLibroVentasExcel, exportLibroVentasCSV, getSIISalesDocumentCode } from '@/lib/export-utils';
import { monthKeyOf } from '@/lib/month-utils';
import { ImportSalesModal } from '@/components/receivables/import-sales-modal';
import Link from 'next/link';
import {
  TrendingUp,
  FileSpreadsheet,
  Download,
  Building2,
  Calendar,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  Filter,
  FileText,
  UploadCloud,
  Clock,
  Briefcase,
} from 'lucide-react';

export default function LibroVentasPage() {
  const { receivables } = useReceipts();
  const { activeOrg, activeOrgId } = useAuth();

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const targetPeriodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Filtrar ventas emitidas por período tributario y filtros de empresa
  const libroVentas = useMemo(() => {
    return receivables.filter((r) => {
      if (r.issue_date) {
        const k = monthKeyOf(r.issue_date);
        if (k && k !== targetPeriodKey) return false;
      }
      const isPersonal = activeOrg?.type === 'personal' || activeOrgId === 'org-personal';
      if (isPersonal) {
        if (r.income_type !== 'personal') return false;
      } else {
        if (r.income_type === 'personal') return false;
        if (activeOrgId && activeOrgId !== 'all') {
          if (r.organization_id && r.organization_id !== activeOrgId) return false;
        }
      }
      if (docTypeFilter !== 'all' && r.document_type !== docTypeFilter) return false;
      return true;
    });
  }, [receivables, activeOrgId, activeOrg, docTypeFilter, targetPeriodKey]);

  // Cálculos Tributarios para Formulario F29 (Débito Fiscal)
  const totalDocumentos = libroVentas.length;
  const totalNeto = libroVentas.reduce((acc, r) => acc + (r.net_amount || 0), 0);
  const totalIVADebito = libroVentas.reduce((acc, r) => acc + (r.tax_amount || 0), 0);
  const totalGeneralBruto = libroVentas.reduce((acc, r) => acc + r.total_amount, 0);
  const totalCobrado = libroVentas
    .filter((r) => r.status === 'collected')
    .reduce((acc, r) => acc + (r.collected_amount || r.total_amount), 0);
  const totalPorCobrar = totalGeneralBruto - totalCobrado;

  return (
    <AppLayout
      title="Libro de Ventas Oficial (Registro RCV - SII)"
      description="Generación y exportación oficial del Libro de Ventas con IVA Débito Fiscal para declaración de impuestos F29 en Chile."
    >
      <div className="space-y-6">
        {/* Cabecera de la Empresa y Período */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl border border-emerald-900/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                Período Tributario: {monthNames[selectedMonth - 1]} {selectedYear}
              </Badge>
              <Badge className="bg-teal-500/20 text-teal-200 border-teal-400/30 text-xs">
                {activeOrg ? activeOrg.name : 'Vista Consolidada'}
              </Badge>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
              <span>Libro de Ventas & Débito Fiscal IVA</span>
            </h2>
            <p className="text-xs text-emerald-200/80 max-w-xl">
              {activeOrg?.rut ? `RUT Empresa: ${activeOrg.rut} • ` : ''}
              Estructura formal con desglose de facturas emitidas (33), facturas exentas (34), boletas (39) y cálculo automático del Débito Fiscal F29.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
            <Button
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-semibold text-xs shadow-md"
            >
              <UploadCloud className="h-4 w-4" />
              <span>+ Subir Facturas de Venta (CSV)</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportLibroVentasCSV(libroVentas, activeOrg, selectedMonth, selectedYear)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 text-xs"
            >
              <Download className="h-4 w-4" />
              <span>Exportar CSV (SII)</span>
            </Button>
            <Button
              size="sm"
              onClick={() => exportLibroVentasExcel(libroVentas, activeOrg, selectedMonth, selectedYear)}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2 font-semibold text-xs shadow-md"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Descargar Libro Excel (.xlsx)</span>
            </Button>
          </div>
        </div>

        {/* Resumen F29 - Débito Fiscal y Base Imponible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-emerald-600 shadow-sm">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Documentos Emitidos
            </span>
            <h3 className="text-2xl font-black text-foreground mt-1">{totalDocumentos}</h3>
            <span className="text-[11px] text-muted-foreground">Comprobantes de venta</span>
          </Card>

          <Card className="p-4 border-l-4 border-l-teal-600 shadow-sm">
            <span className="text-[10px] text-teal-700 dark:text-teal-400 uppercase font-bold tracking-wider">
              Monto Neto Total (Base Ventas)
            </span>
            <h3 className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">
              {formatCLP(totalNeto)}
            </h3>
            <span className="text-[11px] text-muted-foreground">Ingresos de empresa sin IVA</span>
          </Card>

          <Card className="p-4 border-l-4 border-l-blue-600 bg-blue-50/20 dark:bg-blue-950/20 shadow-sm">
            <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-bold tracking-wider flex items-center gap-1">
              <Calculator className="h-3.5 w-3.5" />
              <span>IVA Débito Fiscal (19% a Declarar)</span>
            </span>
            <h3 className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
              {formatCLP(totalIVADebito)}
            </h3>
            <span className="text-[11px] text-blue-600 font-medium">Línea Débito Fiscal Formulario F29</span>
          </Card>

          <Card className="p-4 border-l-4 border-l-amber-600 shadow-sm">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold tracking-wider">
              Total Facturado Bruto
            </span>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {formatCLP(totalGeneralBruto)}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Cobrado: {formatCLP(totalCobrado)}
            </span>
          </Card>
        </div>

        {/* Selector de Período y Filtros */}
        <Card className="p-4 shadow-sm border">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Mes:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="h-9 px-2.5 rounded-lg border border-input bg-background text-foreground text-xs"
                >
                  {monthNames.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Año:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="h-9 px-2.5 rounded-lg border border-input bg-background text-foreground text-xs"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Documento:</span>
                <select
                  value={docTypeFilter}
                  onChange={(e) => setDocTypeFilter(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-input bg-background text-foreground text-xs"
                >
                  <option value="all">Todos los comprobantes</option>
                  <option value="factura_afecta">Facturas Afectas (33)</option>
                  <option value="factura_exenta">Facturas Exentas (34)</option>
                  <option value="boleta_honorarios">Boletas Honorarios (39)</option>
                  <option value="cotizacion_aprobada">Cotizaciones Aprobadas</option>
                </select>
              </div>
            </div>

            <Badge variant="outline" className="text-xs bg-muted/40 font-medium">
              {libroVentas.length} ventas en el período
            </Badge>
          </div>
        </Card>

        {/* Tabla Oficial del Libro de Ventas */}
        <Card className="overflow-hidden shadow-sm border">
          <CardHeader className="py-3 px-4 bg-muted/40 border-b flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-foreground">
              Registro Detallado de Ventas del Período
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
                  <th className="px-3 py-3">RUT Cliente</th>
                  <th className="px-3 py-3">Razón Social Cliente</th>
                  <th className="px-3 py-3 text-right">Neto (CLP)</th>
                  <th className="px-3 py-3 text-right">IVA Débito 19%</th>
                  <th className="px-3 py-3 text-right">Total (CLP)</th>
                  <th className="px-3 py-3 text-center">Estado Cobro</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {libroVentas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="h-8 w-8 text-muted-foreground/40" />
                        <p className="font-semibold text-foreground">
                          No hay ventas ni facturas emitidas en {monthNames[selectedMonth - 1]} {selectedYear}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sube el archivo CSV/Excel de facturación mensual o registra tus ventas.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsImportModalOpen(true)}
                          className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                        >
                          <UploadCloud className="h-4 w-4 mr-1.5" />
                          Subir Facturas del Mes (CSV)
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  libroVentas.map((r, index) => {
                    const docCode = getSIISalesDocumentCode(r.document_type);
                    const isCollected = r.status === 'collected';

                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">{index + 1}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge variant="outline" className="font-mono text-[10px] bg-background">
                            {docCode === '33' ? 'Factura (33)' : docCode === '34' ? 'Exenta (34)' : docCode === '39' ? 'Boleta (39)' : docCode}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                          {r.invoice_number || 'S/N'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground font-medium">
                          {formatDateCL(r.issue_date)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">
                          {r.client_rut || '-'}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-foreground max-w-xs truncate" title={r.client_name}>
                          {r.client_name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-foreground font-semibold">
                          {formatCLP(r.net_amount || 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {formatCLP(r.tax_amount || 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-black text-foreground">
                          {formatCLP(r.total_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {isCollected ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-[10px]">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Cobrada
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-[10px]">
                              <Clock className="w-3 h-3 mr-1" /> Pendiente
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal de Importación de Facturas de Venta */}
        <ImportSalesModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
        />
      </div>
    </AppLayout>
  );
}
