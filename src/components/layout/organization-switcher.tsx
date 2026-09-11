'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/store/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NewOrganizationModal } from '@/components/organizations/new-organization-modal';
import {
  Building2,
  User,
  ChevronDown,
  Plus,
  Check,
  Globe,
  Layers,
} from 'lucide-react';

export function OrganizationSwitcher() {
  const { organizations, activeOrgId, setActiveOrgId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeOrg = organizations.find((o) => o.id === activeOrgId);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-2.5 rounded-xl border bg-card hover:bg-muted/50 transition-all text-left shadow-sm group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center flex-shrink-0">
              {activeOrgId === 'all' ? (
                <Globe className="h-4 w-4" />
              ) : activeOrg?.type === 'personal' ? (
                <User className="h-4 w-4 text-emerald-600" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-foreground block truncate">
                {activeOrgId === 'all'
                  ? 'Vista Consolidada (Todas)'
                  : activeOrg?.name || 'Seleccionar Perfil'}
              </span>
              <span className="text-[10px] text-muted-foreground block truncate">
                {activeOrgId === 'all'
                  ? 'Todas las empresas'
                  : activeOrg?.rut
                  ? `RUT: ${activeOrg.rut}`
                  : activeOrg?.type === 'personal'
                  ? 'Persona Natural'
                  : 'Empresa'}
              </span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 ml-1" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-0 top-full mt-1.5 w-72 rounded-xl border bg-card p-1.5 shadow-xl z-50 text-xs space-y-1">
              <div className="px-2 py-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                Seleccionar Empresa o Cuenta
              </div>

              {/* Vista Consolidada */}
              <button
                type="button"
                onClick={() => {
                  setActiveOrgId('all');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                  activeOrgId === 'all'
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span>Vista Consolidada (Todas)</span>
                </div>
                {activeOrgId === 'all' && <Check className="h-3.5 w-3.5 text-blue-600" />}
              </button>

              <div className="h-px bg-border my-1" />

              {/* Listado de Organizaciones */}
              {organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => {
                    setActiveOrgId(org.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left ${
                    activeOrgId === org.id
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {org.type === 'personal' ? (
                      <User className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Building2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                    <div className="truncate">
                      <p className="truncate leading-tight">{org.name}</p>
                      {org.rut && (
                        <p className="text-[10px] text-muted-foreground font-mono">{org.rut}</p>
                      )}
                    </div>
                  </div>
                  {activeOrgId === org.id && <Check className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />}
                </button>
              ))}

              <div className="h-px bg-border my-1" />

              {/* Botón Crear Nueva Organización */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsModalOpen(true);
                }}
                className="w-full flex items-center gap-2 p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-medium transition-colors text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Crear Nueva Empresa o Perfil</span>
              </button>
            </div>
          </>
        )}
      </div>

      <NewOrganizationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
