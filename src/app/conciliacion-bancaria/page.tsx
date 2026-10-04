'use client';

import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import { BankTransaction } from '@/types';
import { DEMO_BANK_TRANSACTIONS } from '@/lib/bank/demo-bank-statement';
import { DEMO_RECEIPTS } from '@/lib/store/demo-data';
import { reconcileTransactions } from '@/lib/bank/reconciliation-service';
import { parseBankStatementFile } from '@/lib/bank/bank-statement-parser';
import { formatCLP, formatDateCL } from '@/lib/utils';
import { exportBankReconciliationExcel } from '@/lib/export-utils';
import {
  Landmark,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Link as LinkIcon,
  Search,
  ArrowRight,
  ShieldAlert,
  Layers,
  RefreshCw,
  PlusCircle,
  Eye,
  Check,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';

export default function ConciliacionBancariaPage() {
  const { receipts, addReceipt } = useReceipts();
  const { activeOrg, activeOrgId } = useAuth();

  const [transactions, setTransactions] = useState<BankTransaction[]>(DEMO_BANK_TRANSACTIONS);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [hasReconciled, setHasReconciled] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletedTx, setDeletedTx] = useState<BankTransaction | null>(null);

  // Comprobantes filtrados según la organización / perfil activo
  const scopedReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (activeOrgId === 'all') return true;
      if (activeOrg?.type === 'personal' || activeOrgId === 'org-personal') {
        return (
          r.expense_type === 'personal' ||
          r.organization_id === activeOrgId ||
          r.organization_id === 'org-personal' ||
          !r.organization_id
        );
      }
      return (
        r.organization_id === activeOrgId ||
        (r.expense_type === 'business' && (!r.organization_id || r.organization_id === 'org-empresa-1'))
      );
    });
  }, [receipts, activeOrgId, activeOrg]);

  // Transacciones bancarias para la vista activa:
  // Se muestran las transacciones vinculadas a la organización activa, o las transacciones de la cartola cargada/demo
  const orgTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (activeOrgId === 'all') return true;
      // Si la transacción no tiene organización asignada o coincide con la activa
      if (!t.organization_id || t.organization_id === activeOrgId) return true;
      // Compatibilidad con perfiles demo
      if (activeOrg?.type === 'personal' && (t.organization_id === 'org-personal' || t.id.startsWith('btx-'))) {
        return true;
      }
      if (activeOrg?.type === 'business' && (t.organization_id === 'org-empresa-1' || t.id.startsWith('btx-'))) {
        return true;
      }
      return false;
    });
  }, [transactions, activeOrgId, activeOrg]);

  // Ejecutar conciliación automática con IA
  const handleAutoReconcile = () => {
    setIsReconciling(true);
    setUploadError(null);
    setUploadSuccess(null);

    setTimeout(() => {
      // Priorizar boletas reales del usuario en el perfil activo.
      // Si el usuario aún no tiene boletas y está probando la cartola demo,
      // cruzar contra DEMO_RECEIPTS para demostrar el cotejo inteligente.
      const hasUserReceipts = scopedReceipts.length > 0;
      const isDemoSession = transactions.some((t) => t.id.startsWith('btx-'));
      const receiptsToMatch = hasUserReceipts
        ? scopedReceipts
        : (isDemoSession ? DEMO_RECEIPTS : []);

      const reconciled = reconcileTransactions(transactions, receiptsToMatch);
      setTransactions(reconciled);
      setIsReconciling(false);
      setHasReconciled(true);
    }, 600);
  };

  // Cargar cartola bancaria demo
  const handleLoadDemoStatement = () => {
    setTransactions(
      DEMO_BANK_TRANSACTIONS.map((t) => ({
        ...t,
        organization_id: activeOrgId !== 'all' ? activeOrgId : t.organization_id,
        status: 'unmatched',
        matched_receipt_id: null,
        matched_receipt: null,
        match_confidence: 0,
      }))
    );
    setBankFile(null);
    setUploadError(null);
    setUploadSuccess('Cartola de demostración cargada con éxito (10 movimientos).');
    setHasReconciled(false);
  };

  // Cargar cartola desde archivo Excel (.xlsx, .xls) o CSV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBankFile(file);
      setUploadError(null);
      setUploadSuccess(null);

      try {
        const parsed = await parseBankStatementFile(
          file,
          activeOrgId !== 'all' ? activeOrgId : undefined
        );

        if (parsed.transactions.length === 0) {
          setUploadError(
            'No se encontraron filas con cargos bancarios válidos en el archivo. Verifica que contenga columnas de Fecha, Glosa/Descripción y Cargos/Débitos.'
          );
        } else {
          setTransactions(parsed.transactions);
          setHasReconciled(false);
          setUploadSuccess(
            `Se importaron ${parsed.transactions.length} movimientos bancarios de ${parsed.bankName} correctamente.`
          );
        }
      } catch (err: any) {
        console.error('Error al procesar cartola bancaria:', err);
        setUploadError(err.message || 'Error al procesar el archivo de cartola bancaria.');
      }
    }
  };

  // Aceptar sugerencia de cotejo
  const handleAcceptSuggestion = (txId: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: 'matched' } : t))
    );
  };

  // Crear boleta rápida a partir de un cargo bancario no respaldado
  const handleCreateReceiptFromBank = (tx: BankTransaction) => {
    const isPersonal = activeOrg?.type === 'personal' || tx.organization_id === 'org-personal';
    const newDoc = addReceipt({
      merchant_name: tx.description.split(' ').slice(0, 3).join(' '),
      document_date: tx.date,
      total_amount: tx.amount,
      expense_type: isPersonal ? 'personal' : 'business',
      organization_id: activeOrgId !== 'all' ? activeOrgId : (tx.organization_id || undefined),
      payment_method: 'Transferencia / Cargo Bancario',
      status: 'approved',
      notes: `Gasto registrado desde movimiento bancario N° ${tx.operation_number || 'S/N'} (${tx.bank_name || 'Banco'})`,
    });

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === tx.id
          ? {
              ...t,
              status: 'matched',
              matched_receipt_id: newDoc.id,
              matched_receipt: newDoc,
              match_confidence: 1.0,
            }
          : t
      )
    );
  };

  // Eliminar movimiento bancario individual
  const handleDeleteTransaction = (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (tx) {
      setDeletedTx(tx);
      setTransactions((prev) => prev.filter((t) => t.id !== txId));
      setUploadError(null);
    }
  };

  // Deshacer la eliminación del último movimiento
  const handleUndoDelete = () => {
    if (deletedTx) {
      setTransactions((prev) => [deletedTx, ...prev]);
      setDeletedTx(null);
    }
  };

  // Vaciar toda la cartola de movimientos
  const handleClearAllTransactions = () => {
    if (window.confirm('¿Deseas vaciar todos los movimientos bancarios de la cartola actual?')) {
      setTransactions([]);
      setHasReconciled(false);
      setBankFile(null);
      setUploadSuccess(null);
      setDeletedTx(null);
    }
  };

  // Métricas de Conciliación basadas en orgTransactions
  const totalBankCharges = orgTransactions.reduce((acc, t) => acc + t.amount, 0);
  const matchedTransactions = orgTransactions.filter((t) => t.status === 'matched');
  const matchedAmount = matchedTransactions.reduce((acc, t) => acc + t.amount, 0);
  const suggestedTransactions = orgTransactions.filter((t) => t.status === 'suggested');
  const suggestedAmount = suggestedTransactions.reduce((acc, t) => acc + t.amount, 0);
  const pendingTransactions = orgTransactions.filter((t) => t.status === 'unmatched');
  const pendingAmount = pendingTransactions.reduce((acc, t) => acc + t.amount, 0);
  const reconciliationRate = totalBankCharges > 0 ? Math.round((matchedAmount / totalBankCharges) * 100) : 0;

  // Filtrado de la tabla
  const filteredTransactions = useMemo(() => {
    return orgTransactions.filter((t) => {
      const matchSearch =
        !searchTerm ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.operation_number && t.operation_number.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = filterStatus === 'all' || t.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orgTransactions, searchTerm, filterStatus]);

  return (
    <AppLayout
      title="Conciliación Bancaria Automática"
      description="Sube tu cartola bancaria (Excel / CSV / Cartola) y coteja automáticamente los cargos bancarios contra tus boletas y facturas con IA."
    >
      <div className="space-y-6">
        {/* Banner Superior */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl border border-indigo-900/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-200 border-blue-400/30 text-xs">
                {activeOrg ? activeOrg.name : 'Todas las Cuentas'}
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                Bancos de Chile (CLP)
              </Badge>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-6 w-6 text-indigo-400" />
              <span>Cotejo de Cartola Bancaria vs Boletas</span>
            </h2>
            <p className="text-xs text-indigo-200/80 max-w-xl">
              Detecta qué compras bancarias tienen comprobante tributario y cuáles están pendientes de respaldo para evitar contingencias fiscales.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportBankReconciliationExcel(
                  filteredTransactions.length > 0 ? filteredTransactions : orgTransactions,
                  activeOrg
                )
              }
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 text-xs"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Exportar Informe Excel</span>
            </Button>
            <Button
              size="sm"
              onClick={handleAutoReconcile}
              disabled={isReconciling}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold text-xs shadow-md"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isReconciling ? 'Cotejando con IA...' : 'Conciliar Automáticamente'}</span>
            </Button>
          </div>
        </div>

        {/* Zona de Carga de Cartola Bancaria */}
        <Card className="p-4 border-dashed border-2">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">
                  {bankFile ? `Archivo cargado: ${bankFile.name}` : 'Cargar Cartola o Reporte del Banco'}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Formatos compatibles: Excel (.xlsx, .xls), CSV o Cartola exportada de Banco de Chile, Santander, BCI, BancoEstado, Scotiabank, Itaú.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <input
                id="bank-file-input"
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('bank-file-input')?.click()}
                className="text-xs gap-1.5"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Examinar Archivo</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadDemoStatement}
                className="text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Usar Cartola Demo</span>
              </Button>
              {transactions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllTransactions}
                  className="text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 gap-1.5"
                  title="Eliminar todos los movimientos de la cartola"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Vaciar Cartola</span>
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Notificación de deshacer eliminación */}
        {deletedTx && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 truncate">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span className="truncate">
                Se eliminó el movimiento <strong>&quot;{deletedTx.description}&quot;</strong> ({formatCLP(deletedTx.amount)}).
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndoDelete}
              className="h-7 text-xs px-2.5 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 flex-shrink-0"
            >
              Deshacer
            </Button>
          </div>
        )}

        {/* Notificaciones de subida */}
        {uploadSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}
        {uploadError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* KPIs de Conciliación */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-slate-600">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Total Cargos en el Banco
            </span>
            <h3 className="text-2xl font-black text-foreground mt-1">{formatCLP(totalBankCharges)}</h3>
            <span className="text-[11px] text-muted-foreground">{orgTransactions.length} movimientos en cartola</span>
          </Card>

          <Card className="p-4 border-l-4 border-l-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/20">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-bold tracking-wider flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Cargos Respaldados con Boleta</span>
            </span>
            <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
              {formatCLP(matchedAmount)}
            </h3>
            <span className="text-[11px] text-emerald-600 font-medium">
              {matchedTransactions.length} comprobantes conciliados
            </span>
          </Card>

          <Card className="p-4 border-l-4 border-l-red-600 bg-red-50/20 dark:bg-red-950/20">
            <span className="text-[10px] text-red-700 dark:text-red-300 uppercase font-bold tracking-wider flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Cargos Sin Boleta (Falta Respaldo)</span>
            </span>
            <h3 className="text-2xl font-black text-red-700 dark:text-red-300 mt-1">
              {formatCLP(pendingAmount)}
            </h3>
            <span className="text-[11px] text-red-600 font-medium">
              {pendingTransactions.length} cargos por solicitar boleta
            </span>
          </Card>

          <Card className="p-4 border-l-4 border-l-blue-600">
            <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-bold tracking-wider">
              Tasa de Conciliación
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400">{reconciliationRate}%</h3>
              <span className="text-xs text-muted-foreground">de la cartola</span>
            </div>
            <div className="mt-2">
              <Progress
                value={reconciliationRate}
                indicatorColor={reconciliationRate > 80 ? 'bg-emerald-600' : 'bg-amber-500'}
              />
            </div>
          </Card>
        </div>

        {/* Alerta de Estado de Conciliación */}
        {!hasReconciled ? (
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-blue-950 dark:text-blue-200">
                  Cartola lista para cotejar con las boletas registradas
                </p>
                <p className="text-blue-800 dark:text-blue-300 text-[11px]">
                  Presiona &quot;Conciliar Automáticamente&quot; para cruzar montos, fechas y glosas bancarias con inteligencia artificial.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleAutoReconcile} disabled={isReconciling} className="gap-1.5 text-xs shadow-sm flex-shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isReconciling ? 'Cotejando con IA...' : 'Ejecutar Cotejo IA'}</span>
            </Button>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-emerald-950 dark:text-emerald-200">
                  ¡Conciliación bancaria completada exitosamente!
                </p>
                <p className="text-emerald-800 dark:text-emerald-300 text-[11px]">
                  {matchedTransactions.length} cargos respaldados con boleta ({formatCLP(matchedAmount)}).
                  {suggestedTransactions.length > 0 && ` ${suggestedTransactions.length} sugerencias por confirmar.`}
                  {pendingTransactions.length > 0 && ` Quedan ${pendingTransactions.length} cargos sin respaldo tributario.`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {pendingTransactions.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFilterStatus('unmatched')}
                  className="gap-1 text-xs text-red-700 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <AlertCircle className="h-3 w-3" />
                  <span>Ver {pendingTransactions.length} sin boleta</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAutoReconcile}
                disabled={isReconciling}
                className="gap-1 text-xs text-blue-600 hover:bg-blue-50"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Re-ejecutar</span>
              </Button>
            </div>
          </div>
        )}

        {/* Barra de Filtros */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-sm w-full">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Buscar por glosa bancaria o N° operación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 px-3 rounded-lg border border-input bg-background text-xs"
              >
                <option value="all">Todos los movimientos ({orgTransactions.length})</option>
                <option value="matched">🟢 Conciliados ({matchedTransactions.length})</option>
                <option value="suggested">🟡 Coincidencias Sugeridas ({suggestedTransactions.length})</option>
                <option value="unmatched">🔴 Sin Boleta ({pendingTransactions.length})</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Tabla de Cotejo Bancario */}
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="py-3 px-4 bg-muted/40 border-b flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-foreground">
              Movimientos Bancarios & Cotejo de Comprobantes
            </span>
            <span className="text-[11px] text-muted-foreground">
              {filteredTransactions.length} movimientos listados
            </span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-bold border-b">
                <tr>
                  <th className="px-3 py-3">Fecha Banco</th>
                  <th className="px-3 py-3">Glosa Bancaria / Descripción</th>
                  <th className="px-3 py-3">N° Operación</th>
                  <th className="px-3 py-3 text-right">Cargo Banco (CLP)</th>
                  <th className="px-3 py-3 text-center">Estado Cotejo</th>
                  <th className="px-3 py-3">Boleta / Comprobante Asociado</th>
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No se encontraron movimientos bancarios con los criterios de búsqueda actuales.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const receipt = tx.matched_receipt;
                    const isMatched = tx.status === 'matched';
                    const isSuggested = tx.status === 'suggested';
                    const isUnmatched = tx.status === 'unmatched';

                    return (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-3 font-medium whitespace-nowrap">
                          {formatDateCL(tx.date)}
                        </td>
                        <td className="px-3 py-3 font-medium max-w-[240px] truncate" title={tx.description}>
                          <span className="text-foreground block font-semibold truncate">{tx.description}</span>
                          <span className="text-[10px] text-muted-foreground">{tx.bank_name || 'Banco'}</span>
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
                          {tx.operation_number || '-'}
                        </td>
                        <td className="px-3 py-3 text-right font-black text-foreground whitespace-nowrap">
                          {formatCLP(tx.amount)}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {isMatched ? (
                            <Badge variant="success" className="text-[10px] gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Conciliado</span>
                            </Badge>
                          ) : isSuggested ? (
                            <Badge variant="warning" className="text-[10px] gap-1">
                              <Sparkles className="h-3 w-3" />
                              <span>Sugerido ({Math.round((tx.match_confidence || 0) * 100)}%)</span>
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <AlertCircle className="h-3 w-3" />
                              <span>Sin Boleta</span>
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 max-w-[220px]">
                          {receipt ? (
                            <div className="truncate">
                              <p className="font-semibold text-foreground truncate">{receipt.merchant_name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {receipt.receipt_number || 'S/N'} • {formatCLP(receipt.total_amount)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              Pendiente de subir comprobante
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isSuggested && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAcceptSuggestion(tx.id)}
                                className="h-7 text-[10px] px-2 border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                <span>Aceptar</span>
                              </Button>
                            )}

                            {isUnmatched && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCreateReceiptFromBank(tx)}
                                className="h-7 text-[10px] px-2 text-blue-600 hover:bg-blue-50"
                                title="Crear registro de gasto a partir del cargo"
                              >
                                <PlusCircle className="h-3 w-3 mr-1" />
                                <span>Crear Gasto</span>
                              </Button>
                            )}

                            {receipt && (
                              <Link href={`/receipts/${receipt.id}`}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50"
                                  title="Ver boleta vinculada"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            )}

                            {/* Eliminar movimiento bancario individual */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              title="Eliminar este movimiento bancario"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
