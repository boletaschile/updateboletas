'use client';

import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { Settings, RefreshCw, ShieldCheck, Database, Sliders, Building2 } from 'lucide-react';

export default function SettingsPage() {
  const { resetToDemo, clearAllData, receipts, debts } = useReceipts();

  const handleClear = () => {
    if (confirm('¿Estás seguro de que deseas vaciar todas las boletas y deudas de prueba? El sistema quedará en blanco para que comiences a registrar tus documentos reales.')) {
      clearAllData();
      alert('¡Listo! Todos los datos demo han sido eliminados. Ya puedes comenzar a subir tus boletas reales.');
    }
  };

  return (
    <AppLayout
      title="Configuración del Sistema"
      description="Ajustes de perfil, organización, claves de entorno y preferencias regionales."
    >
      <div className="max-w-4xl space-y-6">
        {/* Reinicio y Modo de Trabajo */}
        <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/10">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm text-rose-900 dark:text-rose-300 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-rose-600" />
              <span>Comenzar a Trabajar / Limpiar Datos Demo</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Actualmente tienes {receipts.length} boletas y {debts.length} compromisos registrados en tu navegador.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-background border">
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">Vaciar Todo y Comenzar en Blanco</p>
                <p className="text-[11px] text-muted-foreground max-w-lg">
                  Elimina todas las boletas y deudas de demostración de una sola vez. Mantiene tus categorías oficiales listas para que puedas registrar tus gastos reales.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClear}
                className="gap-1.5 text-xs whitespace-nowrap shadow-sm"
              >
                <span>Vaciar Datos y Empezar de Cero</span>
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-background/60 border">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Restaurar Ejemplos Demo</p>
                <p className="text-[11px] text-muted-foreground max-w-lg">
                  Si deseas volver a explorar el sistema con datos de ejemplo (Copec, Sodimac, Adobe, Créditos bancarios, etc.).
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetToDemo();
                  alert('Datos de prueba restaurados.');
                }}
                className="gap-1.5 text-xs whitespace-nowrap"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Cargar Ejemplos Demo</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Guía de Conexión a Base de Datos Supabase */}
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/20 dark:bg-blue-950/10">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm text-blue-900 dark:text-blue-300 flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              <span>Base de Datos PostgreSQL (Supabase)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Para persistir tus datos permanentemente en la nube y compartirlos con tu equipo contable.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Pasos para activar tu base de datos:</p>
              <ol className="list-decimal pl-4 space-y-1.5 text-muted-foreground text-[11px]">
                <li>
                  Ingresa a tu proyecto en <strong className="text-foreground">supabase.com</strong> y ve a la sección <strong className="text-foreground">SQL Editor</strong>.
                </li>
                <li>
                  Crea una nueva consulta (<strong className="text-foreground">New Query</strong>), copia el archivo <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">supabase/schema.sql</code> de este repositorio y presiona <strong className="text-foreground">Run</strong>.
                </li>
                <li>
                  Copia tu <strong className="text-foreground">Project URL</strong> y <strong className="text-foreground">anon / public key</strong> de Supabase e ingrésalas en las variables de entorno de Vercel como <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">NEXT_PUBLIC_SUPABASE_URL</code> y <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Parámetros Regionales */}
        <Card>
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-600" />
              <span>Configuración Regional y Fiscal (Chile)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Moneda Principal</Label>
              <Input value="CLP (Pesos Chilenos - $)" disabled className="bg-muted font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tasa de Impuesto (IVA)</Label>
              <Input value="19% (Chile General)" disabled className="bg-muted font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Formato de Fecha</Label>
              <Input value="DD/MM/YYYY (Chile)" disabled className="bg-muted font-mono" />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
