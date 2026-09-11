'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { formatCLP, formatDateCL } from '@/lib/utils';
import { exportExpensesToExcel, exportExpensesToCSV } from '@/lib/export-utils';
import {
  Receipt,
  PlusCircle,
  Search,
  Filter,
  FileSpreadsheet,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Building2,
  User,
  Layers,
} from 'lucide-react';

import { useAuth } from '@/lib/store/auth-context';

export default function ReceiptsListPage() {
  const router = useRouter();
  const { receipts, deleteReceipt, approveReceipt } = useReceipts();
  const { activeOrgId } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      // Filtro por organización activa
      if (activeOrgId !== 'all') {
        if (activeOrgId === 'org-personal') {
          if (r.expense_type !== 'personal' && r.organization_id !== 'org-personal') return false;
        } else {
          if (r.organization_id && r.organization_id !== activeOrgId) return false;
        }
      }

      // Búsqueda por texto
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        r.merchant_name.toLowerCase().includes(term) ||
        (r.merchant_rut && r.merchant_rut.toLowerCase().includes(term)) ||
        (r.receipt_number && r.receipt_number.toLowerCase().includes(term)) ||
        (r.items && r.items.some((it) => it.original_name.toLowerCase().includes(term)));

      // Filtro por tipo de gasto
      const matchType = filterType === 'all' || r.expense_type === filterType;

      // Filtro por estado
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;

      return matchSearch && matchType && matchStatus;
    });
  }, [receipts, activeOrgId, searchTerm, filterType, filterStatus]);

  // Métricas rápidas del listado filtrado
  const totalAmount = filteredReceipts.reduce((acc, r) => acc + r.total_amount, 0);
  const totalBusiness = filteredReceipts.reduce((acc, r) => acc + r.business_total, 0);
  const totalPersonal = filteredReceipts.reduce((acc, r) => acc + r.personal_total, 0);
  const pendingReviewCount = filteredReceipts.filter((r) => r.status === 'needs_review').length;

  return (
    <AppLayout
      title="Mis Boletas y Gastos"
      description="Consulta, filtra, revisa y exporta todos los comprobantes y boletas registradas."
    >
      <div className="space-y-6">
        {/* Resumen Superior */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Filtrado</p>
              <h3 className="text-xl font-bold text-foreground mt-0.5">{formatCLP(totalAmount)}</h3>
              <p className="text-[11px] text-muted-foreground">{filteredReceipts.length} documentos</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Gastos Empresa</p>
              <h3 className="text-xl font-bold text-blue-600 mt-0.5">{formatCLP(totalBusiness)}</h3>
              <p className="text-[11px] text-muted-foreground">Deducibles / Operacionales</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Gastos Personales</p>
              <h3 className="text-xl font-bold text-emerald-600 mt-0.5">{formatCLP(totalPersonal)}</h3>
              <p className="text-[11px] text-muted-foreground">Gastos particulares</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Por Revisar</p>
              <h3 className="text-xl font-bold text-amber-600 mt-0.5">{pendingReviewCount}</h3>
              <p className="text-[11px] text-muted-foreground">Requieren confirmación</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
          </Card>
        </div>

        {/* Barra de Búsqueda, Filtros y Exportación */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar por comercio, RUT, N° boleta o ítem..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-10 px-3 rounded-lg border border-input bg-background text-xs"
              >
                <option value="all">Todos los tipos</option>
                <option value="business">Empresa</option>
                <option value="personal">Personal</option>
                <option value="mixed">Mixto</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 px-3 rounded-lg border border-input bg-background text-xs"
              >
                <option value="all">Todos los estados</option>
                <option value="needs_review">Pendiente de revisión</option>
                <option value="approved">Aprobados</option>
                <option value="rejected">Rechazados</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportExpensesToCSV(filteredReceipts)}
                className="gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>CSV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportExpensesToExcel(filteredReceipts)}
                className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Exportar Excel</span>
              </Button>
              <Link href="/receipts/new">
                <Button size="sm" className="gap-1.5 text-xs">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Nueva Boleta</span>
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Tabla de Documentos */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-semibold border-b">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Comercio / Emisor</th>
                  <th className="px-4 py-3">N° Doc</th>
                  <th className="px-4 py-3">Tipo Gasto</th>
                  <th className="px-4 py-3 text-right">Total CLP</th>
                  <th className="px-4 py-3 text-right">Empresa</th>
                  <th className="px-4 py-3 text-right">Personal</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      No se encontraron boletas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((r) => {
                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {formatDateCL(r.document_date)}
                          {r.document_time && (
                            <span className="text-[10px] text-muted-foreground block">{r.document_time}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {r.merchant_name}
                          {r.purchase_summary && (
                            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-normal block truncate max-w-xs">
                              {r.purchase_summary}
                            </span>
                          )}
                          {r.merchant_rut && (
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              RUT: {r.merchant_rut}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]">
                          {r.receipt_number || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              r.expense_type === 'business'
                                ? 'info'
                                : r.expense_type === 'personal'
                                ? 'success'
                                : 'purple'
                            }
                            className="text-[10px]"
                          >
                            {r.expense_type === 'business'
                              ? 'Empresa'
                              : r.expense_type === 'personal'
                              ? 'Personal'
                              : 'Mixto'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {formatCLP(r.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-blue-600">
                          {formatCLP(r.business_total)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                          {formatCLP(r.personal_total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant={
                              r.status === 'approved'
                                ? 'success'
                                : r.status === 'needs_review'
                                ? 'warning'
                                : r.status === 'rejected'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="text-[10px]"
                          >
                            {r.status === 'approved'
                              ? 'Aprobado'
                              : r.status === 'needs_review'
                              ? 'Por Revisar'
                              : r.status === 'rejected'
                              ? 'Rechazado'
                              : r.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/receipts/${r.id}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50" title="Revisar">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            {r.status === 'needs_review' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                                onClick={() => approveReceipt(r.id)}
                                title="Aprobar rápidamente"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:bg-red-50"
                              onClick={() => {
                                if (confirm(`¿Eliminar la boleta de ${r.merchant_name}?`)) {
                                  deleteReceipt(r.id);
                                }
                              }}
                              title="Eliminar"
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
