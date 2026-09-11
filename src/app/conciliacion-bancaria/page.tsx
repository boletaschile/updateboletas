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
import { reconcileTransactions } from '@/lib/bank/reconciliation-service';
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

  // Comprobantes filtrados por organización activa
  const scopedReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (activeOrgId !== 'all') {
        if (activeOrgId === 'org-personal') {
          if (r.expense_type !== 'personal' && r.organization_id !== 'org-personal') return false;
        } else {
          if (r.organization_id && r.organization_id !== activeOrgId) return false;
        }
      }
      return true;
    });
  }, [receipts, activeOrgId]);

  // Transacciones bancarias filtradas por organización activa
  const orgTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (activeOrgId !== 'all') {
        if (t.organization_id && t.organization_id !== activeOrgId) return false;
      }
      return true;
    });
  }, [transactions, activeOrgId]);

  // Ejecutar conciliación automática
  const handleAutoReconcile = () => {
    setIsReconciling(true);
    setTimeout(() => {
      const reconciled = reconcileTransactions(transactions, scopedReceipts);
      setTransactions(reconciled);
      setIsReconciling(false);
      setHasReconciled(true);
    }, 600);
  };

  // Cargar cartola bancaria desde archivo o demo
  const handleLoadDemoStatement = () => {
    setTransactions(DEMO_BANK_TRANSACTIONS);
    setHasReconciled(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBankFile(file);
      // Simular lectura de cartola
      setTransactions(DEMO_BANK_TRANSACTIONS);
      setHasReconciled(false);
    }
  };

  // Aceptar sugerencia
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

  // Métricas de Conciliación (Scoped)
  const totalBankCharges = orgTransactions.reduce((acc, t) => acc + t.amount, 0);
  const matchedTransactions = orgTransactions.filter((t) => t.status === 'matched');
  const matchedAmount = matchedTransactions.reduce((acc, t) => acc + t.amount, 0);
  const pendingTransactions = orgTransactions.filter((t) => t.status === 'unmatched');
  const pendingAmount = pendingTransactions.reduce((acc, t) => acc + t.amount, 0);
  const reconciliationRate = Math.round((matchedAmount / (totalBankCharges || 1)) * 100);

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
              onClick={() => exportBankReconciliationExcel(transactions, activeOrg)}
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
            </div>
          </div>
        </Card>

        {/* KPIs de Conciliación */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-slate-600">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Total Cargos en el Banco
            </span>
            <h3 className="text-2xl font-black text-foreground mt-1">{formatCLP(totalBankCharges)}</h3>
            <span className="text-[11px] text-muted-foreground">{transactions.length} movimientos en cartola</span>
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

        {/* Alerta de Conciliación */}
        {!hasReconciled && (
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-blue-950 dark:text-blue-200">
                  Cartola lista para cotejar con las boletas registradas
                </p>
                <p className="text-blue-800 dark:text-blue-300 text-[11px]">
                  Presiona &quot;Conciliar Automáticamente&quot; para cruzar montos, fechas y glosas bancarias en segundos.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleAutoReconcile} className="gap-1.5 text-xs shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ejecutar Cotejo IA</span>
            </Button>
          </div>
        )}

        {/* Barra de Filtros */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Buscar por glosa bancaria o N° operación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 px-3 rounded-lg border border-input bg-background text-xs"
              >
                <option value="all">Todos los movimientos ({transactions.length})</option>
                <option value="matched">🟢 Conciliados ({transactions.filter((t) => t.status === 'matched').length})</option>
                <option value="suggested">🟡 Coincidencias Sugeridas ({transactions.filter((t) => t.status === 'suggested').length})</option>
                <option value="unmatched">🔴 Sin Boleta ({transactions.filter((t) => t.status === 'unmatched').length})</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Tabla de Cotejo Bancario */}
        <Card className="overflow-hidden">
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
                {filteredTransactions.map((tx) => {
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
                        <span className="text-foreground block font-semibold">{tx.description}</span>
                        <span className="text-[10px] text-muted-foreground">{tx.bank_name || 'Banco'}</span>
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
                        {tx.operation_number || '-'}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-foreground">
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
