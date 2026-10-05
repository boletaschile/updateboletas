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
import { useAuth } from '@/lib/store/auth-context';
import { validateRUT, formatRUT, formatCLP } from '@/lib/utils';
import { ensureUUID } from '@/lib/supabase/db-service';
import { DocumentType, ExpenseType, ExpenseItem } from '@/types';
import {
  Receipt,
  Building2,
  User,
  Calendar,
  DollarSign,
  Tag,
  CreditCard,
  FileText,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  Paperclip,
  X,
  AlertCircle,
  HelpCircle,
  Percent,
} from 'lucide-react';

interface NewExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultExpenseType?: 'business' | 'personal';
}

const COMMON_CHILE_MERCHANTS = [
  'Supermercados Lider',
  'Jumbo',
  'Santa Isabel',
  'Unimarc',
  'Acuenta',
  'Sodimac Homecenter',
  'Easy',
  'Copec Pronto',
  'Shell Select',
  'Petrobras',
  'Farmacias Ahumada',
  'Farmacias Cruz Verde',
  'Doctor Simi',
  'Chilexpress',
  'Starken',
  'Enel Distribución',
  'Aguas Andinas',
  'Aguas Araucanía',
  'Entel',
  'Movistar',
  'Wom',
  'VTR',
  'Uber / DiDi / Cabify',
  'Notaría Pública',
  'Restaurante / Cafetería',
  'Servipag',
];

const DEFAULT_CATEGORIES = [
  'Alimentación y Supermercado',
  'Insumos de Oficina',
  'Combustible y Peajes',
  'Transporte y Movilización',
  'Servicios Básicos (Luz/Agua/Net)',
  'Arriendo y Espacios',
  'Salud y Farmacia',
  'Software, SaaS y Hosting',
  'Publicidad y Marketing',
  'Mantenimiento y Reparaciones',
  'Honorarios y Asesorías',
  'Vestuario y Calzado',
  'Educación y Capacitación',
  'Varios',
];

