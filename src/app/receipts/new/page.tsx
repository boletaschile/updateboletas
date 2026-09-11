'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CameraCaptureModal } from '@/components/receipts/camera-capture-modal';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  ArrowRight,
  Eye,
  ShieldAlert,
  Camera,
  Smartphone,
} from 'lucide-react';

type ProcessingStep =
  | 'idle'
  | 'uploaded'
  | 'processing_image'
  | 'extracting_ocr'
  | 'interpreting_ai'
  | 'ready'
  | 'error';

// Comprime fotos de celular (de 8MB a ~300KB) para subida instantánea en 4G/5G y compatibilidad Vercel
async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1800;
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

export default function NewReceiptPage() {
  const router = useRouter();
  const { addReceipt, receipts } = useReceipts();
  const { activeOrg, activeOrgId } = useAuth();
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [expenseType, setExpenseType] = useState<'business' | 'personal' | 'mixed'>(
    activeOrg?.type === 'personal' ? 'personal' : 'business'
  );
  const [organization, setOrganization] = useState<string>(activeOrg?.name || 'Mi Empresa Principal');
  const [notes, setNotes] = useState<string>('');

  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [processedDocId, setProcessedDocId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Manejo de archivo seleccionado o foto tomada con la cámara
  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    setDuplicateWarning(null);
    setStep('uploaded');
    setProgressPercent(15);
    setStatusMessage('Archivo / Fotografía cargada correctamente');

    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleProcessDocument = async () => {
    if (!file) return;

    try {
      setStep('processing_image');
      setProgressPercent(35);
      setStatusMessage('Optimizando y reduciendo peso de la fotografía...');
      
      let uploadFile = file;
      if (file.type.startsWith('image/')) {
        uploadFile = await compressImageForUpload(file);
      }

      setStep('extracting_ocr');
      setProgressPercent(60);
      setStatusMessage('Extrayendo texto con OCR y buscando datos tributarios...');
      await new Promise((r) => setTimeout(r, 400));

      setStep('interpreting_ai');
      setProgressPercent(85);
      setStatusMessage('Interpretando productos, impuestos y asignando categorías con IA...');

      // Llamada al endpoint de procesamiento o OCR service
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('expense_type', expenseType);
      formData.append('notes', notes);

      const res = await fetch('/api/receipts/process', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      const aiData = json.data || {};
      const docHeader = aiData.document || {};
      const aiItems = aiData.items || [];

      // Detección de duplicados básica frente a las boletas existentes
      const possibleDuplicate = receipts.find(
        (r) =>
          (docHeader.merchant_rut && r.merchant_rut === docHeader.merchant_rut && r.receipt_number === docHeader.receipt_number) ||
          (r.total_amount === docHeader.total && r.merchant_name === docHeader.merchant_name)
      );

      if (possibleDuplicate) {
        setDuplicateWarning(
          `Posible duplicado detectado: Ya existe una boleta de ${possibleDuplicate.merchant_name} por valor de $${possibleDuplicate.total_amount.toLocaleString('es-CL')}.`
        );
      }

      // Guardar documento en el store de la app
      const createdDoc = addReceipt({
        organization_id: activeOrgId !== 'all' ? activeOrgId : (expenseType === 'personal' ? 'org-personal' : 'org-empresa-1'),
        merchant_name: docHeader.merchant_name || 'Comercio Registrado',
        merchant_legal_name: docHeader.legal_name,
        merchant_rut: docHeader.merchant_rut,
        merchant_address: docHeader.merchant_address,
        receipt_number: docHeader.receipt_number,
        document_type: docHeader.document_type || 'boleta',
        document_date: docHeader.date || new Date().toISOString().split('T')[0],
        document_time: docHeader.time || '12:00',
        currency: 'CLP',
        subtotal: docHeader.subtotal || docHeader.total,
        discount: docHeader.discount || 0,
        net_amount: docHeader.net_amount || Math.round(docHeader.total / 1.19),
        tax_amount: docHeader.tax_amount || Math.round((docHeader.total * 0.19) / 1.19),
        tip: docHeader.tip || 0,
        total_amount: docHeader.total || 10000,
        expense_type: expenseType,
        payment_method: docHeader.payment_method || 'Débito',
        status: 'needs_review',
        requires_human_review: true,
        file_name: file.name,
        file_url: filePreview,
        warnings: aiData.warnings || [],
        items: aiItems.map((item: any) => ({
          original_name: item.original_name,
          normalized_name: item.normalized_name || item.original_name,
          sku: item.sku,
          quantity: item.quantity || 1,
          unit: item.unit || 'unidad',
          unit_price: item.unit_price,
          discount: item.discount || 0,
          line_total: item.line_total || item.unit_price * (item.quantity || 1),
          category_name: item.category,
          subcategory_name: item.subcategory,
          expense_type: item.expense_type || expenseType,
          business_percentage: item.business_percentage ?? (expenseType === 'business' ? 100 : 0),
          personal_percentage: item.personal_percentage ?? (expenseType === 'personal' ? 100 : 0),
          confidence: item.confidence ?? 0.9,
          requires_review: item.requires_review ?? false,
        })),
      });

      setProcessedDocId(createdDoc.id);
      setProgressPercent(100);
      setStep('ready');
      setStatusMessage('¡Procesamiento completado con éxito! Listo para revisión humana.');
    } catch (err: any) {
      console.error('Error durante el procesamiento:', err);
      setStep('error');
      setStatusMessage('Ocurrió un inconveniente al procesar el archivo.');
    }
  };

  return (
    <AppLayout
      title="Cargar y Procesar Boleta"
      description="Sube fotografías, capturas o PDFs de boletas para extracción automática con OCR e IA."
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Acceso Rápido Móvil a Cámara */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            type="button"
            onClick={() => setIsCameraModalOpen(true)}
            className="h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-md rounded-xl flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
              <Camera className="h-5 w-5" />
            </div>
            <div className="text-left">
              <span className="block leading-none">Sacar Foto a la Boleta</span>
              <span className="text-[11px] text-blue-100 font-normal">Abrir cámara en vivo</span>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => nativeCameraInputRef.current?.click()}
            className="h-14 border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/30 hover:bg-blue-100/50 text-foreground font-semibold text-sm rounded-xl flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 flex items-center justify-center">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="text-left">
              <span className="block leading-none">Cámara de tu Teléfono</span>
              <span className="text-[11px] text-muted-foreground font-normal">Disparador nativo móvil</span>
            </div>
          </Button>

          {/* Input de cámara nativo con capture="environment" */}
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0]);
              }
            }}
          />
        </div>

        {/* Card Principal de Carga y Drag & Drop */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600 shrink-0" />
                  <span>Subida de Archivos o Fotografía</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Formatos soportados: JPG, PNG, WebP y PDF (hasta 15MB).
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs">
                Chile • CLP / IVA 19%
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-5 sm:space-y-6">
            {/* Zona Drag & Drop */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-5 sm:p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[180px] sm:min-h-[220px] ${
                file
                  ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                  : 'border-muted-foreground/30 hover:border-blue-500 hover:bg-muted/30'
              }`}
              onClick={() => document.getElementById('receipt-file-input')?.click()}
            >
              <input
                id="receipt-file-input"
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />

              {file ? (
                <div className="space-y-3 flex flex-col items-center">
                  <div className="h-14 w-14 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 flex items-center justify-center">
                    {file.type.includes('pdf') ? (
                      <FileText className="h-7 w-7" />
                    ) : (
                      <ImageIcon className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || 'Documento'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs">
                    Cambiar archivo o foto
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 flex flex-col items-center">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:text-blue-600">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-sm">
                      Arrastra tu boleta aquí o <span className="text-blue-600 underline">haz clic para examinar</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fotos de boletas térmicas, comprobantes Transbank, facturas electrónicas o PDFs
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Configuración Inicial del Gasto */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="expense-type" className="text-xs font-semibold">
                  Tipo de Gasto Inicial
                </Label>
                <select
                  id="expense-type"
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="business">Empresa (100% deducible)</option>
                  <option value="personal">Personal (Gasto personal)</option>
                  <option value="mixed">Gasto Mixto (Dividir productos)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-profile" className="text-xs font-semibold">
                  Empresa o Perfil
                </Label>
                <Input
                  id="org-profile"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Ej: Mi Empresa SpA"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs font-semibold">
                  Notas u Observaciones
                </Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Almuerzo cliente o compras taller"
                />
              </div>
            </div>

            {/* Alerta de Duplicado si existe */}
            {duplicateWarning && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{duplicateWarning}</p>
                  <p className="mt-1 text-amber-800 dark:text-amber-300">
                    Puedes continuar y revisar las diferencias o cancelar si ya fue contabilizado.
                  </p>
                </div>
              </div>
            )}

            {/* Barra de Progreso y Estados del Procesamiento */}
            {step !== 'idle' && (
              <div className="space-y-3 p-4 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-2">
                    {step === 'ready' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : step === 'error' ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    )}
                    <span>{statusMessage}</span>
                  </span>
                  <span className="text-muted-foreground">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} />
              </div>
            )}
          </CardContent>

          <CardFooter className="bg-muted/20 border-t p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>La IA nunca aprueba definitivamente sin tu confirmación humana previa.</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {step === 'ready' && processedDocId ? (
                <Button
                  onClick={() => router.push(`/receipts/${processedDocId}`)}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2 w-full sm:w-auto shadow-md"
                >
                  <Eye className="h-4 w-4" />
                  <span>Ir a Revisar Boleta</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  disabled={!file || (step !== 'uploaded' && step !== 'idle')}
                  onClick={handleProcessDocument}
                  className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto shadow-md"
                >
                  {step !== 'idle' && step !== 'uploaded' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Procesando con IA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Procesar Documento con OCR e IA</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Modal de Cámara en Vivo */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(capturedPhoto) => handleFileChange(capturedPhoto)}
      />
    </AppLayout>
  );
}
