'use client';

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import { formatCLP, formatDateCL } from '@/lib/utils';
import {
  parseSalesInvoicesFile,
  SalesInvoicesImportSummary,
} from '@/lib/invoices-import-utils';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  ArrowRight,
  TrendingUp,
  FileText,
  Sparkles,
} from 'lucide-react';

interface ImportSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SAMPLE_SALES_CSV = `Tipo Documento,Fecha,Numero,Emisor / Receptor,Rut,Neto,Exento,IVA,Otros impuestos,Total,Pagado,Impago
Factura electrónica emitida,11-09-2026,356,SOCIEDAD LEGAL Y DE COMUNICACIONES RADIO VIADUCTO LIMITADA,77.945.966-7,163607,0,31085,0,194692,0,194692
Factura electrónica emitida,14-09-2026,357,Comercial Sonnda SpA,77.749.784-7,27497,0,5224,0,32721,0,32721
Factura electrónica emitida,15-09-2026,358,COMERCIAL SERAFIN CHAVEZ Y COMPANIA LIMITADA,78.319.560-7,81869,0,15555,0,97424,97424,0
Factura electrónica emitida,17-09-2026,359,SERVICIOS MEDICOS PATRICIO PEREZ Y CIA LIMITADA,76.912.265-6,100000,0,19000,0,119000,0,119000
Factura electrónica emitida,24-09-2026,360,NUTRINGEN SPA,76.113.500-7,355001,0,67450,0,422451,422451,0
Factura electrónica emitida,24-09-2026,361,NUTRINGEN SPA,76.113.500-7,710002,0,134900,0,844902,0,844902
Factura electrónica emitida,25-09-2026,362,IMPORTADORA PACIFIC COLOR S.A.,77.525.500-5,550074,0,104514,0,654588,654588,0`;

