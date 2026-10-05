'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, Organization, OrganizationMember, UserRole, MonthlyFixedExpenses, EmployeeSalaryItem } from '@/types';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { ensureUUID } from '@/lib/supabase/db-service';

interface AuthContextType {
  user: Profile | null;
  organizations: Organization[];
  activeOrgId: string; // 'all' o un id de organization
  activeOrg: Organization | null;
  members: Record<string, OrganizationMember[]>; // orgId -> members
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  register: (data: {
    email: string;
    fullName: string;
    accountType: 'personal' | 'business' | 'both';
    companyName?: string;
    companyRut?: string;
    password?: string;
  }) => Promise<boolean>;
  logout: () => void;
  setActiveOrgId: (id: string) => void;
  createOrganization: (data: {
    name: string;
    rut?: string;
    legal_name?: string;
    type: 'business' | 'personal';
    assigned_salary?: number | null;
    team_salaries?: EmployeeSalaryItem[] | null;
    monthly_expenses?: MonthlyFixedExpenses | null;
  }) => Organization;
  updateOrganization: (
    id: string,
    data: {
      name: string;
      rut?: string | null;
      legal_name?: string | null;
      type?: 'business' | 'personal';
      assigned_salary?: number | null;
      team_salaries?: EmployeeSalaryItem[] | null;
      monthly_expenses?: MonthlyFixedExpenses | null;
    }
  ) => void;
  deleteOrganization: (id: string) => boolean;
  inviteMember: (orgId: string, email: string, role: UserRole) => void;
  removeMember: (orgId: string, memberId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'subeboletas_auth_user_v1';
const STORAGE_KEY_ORGS = 'subeboletas_auth_orgs_v1';
const STORAGE_KEY_ACTIVE_ORG = 'subeboletas_auth_active_org_v1';
const STORAGE_KEY_MEMBERS = 'subeboletas_auth_members_v1';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>('all');
  const [members, setMembers] = useState<Record<string, OrganizationMember[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Cargar de LocalStorage y sincronizar con Supabase Auth
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      const savedOrgs = localStorage.getItem(STORAGE_KEY_ORGS);
      const savedActiveOrg = localStorage.getItem(STORAGE_KEY_ACTIVE_ORG);
      const savedMembers = localStorage.getItem(STORAGE_KEY_MEMBERS);

      if (savedUser) {
        setUser(JSON.parse(savedUser));
      } else {
        setUser(null);
      }

      if (savedOrgs) {
        const parsedOrgs: Organization[] = JSON.parse(savedOrgs);
        setOrganizations(parsedOrgs);
        if (savedActiveOrg && savedActiveOrg !== 'all' && parsedOrgs.some((o) => o.id === savedActiveOrg)) {
          setActiveOrgId(savedActiveOrg);
        } else if (parsedOrgs.length > 0) {
          const defaultBiz = parsedOrgs.find((o) => o.type === 'business');
          setActiveOrgId(defaultBiz ? defaultBiz.id : parsedOrgs[0].id);
        }
      } else {
        setOrganizations([]);
      }

      if (savedMembers) setMembers(JSON.parse(savedMembers));

      // Sincronizar usuario activo y organizaciones de Supabase (controlado por login)
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseBrowserClient();
        supabase.auth.getUser().then(async ({ data: { user: supaUser } }) => {
          if (supaUser) {
            const userProfile: Profile = {
              id: supaUser.id,
              email: supaUser.email || '',
              full_name: (supaUser.user_metadata?.full_name as string) || supaUser.email?.split('@')[0] || 'Usuario',
              avatar_url: null,
              preferred_currency: 'CLP',
              date_format: 'DD/MM/YYYY',
              created_at: supaUser.created_at,
              updated_at: supaUser.updated_at || supaUser.created_at,
            };
            setUser(userProfile);

            // Cargar organizaciones guardadas en la nube asociadas a este login
            let cloudOrgs = supaUser.user_metadata?.organizations as Organization[] | undefined;

            if (cloudOrgs && Array.isArray(cloudOrgs) && cloudOrgs.length > 0) {
              setOrganizations(cloudOrgs);
              const defaultBiz = cloudOrgs.find((o) => o.type === 'business');
              setActiveOrgId(defaultBiz ? defaultBiz.id : cloudOrgs[0].id);
            } else {
              // Si no tiene organizaciones en la nube aún, crearlas inteligentemente
              const isWebunica = supaUser.email?.includes('webunica');
              const defaultBizId = isWebunica ? 'd5e5b678-4d44-4ba3-b763-a68d43fd8679' : ensureUUID();
              const defaultBizName = isWebunica ? 'Webunica Chile' : 'Mi Empresa SpA';

              const initialOrgs: Organization[] = [
                {
                  id: defaultBizId,
                  name: defaultBizName,
                  legal_name: isWebunica ? 'Webunica Chile SpA' : defaultBizName,
                  rut: isWebunica ? '77.123.456-7' : null,
                  type: 'business',
                  created_by: supaUser.id,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  members_count: 1,
                  assigned_salary: isWebunica ? 800000 : null,
                  monthly_expenses: isWebunica
                    ? {
                        assigned_salary: 800000,
                        rent: 0,
                        internet: 25000,
                        mobile: 0,
                        electricity: 0,
                        water: 0,
                        other_fixed: 0,
                      }
                    : null,
                },
                {
                  id: ensureUUID(),
                  name: 'Finanzas Personales',
                  legal_name: userProfile.full_name,
                  rut: null,
                  type: 'personal',
                  created_by: supaUser.id,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  members_count: 1,
                },
              ];

              setOrganizations(initialOrgs);
              setActiveOrgId(defaultBizId);

              // Guardar en Supabase Auth user_metadata para persistencia entre dominios/dispositivos
              await supabase.auth.updateUser({
                data: { organizations: initialOrgs },
              }).catch(() => {});
            }
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Error cargando estado de Auth:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Guardar en LocalStorage
  useEffect(() => {
    if (isLoading) return;
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
      }
      localStorage.setItem(STORAGE_KEY_ORGS, JSON.stringify(organizations));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ORG, activeOrgId);
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
    } catch (e) {
      console.warn('Error persistiendo estado de Auth:', e);
    }
  }, [user, organizations, activeOrgId, members, isLoading]);

  const activeOrg = activeOrgId === 'all' ? null : organizations.find((o) => o.id === activeOrgId) || null;

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    let userId = ensureUUID();
    const namePart = cleanEmail.split('@')[0];
    const fullName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    let remoteOrgs: Organization[] | null = null;

    if (isSupabaseConfigured()) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        const resData = await res.json();

        if (res.ok && resData.session) {
          const supabase = getSupabaseBrowserClient();
          await supabase.auth.setSession(resData.session);
          if (resData.user?.id) userId = resData.user.id;
          if (
            resData.user?.user_metadata?.organizations &&
            Array.isArray(resData.user.user_metadata.organizations) &&
            resData.user.user_metadata.organizations.length > 0
          ) {
            remoteOrgs = resData.user.user_metadata.organizations;
          }
        } else {
          // Respaldo directo en cliente si el endpoint falla
          const supabase = getSupabaseBrowserClient();
          const { data: authData } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: password || 'BoletasChile2026!',
          });
          if (authData?.user) {
            userId = authData.user.id;
            if (authData.user.user_metadata?.organizations) {
              remoteOrgs = authData.user.user_metadata.organizations;
            }
          }
        }
      } catch (err) {
        console.warn('Supabase auth login error:', err);
      }
    }

    const loggedUser: Profile = {
      id: userId,
      email: cleanEmail,
      full_name: fullName,
      avatar_url: null,
      preferred_currency: 'CLP',
      date_format: 'DD/MM/YYYY',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setUser(loggedUser);

    let finalOrgs: Organization[] = [];
    if (remoteOrgs && remoteOrgs.length > 0) {
      finalOrgs = remoteOrgs;
    } else {
      const isWebunica = cleanEmail.includes('webunica');
      const companyId = isWebunica ? 'd5e5b678-4d44-4ba3-b763-a68d43fd8679' : ensureUUID();
      const companyName = isWebunica ? 'Webunica Chile' : 'Mi Empresa SpA';

      finalOrgs = [
        {
          id: companyId,
          name: companyName,
          rut: isWebunica ? '77.123.456-7' : null,
          legal_name: isWebunica ? 'Webunica Chile SpA' : companyName,
          type: 'business',
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          members_count: 1,
          assigned_salary: isWebunica ? 800000 : null,
          monthly_expenses: isWebunica
            ? {
                assigned_salary: 800000,
                rent: 0,
                internet: 25000,
                mobile: 0,
                electricity: 0,
                water: 0,
                other_fixed: 0,
              }
            : null,
        },
        {
          id: ensureUUID(),
          name: 'Finanzas Personales',
          rut: null,
          legal_name: fullName,
          type: 'personal',
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          members_count: 1,
        },
      ];

      // Sincronizar en la nube
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseBrowserClient();
        supabase.auth.updateUser({ data: { organizations: finalOrgs } }).catch(() => {});
      }
    }

    setOrganizations(finalOrgs);
    const defaultBiz = finalOrgs.find((o) => o.type === 'business');
    setActiveOrgId(defaultBiz ? defaultBiz.id : finalOrgs[0].id);

    setIsLoading(false);
    return true;
  };

  const register = async (data: {
    email: string;
    fullName: string;
    accountType: 'personal' | 'business' | 'both';
    companyName?: string;
    companyRut?: string;
    password?: string;
  }) => {
    setIsLoading(true);
    const cleanEmail = data.email.trim().toLowerCase();
    let newUserId = ensureUUID();

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: signUpData } = await supabase.auth.signUp({
          email: cleanEmail,
          password: data.password || 'BoletasChile2026!',
          options: {
            data: { full_name: data.fullName.trim() },
          },
        });
        if (signUpData?.user) {
          newUserId = signUpData.user.id;
        }
      } catch (err) {
        console.warn('Supabase auth register error:', err);
      }
    }

    const newUser: Profile = {
      id: newUserId,
      email: cleanEmail,
      full_name: data.fullName.trim(),
      avatar_url: null,
      preferred_currency: 'CLP',
      date_format: 'DD/MM/YYYY',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newOrgs: Organization[] = [
      {
        id: ensureUUID(),
        name: 'Gastos Personales',
        rut: null,
        legal_name: data.fullName,
        type: 'personal',
        created_by: newUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        members_count: 1,
      },
    ];

    if (data.accountType === 'business' || data.accountType === 'both') {
      newOrgs.push({
        id: ensureUUID(),
        name: data.companyName || 'Mi Empresa SpA',
        rut: data.companyRut || null,
        legal_name: data.companyName || 'Mi Empresa SpA',
        type: 'business',
        created_by: newUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        members_count: 1,
      });
    }

    setUser(newUser);
    setOrganizations(newOrgs);
    setActiveOrgId('all');
    setIsLoading(false);
    return true;
  };

  const logout = () => {
    setUser(null);
    setOrganizations([]);
    setActiveOrgId('all');
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_ORGS);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_ORG);
    localStorage.removeItem(STORAGE_KEY_MEMBERS);
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseBrowserClient();
        supabase.auth.signOut().catch(() => {});
      } catch (e) {}
    }
    window.location.href = '/login';
  };

  const createOrganization = (data: {
    name: string;
    rut?: string;
    legal_name?: string;
    type: 'business' | 'personal';
    assigned_salary?: number | null;
    monthly_expenses?: MonthlyFixedExpenses | null;
  }) => {
    const newOrg: Organization = {
      id: ensureUUID(),
      name: data.name.trim(),
      rut: data.rut?.trim() || null,
      legal_name: data.legal_name?.trim() || data.name.trim(),
      type: data.type,
      assigned_salary: data.assigned_salary ?? null,
      monthly_expenses: data.monthly_expenses ?? null,
      created_by: user?.id || ensureUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      members_count: 1,
    };

    const updated = [...organizations, newOrg];
    setOrganizations(updated);
    setActiveOrgId(newOrg.id);
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.updateUser({ data: { organizations: updated } }).catch(() => {});
    }
    return newOrg;
  };

  const updateOrganization = (
    id: string,
    data: {
      name: string;
      rut?: string | null;
      legal_name?: string | null;
      type?: 'business' | 'personal';
      assigned_salary?: number | null;
      team_salaries?: EmployeeSalaryItem[] | null;
      monthly_expenses?: MonthlyFixedExpenses | null;
    }
  ) => {
    const updated = organizations.map((org) => {
      if (org.id !== id) return org;
      return {
        ...org,
        name: data.name.trim(),
        rut: data.rut !== undefined ? (data.rut ? data.rut.trim() : null) : org.rut,
        legal_name:
          data.legal_name !== undefined
            ? (data.legal_name ? data.legal_name.trim() : data.name.trim())
            : org.legal_name,
        type: data.type || org.type,
        assigned_salary: data.assigned_salary !== undefined ? data.assigned_salary : org.assigned_salary,
        team_salaries: data.team_salaries !== undefined ? data.team_salaries : org.team_salaries,
        monthly_expenses: data.monthly_expenses !== undefined ? data.monthly_expenses : org.monthly_expenses,
        updated_at: new Date().toISOString(),
      };
    });

    setOrganizations(updated);
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.updateUser({ data: { organizations: updated } }).catch(() => {});
    }
  };

  const deleteOrganization = (id: string): boolean => {
    if (organizations.length <= 1) return false;
    const updated = organizations.filter((o) => o.id !== id);
    setOrganizations(updated);
    if (activeOrgId === id) {
      const remaining = organizations.filter((o) => o.id !== id);
      setActiveOrgId(remaining[0]?.id || 'all');
    }
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.updateUser({ data: { organizations: updated } }).catch(() => {});
    }
    return true;
  };

  const inviteMember = (orgId: string, email: string, role: UserRole) => {
    const newMember: OrganizationMember = {
      id: `m-${Date.now()}`,
      organization_id: orgId,
      user_id: `invited-${Date.now()}`,
      email: email.trim().toLowerCase(),
      full_name: email.split('@')[0],
      role: role,
      created_at: new Date().toISOString(),
    };

    setMembers((prev) => ({
      ...prev,
      [orgId]: [...(prev[orgId] || []), newMember],
    }));

    setOrganizations((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, members_count: (o.members_count || 1) + 1 } : o))
    );
  };

  const removeMember = (orgId: string, memberId: string) => {
    setMembers((prev) => ({
      ...prev,
      [orgId]: (prev[orgId] || []).filter((m) => m.id !== memberId),
    }));

    setOrganizations((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, members_count: Math.max(1, (o.members_count || 1) - 1) } : o))
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        activeOrgId,
        activeOrg,
        members,
        isLoading,
        login,
        register,
        logout,
        setActiveOrgId,
        createOrganization,
        updateOrganization,
        deleteOrganization,
        inviteMember,
        removeMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return context;
}
