'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { useAuth } from '@/lib/store/auth-context';
import { NewReceivableModal } from '@/components/receivables/new-receivable-modal';
import { ImportSalesModal } from '@/components/receivables/import-sales-modal';
import { formatCLP, formatDateCL } from '@/lib/utils';
import { exportReceivablesToExcel } from '@/lib/export-utils';
import { AccountReceivable, ReceivableDocumentType } from '@/types';
import {
  Briefcase,
  PlusCircle,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Search,
  Filter,
  Trash2,
  Building2,
  User,
  Clock,
  RotateCcw,
  DollarSign,
  TrendingUp,
  Receipt,
  FileText,
  HelpCircle,
  UploadCloud,
  Paperclip,
} from 'lucide-react';

export default function CuentasPorCobrarPage() {
  const {
    receivables,
    markReceivableAsCollected,
    unmarkReceivableAsCollected,
    updateReceivable,
    deleteReceivable,
  } = useReceipts();
  const { activeOrg, activeOrgId } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('import') === 'sales') {
        setIsImportModalOpen(true);
      }
    }
  }, []);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDocType, setFilterDocType] = useState<string>('all');
  const [filterScope, setFilterScope] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Cálculos de Días y Estados en Vivo
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysRemainingText = (dueDate: string, isCollected?: boolean) => {
    if (isCollected) return { text: 'Cobrada', color: 'text-emerald-500 font-semibold' };
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `Vencida hace ${Math.abs(diffDays)} día(s)`,
        color: 'text-rose-500 font-bold',
      };
    }
    if (diffDays === 0) {
      return {
        text: '¡Vence Hoy!',
        color: 'text-rose-500 font-extrabold animate-pulse',
      };
    }
    if (diffDays <= 5) {
      return {
        text: `Vence en ${diffDays} día(s)`,
        color: 'text-amber-500 font-bold',
      };
    }
    return {
      text: `En ${diffDays} días (${formatDateCL(dueDate)})`,
      color: 'text-slate-400',
    };
  };

  const getDocTypeBadge = (type: ReceivableDocumentType) => {
    switch (type) {
      case 'factura_afecta':
        return (
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
            Factura Afecta (19%)
          </Badge>
        );
      case 'factura_exenta':
        return (
          <Badge className="bg-slate-700/50 text-slate-300 border-slate-600 text-xs">
            Factura Exenta
          </Badge>
        );
      case 'boleta_honorarios':
        return (
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs">
            Boleta Honorarios
          </Badge>
        );
      case 'cotizacion_aprobada':
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
            Cotización Aprobada
          </Badge>
        );
      case 'orden_compra':
        return (
          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-xs">
            Orden de Compra
          </Badge>
        );
      case 'sin_facturar':
        return (
          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-xs">
            Sin Facturar aún
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const isPersonalMode = activeOrg?.type === 'personal' || activeOrgId === 'org-personal';

  // Filtrado por organización activa: Aislamiento total de entorno
  const orgReceivables = useMemo(() => {
    return receivables.filter((r) => {
      if (isPersonalMode) {
        return r.income_type === 'personal';
      } else {
        if (r.income_type === 'personal') return false;
        if (activeOrgId && activeOrgId !== 'all') {
          return r.organization_id === activeOrgId || (!r.organization_id && r.income_type === 'business');
        }
        return r.income_type === 'business';
      }
    });
  }, [receivables, activeOrgId, isPersonalMode]);

  // Filtrado de la lista con búsqueda y filtros
  const filteredReceivables = useMemo(() => {
    return orgReceivables.filter((r) => {
      const matchSearch =
        !searchTerm ||
        r.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.client_rut && r.client_rut.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.invoice_number && r.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        r.service_description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        filterStatus === 'all'
          ? true
          : filterStatus === 'pending_all'
          ? r.status !== 'collected'
          : r.status === filterStatus;

      const matchDocType =
        filterDocType === 'all' ? true : r.document_type === filterDocType;

      const matchScope =
        filterScope === 'all' ? true : r.income_type === filterScope;

      return matchSearch && matchStatus && matchDocType && matchScope;
    });
  }, [orgReceivables, searchTerm, filterStatus, filterDocType, filterScope]);

  // Métricas Financieras (Scoped)
  const pendingReceivables = orgReceivables.filter((r) => r.status !== 'collected');
  const overdueReceivables = orgReceivables.filter((r) => r.status === 'overdue');
  const dueSoonReceivables = orgReceivables.filter((r) => r.status === 'due_soon');
  const collectedReceivables = orgReceivables.filter((r) => r.status === 'collected');

  const totalPendingAmount = pendingReceivables.reduce((acc, r) => acc + r.total_amount, 0);
  const totalPendingNeto = pendingReceivables.reduce((acc, r) => acc + r.net_amount, 0);
  const totalPendingIva = pendingReceivables.reduce((acc, r) => acc + r.tax_amount, 0);

  const totalOverdueAmount = overdueReceivables.reduce((acc, r) => acc + r.total_amount, 0);
  const totalDueSoonAmount = dueSoonReceivables.reduce((acc, r) => acc + r.total_amount, 0);
  const totalCollectedAmount = collectedReceivables.reduce(
    (acc, r) => acc + (r.collected_amount || r.total_amount),
    0
  );

  const collectedBusinessAmount = collectedReceivables
    .filter((r) => r.income_type === 'business')
    .reduce((acc, r) => acc + (r.collected_amount || r.total_amount), 0);

  const collectedPersonalAmount = collectedReceivables
    .filter((r) => r.income_type === 'personal')
    .reduce((acc, r) => acc + (r.collected_amount || r.total_amount), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Cabecera Principal */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Briefcase className="w-7 h-7 text-emerald-400" />
                Cuentas por Cobrar & Facturas de Venta
              </h1>
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                Flujo de Ingresos
              </Badge>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Control de servicios realizados, facturas a clientes, cálculo automático de IVA Débito (19%) y gestión de cobranza.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setUploadFile(e.target.files[0]);
                  setIsModalOpen(true);
                  e.target.value = '';
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="border-blue-500/40 bg-blue-950/40 hover:bg-blue-900/60 text-blue-200"
            >
              <UploadCloud className="w-4 h-4 mr-1.5 text-blue-400" />
              Importar Facturas (CSV/Excel)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportReceivablesToExcel(filteredReceivables, activeOrg)}
              className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-400" />
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUploadFile(null);
                setIsModalOpen(true);
              }}
              className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
            >
              <PlusCircle className="w-4 h-4 mr-1.5 text-emerald-400" />
              Ingreso Manual
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/30 flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              Subir Cotización / Factura (PDF)
            </Button>
          </div>
        </div>

        {/* Banner de Subida Rápida de Cotizaciones y Facturas */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              setUploadFile(e.dataTransfer.files[0]);
              setIsModalOpen(true);
            }
          }}
          className="bg-gradient-to-r from-emerald-950/40 via-slate-850 to-slate-900 border border-emerald-500/30 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 shrink-0">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">
                  ¿Tienes Facturas de Venta o Cotizaciones del Mes?
                </h3>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  CSV, Excel o PDF
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Carga el archivo mensual de facturación para sincronizar ventas, flujo de cobranza e IVA Débito, o sube PDFs individuales con IA.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <Button
              onClick={() => setIsImportModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold w-full sm:w-auto shadow-md gap-1.5 text-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Subir Facturas del Mes (CSV)
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-200 font-semibold w-full sm:w-auto shadow-md text-xs"
            >
              <UploadCloud className="w-4 h-4 mr-1.5 text-emerald-400" />
              Subir PDF
            </Button>
          </div>
        </div>

        {/* Tarjetas de Métricas (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total por Cobrar */}
          <Card className="bg-slate-850 border-slate-700/80 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Total por Cobrar</span>
                <Clock className="w-4 h-4 text-blue-400" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-blue-400 font-mono">
                {formatCLP(totalPendingAmount)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{pendingReceivables.length} documento(s) pendiente(s)</span>
                <span className="text-slate-500">Neto: {formatCLP(totalPendingNeto)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Vencidos en Mora */}
          <Card className={`border-slate-700/80 shadow-sm relative overflow-hidden ${
            overdueReceivables.length > 0 ? 'bg-rose-950/20 border-rose-800/50' : 'bg-slate-850'
          }`}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Vencidas en Alerta</span>
                <AlertTriangle className={`w-4 h-4 ${overdueReceivables.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
              </CardDescription>
              <CardTitle className={`text-2xl font-bold font-mono ${
                overdueReceivables.length > 0 ? 'text-rose-400' : 'text-slate-300'
              }`}>
                {formatCLP(totalOverdueAmount)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">
                {overdueReceivables.length > 0 ? (
                  <span className="text-rose-400 font-medium">
                    ⚠️ {overdueReceivables.length} factura(s) requieren cobranza urgente
                  </span>
                ) : (
                  <span className="text-emerald-400">Sin facturas vencidas</span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Por Vencer Pronto */}
          <Card className="bg-slate-850 border-slate-700/80 shadow-sm relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Por Vencer (5 días)</span>
                <Calendar className="w-4 h-4 text-amber-400" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-400 font-mono">
                {formatCLP(totalDueSoonAmount)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">
                {dueSoonReceivables.length} factura(s) próximas a vencer
              </p>
            </CardContent>
          </Card>

          {/* Total Cobrado / Percibido */}
          <Card className="bg-slate-850 border-slate-700/80 shadow-sm relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Total Cobrado</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-400 font-mono">
                {formatCLP(totalCollectedAmount)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Empresa: {formatCLP(collectedBusinessAmount)}</span>
                <span>Pers.: {formatCLP(collectedPersonalAmount)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-slate-850 p-4 rounded-xl border border-slate-700/80 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por cliente, RUT, folio o trabajo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro Estado */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Todos los Estados</option>
              <option value="pending_all">Pendientes (Sin Cobrar)</option>
              <option value="overdue">Vencidas en Alerta</option>
              <option value="due_soon">Por Vencer Pronto</option>
              <option value="collected">Cobradas</option>
            </select>

            {/* Filtro Tipo Documento */}
            <select
              value={filterDocType}
              onChange={(e) => setFilterDocType(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Todos los Documentos</option>
              <option value="factura_afecta">Facturas Afectas (19% IVA)</option>
              <option value="cotizacion_aprobada">Cotizaciones Aprobadas</option>
              <option value="orden_compra">Órdenes de Compra</option>
              <option value="factura_exenta">Facturas Exentas</option>
              <option value="boleta_honorarios">Boletas Honorarios</option>
              <option value="sin_facturar">Sin Facturar aún</option>
            </select>

            {/* Filtro Ámbito */}
            <select
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Empresa y Personal</option>
              <option value="business">Solo Empresa</option>
              <option value="personal">Solo Personal</option>
            </select>
          </div>
        </div>

        {/* Tabla de Cuentas por Cobrar */}
        <div className="bg-slate-850 rounded-xl border border-slate-700/80 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Cliente / Razón Social</th>
                  <th className="py-3 px-4">Glosa del Trabajo / Servicio</th>
                  <th className="py-3 px-3">Tipo / Folio</th>
                  <th className="py-3 px-3">Ámbito</th>
                  <th className="py-3 px-3 text-right">Neto</th>
                  <th className="py-3 px-3 text-right">IVA Débito</th>
                  <th className="py-3 px-4 text-right">Total a Cobrar</th>
                  <th className="py-3 px-3">Vencimiento / Plazo</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredReceivables.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Briefcase className="w-10 h-10 text-slate-600" />
                        <div>
                          <p className="font-medium text-slate-400">No hay cuentas por cobrar registradas</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Comienza agregando un trabajo realizado o una factura pendiente de pago.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                          <Button
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                          >
                            <UploadCloud className="w-4 h-4 mr-1.5" />
                            Subir Cotización / Factura (PDF)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setUploadFile(null);
                              setIsModalOpen(true);
                            }}
                            className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                          >
                            <PlusCircle className="w-4 h-4 mr-1.5 text-emerald-400" />
                            Ingreso Manual
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredReceivables.map((r) => {
                    const isCollected = r.status === 'collected';
                    const remaining = getDaysRemainingText(r.due_date, isCollected);

                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-800/50 transition-colors ${
                          isCollected ? 'bg-slate-900/30 opacity-70' : ''
                        }`}
                      >
                        {/* Cliente + RUT + Contacto */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{r.client_name}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            {r.client_rut && <span>{r.client_rut}</span>}
                            {r.client_contact && (
                              <span className="text-slate-500">• {r.client_contact}</span>
                            )}
                          </div>
                        </td>

                        {/* Glosa / Servicio */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="text-slate-200 line-clamp-2 text-xs font-medium">
                            {r.service_description}
                          </div>
                          {r.notes && (
                            <div className="text-[11px] text-slate-500 italic truncate mt-0.5">
                              Nota: {r.notes}
                            </div>
                          )}
                        </td>

                        {/* Tipo / Folio / Archivo */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div>{getDocTypeBadge(r.document_type)}</div>
                          {r.invoice_number && (
                            <div className="text-[11px] text-slate-400 font-mono mt-1">
                              Folio: {r.invoice_number}
                            </div>
                          )}
                          {r.file_name && (
                            <div className="mt-1">
                              <a
                                href={r.file_url || '#'}
                                download={r.file_name}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:underline max-w-[130px] truncate"
                                title={`Descargar ${r.file_name}`}
                              >
                                <Paperclip className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="truncate">{r.file_name}</span>
                              </a>
                            </div>
                          )}
                        </td>

                        {/* Ámbito interactivo */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              updateReceivable(r.id, {
                                income_type: r.income_type === 'business' ? 'personal' : 'business',
                              })
                            }
                            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all ${
                              r.income_type === 'business'
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
                                : 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                            }`}
                            title="Haz clic para cambiar entre Empresa y Personal"
                          >
                            {r.income_type === 'business' ? (
                              <>
                                <Building2 className="w-3 h-3" /> Empresa
                              </>
                            ) : (
                              <>
                                <User className="w-3 h-3" /> Personal
                              </>
                            )}
                          </button>
                        </td>

                        {/* Monto Neto */}
                        <td className="py-3 px-3 text-right font-mono text-slate-300 text-xs">
                          {formatCLP(r.net_amount)}
                        </td>

                        {/* IVA Débito */}
                        <td className="py-3 px-3 text-right font-mono text-slate-400 text-xs">
                          {r.tax_amount > 0 ? (
                            <span className="text-blue-400">{formatCLP(r.tax_amount)}</span>
                          ) : (
                            <span className="text-slate-600">$0</span>
                          )}
                        </td>

                        {/* Total a Cobrar */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                          <span className={isCollected ? 'text-slate-400 line-through' : 'text-emerald-400'}>
                            {formatCLP(r.total_amount)}
                          </span>
                        </td>

                        {/* Vencimiento / Plazo */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className={`text-xs ${remaining.color}`}>{remaining.text}</div>
                          <div className="text-[11px] text-slate-500">
                            Emisión: {formatDateCL(r.issue_date)}
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isCollected ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Cobrada
                            </Badge>
                          ) : r.status === 'overdue' ? (
                            <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/40 text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" /> En Mora
                            </Badge>
                          ) : r.status === 'due_soon' ? (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs">
                              <Clock className="w-3 h-3 mr-1" /> Por Vencer
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-xs">
                              Pendiente
                            </Badge>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {isCollected ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => unmarkReceivableAsCollected(r.id)}
                                className="h-8 px-2 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                                title="Reabrir cuenta por cobrar"
                              >
                                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                Reabrir
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => markReceivableAsCollected(r.id, 'Transferencia')}
                                className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                                title="Registrar como cobrado"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Marcar Cobrado
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`¿Eliminar la cuenta por cobrar de ${r.client_name}?`)) {
                                  deleteReceivable(r.id);
                                }
                              }}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>

        {/* Modal de Registro */}
        <NewReceivableModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setUploadFile(null);
          }}
          initialFile={uploadFile}
        />

        {/* Modal de Importación Masiva de Facturas de Venta */}
        <ImportSalesModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
        />
      </div>
    </AppLayout>
  );
}