export function NewExpenseModal({
  isOpen,
  onClose,
  defaultExpenseType,
}: NewExpenseModalProps) {
  const { addReceipt, categories } = useReceipts();
  const { activeOrgId, activeOrg, organizations } = useAuth();

  const isCurrentPersonal = activeOrg?.type === 'personal' || activeOrgId === 'org-personal';

  // Identificar empresas y perfiles disponibles
  const businessOrgs = organizations.filter((o) => o.type !== 'personal');
  const personalOrg = organizations.find((o) => o.type === 'personal');

  // Form states
  const [merchantName, setMerchantName] = useState('');
  const [merchantRut, setMerchantRut] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('boleta');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [documentDate, setDocumentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [documentTime, setDocumentTime] = useState<string>('12:00');

  // Tipo de gasto (empresa, personal, mixto)
  const [expenseType, setExpenseType] = useState<ExpenseType>(
    defaultExpenseType || (isCurrentPersonal ? 'personal' : 'business')
  );
  const [targetOrgId, setTargetOrgId] = useState<string>(
    isCurrentPersonal ? 'org-personal' : activeOrgId !== 'all' ? activeOrgId : businessOrgs[0]?.id || 'org-empresa-1'
  );

  // Montos
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [taxMode, setTaxMode] = useState<'afecto' | 'exento' | 'manual'>('afecto');
  const [netAmount, setNetAmount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);

  // Split para mixto
  const [businessPercent, setBusinessPercent] = useState<number>(50);
  const [businessAmount, setBusinessAmount] = useState<number>(0);
  const [personalAmount, setPersonalAmount] = useState<number>(0);

  // Categoría y Pago
  const [categoryName, setCategoryName] = useState<string>('Alimentación y Supermercado');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Débito');
  const [purchaseSummary, setPurchaseSummary] = useState<string>('');

  // Ítems detallados opcionales
  const [items, setItems] = useState<Array<{ name: string; qty: number; price: number }>>([]);
  const [showItemSection, setShowItemSection] = useState<boolean>(false);

  // Archivo adjunto opcional
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Feedback y validación
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Sincronizar tipo de gasto al abrir según el perfil
  useEffect(() => {
    if (isOpen) {
      const initialType = defaultExpenseType || (isCurrentPersonal ? 'personal' : 'business');
      setExpenseType(initialType);
      setTargetOrgId(initialType === 'personal' ? 'org-personal' : businessOrgs[0]?.id || activeOrgId);
      setDocumentDate(new Date().toISOString().split('T')[0]);
      setErrorMessage(null);
      setIsSuccess(false);
    }
  }, [isOpen, defaultExpenseType, isCurrentPersonal, businessOrgs, activeOrgId]);

  // Recálculo automático de Neto e IVA al cambiar Total o Modo Tributario
  useEffect(() => {
    if (taxMode === 'afecto') {
      const net = Math.round(totalAmount / 1.19);
      const iva = totalAmount - net;
      setNetAmount(net);
      setTaxAmount(iva);
    } else if (taxMode === 'exento') {
      setNetAmount(totalAmount);
      setTaxAmount(0);
    }
  }, [totalAmount, taxMode]);

  // Recálculo de montos Mixtos
  useEffect(() => {
    if (expenseType === 'mixed') {
      const bAmt = Math.round((totalAmount * businessPercent) / 100);
      const pAmt = totalAmount - bAmt;
      setBusinessAmount(bAmt);
      setPersonalAmount(pAmt);
    } else if (expenseType === 'business') {
      setBusinessAmount(totalAmount);
      setPersonalAmount(0);
    } else {
      setBusinessAmount(0);
      setPersonalAmount(totalAmount);
    }
  }, [totalAmount, expenseType, businessPercent]);

  // Manejo de archivo adjunto
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (selected.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => setFilePreview(ev.target?.result as string);
        reader.readAsDataURL(selected);
      } else {
        setFilePreview(null);
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Ítems detallados
  const addItemRow = () => {
    setItems((prev) => [...prev, { name: '', qty: 1, price: 0 }]);
  };

  const removeItemRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItemRow = (index: number, field: 'name' | 'qty' | 'price', val: any) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: val } : it))
    );
  };

  const calculateTotalFromItems = () => {
    const sum = items.reduce((acc, it) => acc + (it.qty || 1) * (it.price || 0), 0);
    if (sum > 0) setTotalAmount(sum);
  };

  // Validación de RUT en vivo
  const isRutValid = merchantRut ? validateRUT(merchantRut) : true;

  // Lista combinada de categorías
  const allCategoryNames = Array.from(
    new Set([
      ...DEFAULT_CATEGORIES,
      ...categories.map((c) => c.name),
    ])
  );

  // Guardar Gasto
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!merchantName.trim()) {
      setErrorMessage('Ingresa el nombre del comercio, emisor o proveedor.');
      return;
    }

    if (!totalAmount || totalAmount <= 0) {
      setErrorMessage('Ingresa un monto válido mayor a $0.');
      return;
    }

    if (merchantRut && !validateRUT(merchantRut)) {
      setErrorMessage('El RUT del emisor ingresado no es válido. Revisa el dígito verificador.');
      return;
    }

    const finalCategory = customCategory.trim() || categoryName;
    const finalReceiptNumber = receiptNumber.trim() || `MAN-${Math.floor(100000 + Math.random() * 900000)}`;

    const formattedItems: Partial<ExpenseItem>[] = items
      .filter((it) => it.name.trim() && it.price > 0)
      .map((it) => ({
        id: ensureUUID(),
        expense_document_id: '',
        original_name: it.name,
        normalized_name: it.name,
        quantity: it.qty || 1,
        unit: 'unidad',
        unit_price: it.price,
        discount: 0,
        line_total: (it.qty || 1) * it.price,
        category_name: finalCategory,
        expense_type: expenseType,
        business_percentage: expenseType === 'business' ? 100 : expenseType === 'mixed' ? businessPercent : 0,
        personal_percentage: expenseType === 'personal' ? 100 : expenseType === 'mixed' ? 100 - businessPercent : 0,
        confidence: 1.0,
        requires_review: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

    const finalOrgId =
      expenseType === 'personal'
        ? 'org-personal'
        : targetOrgId || activeOrgId || 'org-empresa-1';

    addReceipt({
      merchant_name: merchantName.trim(),
      merchant_rut: merchantRut ? formatRUT(merchantRut) : null,
      document_type: documentType,
      receipt_number: finalReceiptNumber,
      document_date: documentDate,
      document_time: documentTime,
      total_amount: totalAmount,
      subtotal: netAmount,
      net_amount: netAmount,
      tax_amount: taxAmount,
      expense_type: expenseType,
      business_total: businessAmount,
      personal_total: personalAmount,
      organization_id: finalOrgId,
      category_name: finalCategory,
      payment_method: paymentMethod,
      purchase_summary: purchaseSummary.trim() || null,
      status: 'approved', // Registrado conscientemente por el usuario
      requires_human_review: false,
      file_name: file ? file.name : undefined,
      file_url: filePreview || undefined,
      items: formattedItems.length > 0 ? formattedItems : undefined,
    });

    setIsSuccess(true);
    setTimeout(() => {
      onClose();
      // Reset form
      setMerchantName('');
      setMerchantRut('');
      setTotalAmount(0);
      setReceiptNumber('');
      setPurchaseSummary('');
      setItems([]);
      setFile(null);
      setFilePreview(null);
      setIsSuccess(false);
    }, 800);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                  expenseType === 'personal'
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600'
                    : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600'
                }`}
              >
                <Receipt className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold">
                Registrar Nuevo Gasto
              </DialogTitle>
            </div>
            <Badge
              className={
                expenseType === 'personal'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30'
                  : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/30'
              }
            >
              {expenseType === 'personal' ? '👤 Modo Personal' : '🏢 Modo Empresa'}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Ingresa los datos del comprobante, cálculo de IVA chileno y asignación contable.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-foreground">¡Gasto Registrado con Éxito!</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Se ha agregado a tu lista de boletas y se ha contabilizado en tus métricas del período.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* SECCIÓN 1: PERFIL Y TIPO DE GASTO (AISLAMIENTO TOTAL) */}
            <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>¿A qué perfil corresponde este gasto?</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Evita mezclar gastos personales con empresa
                </span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExpenseType('business');
                    setTargetOrgId(businessOrgs[0]?.id || 'org-empresa-1');
                  }}
                  className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                    expenseType === 'business'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-500'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span>🏢 Empresa</span>
                  <span className="text-[10px] font-normal text-muted-foreground">Deducible F29</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExpenseType('personal');
                    setTargetOrgId('org-personal');
                  }}
                  className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                    expenseType === 'personal'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-500'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <User className="h-4 w-4 text-emerald-600" />
                  <span>👤 Personal</span>
                  <span className="text-[10px] font-normal text-muted-foreground">Vida y hogar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExpenseType('mixed')}
                  className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                    expenseType === 'mixed'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shadow-sm ring-1 ring-purple-500'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Percent className="h-4 w-4 text-purple-600" />
                  <span>⚖️ Mixto</span>
                  <span className="text-[10px] font-normal text-muted-foreground">Dividido</span>
                </button>
              </div>

              {/* Selector de Empresa si hay múltiples empresas y es tipo Empresa */}
              {expenseType === 'business' && businessOrgs.length > 1 && (
                <div className="pt-1">
                  <Label className="text-[11px] text-muted-foreground">Empresa Asignada:</Label>
                  <select
                    value={targetOrgId}
                    onChange={(e) => setTargetOrgId(e.target.value)}
                    className="w-full mt-1 p-2 rounded-lg border bg-background text-xs"
                  >
                    {businessOrgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} {org.rut ? `(${org.rut})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Slider de Desglose si es Mixto */}
              {expenseType === 'mixed' && (
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-blue-600">Empresa: {businessPercent}% ({formatCLP(businessAmount)})</span>
                    <span className="text-emerald-600">Personal: {100 - businessPercent}% ({formatCLP(personalAmount)})</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="99"
                    value={businessPercent}
                    onChange={(e) => setBusinessPercent(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              )}
            </div>

            {/* SECCIÓN 2: DATOS DEL COMERCIO Y COMPROBANTE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Comercio / Proveedor */}
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="merchantName" className="text-xs font-semibold">
                  Comercio / Proveedor / Emisor <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="merchantName"
                    list="common-merchants"
                    placeholder="Ej: Supermercados Lider, Copec, Sodimac, AWS..."
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    className="text-xs font-medium"
                    required
                  />
                  <datalist id="common-merchants">
                    {COMMON_CHILE_MERCHANTS.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* RUT Emisor (Chile) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="merchantRut" className="text-xs font-semibold">
                    RUT del Emisor (Opcional)
                  </Label>
                  {merchantRut && (
                    <span
                      className={`text-[10px] font-medium ${
                        isRutValid ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {isRutValid ? '✓ RUT Válido' : '✗ RUT Inválido'}
                    </span>
                  )}
                </div>
                <Input
                  id="merchantRut"
                  placeholder="Ej: 76.123.456-7"
                  value={merchantRut}
                  onChange={(e) => setMerchantRut(e.target.value)}
                  onBlur={() => {
                    if (merchantRut) setMerchantRut(formatRUT(merchantRut));
                  }}
                  className={`text-xs font-mono ${
                    merchantRut && !isRutValid ? 'border-rose-400 focus:ring-rose-400' : ''
                  }`}
                />
              </div>

              {/* Tipo de Documento */}
              <div className="space-y-1">
                <Label htmlFor="documentType" className="text-xs font-semibold">
                  Tipo de Documento
                </Label>
                <select
                  id="documentType"
                  value={documentType}
                  onChange={(e) => {
                    const dt = e.target.value as DocumentType;
                    setDocumentType(dt);
                    if (dt === 'factura') setTaxMode('afecto');
                  }}
                  className="w-full h-9 rounded-lg border bg-background px-3 text-xs"
                >
                  <option value="boleta">Boleta Electrónica (SII)</option>
                  <option value="factura">Factura de Compra (Crédito Fiscal)</option>
                  <option value="comprobante_transbank">Voucher Transbank / Redcompra</option>
                  <option value="boleta_honorarios">Boleta de Honorarios</option>
                  <option value="ticket">Ticket / Comprobante Simple</option>
                  <option value="otro">Transferencia / Recibo / Efectivo</option>
                </select>
              </div>

              {/* Fecha del Documento */}
              <div className="space-y-1">
                <Label htmlFor="documentDate" className="text-xs font-semibold">
                  Fecha del Gasto <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="documentDate"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              {/* N° Folio o Comprobante */}
              <div className="space-y-1">
                <Label htmlFor="receiptNumber" className="text-xs font-semibold">
                  N° Boleta / Factura / Folio
                </Label>
                <Input
                  id="receiptNumber"
                  placeholder="Ej: 148921 o T-40291"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {/* SECCIÓN 3: MONTOS Y TRATAMIENTO TRIBUTARIO CHILENO (IVA 19%) */}
            <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-900/40 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                {/* Monto Total */}
                <div className="space-y-1">
                  <Label htmlFor="totalAmount" className="text-xs font-bold text-foreground">
                    Monto Total CLP <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">$</span>
                    <Input
                      id="totalAmount"
                      type="number"
                      placeholder="0"
                      min="1"
                      step="1"
                      value={totalAmount || ''}
                      onChange={(e) => setTotalAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="pl-7 text-sm font-extrabold text-blue-700 dark:text-blue-300"
                      required
                    />
                  </div>
                </div>

                {/* Régimen de IVA */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Tratamiento de IVA (Chile)</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTaxMode('afecto')}
                      className={`py-2 px-2.5 rounded-lg text-xs font-medium border text-center transition-all ${
                        taxMode === 'afecto'
                          ? 'border-blue-600 bg-blue-100/70 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-bold'
                          : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      Afecto IVA (19%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxMode('exento')}
                      className={`py-2 px-2.5 rounded-lg text-xs font-medium border text-center transition-all ${
                        taxMode === 'exento'
                          ? 'border-emerald-600 bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-bold'
                          : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      Exento de IVA
                    </button>
                  </div>
                </div>
              </div>

              {/* Desglose Neto + IVA */}
              <div className="p-2.5 rounded-lg bg-card border flex items-center justify-between text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Neto Calculado:</span>
                  <span className="font-semibold text-foreground">{formatCLP(netAmount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">IVA (19% Crédito Fiscal):</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCLP(taxAmount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Total a Pagar:</span>
                  <span className="font-extrabold text-foreground">{formatCLP(totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 4: CATEGORÍA Y MEDIO DE PAGO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Categoría */}
              <div className="space-y-1">
                <Label htmlFor="category" className="text-xs font-semibold flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Categoría</span>
                </Label>
                <select
                  id="category"
                  value={categoryName}
                  onChange={(e) => {
                    setCategoryName(e.target.value);
                    if (e.target.value !== 'Otra...') setCustomCategory('');
                  }}
                  className="w-full h-9 rounded-lg border bg-background px-3 text-xs"
                >
                  {allCategoryNames.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="Otra...">Escribir otra categoría...</option>
                </select>
                {categoryName === 'Otra...' && (
                  <Input
                    placeholder="Escribe el nombre de la nueva categoría"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="text-xs mt-1"
                    autoFocus
                  />
                )}
              </div>

              {/* Medio de Pago */}
              <div className="space-y-1">
                <Label htmlFor="paymentMethod" className="text-xs font-semibold flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Medio de Pago</span>
                </Label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background px-3 text-xs"
                >
                  <option value="Débito">Tarjeta de Débito (Redcompra)</option>
                  <option value="Crédito">Tarjeta de Crédito</option>
                  <option value="Transferencia">Transferencia Electrónica</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cuenta Corriente">Cuenta Corriente Empresa</option>
                </select>
              </div>

              {/* Descripción / Glosa del Gasto */}
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="purchaseSummary" className="text-xs font-semibold">
                  Glosa / Descripción del Gasto (Opcional)
                </Label>
                <Input
                  id="purchaseSummary"
                  placeholder="Ej: Resmas de papel y tóner para impresora de oficina..."
                  value={purchaseSummary}
                  onChange={(e) => setPurchaseSummary(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* SECCIÓN 5: DESGLOSE DE PRODUCTOS / ÍTEMS (OPCIONAL) */}
            <div className="border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowItemSection(!showItemSection)}
                  className="flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-blue-600 transition-colors"
                >
                  <span>{showItemSection ? '▼' : '►'} Desglose de Productos o Ítems</span>
                  {items.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] py-0">
                      {items.length} ítem(s)
                    </Badge>
                  )}
                </button>
                {showItemSection && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItemRow}
                    className="text-xs h-7 gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Agregar Ítem</span>
                  </Button>
                )}
              </div>

              {showItemSection && (
                <div className="space-y-2 pt-1">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-2 text-center">
                      Puedes añadir productos específicos para tener trazabilidad del inventario o consumo.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((it, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <Input
                            placeholder="Nombre del producto"
                            value={it.name}
                            onChange={(e) => updateItemRow(idx, 'name', e.target.value)}
                            className="flex-1 text-xs h-8"
                          />
                          <Input
                            type="number"
                            placeholder="Cant."
                            min="1"
                            value={it.qty || ''}
                            onChange={(e) => updateItemRow(idx, 'qty', parseInt(e.target.value, 10) || 1)}
                            className="w-16 text-xs h-8 text-center"
                          />
                          <Input
                            type="number"
                            placeholder="Precio"
                            min="0"
                            value={it.price || ''}
                            onChange={(e) => updateItemRow(idx, 'price', parseInt(e.target.value, 10) || 0)}
                            className="w-24 text-xs h-8 text-right"
                          />
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            className="text-muted-foreground hover:text-rose-500 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={calculateTotalFromItems}
                          className="text-[11px] h-7 text-blue-600 hover:underline"
                        >
                          Usar suma de ítems como total ({formatCLP(items.reduce((a, b) => a + (b.qty || 1) * (b.price || 0), 0))})
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN 6: COMPROBANTE O FOTO ADJUNTA (OPCIONAL) */}
            <div className="border border-dashed rounded-xl p-3 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Paperclip className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {file ? file.name : 'Adjuntar Comprobante o Foto (Opcional)'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Foto de la boleta o PDF de respaldo'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    className="text-xs text-rose-600 h-7"
                  >
                    Quitar archivo
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs h-7"
                  >
                    Seleccionar Archivo
                  </Button>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onClose} className="text-xs">
                Cancelar
              </Button>
              <Button
                type="submit"
                className={`text-xs font-bold gap-1.5 shadow-md ${
                  expenseType === 'personal'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Guardar Gasto</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
