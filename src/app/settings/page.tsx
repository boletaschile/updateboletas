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
  const { resetToDemo, receipts } = useReceipts();

  return (
    <AppLayout
      title="Configuración del Sistema"
      description="Ajustes de perfil, organización, claves de entorno y preferencias regionales."
    >
      <div className="max-w-4xl space-y-6">
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

        {/* Estado de Seguridad y Base de Datos */}
        <Card>
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              <span>Infraestructura y Seguridad</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-semibold text-foreground">Row Level Security (RLS)</p>
                  <p className="text-[11px] text-muted-foreground">Aislamiento total por usuario y organización activo en Supabase</p>
                </div>
              </div>
              <Badge variant="success">Activo</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-semibold text-foreground">OpenAI Structured Outputs</p>
                  <p className="text-[11px] text-muted-foreground">Validación estricta con esquemas Zod en formato JSON</p>
                </div>
              </div>
              <Badge variant="success">Configurado</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Zona de Demostración y Datos de Prueba */}
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/20 dark:bg-amber-950/10">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              <span>Datos de Demostración y Reinicio</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Actualmente hay {receipts.length} boletas cargadas en el almacenamiento local.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Restaurar los 8 ejemplos realistas de boletas</p>
              <p className="text-[11px] text-muted-foreground">
                Recupera las boletas de supermercado, combustible Copec, Adobe, Sodimac mixta, descuento y boleta ilegible.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetToDemo();
                alert('Datos de prueba restaurados exitosamente.');
              }}
              className="border-amber-400 text-amber-900 dark:text-amber-200 hover:bg-amber-100 gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Restaurar Datos Demo</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
