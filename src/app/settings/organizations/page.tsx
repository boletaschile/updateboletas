'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/store/auth-context';
import { NewOrganizationModal } from '@/components/organizations/new-organization-modal';
import { EditOrganizationModal } from '@/components/organizations/edit-organization-modal';
import { AssignSalaryModal } from '@/components/payroll/assign-salary-modal';
import { formatCLP } from '@/lib/utils';
import { UserRole, Organization } from '@/types';
import {
  Building2,
  User,
  Users,
  Plus,
  Mail,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  UserPlus,
  Briefcase,
  Pencil,
} from 'lucide-react';

export default function OrganizationsManagementPage() {
  const { organizations, members, inviteMember, removeMember, activeOrgId, setActiveOrgId } = useAuth();
  const [isNewOrgModalOpen, setIsNewOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [salaryModalOrgId, setSalaryModalOrgId] = useState<string | null>(null);

  // Estados para invitar miembro
  const [selectedOrgIdForInvite, setSelectedOrgIdForInvite] = useState<string>(
    organizations[1]?.id || organizations[0]?.id || ''
  );
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('member');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedOrgIdForInvite) return;

    inviteMember(selectedOrgIdForInvite, inviteEmail.trim(), inviteRole);
    setInviteEmail('');
    setInviteSuccess(true);
    setTimeout(() => setInviteSuccess(false), 3000);
  };

  return (
    <AppLayout
      title="Empresas, Perfiles y Equipo"
      description="Gestiona múltiples razones sociales, perfiles de gasto personales e invita colaboradores con roles."
    >
      <div className="space-y-6">
        {/* Cabecera y Botón Nueva Empresa */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card">
          <div>
            <h2 className="font-bold text-sm text-foreground">Tus Entidades Registradas</h2>
            <p className="text-xs text-muted-foreground">
              Tienes {organizations.length} empresa(s) o perfil(es) configurados en tu cuenta.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setIsNewOrgModalOpen(true)}
            className="gap-1.5 text-xs shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Empresa o Perfil</span>
          </Button>
        </div>

        {/* Listado de Empresas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organizations.map((org) => {
            const orgMembers = members[org.id] || [];
            const isActive = activeOrgId === org.id;

            return (
              <Card
                key={org.id}
                className={`transition-all ${
                  isActive
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/10 dark:bg-blue-950/20'
                    : 'hover:border-border/80'
                }`}
              >
                <CardHeader className="py-4 border-b flex flex-row items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        org.type === 'personal'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      }`}
                    >
                      {org.type === 'personal' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm truncate">{org.name}</CardTitle>
                      <CardDescription className="text-[11px] font-mono">
                        {org.rut ? `RUT: ${org.rut}` : 'Persona Natural'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingOrg(org)}
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      title="Editar datos de este perfil"
                    >
                      <Pencil className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                    <Badge
                      variant={org.type === 'personal' ? 'success' : 'info'}
                      className="text-[10px]"
                    >
                      {org.type === 'personal' ? 'Personal' : 'Empresa'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3 text-xs">
                  {org.legal_name && (
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                        {org.type === 'personal' ? 'Nombre Completo / Alias' : 'Razón Social'}
                      </span>
                      <p className="text-xs text-foreground truncate">{org.legal_name}</p>
                    </div>
                  )}

                  {/* Sueldo Asignado y Gastos Mensuales (Perfil Empresa) */}
                  {org.type === 'business' && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-border/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-muted-foreground flex items-center gap-1">
                          <Briefcase className="h-3 w-3 text-blue-600" />
                          <span>Sueldo Asignado Dueño:</span>
                        </span>
                        <span className="font-bold text-blue-700 dark:text-blue-300">
                          {org.assigned_salary ? formatCLP(org.assigned_salary) : 'No configurado'}
                        </span>
                      </div>

                      {org.team_salaries && org.team_salaries.length > 0 && (
                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/60">
                          <span className="font-semibold text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3 text-emerald-600" />
                            <span>Nómina Equipo ({org.team_salaries.length}):</span>
                          </span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-300">
                            {formatCLP(org.team_salaries.reduce((sum, item) => sum + (item.amount || 0), 0))}
                          </span>
                        </div>
                      )}

                      {org.monthly_expenses && (
                        <div className="pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground space-y-1">
                          <span className="font-semibold uppercase tracking-wider block text-[9px] text-muted-foreground">
                            Gastos Fijos Mensuales Base
                          </span>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                            {org.monthly_expenses.rent ? (
                              <div className="flex justify-between">
                                <span>Arriendo:</span>
                                <span className="font-medium text-foreground">{formatCLP(org.monthly_expenses.rent)}</span>
                              </div>
                            ) : null}
                            {org.monthly_expenses.internet ? (
                              <div className="flex justify-between">
                                <span>Internet:</span>
                                <span className="font-medium text-foreground">{formatCLP(org.monthly_expenses.internet)}</span>
                              </div>
                            ) : null}
                            {org.monthly_expenses.mobile ? (
                              <div className="flex justify-between">
                                <span>Móvil:</span>
                                <span className="font-medium text-foreground">{formatCLP(org.monthly_expenses.mobile)}</span>
                              </div>
                            ) : null}
                            {org.monthly_expenses.electricity ? (
                              <div className="flex justify-between">
                                <span>Luz:</span>
                                <span className="font-medium text-foreground">{formatCLP(org.monthly_expenses.electricity)}</span>
                              </div>
                            ) : null}
                            {org.monthly_expenses.water ? (
                              <div className="flex justify-between">
                                <span>Agua:</span>
                                <span className="font-medium text-foreground">{formatCLP(org.monthly_expenses.water)}</span>
                              </div>
                            ) : null}
                            {org.monthly_expenses.other_fixed ? (
                              <div className="flex justify-between">
                                <span>Otros:</span>
                                <span className="font-medium text-foreground">{formatCLP(org.monthly_expenses.other_fixed)}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {org.type === 'business' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSalaryModalOrgId(org.id)}
                      className="w-full text-xs gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      <Briefcase className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Gestionar Sueldos & Nómina</span>
                    </Button>
                  )}

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold mb-1">
                      Equipo y Colaboradores ({orgMembers.length || 1})
                    </span>
                    <div className="space-y-1">
                      {orgMembers.length > 0 ? (
                        orgMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-muted/40 text-[11px]"
                          >
                            <span className="truncate">{m.email}</span>
                            <Badge variant="outline" className="text-[9px] capitalize">
                              {m.role === 'owner'
                                ? 'Propietario'
                                : m.role === 'admin'
                                ? 'Contador / Admin'
                                : 'Miembro'}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground">1 usuario (Tú)</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isActive ? 'default' : 'outline'}
                      onClick={() => setActiveOrgId(org.id)}
                      className="flex-1 text-xs"
                    >
                      {isActive ? 'Empresa Seleccionada Actualmente' : 'Cambiar a esta Empresa'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingOrg(org)}
                      className="text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground"
                      title="Editar perfil"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Sección Invitar Colaborador por Correo */}
        <Card>
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-blue-600" />
              <span>Invitar Miembro o Contador por Correo Electrónico</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Otorga acceso a contadores o socios para subir, revisar y descargar boletas de una empresa específica.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">Empresa Destino</Label>
                <select
                  value={selectedOrgIdForInvite}
                  onChange={(e) => setSelectedOrgIdForInvite(e.target.value)}
                  className="h-10 w-full px-3 rounded-lg border border-input bg-background text-xs"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.type === 'business' ? 'Empresa' : 'Personal'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Correo del Invitado</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="ej: contador@estudiochile.cl"
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Rol Asignado</Label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="h-10 w-full px-3 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="member">Miembro (Subir y Ver)</option>
                  <option value="admin">Administrador / Contador</option>
                  <option value="viewer">Solo Lectura (Auditor)</option>
                </select>
              </div>

              <div className="sm:col-span-4 flex items-center justify-between pt-2">
                {inviteSuccess && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>¡Invitación enviada por correo exitosamente!</span>
                  </span>
                )}
                <Button type="submit" size="sm" className="ml-auto gap-1.5 text-xs">
                  <Mail className="h-3.5 w-3.5" />
                  <span>Enviar Invitación</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <NewOrganizationModal
        isOpen={isNewOrgModalOpen}
        onClose={() => setIsNewOrgModalOpen(false)}
      />

      <EditOrganizationModal
        isOpen={!!editingOrg}
        onClose={() => setEditingOrg(null)}
        organization={editingOrg}
      />

      <AssignSalaryModal
        isOpen={Boolean(salaryModalOrgId)}
        onClose={() => setSalaryModalOrgId(null)}
        targetOrgId={salaryModalOrgId || undefined}
      />
    </AppLayout>
  );
}
