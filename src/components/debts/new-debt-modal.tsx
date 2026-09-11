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
import { validateRUT, formatRUT, parseCLP, formatCLP } from '@/lib/utils';
import { DebtCategory } from '@/types';
import { Calendar, Plus, Clock, AlertTriangle, Building2, User, CreditCard } from 'lucide-react';

interface NewDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewDebtModal({ isOpen, onClose }: NewDebtModalProps) {
  const { addDebt } = useReceipts();

  const [supplierName, setSupplierName] = useState('');
  const [supplierRut, setSupplierRut] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [category, setCategory] = useState<DebtCategory>('factura_proveedor');
  const [amount, setAmount] = useState<number>(100000);
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  const [reminderDays, setReminderDays] = useState<number>(3);
  const [expenseType, setExpenseType] = useState<'business' | 'personal'>('business');
  const [isRecurring, setIsRecurring] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCurrent, setInstallmentCurrent] = useState<number>(1);
  const [installmentTotal, setInstallmentTotal] = useState<number>(12);
  const [installmentAmount, setInstallmentAmount] = useState<number>(150000);
  const [totalCreditAmount, setTotalCreditAmount] = useState<number>(1800000);
  const [notes, setNotes] = useState('');

  const isRutValid = supplierRut ? validateRUT(supplierRut) : true;

  // Cuando cambia la categoría a crédito bancario, sugerir modo cuotas
  const handleCategoryChange = (newCat: DebtCategory) => {
    setCategory(newCat);
    if (newCat === 'credito_bancario') {
      setIsInstallment(true);
      setAmount(installmentAmount);
    }
  };

  const handleInstallmentAmountChange = (val: number) => {
    setInstallmentAmount(val);
    setAmount(val);
    setTotalCreditAmount(val * installmentTotal);
  };

  const handleInstallmentTotalChange = (val: number) => {
    setInstallmentTotal(val);
    setTotalCreditAmount(installmentAmount * val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = isInstallment ? installmentAmount : amount;
    if (!supplierName.trim() || !dueDate || !finalAmount) return;

    const docNum = isInstallment
      ? (documentNumber.trim() || `CTA-${installmentCurrent}/${installmentTotal}`)
      : (documentNumber.trim() || null);

    addDebt({
      user_id: 'user-demo-1',
      supplier_name: supplierName.trim(),
      supplier_rut: supplierRut ? formatRUT(supplierRut) : null,
      document_number: docNum,
      document_type: isInstallment
        ? 'cuota_credito'
        : category === 'impuesto_f29' || category === 'previred'
        ? 'impuesto'
        : category === 'credito_bancario'
        ? 'cuota_credito'
        : 'factura',
      category,
      amount: finalAmount,
      issue_date: issueDate || new Date().toISOString().split('T')[0],
      due_date: dueDate,
      reminder_days_before: reminderDays,
      expense_type: expenseType,
      notes: notes.trim() || (isInstallment ? `Cuota ${installmentCurrent} de ${installmentTotal}` : null),
      is_recurring: isRecurring,
      recurring_frequency: isRecurring ? 'monthly' : undefined,
      is_installment_credit: isInstallment,
      installment_current: isInstallment ? installmentCurrent : null,
      installment_total: isInstallment ? installmentTotal : null,
      installment_amount: isInstallment ? installmentAmount : null,
      total_credit_amount: isInstallment ? totalCreditAmount : null,
    });

    setSupplierName('');
    setSupplierRut('');
    setDocumentNumber('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-blue-600" />
            <span>Registrar Cuenta por Pagar o Deuda</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Programa fechas límite de pago, alertas preventivas y controla tus compromisos tributarios o con proveedores.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {/* Ámbito de la Deuda */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setExpenseType('business')}
              className={`p-2.5 rounded-lg border text-center transition-all ${
                expenseType === 'business'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold'
                  : 'border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              <Building2 className="h-4 w-4 mx-auto mb-1 text-blue-600" />
              <span>Deuda Empresa / Proveedor</span>
            </button>

            <button
              type="button"
              onClick={() => setExpenseType('personal')}
              className={`p-2.5 rounded-lg border text-center transition-all ${
                expenseType === 'personal'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                  : 'border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              <User className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
              <span>Deuda Personal / Tarjeta</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Proveedor o Acreedor</Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ej: Distribuidora Central SpA"
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">RUT Acreedor (Opcional)</Label>
                {supplierRut && !isRutValid && (
                  <span className="text-[10px] text-red-600 font-semibold">RUT no válido</span>
                )}
              </div>
              <Input
                value={supplierRut}
                onChange={(e) => setSupplierRut(e.target.value)}
                onBlur={(e) => setSupplierRut(formatRUT(e.target.value))}
                placeholder="76.123.456-7"
                className={`text-xs ${supplierRut && !isRutValid ? 'border-red-500' : ''}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo de Compromiso</Label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as DebtCategory)}
                className="h-10 w-full px-2.5 rounded-lg border border-input bg-background text-xs"
              >
                <option value="factura_proveedor">Factura Proveedor</option>
                <option value="impuesto_f29">Impuesto F29 (IVA)</option>
                <option value="previred">Previred (Imposiciones)</option>
                <option value="credito_bancario">Cuota Crédito Bancario</option>
                <option value="arriendo">Arriendo Oficina/Local</option>
                <option value="servicio_suscripcion">Servicio / Suscripción</option>
                <option value="tarjeta_credito">Tarjeta de Crédito</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {isInstallment ? 'Identificador Crédito' : 'N° Factura / Folio'}
              </Label>
              <Input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder={isInstallment ? `CTA-${installmentCurrent}/${installmentTotal}` : 'Ej: F-10294'}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {isInstallment ? 'Valor Cuota (CLP)' : 'Monto a Pagar (CLP)'}
              </Label>
              <Input
                type="number"
                value={isInstallment ? installmentAmount : amount}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  if (isInstallment) {
                    handleInstallmentAmountChange(val);
                  } else {
                    setAmount(val);
                  }
                }}
                placeholder="100000"
                required
                className="text-xs font-bold"
              />
            </div>
          </div>

          {/* Opción Crédito en Cuotas */}
          <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isInstallment}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsInstallment(checked);
                    if (checked) {
                      setCategory('credito_bancario');
                      setAmount(installmentAmount);
                      setTotalCreditAmount(installmentAmount * installmentTotal);
                    }
                  }}
                  className="rounded border-input text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  ¿Es un Crédito o Préstamo en Cuotas?
                </span>
              </label>
              {isInstallment && (
                <Badge variant="outline" className="text-[10px] bg-background text-blue-700 dark:text-blue-300 font-semibold">
                  Cuota {installmentCurrent} de {installmentTotal}
                </Badge>
              )}
            </div>

            {isInstallment && (
              <div className="space-y-3 pt-1 border-t border-blue-100 dark:border-blue-900">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">N° Cuota Actual</Label>
                    <Input
                      type="number"
                      min={1}
                      max={installmentTotal}
                      value={installmentCurrent}
                      onChange={(e) => setInstallmentCurrent(parseInt(e.target.value) || 1)}
                      className="text-xs h-9 bg-background"
                      placeholder="Ej: 1"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">Total de Cuotas</Label>
                    <Input
                      type="number"
                      min={1}
                      value={installmentTotal}
                      onChange={(e) => handleInstallmentTotalChange(parseInt(e.target.value) || 1)}
                      className="text-xs h-9 bg-background"
                      placeholder="Ej: 24"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                      Valor de la Cuota (CLP)
                    </Label>
                    <Input
                      type="number"
                      value={installmentAmount}
                      onChange={(e) => handleInstallmentAmountChange(parseInt(e.target.value) || 0)}
                      className="text-xs h-9 font-bold bg-background text-blue-700 dark:text-blue-300"
                      placeholder="150000"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/80 border text-[11px] flex justify-between items-center">
                    <span className="text-muted-foreground">Monto Total del Crédito:</span>
                    <strong className="text-foreground">{formatCLP(totalCreditAmount)}</strong>
                  </div>

                  <div className="p-2 rounded-lg bg-background/80 border text-[11px] flex justify-between items-center">
                    <span className="text-muted-foreground">Saldo Restante Estimado:</span>
                    <strong className="text-blue-600 dark:text-blue-400">
                      {formatCLP(installmentAmount * Math.max(0, installmentTotal - installmentCurrent + 1))}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                <Calendar className="h-3.5 w-3.5" />
                <span>Fecha Límite de Pago (Vencimiento)</span>
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="text-xs bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Días de Recordatorio Previo</Label>
              <select
                value={reminderDays}
                onChange={(e) => setReminderDays(parseInt(e.target.value))}
                className="h-10 w-full px-2.5 rounded-lg border border-input bg-background text-xs"
              >
                <option value={0}>El mismo día del vencimiento</option>
                <option value={1}>1 día antes</option>
                <option value={3}>3 días antes (Recomendado)</option>
                <option value={5}>5 días antes</option>
                <option value={7}>1 semana antes</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notas / Instrucciones de Transferencia</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Transferir a Banco Santander Cta Cte 0019..."
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!supplierName.trim() || !dueDate} className="gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              <span>Programar Cuenta por Pagar</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
