'use client';

import React, { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import { formatCLP, formatDateCL } from '@/lib/utils';
import { currentMonthKey, defaultDateForMonth, formatMonthLabel } from '@/lib/month-utils';
import {
  parseExpensesExcelFile,
  downloadExpensesTemplateExcel,
  ExcelImportSummary,
  ParsedExpenseRow,
} from '@/lib/excel-import-utils';
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Building2,
  User,
  Sparkles,
  Layers,
  FileCheck,
} from 'lucide-react';

export default function ImportExcelPage() {
  const router = useRouter();
  const { addReceipt } = useReceipts();
  const { activeOrg, activeOrgId, organizations } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ExcelImportSummary | null>(null);
  const [fallbackMonth, setFallbackMonth] = useState<string>(currentMonthKey());
  const [targetOrgId, setTargetOrgId] = useState<string>(activeOrgId !== 'all' ? activeOrgId : 'org-personal');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);

  const handleProcessFile = async (selectedFile: File) => {
    setIsProcessing(true);
    setParseError(null);
    setFile(selectedFile);

    try {
      const result = await parseExpensesExcelFile(selectedFile, fallbackMonth);
      setSummary(result);
    } catch (err: any) {
      setParseError(err.message || 'Error al procesar el archivo Excel.');
      setSummary(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Confirmar e importar todas las filas válidas
  const handleConfirmImport = async () => {
    if (!summary || summary.validRows === 0) return;

    setIsImporting(true);
    setImportProgress(0);

    const validRows = summary.rows.filter((r) => r.isValid);
    let count = 0;

    for (const r of validRows) {
      const netAmount = r.netAmount !== undefined ? r.netAmount : Math.round(r.totalAmount / 1.19);
      const taxAmount = r.taxAmount !== undefined ? r.taxAmount : Math.round((r.totalAmount * 0.19) / 1.19);
      const isBusiness = r.expenseType === 'business';
      const isPersonal = r.expenseType === 'personal';

      addReceipt({
        organization_id: targetOrgId !== 'all' ? targetOrgId : (isPersonal ? 'org-personal' : 'org-empresa-1'),
        merchant_name: r.merchantName,
        merchant_rut: r.merchantRut || null,
        receipt_number: r.receiptNumber || `IMP-${Math.floor(100000 + Math.random() * 900000)}`,
        document_type: r.documentType,
        document_date: r.date,
        document_time: '12:00',
        currency: 'CLP',
        subtotal: r.totalAmount,
        discount: 0,
        net_amount: netAmount,
        tax_amount: taxAmount,
        tip: 0,
        total_amount: r.totalAmount,
        business_total: isBusiness ? r.totalAmount : r.expenseType === 'mixed' ? Math.round(r.totalAmount / 2) : 0,
        personal_total: isPersonal ? r.totalAmount : r.expenseType === 'mixed' ? Math.round(r.totalAmount / 2) : 0,
        expense_type: r.expenseType,
        payment_method: r.paymentMethod,
        category_name: r.categoryName,
        notes: r.notes || `Importado desde planilla Excel: ${summary.fileName}`,
        purchase_summary: r.notes || `Gasto en ${r.merchantName} (${r.categoryName})`,
        status: 'approved',
        ocr_confidence: 1.0,
        ai_confidence: 1.0,
        requires_human_review: false,
        file_name: summary.fileName,
        items: [
          {
            original_name: r.notes || `Gasto ${r.categoryName}`,
            normalized_name: r.notes || `Gasto ${r.categoryName}`,
            quantity: 1,
            unit: 'unidad',
            unit_price: r.totalAmount,
            discount: 0,
            line_total: r.totalAmount,
            category_name: r.categoryName,
            expense_type: r.expenseType,
            business_percentage: isBusiness ? 100 : r.expenseType === 'mixed' ? 50 : 0,
            personal_percentage: isPersonal ? 100 : r.expenseType === 'mixed' ? 50 : 0,
            confidence: 1.0,
            requires_review: false,
          },
        ] as any,
      });

      count++;
      setImportProgress(Math.round((count / validRows.length) * 100));
    }

    setIsImporting(false);
    setImportSuccess(true);

    setTimeout(() => {
      router.push('/receipts');
    }, 1800);
  };

const SAMPLE_SII_RCV = `Nro;Tipo Compra;RUT Proveedor;Razon Social;Folio;Fecha Docto;Fecha Recepcion;Fecha Acuse;Monto Exento;Monto Neto;Monto IVA Recuperable;Monto Iva No Recuperable;Codigo IVA No Rec.;Monto Total;Monto Neto Activo Fijo;IVA Activo Fijo;IVA uso Comun;Impto. Sin Derecho a Credito;IVA No Retenido;Tabacos Puros;Tabacos Cigarrillos;Tabacos Elaborados;NCE o NDE sobre Fact. de Compra;Codigo Otro Impuesto;Valor Otro Impuesto;Tasa Otro Impuesto
1;Del Giro;76399932-7;Koywe Billing SpA;41538;31/08/2026;01/09/2026 09:19:46;;0;9860;1873;;;11733;;;;;0;;;;0;;;;
2;Del Giro;78921690-8;WOM S.A.;18504315;16/09/2026;18/09/2026 05:03:06;;0;20963;3983;;;24946;;;;;0;;;;0;;;;
3;Del Giro;90635000-9;Telefonica Chile S.A;55094424;19/09/2026;20/09/2026 18:41:59;;0;10087;1917;;;12004;;;;;0;;;;0;;;;`;

  const handleLoadSiiSample = () => {
    const blob = new Blob([SAMPLE_SII_RCV], { type: 'text/csv;charset=utf-8;' });
    const sampleFile = new File([blob], 'RCV_Facturas_Compra_SII.csv', { type: 'text/csv' });
    handleProcessFile(sampleFile);
  };

  return (
    <AppLayout
      title="Importación por Planilla Excel & RCV SII"
      description="Carga tus facturas de compra y boletas masivamente mediante archivo RCV del SII, Excel o CSV con validación instantánea."
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Cabecera de Navegación y Descarga de Plantilla */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link href="/receipts">
            <Button variant="ghost" size="sm" className="gap-2 text-xs">
              <ArrowLeft className="h-4 w-4" />
              <span>Volver a Mis Boletas</span>
            </Button>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadSiiSample}
              className="gap-1.5 text-xs border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Cargar Ejemplo RCV SII</span>
            </Button>
            <Button
              onClick={downloadExpensesTemplateExcel}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md"
            >
              <Download className="h-4 w-4" />
              <span>Descargar Plantilla Excel Oficial (.xlsx)</span>
            </Button>
          </div>
        </div>

        {/* Banner Explicativo */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-emerald-800/40 shadow-lg">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                Importador Masivo
              </Badge>
              <Badge className="bg-blue-500/20 text-blue-200 border-blue-400/30 text-xs">
                Formatos .xlsx, .xls y .csv
              </Badge>
              <Badge className="bg-amber-500/20 text-amber-200 border-amber-400/30 text-xs">
                🇨🇱 Registro RCV oficial del SII
              </Badge>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-emerald-400" />
              <span>Sube tus Facturas de Compra o Boletas en segundos</span>
            </h2>
            <p className="text-xs text-emerald-100/80 max-w-2xl leading-relaxed">
              Compatible con el archivo descargado directamente del <strong>Registro de Compras RCV del SII de Chile</strong> (separado por punto y coma o coma) o con nuestra plantilla Excel oficial. Las facturas se registrarán con su Folio, Razón Social, RUT, Neto e IVA Crédito Fiscal.
            </p>
          </div>
        </div>

        {/* Tarjeta de Opciones y Zona de Carga */}
        {!importSuccess && (
          <Card>
            <CardHeader className="p-4 sm:p-6 border-b bg-muted/20">
              <CardTitle className="text-base flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-emerald-600" />
                <span>Paso 1: Selecciona o Arrastra tu Planilla</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Sube el archivo Excel con tus boletas y comprobantes.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Selectores de Período y Organización por defecto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold block">
                    Mes por Defecto (si faltan fechas en filas)
                  </label>
                  <input
                    type="month"
                    value={fallbackMonth}
                    onChange={(e) => setFallbackMonth(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs font-medium"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Período: {formatMonthLabel(fallbackMonth)}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold block">
                    Empresa / Destino de los Gastos
                  </label>
                  <select
                    value={targetOrgId}
                    onChange={(e) => setTargetOrgId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs font-medium"
                  >
                    <option value="org-personal">Finanzas Personales</option>
                    {organizations
                      .filter((o) => o.type === 'business')
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} {o.rut ? `(${o.rut})` : ''}
                        </option>
                      ))}
                    {organizations.length === 0 && (
                      <option value="org-empresa-1">Mi Empresa Principal (SpA)</option>
                    )}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Los gastos se registrarán bajo esta cuenta.
                  </p>
                </div>
              </div>

              {/* Zona Drag and Drop */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] ${
                  file
                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-muted-foreground/30 hover:border-emerald-500 hover:bg-muted/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center mb-3">
                  <FileSpreadsheet className="h-7 w-7" />
                </div>

                <p className="text-sm font-semibold text-foreground">
                  {file ? file.name : 'Haz clic para seleccionar o arrastra tu archivo Excel aquí'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Formatos soportados: Microsoft Excel (.xlsx, .xls) o archivo separado por comas (.csv)
                </p>

                {file && (
                  <Badge variant="outline" className="mt-3 text-xs bg-emerald-50 text-emerald-700 border-emerald-300">
                    Archivo cargado • {(file.size / 1024).toFixed(1)} KB
                  </Badge>
                )}
              </div>

              {parseError && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">No se pudo leer la planilla</p>
                    <p>{parseError}</p>
                    <p className="mt-1 text-[11px]">
                      Tip: Te recomendamos pulsar <strong>"Descargar Plantilla Excel Oficial"</strong> arriba y pegar tus datos en ella.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Previsualización de Datos Parseados */}
        {summary && !importSuccess && (
          <div className="space-y-4">
            {/* KPIs del Resumen de Importación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 border-l-4 border-l-emerald-600">
                <p className="text-xs text-muted-foreground font-medium">Boletas Detectadas</p>
                <h3 className="text-2xl font-bold text-foreground mt-0.5">{summary.validRows}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {summary.invalidRows > 0 ? `${summary.invalidRows} con errores ignoradas` : '100% filas válidas'}
                </p>
              </Card>

              <Card className="p-4 border-l-4 border-l-blue-600">
                <p className="text-xs text-muted-foreground font-medium">Monto Total a Importar</p>
                <h3 className="text-2xl font-bold text-blue-600 mt-0.5">{formatCLP(summary.totalAmount)}</h3>
                <p className="text-[11px] text-muted-foreground">Suma en pesos chilenos</p>
              </Card>

              <Card className="p-4 border-l-4 border-l-indigo-600">
                <p className="text-xs text-muted-foreground font-medium">Gastos de Empresa</p>
                <h3 className="text-2xl font-bold text-indigo-600 mt-0.5">{formatCLP(summary.businessAmount)}</h3>
                <p className="text-[11px] text-muted-foreground">Deducibles tributarios</p>
              </Card>

              <Card className="p-4 border-l-4 border-l-teal-600">
                <p className="text-xs text-muted-foreground font-medium">Gastos Personales</p>
                <h3 className="text-2xl font-bold text-teal-600 mt-0.5">{formatCLP(summary.personalAmount)}</h3>
                <p className="text-[11px] text-muted-foreground">Particulares</p>
              </Card>
            </div>

            {/* Tabla Preview de Filas */}
            <Card className="overflow-hidden">
              <CardHeader className="p-4 bg-muted/30 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-emerald-600" />
                    <span>Paso 2: Previsualización de Filas a Importar ({summary.validRows} registros)</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Revisa los datos leídos de tu planilla antes de confirmar la inserción.
                  </CardDescription>
                </div>
              </CardHeader>

              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] font-semibold sticky top-0 border-b">
                    <tr>
                      <th className="px-3 py-2.5">Fila</th>
                      <th className="px-3 py-2.5">Fecha</th>
                      <th className="px-3 py-2.5">Comercio / Emisor</th>
                      <th className="px-3 py-2.5">RUT</th>
                      <th className="px-3 py-2.5">N° Doc</th>
                      <th className="px-3 py-2.5">Ámbito</th>
                      <th className="px-3 py-2.5">Categoría</th>
                      <th className="px-3 py-2.5 text-right">Monto CLP</th>
                      <th className="px-3 py-2.5 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.rows.map((r) => (
                      <tr
                        key={r.rowNumber}
                        className={`transition-colors ${
                          !r.isValid ? 'bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-muted/30'
                        }`}
                      >
                        <td className="px-3 py-2 text-muted-foreground font-mono">{r.rowNumber}</td>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{formatDateCL(r.date)}</td>
                        <td className="px-3 py-2 font-semibold text-foreground">
                          {r.merchantName}
                          {r.notes && (
                            <span className="block text-[10px] text-muted-foreground font-normal truncate max-w-xs">
                              {r.notes}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.merchantRut || '-'}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.receiptNumber || '-'}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={
                              r.expenseType === 'business'
                                ? 'info'
                                : r.expenseType === 'personal'
                                ? 'success'
                                : 'purple'
                            }
                            className="text-[10px]"
                          >
                            {r.expenseType === 'business' ? 'Empresa' : r.expenseType === 'personal' ? 'Personal' : 'Mixto'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.categoryName}</td>
                        <td className="px-3 py-2 text-right font-bold text-foreground">
                          {formatCLP(r.totalAmount)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-[11px] font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Válido</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive text-[11px] font-medium" title={r.errors.join(', ')}>
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>Error</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pie de confirmación */}
              <CardFooter className="p-4 bg-muted/20 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-muted-foreground">
                  Se importarán <strong>{summary.validRows}</strong> boletas válidas por un total de{' '}
                  <strong className="text-foreground">{formatCLP(summary.totalAmount)}</strong>.
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setSummary(null);
                    }}
                    className="text-xs"
                    disabled={isImporting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmImport}
                    disabled={summary.validRows === 0 || isImporting}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md"
                  >
                    {isImporting ? (
                      <span>Importando ({importProgress}%)...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Confirmar e Importar {summary.validRows} Boletas</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Mensaje de Éxito al finalizar */}
        {importSuccess && (
          <Card className="p-8 text-center space-y-4 border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">¡Importación Completada con Éxito!</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Se agregaron correctamente todas las boletas y gastos a tu base de datos y fueron sincronizados.
              </p>
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium animate-pulse">
              Redirigiendo a tu listado de gastos...
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
