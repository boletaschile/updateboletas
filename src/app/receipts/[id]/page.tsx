'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { formatCLP, formatDateCL, validateRUT, formatRUT, calculateTotalsBreakdown } from '@/lib/utils';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  XCircle,
  Building2,
  User,
  Layers,
  ZoomIn,
  RotateCw,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params?.id as string;

  const {
    receipts,
    categories,
    updateReceipt,
    updateReceiptItem,
    addReceiptItem,
    deleteReceiptItem,
    approveReceipt,
    rejectReceipt,
  } = useReceipts();

  const doc = receipts.find((r) => r.id === docId);

  // Estados locales editables del documento
  const [merchantName, setMerchantName] = useState('');
  const [merchantRut, setMerchantRut] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [documentTime, setDocumentTime] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (doc) {
      setMerchantName(doc.merchant_name || '');
      setMerchantRut(doc.merchant_rut || '');
      setReceiptNumber(doc.receipt_number || '');
      setDocumentDate(doc.document_date || '');
      setDocumentTime(doc.document_time || '');
      setTotalAmount(doc.total_amount || 0);
      setPaymentMethod(doc.payment_method || '');
      setNotes(doc.notes || '');
    }
  }, [doc]);

  if (!doc) {
    return (
      <AppLayout title="Boleta no encontrada">
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">El documento solicitado no existe o fue eliminado.</p>
          <Button onClick={() => router.push('/receipts')} variant="outline">
            Volver a la lista
          </Button>
        </div>
      </AppLayout>
    );
  }

  const items = doc.items || [];
  const breakdown = calculateTotalsBreakdown(items);
  const discrepancy = breakdown.itemsSum - totalAmount;
  const isRutValid = merchantRut ? validateRUT(merchantRut) : true;

  const handleSaveChanges = () => {
    updateReceipt(doc.id, {
      merchant_name: merchantName,
      merchant_rut: merchantRut,
      receipt_number: receiptNumber,
      document_date: documentDate,
      document_time: documentTime,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      notes: notes,
    });
    alert('Cambios guardados correctamente.');
  };

  const handleApprove = () => {
    handleSaveChanges();
    approveReceipt(doc.id);
    router.push('/receipts');
  };

  const handleReject = () => {
    rejectReceipt(doc.id);
    router.push('/receipts');
  };

  return (
    <AppLayout
      title={`Revisión de Boleta: ${doc.merchant_name}`}
      description="Compara la imagen original contra los datos extraídos, corrige productos y distribuye gastos mixtos."
    >
      <div className="space-y-6">
        {/* Barra superior de navegación y acciones */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/receipts')}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver</span>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-foreground">{doc.merchant_name}</h2>
                <Badge
                  variant={
                    doc.status === 'approved'
                      ? 'success'
                      : doc.status === 'needs_review'
                      ? 'warning'
                      : doc.status === 'rejected'
                      ? 'destructive'
                      : 'info'
                  }
                >
                  {doc.status === 'approved'
                    ? 'Aprobado'
                    : doc.status === 'needs_review'
                    ? 'Pendiente de Revisión'
                    : doc.status === 'rejected'
                    ? 'Rechazado'
                    : doc.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Documento {doc.receipt_number || 'S/N'} • Subido el {formatDateCL(doc.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" onClick={handleSaveChanges} className="gap-1.5">
              <Save className="h-4 w-4" />
              <span>Guardar Borrador</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReject}
              className="gap-1.5"
            >
              <XCircle className="h-4 w-4" />
              <span>Rechazar</span>
            </Button>
            <Button
              onClick={handleApprove}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
              size="sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Aprobar Gasto</span>
            </Button>
          </div>
        </div>

        {/* Advertencias de IA si existen */}
        {doc.warnings && doc.warnings.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Observaciones detectadas en la boleta:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-300 pl-2">
              {doc.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Contenedor Split-Screen (2 Columnas) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Panel Izquierdo: Imagen / Vista Previa del Comprobante (5 columnas) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="h-full flex flex-col overflow-hidden sticky top-20">
              <CardHeader className="bg-muted/40 py-3 px-4 border-b flex flex-row items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>Documento Original</span>
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setZoomLevel((z) => (z < 2 ? z + 0.25 : 1))}
                    title="Zoom"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    title="Rotar"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-1 flex items-center justify-center bg-slate-900/5 dark:bg-slate-950 min-h-[450px] max-h-[700px] overflow-auto">
                {doc.file_url ? (
                  <img
                    src={doc.file_url}
                    alt="Comprobante"
                    className="max-w-full rounded shadow-md transition-all duration-200"
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transformOrigin: 'center center',
                    }}
                  />
                ) : (
                  <div className="p-8 text-center space-y-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 shadow-sm max-w-xs">
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 mx-auto flex items-center justify-center">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-foreground">{doc.file_name || 'comprobante_digital.jpg'}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Almacenado de forma privada y cifrada en Supabase Storage.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Hash: sha256:7f8e...39c1
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Panel Derecho: Datos de Cabecera y Editor de Productos (7 columnas) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Cabecera del Documento */}
            <Card>
              <CardHeader className="py-4 border-b">
                <CardTitle className="text-sm">Datos Generales del Comprobante</CardTitle>
              </CardHeader>
              <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre Comercio</Label>
                  <Input
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="Nombre del comercio"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">RUT Emisor</Label>
                    {!isRutValid && (
                      <span className="text-[10px] text-red-600 font-semibold">RUT no válido</span>
                    )}
                  </div>
                  <Input
                    value={merchantRut}
                    onChange={(e) => setMerchantRut(e.target.value)}
                    onBlur={(e) => setMerchantRut(formatRUT(e.target.value))}
                    placeholder="76.123.456-7"
                    className={!isRutValid ? 'border-red-500' : ''}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">N° Boleta / Factura</Label>
                  <Input
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    placeholder="B-123456"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha del Gasto</Label>
                  <Input
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Medio de Pago</Label>
                  <Input
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="Débito, Crédito, Efectivo..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Total Informado en Boleta (CLP)</Label>
                  <Input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(parseInt(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Validación Contable y Subtotales */}
            <Card className="border-blue-100 dark:border-blue-900 bg-blue-50/20 dark:bg-blue-950/20">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 rounded-lg bg-background border">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Boleta</span>
                    <span className="text-sm font-bold text-foreground">{formatCLP(totalAmount)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background border">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Suma Productos</span>
                    <span className="text-sm font-bold text-foreground">{formatCLP(breakdown.itemsSum)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800">
                    <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-semibold block">Gasto Empresa</span>
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{formatCLP(breakdown.businessTotal)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-semibold block">Gasto Personal</span>
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCLP(breakdown.personalTotal)}</span>
                  </div>
                </div>

                {/* Discrepancia Contable */}
                {discrepancy !== 0 && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>Diferencia entre total y productos: <strong>{formatCLP(Math.abs(discrepancy))}</strong></span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">Ajusta los productos o el total para cuadrar.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Listado de Productos / Ítems Editables */}
            <Card>
              <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Detalle de Productos ({items.length})</CardTitle>
                  <CardDescription className="text-xs">
                    Modifica categorías, cantidades y división porcentual empresa/personal por ítem.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    addReceiptItem(doc.id, {
                      original_name: 'Nuevo producto',
                      quantity: 1,
                      unit_price: 1000,
                      line_total: 1000,
                      category_name: 'Insumos de oficina',
                      expense_type: 'business',
                      business_percentage: 100,
                      personal_percentage: 0,
                    })
                  }
                  className="gap-1 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Agregar Ítem</span>
                </Button>
              </CardHeader>

              <CardContent className="p-0 divide-y">
                {items.map((item, index) => {
                  return (
                    <div key={item.id} className="p-4 space-y-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground font-semibold">#{index + 1}</span>
                            <Input
                              value={item.original_name}
                              onChange={(e) =>
                                updateReceiptItem(doc.id, item.id, { original_name: e.target.value })
                              }
                              className="h-8 text-xs font-semibold"
                              placeholder="Nombre del producto"
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteReceiptItem(doc.id, item.id)}
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Cantidad</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateReceiptItem(doc.id, item.id, { quantity: parseFloat(e.target.value) || 1 })
                            }
                            className="h-8 text-xs"
                          />
                        </div>

                        <div>
                          <Label className="text-[10px] text-muted-foreground">Precio Unitario</Label>
                          <Input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateReceiptItem(doc.id, item.id, { unit_price: parseInt(e.target.value) || 0 })
                            }
                            className="h-8 text-xs"
                          />
                        </div>

                        <div>
                          <Label className="text-[10px] text-muted-foreground">Total Línea</Label>
                          <div className="h-8 px-2.5 rounded-lg border bg-muted/40 flex items-center font-bold text-xs">
                            {formatCLP(item.line_total)}
                          </div>
                        </div>

                        <div>
                          <Label className="text-[10px] text-muted-foreground">Categoría</Label>
                          <select
                            value={item.category_name || ''}
                            onChange={(e) =>
                              updateReceiptItem(doc.id, item.id, { category_name: e.target.value })
                            }
                            className="h-8 w-full px-2 rounded-lg border bg-background text-xs"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name} ({c.type === 'business' ? 'Empresa' : 'Personal'})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* División de Gastos Mixtos por Ítem */}
                      <div className="pt-2 border-t border-dashed flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-muted/30 p-2.5 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">Asignación:</span>
                          <Button
                            type="button"
                            variant={item.business_percentage === 100 ? 'default' : 'outline'}
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() =>
                              updateReceiptItem(doc.id, item.id, {
                                expense_type: 'business',
                                business_percentage: 100,
                                personal_percentage: 0,
                              })
                            }
                          >
                            100% Empresa
                          </Button>
                          <Button
                            type="button"
                            variant={item.personal_percentage === 100 ? 'default' : 'outline'}
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() =>
                              updateReceiptItem(doc.id, item.id, {
                                expense_type: 'personal',
                                business_percentage: 0,
                                personal_percentage: 100,
                              })
                            }
                          >
                            100% Personal
                          </Button>
                          <Button
                            type="button"
                            variant={item.business_percentage === 50 ? 'default' : 'outline'}
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() =>
                              updateReceiptItem(doc.id, item.id, {
                                expense_type: 'mixed',
                                business_percentage: 50,
                                personal_percentage: 50,
                              })
                            }
                          >
                            50/50 Mixto
                          </Button>
                        </div>

                        <div className="text-[11px] font-semibold flex items-center gap-3">
                          <span className="text-blue-600">Empresa: {formatCLP(Math.round((item.line_total * item.business_percentage) / 100))}</span>
                          <span className="text-emerald-600">Personal: {formatCLP(Math.round((item.line_total * item.personal_percentage) / 100))}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