export function ImportSalesModal({ isOpen, onClose, onSuccess }: ImportSalesModalProps) {
  const { addReceivable } = useReceipts();
  const { activeOrg, activeOrgId, organizations } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SalesInvoicesImportSummary | null>(null);
  const [targetOrgId, setTargetOrgId] = useState<string>(
    activeOrgId !== 'all' && activeOrgId !== 'org-personal' ? activeOrgId : 'org-empresa-1'
  );
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleProcessFile = async (selectedFile: File) => {
    setIsProcessing(true);
    setParseError(null);
    setFile(selectedFile);

    try {
      const res = await parseSalesInvoicesFile(selectedFile, selectedFile.name);
      setSummary(res);
    } catch (err: any) {
      setParseError(err.message || 'Error al procesar el archivo de facturas de venta.');
      setSummary(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSample = async () => {
    setIsProcessing(true);
    setParseError(null);
    setFile(null);
    try {
      const res = await parseSalesInvoicesFile(SAMPLE_SALES_CSV, 'Ejemplo_Facturas_Emitidas.csv');
      setSummary(res);
    } catch (err: any) {
      setParseError(err.message || 'Error al cargar ejemplo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!summary || summary.validRows === 0) return;

    setIsImporting(true);
    try {
      const validRows = summary.rows.filter((r) => r.isValid);

      for (const r of validRows) {
        addReceivable({
          organization_id: targetOrgId,
          client_name: r.clientName,
          client_rut: r.clientRut,
          service_description: `${r.documentType} N° ${r.invoiceNumber}`,
          document_type: 'factura_afecta',
          invoice_number: r.invoiceNumber,
          net_amount: r.netAmount,
          tax_amount: r.taxAmount,
          total_amount: r.totalAmount,
          issue_date: r.issueDate,
          due_date: r.issueDate,
          reminder_days_before: 5,
          income_type: 'business',
          status: r.status,
          collected_at: r.status === 'collected' ? r.issueDate : null,
          collected_amount: r.status === 'collected' ? (r.paidAmount || r.totalAmount) : (r.paidAmount > 0 ? r.paidAmount : null),
          payment_method: r.paidAmount > 0 || r.status === 'collected' ? 'Transferencia Bancaria' : null,
          notes: `Importada automáticamente desde ${summary.fileName}.`,
        });
      }

      setImportSuccess(true);
      setTimeout(() => {
        setImportSuccess(false);
        setSummary(null);
        setFile(null);
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      setParseError('Ocurrió un error al guardar las facturas en el sistema.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setSummary(null);
    setParseError(null);
    setImportSuccess(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Importar Facturas de Venta / Emitidas
              </DialogTitle>
              <DialogDescription className="text-xs">
                Carga el archivo mensual de facturas emitidas (CSV o Excel) para actualizar ventas, flujo de cobranza e IVA Débito de la empresa.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Selector de Empresa de Destino */}
          <div className="p-3 bg-muted/40 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-foreground">Empresa de destino:</span>
            </div>
            <select
              value={targetOrgId}
              onChange={(e) => setTargetOrgId(e.target.value)}
              className="h-9 px-3 rounded-lg border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-blue-500"
            >
              {organizations
                .filter((o) => o.type === 'business')
                .map((org) => (
                  <option key={org.id} value={org.id}>
                    🏢 {org.name} {org.rut ? `(${org.rut})` : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Zona de Arrastre de Archivo */}
          {!summary ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleProcessFile(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-border hover:border-blue-500 rounded-2xl p-8 text-center transition-all bg-muted/10 hover:bg-blue-50/20 flex flex-col items-center justify-center gap-3 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleProcessFile(e.target.files[0]);
                  }
                }}
              />
              <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Arrastra aquí tu archivo de facturas emitidas o haz clic para explorar
                </p>
                <p className="text-xs text-muted-foreground">
                  Soporta archivos <strong>.CSV</strong> y planillas <strong>Excel (.xlsx)</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" variant="outline" className="text-xs gap-1.5" type="button">
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>Seleccionar Archivo</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-blue-600 hover:bg-blue-50 gap-1.5"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoadSample();
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Cargar datos de ejemplo</span>
                </Button>
              </div>

              {/* Guía de columnas soportadas */}
              <div className="mt-4 pt-3 border-t border-border w-full text-left">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Columnas reconocidas automáticamente:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Tipo Documento',
                    'Fecha',
                    'Numero / Folio',
                    'Emisor / Receptor (Cliente)',
                    'RUT',
                    'Neto',
                    'IVA',
                    'Total',
                    'Pagado',
                    'Impago',
                  ].map((col) => (
                    <Badge key={col} variant="secondary" className="text-[10px] font-mono">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Vista Previa de Facturas Procesadas */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-blue-400 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                    📄 {summary.fileName}
                  </Badge>
                  <Badge variant="success" className="text-xs">
                    {summary.validRows} facturas listas
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleReset}>
                  Cambiar archivo
                </Button>
              </div>

              {/* Tarjetas de Resumen Financiero del Archivo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3 border-l-4 border-l-blue-500">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Ventas Facturadas</span>
                  <p className="text-lg font-bold text-foreground mt-0.5">{formatCLP(summary.totalAmount)}</p>
                  <span className="text-[10px] text-muted-foreground">Neto: {formatCLP(summary.totalNeto)}</span>
                </Card>

                <Card className="p-3 border-l-4 border-l-emerald-500">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold">Total Cobrado</span>
                  <p className="text-lg font-bold text-emerald-600 mt-0.5">{formatCLP(summary.totalPaid)}</p>
                  <span className="text-[10px] text-muted-foreground">Ingresos percibidos</span>
                </Card>

                <Card className="p-3 border-l-4 border-l-amber-500">
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold">Saldo por Cobrar</span>
                  <p className="text-lg font-bold text-amber-600 mt-0.5">{formatCLP(summary.totalUnpaid)}</p>
                  <span className="text-[10px] text-muted-foreground">Flujo pendiente</span>
                </Card>

                <Card className="p-3 border-l-4 border-l-indigo-500">
                  <span className="text-[10px] text-indigo-700 dark:text-indigo-400 uppercase font-semibold">IVA Débito (19%)</span>
                  <p className="text-lg font-bold text-indigo-600 mt-0.5">{formatCLP(summary.totalIva)}</p>
                  <span className="text-[10px] text-muted-foreground">A declarar en F29</span>
                </Card>
              </div>

              {/* Tabla de Facturas Listas para Carga */}
              <div className="border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground uppercase text-[10px] sticky top-0 border-b">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Folio</th>
                      <th className="px-3 py-2">Cliente / Receptor</th>
                      <th className="px-3 py-2 text-right">Neto</th>
                      <th className="px-3 py-2 text-right">IVA (19%)</th>
                      <th className="px-3 py-2 text-right">Total CLP</th>
                      <th className="px-3 py-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.rows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap font-medium">{formatDateCL(r.issueDate)}</td>
                        <td className="px-3 py-2 font-mono">{r.invoiceNumber}</td>
                        <td className="px-3 py-2">
                          <span className="font-semibold block truncate max-w-xs">{r.clientName}</span>
                          {r.clientRut && <span className="text-[10px] text-muted-foreground font-mono">RUT: {r.clientRut}</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatCLP(r.netAmount)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCLP(r.taxAmount)}</td>
                        <td className="px-3 py-2 text-right font-bold text-foreground font-mono">{formatCLP(r.totalAmount)}</td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant={r.status === 'collected' ? 'success' : 'warning'} className="text-[10px]">
                            {r.status === 'collected' ? 'Cobrada' : 'Pendiente'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parseError && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {importSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>¡Facturas de venta cargadas exitosamente al sistema de la empresa!</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isImporting}>
            Cancelar
          </Button>
          {summary && summary.validRows > 0 && (
            <Button
              size="sm"
              onClick={handleConfirmImport}
              disabled={isImporting || importSuccess}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold text-xs"
            >
              {isImporting ? (
                <span>Importando facturas...</span>
              ) : importSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>¡Listo!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirmar e Importar {summary.validRows} Facturas</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
