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
import { useAuth } from '@/lib/store/auth-context';
import { validateRUT, formatRUT } from '@/lib/utils';
import { Building2, User, Plus } from 'lucide-react';

interface NewOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewOrganizationModal({
  isOpen,
  onClose,
}: NewOrganizationModalProps) {
  const { createOrganization } = useAuth();

  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const [legalName, setLegalName] = useState('');
  const [orgType, setOrgType] = useState<'business' | 'personal'>('personal');

  const isRutValid = rut ? validateRUT(rut) : true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (rut && !validateRUT(rut)) return;

    createOrganization({
      name: name.trim(),
      rut: rut ? formatRUT(rut) : undefined,
      legal_name: legalName.trim() || name.trim(),
      type: orgType,
    });

    setName('');
    setRut('');
    setLegalName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {orgType === 'personal' ? (
              <User className="h-5 w-5 text-emerald-600" />
            ) : (
              <Building2 className="h-5 w-5 text-blue-600" />
            )}
            <span>
              {orgType === 'personal'
                ? 'Crear Perfil de Persona Natural'
                : 'Crear Nueva Empresa'}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {orgType === 'personal'
              ? 'Registra una persona con su nombre y RUT para gestionar gastos particulares y separar la contabilidad.'
              : 'Agrega una nueva entidad jurídica, SpA, EIRL o Ltda para deducir gastos e IVA.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tipo de Entidad</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrgType('business')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  orgType === 'business'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold shadow-sm'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <span className="block text-xs">Empresa (SpA / Ltda / EIRL)</span>
                <span className="text-[10px] text-muted-foreground font-normal">Gastos deducibles e IVA</span>
              </button>

              <button
                type="button"
                onClick={() => setOrgType('personal')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  orgType === 'personal'
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold shadow-sm'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <span className="block text-xs">Persona Natural</span>
                <span className="text-[10px] text-muted-foreground font-normal">Gastos particulares</span>
              </button>
            </div>
          </div>

          {orgType === 'personal' ? (
            /* Campos para Persona Natural */
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nombre Completo de la Persona</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Juan Pérez González"
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">RUT de la Persona</Label>
                  {rut && !isRutValid && (
                    <span className="text-[10px] text-red-600 font-semibold">RUT chileno no válido</span>
                  )}
                </div>
                <Input
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  onBlur={(e) => setRut(formatRUT(e.target.value))}
                  placeholder="Ej: 12.345.678-9"
                  className={rut && !isRutValid ? 'border-red-500 text-xs' : 'text-xs'}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Alias o Descripción del Perfil (Opcional)</Label>
                <Input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Ej: Gastos Personales Juan"
                  className="text-xs"
                />
              </div>
            </>
          ) : (
            /* Campos para Empresa */
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nombre de la Empresa o Fantasía</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Inversiones del Valle SpA"
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">RUT de la Empresa</Label>
                  {rut && !isRutValid && (
                    <span className="text-[10px] text-red-600 font-semibold">RUT chileno no válido</span>
                  )}
                </div>
                <Input
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  onBlur={(e) => setRut(formatRUT(e.target.value))}
                  placeholder="Ej: 76.123.456-7"
                  className={rut && !isRutValid ? 'border-red-500 text-xs' : 'text-xs'}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Razón Social Completa</Label>
                <Input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Ej: Comercial e Inversiones del Valle SpA"
                  className="text-xs"
                />
              </div>
            </>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || (!!rut && !isRutValid)}
              className={
                orgType === 'personal'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5'
                  : 'bg-blue-600 hover:bg-blue-700 text-white gap-1.5'
              }
            >
              <Plus className="h-4 w-4" />
              <span>
                {orgType === 'personal'
                  ? 'Crear y Cambiar a este Perfil'
                  : 'Crear y Cambiar a esta Empresa'}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
