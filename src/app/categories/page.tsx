'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useReceipts } from '@/lib/store/receipts-context';
import { Tags, Plus, Check, Briefcase, User, Sparkles } from 'lucide-react';

export default function CategoriesPage() {
  const { categories, addCategory } = useReceipts();
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'business' | 'personal' | 'both'>('business');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');

  const businessCategories = categories.filter((c) => c.type === 'business' || c.type === 'both');
  const personalCategories = categories.filter((c) => c.type === 'personal' || c.type === 'both');

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    addCategory({
      name: newCatName.trim(),
      type: newCatType,
      color: newCatColor,
      is_active: true,
      is_system: false,
    });

    setNewCatName('');
  };

  return (
    <AppLayout
      title="Gestión de Categorías"
      description="Administra y personaliza las categorías y reglas automáticas de clasificación para gastos de empresa y personales."
    >
      <div className="space-y-6">
        {/* Formulario de Nueva Categoría */}
        <Card>
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              <span>Crear Nueva Categoría</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleCreateCategory} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Nombre de la Categoría</Label>
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Ej: Licencias de Diseño o Gimnasio"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Ámbito de Gasto</Label>
                <select
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value as any)}
                  className="h-10 w-full px-3 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="business">Empresa</option>
                  <option value="personal">Personal</option>
                  <option value="both">Ambos Ámbitos</option>
                </select>
              </div>

              <Button type="submit" size="sm" className="gap-1.5 text-xs">
                <Plus className="h-4 w-4" />
                <span>Agregar Categoría</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Listado de Categorías Divididas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Categorías Empresariales */}
          <Card>
            <CardHeader className="py-4 border-b bg-blue-50/30 dark:bg-blue-950/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">Gastos de Empresa</CardTitle>
                  <CardDescription className="text-xs">{businessCategories.length} categorías activas</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 divide-y">
              {businessCategories.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: c.color || '#3B82F6' }}
                    />
                    <span className="font-medium text-foreground">{c.name}</span>
                  </div>
                  {c.is_system && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Sistema
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Categorías Personales */}
          <Card>
            <CardHeader className="py-4 border-b bg-emerald-50/30 dark:bg-emerald-950/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">Gastos Personales</CardTitle>
                  <CardDescription className="text-xs">{personalCategories.length} categorías activas</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 divide-y">
              {personalCategories.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: c.color || '#10B981' }}
                    />
                    <span className="font-medium text-foreground">{c.name}</span>
                  </div>
                  {c.is_system && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Sistema
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
