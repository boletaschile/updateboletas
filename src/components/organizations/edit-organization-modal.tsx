'use client';

import React, { useState, useEffect } from 'react';
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
import { Organization } from '@/types';
import { Building2, User, Save, Trash2, AlertCircle } from 'lucide-react';

interface EditOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: Organization | null;
}

export function EditOrganizationModal({
  isOpen,
  onClose,
  organization,
}: EditOrganizationModalProps) {
  const { updateOrganization, deleteOrganization, organizations } = useAuth();

  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const [legalName, setLegalName] = useState('');
  const [orgType, setOrgType] = useState<'business' | 'personal'>('personal');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name || '');
      setRut(organization.rut || '');
      setLegalName(organization.legal_name || '');
      setOrgType(organization.type || 'business');
      setShowDeleteConfirm(false);
    }
  }, [organization, isOpen]);

  if (!organization) return null;

  const isRutValid = rut ? validateRUT(rut) : true;
  const canDelete = organizations.length > 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (rut && !validateRUT(rut)) return;

    updateOrganization(organization.id, {
      name: name.trim(),
      rut: rut ? formatRUT(rut) : null,
      legal_name: legalName.trim() || name.trim(),
      type: orgType,
    });

    onClose();
  };

  const handleDelete = () => {
    if (!canDelete) return;
    deleteOrganization(organization.id);
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
                ? 'Editar Perfil de Persona Natural'
                : 'Editar Perfil de Empresa'}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {orgType === 'personal'
              ? 'Modifica los datos personales y RUT para la separación contable de gastos.'
              : 'Actualiza la razón social, RUT y nombre de tu empresa para la emisión y registro de boletas.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {/* Selector de Tipo */}
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
                  placeholder="Ej: Javier González"
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
                  placeholder="Ej: 15.678.901-2"
                  className={rut && !isRutValid ? 'border-red-500 text-xs' : 'text-xs'}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Alias o Descripción del Perfil (Opcional)</Label>
                <Input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Ej: Finanzas Personales Javier"
                  className="text-xs"
                />
              </div>
            </>
          ) : (
            /* Campos para Empresa */
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nombre de Fantasía o Comercial</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Webunica Chile"
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
                  placeholder="Ej: 76.371.864-6"
                  className={rut && !isRutValid ? 'border-red-500 text-xs' : 'text-xs'}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Razón Social Completa</Label>
                <Input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Ej: Webunica Chile EIRL"
                  className="text-xs"
                />
              </div>
            </>
          )}

          {showDeleteConfirm && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="font-semibold text-xs">¿Estás seguro de eliminar este perfil?</span>
              </div>
              <p className="text-[11px] text-red-700 dark:text-red-300">
                Esta acción no se puede deshacer. Se desvinculará de la lista de entidades activas.
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="text-xs h-7"
                  onClick={handleDelete}
                >
                  Confirmar Eliminación
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              {canDelete && !showDeleteConfirm && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar Perfil</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
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
                <Save className="h-4 w-4" />
                <span>Guardar Cambios</span>
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
