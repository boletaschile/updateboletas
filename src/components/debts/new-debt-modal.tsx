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
import { useReceipts } from '@/lib/store/receipts-context';
import { validateRUT, formatRUT, parseCLP } from '@/lib/utils';
import { DebtCategory } from '@/types';
import { Calendar, Plus, Clock, AlertTriangle, Building2, User } from 'lucide-react';

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
  const [notes, setNotes] = useState('');

  const isRutValid = supplierRut ? validateRUT(supplierRut) : true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim() || !dueDate || !amount) return;

    addDebt({
      user_id: 'user-demo-1',
      supplier_name: supplierName.trim(),
      supplier_rut: supplierRut ? formatRUT(supplierRut) : null,
      document_number: documentNumber.trim() || null,
      document_type: category === 'impuesto_f29' || category === 'previred' ? 'impuesto' : category === 'credito_bancario' ? 'cuota_credito' : 'factura',
      category,
      amount,
      issue_date: issueDate || new Date().toISOString().split('T')[0],
      due_date: dueDate,
      reminder_days_before: reminderDays,
      expense_type: expenseType,
      notes: notes.trim() || null,
      is_recurring: isRecurring,
      recurring_frequency: isRecurring ? 'monthly' : undefined,
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
                onChange={(e) => setCategory(e.target.value as DebtCategory)}
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
              <Label className="text-xs font-semibold">N° Factura / Folio</Label>
              <Input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Ej: F-10294"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Monto a Pagar (CLP)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                placeholder="100000"
                required
                className="text-xs font-bold"
              />
            </div>
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
