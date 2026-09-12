'use client';

import React, { useState } from 'react';
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
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  User,
  Calendar,
  DollarSign,
  Briefcase,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

interface NewReceivableModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewReceivableModal({ isOpen, onClose }: NewReceivableModalProps) {
  const { addReceivable } = useReceipts();

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
    if (docType === 'factura_afecta') {
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
    if (documentType === 'factura_afecta') {
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
                Nuevo Trabajo / Cuenta por Cobrar
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Registra servicios entregados, facturas emitidas y cotizaciones por cobrar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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
              <Label className="text-xs font-medium text-slate-300">Tipo de Documento Tributario</Label>
              <select
                value={documentType}
                onChange={(e) => handleDocumentTypeChange(e.target.value as ReceivableDocumentType)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="factura_afecta">Factura Electrónica Afecta (19% IVA)</option>
                <option value="factura_exenta">Factura Electrónica Exenta</option>
                <option value="boleta_honorarios">Boleta de Honorarios (con Retención)</option>
                <option value="orden_compra">Orden de Compra / Cotización Aceptada</option>
                <option value="sin_facturar">Trabajo Realizado / Sin Facturar aún</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">N° Folio / Factura (Opcional)</Label>
              <Input
                placeholder="Ej: F-1045, OC-892"
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
                {documentType === 'factura_afecta'
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
              <Label className="text-xs font-medium text-slate-300">Fecha de Emisión / Trabajo</Label>
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
