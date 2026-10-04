'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { validateRUT, formatRUT, formatCLP } from '@/lib/utils';
import { ReceivableDocumentType } from '@/types';
import {
  AlertTriangle,
  Building2,
  User,
  Calendar,
  DollarSign,
  Briefcase,
  CheckCircle2,
  Clock,
  Sparkles,
  UploadCloud,
  FileText,
  X,
  Loader2,
  Paperclip,
} from 'lucide-react';

interface NewReceivableModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFile?: File | null;
}

export function NewReceivableModal({ isOpen, onClose, initialFile }: NewReceivableModalProps) {
  const { addReceivable } = useReceipts();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileUrl, setFileUrl] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Form inputs
  const [clientName, setClientName] = useState('');
  const [clientRut, setClientRut] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [documentType, setDocumentType] = useState<ReceivableDocumentType>('factura_afecta');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Amounts
  const [netAmount, setNetAmount] = useState<number>(500000);
  const [taxAmount, setTaxAmount] = useState<number>(95000); // 19% of 500.000
  const [totalAmount, setTotalAmount] = useState<number>(595000);

  // Dates
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [reminderDays, setReminderDays] = useState<number>(5);
  const [incomeType, setIncomeType] = useState<'business' | 'personal'>('business');
  const [notes, setNotes] = useState('');

  const isRutValid = clientRut ? validateRUT(clientRut) : true;

  // Actualizar montos según tipo de documento
  const recalculateAmounts = (net: number, docType: ReceivableDocumentType) => {
    setNetAmount(net);
    if (docType === 'factura_afecta' || docType === 'cotizacion_aprobada') {
      const tax = Math.round(net * 0.19);
      setTaxAmount(tax);
      setTotalAmount(net + tax);
    } else if (docType === 'boleta_honorarios') {
      const retention = Math.round(net * 0.1375);
      setTaxAmount(retention);
      setTotalAmount(net - retention);
    } else {
      setTaxAmount(0);
      setTotalAmount(net);
    }
  };

  const handleDocumentTypeChange = (type: ReceivableDocumentType) => {
    setDocumentType(type);
    recalculateAmounts(netAmount, type);
  };

  const handleNetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
    recalculateAmounts(val, documentType);
  };

  const handleTotalAmountDirectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const total = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
    setTotalAmount(total);
    if (documentType === 'factura_afecta' || documentType === 'cotizacion_aprobada') {
      const net = Math.round(total / 1.19);
      setNetAmount(net);
      setTaxAmount(total - net);
    } else {
      setNetAmount(total);
      setTaxAmount(0);
    }
  };

  // Presets para fecha de vencimiento
  const applyDuePreset = (days: number) => {
    const base = issueDate ? new Date(issueDate + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + days);
    setDueDate(base.toISOString().split('T')[0]);
  };

  // Procesamiento y extracción inteligente del archivo subido
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setFileSize(selectedFile.size);
    setAiMessage(null);

    // Guardar preview URL o data URL para descargar / ver
    if (selectedFile.size < 1_500_000) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileUrl(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setFileUrl(URL.createObjectURL(selectedFile));
    }

    // Heurística rápida sobre el nombre de archivo
    const nameLower = selectedFile.name.toLowerCase();
    let detectedDocType: ReceivableDocumentType = documentType;

    if (nameLower.includes('cotiz') || nameLower.includes('presupuesto') || nameLower.includes('wu-') || nameLower.includes('propuesta')) {
      detectedDocType = 'cotizacion_aprobada';
      setDocumentType('cotizacion_aprobada');
    } else if (nameLower.includes('fact') || nameLower.includes('fac-') || nameLower.includes('f-')) {
      detectedDocType = 'factura_afecta';
      setDocumentType('factura_afecta');
    } else if (nameLower.includes('honorario') || nameLower.includes('bhe')) {
      detectedDocType = 'boleta_honorarios';
      setDocumentType('boleta_honorarios');
    } else if (nameLower.includes('orden') || nameLower.includes('oc-')) {
      detectedDocType = 'orden_compra';
      setDocumentType('orden_compra');
    }

    // Extraer posible folio del nombre de archivo (ej: WU-2026-5747, 363, COT-5747)
    const folioMatch = selectedFile.name.match(/(?:[a-zA-Z]{1,4}[-_])?\d{2,8}(?:[-_]\d{1,6})?/i);
    if (folioMatch && (!invoiceNumber || invoiceNumber === '')) {
      setInvoiceNumber(folioMatch[0]);
    }

    // Análisis OCR / IA
    setIsAnalyzing(true);
    setAiMessage('Leyendo datos de la cotización/factura con IA...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('expense_type', incomeType);

      const res = await fetch('/api/receipts/process', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const doc = json.data.document || {};

          if (doc.merchant_name && (!clientName || clientName === '')) {
            setClientName(doc.merchant_name);
          }
          if (doc.merchant_rut && (!clientRut || clientRut === '')) {
            setClientRut(formatRUT(doc.merchant_rut));
          }
          if (doc.receipt_number && (!invoiceNumber || invoiceNumber === '')) {
            setInvoiceNumber(doc.receipt_number);
          }
          if (doc.document_date) {
            setIssueDate(doc.document_date);
            const d = new Date(doc.document_date + 'T00:00:00');
            d.setDate(d.getDate() + 30);
            setDueDate(d.toISOString().split('T')[0]);
          }
          if (doc.total_amount && doc.total_amount > 0) {
            const tot = Math.round(doc.total_amount);
            setTotalAmount(tot);
            if (detectedDocType === 'factura_afecta' || detectedDocType === 'cotizacion_aprobada') {
              const net = Math.round(tot / 1.19);
              setNetAmount(net);
              setTaxAmount(tot - net);
            } else {
              setNetAmount(tot);
              setTaxAmount(0);
            }
          }
          if (doc.purchase_summary && (!serviceDescription || serviceDescription === '')) {
            setServiceDescription(doc.purchase_summary);
          }

          setAiMessage('✨ ¡Datos extraídos automáticamente del documento! Puedes ajustarlos antes de guardar.');
        } else {
          setAiMessage('Documento adjunto correctamente.');
        }
      } else {
        setAiMessage('Documento adjunto correctamente. Completa los detalles del cobro.');
      }
    } catch {
      setAiMessage('Documento adjunto correctamente. Completa los detalles del cobro.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileName('');
    setFileUrl('');
    setFileSize(0);
    setAiMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cargar archivo inicial si se pasó por props
  useEffect(() => {
    if (initialFile && isOpen) {
      handleFileSelect(initialFile);
    }
  }, [initialFile, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !serviceDescription.trim() || !dueDate || totalAmount <= 0) return;

    addReceivable({
      user_id: 'user-demo-1',
      client_name: clientName.trim(),
      client_rut: clientRut ? formatRUT(clientRut) : null,
      client_contact: clientContact.trim() || null,
      service_description: serviceDescription.trim(),
      document_type: documentType,
      invoice_number: invoiceNumber.trim() || null,
      net_amount: netAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      issue_date: issueDate || new Date().toISOString().split('T')[0],
      due_date: dueDate,
      reminder_days_before: reminderDays,
      income_type: incomeType,
      notes: notes.trim() || null,
      file_name: fileName || null,
      file_url: fileUrl || null,
      file_size: fileSize || null,
    });

    handleClose();
  };

  const handleClose = () => {
    setClientName('');
    setClientRut('');
    setClientContact('');
    setServiceDescription('');
    setDocumentType('factura_afecta');
    setInvoiceNumber('');
    setNetAmount(500000);
    setTaxAmount(95000);
    setTotalAmount(595000);
    setNotes('');
    handleRemoveFile();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 text-slate-100 border-slate-700 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">
                Subir Cotización / Factura por Cobrar
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Sube el PDF de la cotización aprobada o factura de venta para respaldar el cobro y autocompletar datos con IA.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Zona de Subida de Documento (PDF o Imagen) */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                Documento de Respaldo (Cotización PDF / Factura)
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Opcional pero recomendado</span>
            </Label>

            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-400 bg-emerald-500/15'
                    : 'border-slate-700 hover:border-emerald-500/70 bg-slate-800/40 hover:bg-slate-800/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="p-2.5 rounded-full bg-emerald-500/15 text-emerald-400">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Arrastra tu Cotización o Factura aquí
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      o haz clic para explorar tus archivos (PDF, JPG, PNG hasta 25MB)
                    </p>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <Sparkles className="w-3 h-3" /> Autocompleta cliente, folio y montos con IA
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{fileName}</p>
                      <p className="text-[11px] text-slate-400">
                        {(fileSize / 1024).toFixed(0)} KB · Documento cargado
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isAnalyzing ? (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extrayendo...
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[11px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Adjunto
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Quitar archivo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {aiMessage && (
                  <div className="text-xs text-emerald-300 bg-emerald-900/30 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{aiMessage}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clasificación: Empresa vs Personal */}
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-2">
            <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Ámbito de Cobro / Ingreso
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIncomeType('business')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                  incomeType === 'business'
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300 ring-1 ring-blue-500'
                    : 'bg-slate-850 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>Empresa / Giro Comercial</span>
              </button>
              <button
                type="button"
                onClick={() => setIncomeType('personal')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                  incomeType === 'personal'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-300 ring-1 ring-purple-500'
                    : 'bg-slate-850 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <User className="w-4 h-4 text-purple-400" />
                <span>Honorarios / Persona Natural</span>
              </button>
            </div>
          </div>

          {/* Datos del Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-medium text-slate-300">
                Cliente / Razón Social <span className="text-emerald-400">*</span>
              </Label>
              <Input
                placeholder="Ej: Constructora del Sur SpA / Juan Pérez"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-slate-300">RUT del Cliente (Opcional)</Label>
                {clientRut && !isRutValid && (
                  <span className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> RUT Inválido
                  </span>
                )}
              </div>
              <Input
                placeholder="Ej: 76.123.456-7"
                value={clientRut}
                onChange={(e) => setClientRut(e.target.value)}
                onBlur={() => clientRut && isRutValid && setClientRut(formatRUT(clientRut))}
                className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 ${
                  clientRut && !isRutValid ? 'border-rose-500 focus:border-rose-500' : 'focus:border-emerald-500'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Contacto / Teléfono / Email</Label>
              <Input
                placeholder="Ej: finanzas@cliente.cl / +569 9876 5432"
                value={clientContact}
                onChange={(e) => setClientContact(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Glosa o Descripción del Servicio */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-300">
              Descripción del Trabajo o Servicio <span className="text-emerald-400">*</span>
            </Label>
            <Input
              placeholder="Ej: Desarrollo web plataforma SaaS, Mantención eléctrica industrial, etc."
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              required
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
            />
          </div>

          {/* Tipo de Documento y Folio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Tipo de Documento</Label>
              <select
                value={documentType}
                onChange={(e) => handleDocumentTypeChange(e.target.value as ReceivableDocumentType)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="cotizacion_aprobada">Cotización Aprobada por Cliente</option>
                <option value="factura_afecta">Factura Electrónica Afecta (19% IVA)</option>
                <option value="orden_compra">Orden de Compra (OC)</option>
                <option value="factura_exenta">Factura Electrónica Exenta</option>
                <option value="boleta_honorarios">Boleta de Honorarios (con Retención)</option>
                <option value="sin_facturar">Trabajo Realizado / Sin Facturar aún</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">N° Folio / Factura / Cotización (Opcional)</Label>
              <Input
                placeholder="Ej: COT-5747, F-363, OC-892"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Montos: Neto, IVA y Total */}
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Desglose Monetario (CLP)
              </span>
              <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                {documentType === 'factura_afecta' || documentType === 'cotizacion_aprobada'
                  ? 'IVA Débito Fiscal 19% Automático'
                  : documentType === 'boleta_honorarios'
                  ? 'Retención 13.75%'
                  : 'Sin Impuesto Adicional'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Monto Neto</Label>
                <Input
                  type="text"
                  value={formatCLP(netAmount)}
                  onChange={handleNetAmountChange}
                  className="bg-slate-900 border-slate-700 text-white font-mono text-sm focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-400">
                  {documentType === 'boleta_honorarios' ? 'Retención SII' : 'IVA Débito (19%)'}
                </Label>
                <Input
                  type="text"
                  readOnly
                  value={formatCLP(taxAmount)}
                  className="bg-slate-900/60 border-slate-700/70 text-slate-400 font-mono text-sm cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-emerald-400 font-semibold">Total a Cobrar</Label>
                <Input
                  type="text"
                  value={formatCLP(totalAmount)}
                  onChange={handleTotalAmountDirectChange}
                  className="bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-bold font-mono text-sm focus:border-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* Fechas de Emisión y Vencimiento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Fecha de Emisión / Cotización</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">
                Fecha de Vencimiento / Plazo de Pago <span className="text-emerald-400">*</span>
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="bg-slate-800 border-slate-700 text-white focus:border-emerald-500"
              />
              {/* Presets rápidos de vencimiento */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500">Plazos:</span>
                <button
                  type="button"
                  onClick={() => applyDuePreset(0)}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                >
                  Contado
                </button>
                <button
                  type="button"
                  onClick={() => applyDuePreset(30)}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                >
                  30 días
                </button>
                <button
                  type="button"
                  onClick={() => applyDuePreset(60)}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                >
                  60 días
                </button>
                <button
                  type="button"
                  onClick={() => applyDuePreset(90)}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                >
                  90 días
                </button>
              </div>
            </div>
          </div>

          {/* Días de Alerta & Notas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Alertar antes del Vencimiento (días)
              </Label>
              <Input
                type="number"
                min="0"
                max="30"
                value={reminderDays}
                onChange={(e) => setReminderDays(parseInt(e.target.value, 10) || 0)}
                className="bg-slate-800 border-slate-700 text-white focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Notas / Observaciones de Cobro</Label>
              <Input
                placeholder="Ej: Cobrar a contra entrega, transferencia BCI"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!clientName.trim() || !serviceDescription.trim() || !dueDate || totalAmount <= 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Guardar Cuenta por Cobrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
